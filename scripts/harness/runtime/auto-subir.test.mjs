import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aplicar, avaliar } from './auto-subir.mjs';

const agora = Date.now();
let seq = 0;

function linha(overrides = {}) {
  seq++;
  return {
    ts: new Date(agora - seq * 1_000).toISOString(),
    frente: 'codex',
    modelo: 'sol',
    effort: 'high',
    terreno: 'dificil',
    resultado: 'ok1',
    papel: 'construtor',
    auto: true,
    terreno_inferido: false,
    ...overrides,
  };
}

function defaults() {
  return {
    _meta: { auto_aplicar: true },
    terrenos: {
      dificil: {
        rotulo: 'Código difícil', modelo: 'sol', effort: 'high',
        cadeia_modelo: ['sol'], piso_modelo: 'sol', teto_modelo: 'sol',
        effort_teto: 'high', alvo_ok1: 80, reforco: null,
      },
    },
    codex: {
      terrenos: {
        dificil: {
          modelo: 'sol', effort: 'high', escalada_effort: ['xhigh'],
          orquestrador: 'thread_principal',
        },
      },
    },
  };
}

function preparar(linhas, cfg = defaults()) {
  const dir = mkdtempSync(join(tmpdir(), 'auto-subir-codex-'));
  const ledger = join(dir, 'ledger.jsonl');
  const defaultsFile = join(dir, 'defaults.json');
  const auditFile = join(dir, 'audit.jsonl');
  writeFileSync(ledger, `${linhas.map((r) => JSON.stringify(r)).join('\n')}\n`);
  writeFileSync(defaultsFile, `${JSON.stringify(cfg, null, 2)}\n`);
  return { ledger, defaultsFile, auditFile };
}

test('papel ausente ou inferido deixa a rota Codex sem amostra decisória', async () => {
  const linhas = [
    ...Array.from({ length: 10 }, () => linha({ papel: undefined })),
    ...Array.from({ length: 10 }, () => linha({ papel_inferido: true })),
  ];
  const files = preparar(linhas);
  const resultado = await avaliar({ dias: 7, file: files.ledger, defaultsFile: files.defaultsFile });
  assert.equal(resultado.codex.terrenos[0].n, 0);
  assert.equal(resultado.codex.terrenos[0].estado, 'amostra');
});

test('rota Codex aplica apenas effort permitido e registra trilha própria', async () => {
  const linhas = [
    ...Array.from({ length: 10 }, () => linha({ effort: 'high', resultado: 'ok1' })),
    ...Array.from({ length: 10 }, () => linha({ effort: 'high', resultado: 'retrabalho' })),
    ...Array.from({ length: 20 }, () => linha({ effort: 'xhigh', resultado: 'ok1' })),
  ];
  const files = preparar(linhas);
  const antes = process.env.AUTO_SUBIR_ON;
  process.env.AUTO_SUBIR_ON = '1';
  try {
    const resultado = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(resultado.codex_aplicado.length, 1);
    const depois = JSON.parse(readFileSync(files.defaultsFile, 'utf8'));
    assert.equal(depois.codex.terrenos.dificil.effort, 'xhigh');
    const audit = JSON.parse(readFileSync(files.auditFile, 'utf8').trim().split('\n').at(-1));
    assert.equal(audit.rota, 'codex');
    assert.equal(audit.tipo, 'effort');
    assert.equal(audit.de, 'high');
    assert.equal(audit.para, 'xhigh');
  } finally {
    if (antes === undefined) delete process.env.AUTO_SUBIR_ON;
    else process.env.AUTO_SUBIR_ON = antes;
  }
});

test('19 construções não recomendam nem alteram o effort', async () => {
  const files = preparar(
    Array.from({ length: 19 }, (_, i) => linha({ resultado: i < 8 ? 'ok1' : 'retrabalho' })),
  );
  const antes = process.env.AUTO_SUBIR_ON;
  process.env.AUTO_SUBIR_ON = '1';
  try {
    const aval = await avaliar({ dias: 7, file: files.ledger, defaultsFile: files.defaultsFile });
    assert.equal(aval.codex.propostas.length, 0);
    assert.equal(aval.codex.terrenos[0].estado, 'amostra');
    const resultado = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(resultado.codex_aplicado.length, 0);
    assert.equal(JSON.parse(readFileSync(files.defaultsFile, 'utf8')).codex.terrenos.dificil.effort, 'high');
  } finally {
    if (antes === undefined) delete process.env.AUTO_SUBIR_ON;
    else process.env.AUTO_SUBIR_ON = antes;
  }
});

test('rollback Codex preserva mudança manual e encerra a subida antiga', async () => {
  const subidaTs = new Date(agora - 3_600_000).toISOString();
  const cfg = defaults();
  cfg.codex.terrenos.dificil.effort = 'max';
  const files = preparar(
    Array.from({ length: 20 }, () => linha({ effort: 'max', resultado: 'retrabalho' })),
    cfg,
  );
  writeFileSync(
    files.auditFile,
    `${JSON.stringify({
      ts: subidaTs,
      rota: 'codex',
      terreno: 'dificil',
      acao: 'subiu',
      tipo: 'effort',
      de: 'high',
      para: 'xhigh',
      ok1_antes_pts: 50,
    })}\n`,
  );
  const antes = process.env.AUTO_SUBIR_ON;
  process.env.AUTO_SUBIR_ON = '1';
  try {
    const resultado = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(resultado.codex_revertido.length, 0);
    assert.equal(JSON.parse(readFileSync(files.defaultsFile, 'utf8')).codex.terrenos.dificil.effort, 'max');
    const audit = readFileSync(files.auditFile, 'utf8')
      .trim()
      .split('\n')
      .map((registro) => JSON.parse(registro));
    assert.equal(audit.some((registro) => registro.acao === 'reversao_ignorada'), true);

    const alteradoDepois = JSON.parse(readFileSync(files.defaultsFile, 'utf8'));
    alteradoDepois.codex.terrenos.dificil.effort = 'xhigh';
    writeFileSync(files.defaultsFile, `${JSON.stringify(alteradoDepois, null, 2)}\n`);
    const segundaPassada = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(segundaPassada.codex_revertido.length, 0);
    assert.equal(
      JSON.parse(readFileSync(files.defaultsFile, 'utf8')).codex.terrenos.dificil.effort,
      'xhigh',
    );
    const auditFinal = readFileSync(files.auditFile, 'utf8')
      .trim()
      .split('\n')
      .map((registro) => JSON.parse(registro));
    assert.equal(auditFinal.filter((registro) => registro.acao === 'reversao_ignorada').length, 1);
    assert.equal(auditFinal.some((registro) => registro.acao === 'reverteu'), false);
  } finally {
    if (antes === undefined) delete process.env.AUTO_SUBIR_ON;
    else process.env.AUTO_SUBIR_ON = antes;
  }
});

test('rollback Claude também encerra uma subida superada por mudança manual', async () => {
  const subidaTs = new Date(agora - 3_600_000).toISOString();
  const cfg = defaults();
  cfg.terrenos.dificil.effort = 'max';
  const files = preparar(
    Array.from({ length: 20 }, () => linha({ effort: 'max', resultado: 'retrabalho' })),
    cfg,
  );
  writeFileSync(
    files.auditFile,
    `${JSON.stringify({
      ts: subidaTs,
      rota: 'claude',
      terreno: 'dificil',
      acao: 'subiu',
      tipo: 'effort',
      de: 'high',
      para: 'xhigh',
      ok1_antes_pts: 50,
    })}\n`,
  );
  const antes = process.env.AUTO_SUBIR_ON;
  process.env.AUTO_SUBIR_ON = '1';
  try {
    const primeira = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(primeira.revertido.length, 0);

    const alteradoDepois = JSON.parse(readFileSync(files.defaultsFile, 'utf8'));
    alteradoDepois.terrenos.dificil.effort = 'xhigh';
    writeFileSync(files.defaultsFile, `${JSON.stringify(alteradoDepois, null, 2)}\n`);
    const segunda = await aplicar({
      dias: 7,
      file: files.ledger,
      defaultsFile: files.defaultsFile,
      auditFile: files.auditFile,
    });
    assert.equal(segunda.revertido.length, 0);
    assert.equal(JSON.parse(readFileSync(files.defaultsFile, 'utf8')).terrenos.dificil.effort, 'xhigh');
    const audit = readFileSync(files.auditFile, 'utf8')
      .trim()
      .split('\n')
      .map((registro) => JSON.parse(registro));
    assert.equal(audit.filter((registro) => registro.acao === 'reversao_ignorada').length, 1);
    assert.equal(audit.some((registro) => registro.acao === 'reverteu'), false);
  } finally {
    if (antes === undefined) delete process.env.AUTO_SUBIR_ON;
    else process.env.AUTO_SUBIR_ON = antes;
  }
});
