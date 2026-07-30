'use client';

// RoadMapMind — shell da tela: orquestra editor (BlockNote) + mapa (React Flow),
// 3 modos de visualização (Documento / Lado a lado / Mapa) com divisor arrastável,
// persistência (autosave + Salvar) e a trava de tarefas pai/filhas.
// Fatia 4: mapa em visualização + sincronia. Edição pelo mapa chega na Fatia 5.

import './roadmapmind.css';

import {
  type BlocoBN,
  type DocEspelho,
  blocosParaLinhas,
  linhasParaBlocos,
} from '@/services/doc-markdown';
import type { DocLinha } from '@/types/doc';
import type { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { pt } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from './Editor';
import MenuDocumentos from './MenuDocumentos';
import Mindmap, { CORES_NIVEL, extrairTexto, RAIZ_ID } from './Mindmap';
import { useDocStore } from './useDocStore';

type Status = 'carregando' | 'ok' | 'salvando' | 'erro';

const ROTULOS: Record<Status, string> = {
  carregando: 'Carregando…',
  ok: '✓ Sincronizado',
  salvando: 'Salvando…',
  erro: 'Erro ao salvar',
};

// ---- helpers de tarefa (operam sobre a árvore de blocos do BlockNote) --------
function acharBloco(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const achado = acharBloco(b.children ?? [], id);
    if (achado) return achado;
  }
  return null;
}

function filhasAbertas(block: Block): number {
  let n = 0;
  for (const child of block.children ?? []) {
    if (child.type === 'checkListItem' && child.props.checked === false) n += 1;
    n += filhasAbertas(child);
  }
  return n;
}

function fecharSubarvore(editor: BlockNoteEditor, block: Block): void {
  if (block.type === 'checkListItem' && block.props.checked === false) {
    editor.updateBlock(block, { props: { checked: true } });
  }
  for (const child of block.children ?? []) fecharSubarvore(editor, child);
}

function snapshotChecks(blocks: Block[], acc: Map<string, boolean>): Map<string, boolean> {
  for (const b of blocks) {
    if (b.type === 'checkListItem') acc.set(b.id, b.props.checked === true);
    snapshotChecks(b.children ?? [], acc);
  }
  return acc;
}

// espelhos não contam: a tarefa é UMA só, mesmo aparecendo em várias mães
function contarTarefas(blocks: Block[], ignorar?: Set<string>): { total: number; feitas: number } {
  let total = 0;
  let feitas = 0;
  for (const b of blocks) {
    if (b.type === 'checkListItem' && !ignorar?.has(b.id)) {
      total += 1;
      if (b.props.checked === true) feitas += 1;
    }
    const sub = contarTarefas(b.children ?? [], ignorar);
    total += sub.total;
    feitas += sub.feitas;
  }
  return { total, feitas };
}

function snapshotTextos(blocks: Block[], acc: Map<string, string>): Map<string, string> {
  for (const b of blocks) {
    acc.set(b.id, extrairTexto(b));
    snapshotTextos(b.children ?? [], acc);
  }
  return acc;
}

// clona um bloco PRESERVANDO os ids (o id do bloco = id da linha no banco;
// mover não pode trocar identidade — contrato da Fase 3)
function clonarComIds(b: Block): PartialBlock {
  return {
    id: b.id,
    // biome-ignore lint/suspicious/noExplicitAny: idem
    type: b.type as any,
    // biome-ignore lint/suspicious/noExplicitAny: idem
    props: b.props as any,
    content: b.content as PartialBlock['content'],
    children: (b.children ?? []).map(clonarComIds),
  };
}

// rgba(r, g, b, a) → #rrggbb (pro input type=color do painel 🎨)
function rgbaParaHex(rgba: string): string {
  const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#888888';
  const hex = (s: string) => Number(s).toString(16).padStart(2, '0');
  return `#${hex(m[1] ?? '136')}${hex(m[2] ?? '136')}${hex(m[3] ?? '136')}`;
}

export default function RoadMapMind() {
  const editor = useCreateBlockNote({ dictionary: pt });
  const [raizId, setRaizId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('RoadMapMind');
  const [status, setStatus] = useState<Status>('carregando');
  const [modoNumeros, setModoNumeros] = useState(false);
  const [dobradas, setDobradas] = useState<Set<string>>(new Set());
  const [copiado, setCopiado] = useState(false);
  const [progresso, setProgresso] = useState({ total: 0, feitas: 0 });
  const [aviso, setAviso] = useState<{ blockId: string; abertas: number } | null>(null);
  const [painelCores, setPainelCores] = useState(false);
  const [doc, setDoc] = useState<Block[]>([]);
  const [editarNoId, setEditarNoId] = useState<string | null>(null); // nó novo abre pra nomear
  const [confirmarExclusao, setConfirmarExclusao] = useState<{
    id: string;
    texto: string;
    dentro: number;
  } | null>(null);
  const [erroMapa, setErroMapa] = useState<string | null>(null);
  // espelhos: espelhoBlockId -> linhaOriginalId (ref é a fonte no onChange)
  const espelhosRef = useRef<Map<string, string>>(new Map());
  const [espelhos, setEspelhos] = useState<Map<string, string>>(new Map());
  const textosRef = useRef<Map<string, string>>(new Map());
  const [avisoEspelhos, setAvisoEspelhos] = useState<{
    id: string;
    texto: string;
    espelhoIds: string[];
  } | null>(null);
  // no celular o menu nasce fechado (um painel por vez); só client (ssr:false)
  // menu de documentos: 'auto' = aberto no desktop e fechado no celular, via
  // CSS media query (no mount o innerWidth ainda vem 0 — não dá pra medir aqui)
  const [menuEstado, setMenuEstado] = useState<'auto' | 'aberto' | 'fechado'>('auto');
  const alternarMenu = useCallback(() => {
    setMenuEstado((e) => {
      if (e === 'aberto') return 'fechado';
      if (e === 'fechado') return 'aberto';
      // no clique a largura já é real: inverte o que o 'auto' está mostrando
      return window.matchMedia('(max-width: 767px)').matches ? 'aberto' : 'fechado';
    });
  }, []);
  const [tema, setTema] = useState<'dark' | 'light'>(() =>
    typeof localStorage !== 'undefined' && localStorage.getItem('rmm-tema') === 'light'
      ? 'light'
      : 'dark',
  );
  const [telaCheia, setTelaCheia] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const carregado = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checksRef = useRef<Map<string, boolean>>(new Map());
  const revertendo = useRef(false);
  const arrastando = useRef(false);

  const modo = useDocStore((s) => s.modo);
  const setModo = useDocStore((s) => s.setModo);
  const larguraEditor = useDocStore((s) => s.larguraEditor);
  const setLarguraEditor = useDocStore((s) => s.setLarguraEditor);
  const orientacao = useDocStore((s) => s.orientacao);
  const alternarOrientacao = useDocStore((s) => s.alternarOrientacao);
  const focoEdicao = useDocStore((s) => s.focoEdicao);
  const alternarFocoEdicao = useDocStore((s) => s.alternarFocoEdicao);
  const focoId = useDocStore((s) => s.focoId);
  const setFocoId = useDocStore((s) => s.setFocoId);
  const cursorId = useDocStore((s) => s.cursorId);
  const setCursorId = useDocStore((s) => s.setCursorId);
  const coresCustom = useDocStore((s) => s.coresCustom);
  const setCoresCustom = useDocStore((s) => s.setCoresCustom);

  const agendarSalvar = useCallback((fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, 800);
  }, []);

  const atualizarCursor = useCallback(() => {
    try {
      setCursorId(editor.getTextCursorPosition().block.id);
    } catch {
      // sem cursor (ex.: replaceBlocks) — ignora
    }
  }, [editor, setCursorId]);

  // carregar o documento do usuário (garante a raiz no servidor)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/docs');
        const data = await res.json();
        if (!vivo) return;
        if (!res.ok) throw new Error(data?.erro ?? 'Falha ao carregar');
        setRaizId(data.raiz.id);
        if (data.raiz.textoMd) setTitulo(data.raiz.textoMd);
        const listaEspelhos = (data.espelhos ?? []) as DocEspelho[];
        espelhosRef.current = new Map(listaEspelhos.map((e) => [e.id, e.linhaId]));
        setEspelhos(new Map(espelhosRef.current));
        const blocos = linhasParaBlocos(
          (data.linhas ?? []) as DocLinha[],
          data.raiz.id,
          listaEspelhos,
        );
        if (blocos.length > 0) {
          editor.replaceBlocks(editor.document, blocos as unknown as PartialBlock[]);
        }
        checksRef.current = snapshotChecks(editor.document, new Map());
        textosRef.current = snapshotTextos(editor.document, new Map());
        setProgresso(contarTarefas(editor.document, new Set(espelhosRef.current.keys())));
        setDoc(editor.document);
        carregado.current = true;
        setStatus('ok');
      } catch {
        if (vivo) setStatus('erro');
      }
    })();
    return () => {
      vivo = false;
    };
  }, [editor]);

  const salvar = useCallback(async () => {
    if (!raizId) return;
    setStatus('salvando');
    try {
      const linhas = blocosParaLinhas(
        editor.document as unknown as BlocoBN[],
        raizId,
        new Set(espelhosRef.current.keys()),
      );
      const res = await fetch('/api/docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raizId, linhas }),
      });
      setStatus(res.ok ? 'ok' : 'erro');
    } catch {
      setStatus('erro');
    }
  }, [editor, raizId]);

  // a cada mudança: trava pai/filhas (reverte marca se houver filha aberta) +
  // espelha o doc pro mapa + autosave
  const onChange = useCallback(() => {
    if (revertendo.current || !carregado.current) return;
    const documento = editor.document;
    const atual = snapshotChecks(documento, new Map());
    for (const [id, checked] of atual) {
      if (checksRef.current.get(id) === false && checked === true) {
        const block = acharBloco(documento, id);
        if (block) {
          const abertas = filhasAbertas(block);
          if (abertas > 0) {
            revertendo.current = true;
            editor.updateBlock(block, { props: { checked: false } });
            revertendo.current = false;
            atual.set(id, false);
            setAviso({ blockId: id, abertas });
          }
        }
      }
    }
    const checksAntes = checksRef.current;
    checksRef.current = atual;

    // ESPELHOS: quem mudou propaga texto E check pro par (a linha é "uma só");
    // espelho que SUMIU do documento é removido no servidor
    if (espelhosRef.current.size > 0) {
      const antes = textosRef.current;
      let mudouMapa = false;
      for (const [espId, origId] of espelhosRef.current) {
        const esp = acharBloco(editor.document, espId);
        const orig = acharBloco(editor.document, origId);
        if (!esp) {
          // usuário apagou a linha-espelho no editor → remove só o espelho
          espelhosRef.current.delete(espId);
          mudouMapa = true;
          void fetch('/api/docs/espelhos', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: espId }),
          });
          continue;
        }
        if (!orig) continue; // original sumiu: o aviso é tratado na exclusão
        // check: quem mudou arrasta o par
        if (esp.type === 'checkListItem' && orig.type === 'checkListItem') {
          const cEsp = esp.props.checked === true;
          const cOrig = orig.props.checked === true;
          if (cEsp !== cOrig) {
            revertendo.current = true;
            if (cEsp !== (checksAntes.get(espId) ?? false)) {
              editor.updateBlock(orig, { props: { checked: cEsp } });
              checksRef.current.set(origId, cEsp);
            } else {
              editor.updateBlock(esp, { props: { checked: cOrig } });
              checksRef.current.set(espId, cOrig);
            }
            revertendo.current = false;
          }
        }
        const tEsp = extrairTexto(esp);
        const tOrig = extrairTexto(orig);
        if (tEsp === tOrig) continue;
        revertendo.current = true;
        if (tEsp !== (antes.get(espId) ?? '')) {
          editor.updateBlock(orig, { content: tEsp }); // editou no espelho → original acompanha
        } else if (tOrig !== (antes.get(origId) ?? '')) {
          editor.updateBlock(esp, { content: tOrig }); // editou no original → espelho acompanha
        }
        revertendo.current = false;
      }
      if (mudouMapa) setEspelhos(new Map(espelhosRef.current));
    }
    textosRef.current = snapshotTextos(editor.document, new Map());

    setProgresso(contarTarefas(editor.document, new Set(espelhosRef.current.keys())));
    setDoc(editor.document);
    atualizarCursor();
    agendarSalvar(() => void salvar());
  }, [editor, salvar, agendarSalvar, atualizarCursor]);

  // "Concluir tudo": fecha a subárvore inteira e marca o pai
  const confirmarFechamento = useCallback(() => {
    if (!aviso) return;
    const block = acharBloco(editor.document, aviso.blockId);
    if (block) {
      revertendo.current = true;
      fecharSubarvore(editor, block);
      editor.updateBlock(block, { props: { checked: true } });
      revertendo.current = false;
      checksRef.current = snapshotChecks(editor.document, new Map());
      setProgresso(contarTarefas(editor.document, new Set(espelhosRef.current.keys())));
      setDoc(editor.document);
      void salvar();
    }
    setAviso(null);
  }, [aviso, editor, salvar]);

  const copiarMarkdown = useCallback(async () => {
    const md = await editor.blocksToMarkdownLossy(editor.document);
    try {
      await navigator.clipboard.writeText(md);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard bloqueado — ignora */
    }
  }, [editor]);

  const colarMarkdown = useCallback(async () => {
    try {
      const md = await navigator.clipboard.readText();
      if (!md.trim()) return;
      const blocos = await editor.tryParseMarkdownToBlocks(md);
      editor.replaceBlocks(editor.document, blocos);
      setDoc(editor.document);
      await salvar();
    } catch {
      setStatus('erro');
    }
  }, [editor, salvar]);

  // clicar na faixa do marcador (~26px) de uma linha com filhos = dobra/expande
  const aoClicarNoDoc = useCallback((e: React.MouseEvent) => {
    const alvo = (e.target as HTMLElement).closest('.bn-block-content') as HTMLElement | null;
    if (!alvo) return;
    const outer = alvo.closest('.bn-block-outer') as HTMLElement | null;
    const id = outer?.getAttribute('data-id');
    if (!id) return;
    if (e.clientX - alvo.getBoundingClientRect().left > 26) return;
    const temFilhos = outer?.querySelector(':scope > .bn-block > .bn-block-group') !== null;
    if (!temFilhos) return;
    e.preventDefault();
    e.stopPropagation();
    setDobradas((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);

  // mapa → editor: clicar num nó leva o cursor à linha correspondente
  const aoClicarNo = useCallback(
    (id: string) => {
      try {
        editor.setTextCursorPosition(id, 'end');
        setCursorId(id);
        document
          .querySelector(`[data-id="${id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        // nó pode ter sumido entre render e clique — ignora
      }
    },
    [editor, setCursorId],
  );

  // marcar/desmarcar tarefa PELO MAPA (a trava pai/filhas roda aqui também)
  const aoToggleTarefa = useCallback(
    (id: string) => {
      const block = acharBloco(editor.document, id);
      if (!block || block.type !== 'checkListItem') return;
      const marcar = block.props.checked !== true;
      if (marcar) {
        const abertas = filhasAbertas(block);
        if (abertas > 0) {
          setAviso({ blockId: id, abertas });
          return;
        }
      }
      editor.updateBlock(block, { props: { checked: marcar } });
    },
    [editor],
  );

  // deep-link: /docs?doc=<uuid> abre focado; navegar pelo menu atualiza a URL
  useEffect(() => {
    setFocoId(searchParams.get('doc'));
  }, [searchParams, setFocoId]);

  const aoFocar = useCallback(
    (id: string | null) => {
      setFocoId(id); // resposta imediata; o <Link> atualiza a URL em paralelo
    },
    [setFocoId],
  );

  // toast de erro do mapa some sozinho
  useEffect(() => {
    if (!erroMapa) return;
    const t = setTimeout(() => setErroMapa(null), 3000);
    return () => clearTimeout(t);
  }, [erroMapa]);

  // ---- edição PELO MAPA (Fatia 5): tudo muta o editor (ids preservados) e
  // ---- persiste pelo autosave do onChange — escrita única via /api/docs.

  // construir a partir do mapa: cria uma filha e já abre pra nomear
  const aoAdicionarFilho = useCallback(
    (id: string) => {
      if (id === RAIZ_ID) {
        // filha da raiz = linha nova de primeiro nível no fim do documento
        const ultimo = editor.document[editor.document.length - 1];
        if (!ultimo) return;
        const inseridos = editor.insertBlocks(
          [{ type: 'bulletListItem', content: 'nova linha' }],
          ultimo,
          'after',
        );
        if (inseridos[0]) setEditarNoId(inseridos[0].id);
        return;
      }
      const block = acharBloco(editor.document, id);
      if (!block) return;
      const filhosAtuais = (block.children ?? []) as PartialBlock[];
      editor.updateBlock(block, {
        children: [...filhosAtuais, { type: 'bulletListItem', content: 'nova linha' }],
      });
      const atualizado = acharBloco(editor.document, id);
      const novo = atualizado?.children?.[atualizado.children.length - 1];
      if (novo) {
        editor.setTextCursorPosition(novo.id, 'end');
        setCursorId(novo.id);
        setEditarNoId(novo.id);
        document
          .querySelector(`[data-id="${novo.id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    [editor, setCursorId],
  );

  // irmã: linha nova no MESMO nível, logo depois do nó
  const aoAdicionarIrma = useCallback(
    (id: string) => {
      if (id === RAIZ_ID) return;
      const block = acharBloco(editor.document, id);
      if (!block) return;
      const inseridos = editor.insertBlocks(
        [{ type: 'bulletListItem', content: 'nova linha' }],
        block,
        'after',
      );
      const novo = inseridos[0];
      if (novo) {
        editor.setTextCursorPosition(novo.id, 'end');
        setCursorId(novo.id);
        setEditarNoId(novo.id);
      }
    },
    [editor, setCursorId],
  );

  // excluir a partir do mapa (com confirmação quando leva descendentes junto)
  const executarExclusao = useCallback(
    (id: string) => {
      const block = acharBloco(editor.document, id);
      if (!block) return;
      editor.removeBlocks([id]);
    },
    [editor],
  );

  const aoExcluir = useCallback(
    (id: string) => {
      const block = acharBloco(editor.document, id);
      if (!block) return;
      // se for um bloco-espelho, apagar só desfaz o reflexo
      if (espelhosRef.current.has(id)) {
        editor.removeBlocks([id]); // o onChange detecta e chama o DELETE
        return;
      }
      // linha original que TEM espelhos: aviso com opções
      const meus = [...espelhosRef.current.entries()]
        .filter(([, orig]) => orig === id)
        .map(([espId]) => espId);
      if (meus.length > 0) {
        setAvisoEspelhos({ id, texto: extrairTexto(block), espelhoIds: meus });
        return;
      }
      const dentro = (block.children ?? []).length;
      if (dentro > 0) {
        setConfirmarExclusao({ id, texto: extrairTexto(block), dentro });
        return;
      }
      executarExclusao(id);
    },
    [editor, executarExclusao],
  );

  // "Apagar tudo" do aviso de espelhos: some a linha e todos os reflexos
  const excluirComEspelhos = useCallback(() => {
    if (!avisoEspelhos) return;
    for (const espId of avisoEspelhos.espelhoIds) {
      espelhosRef.current.delete(espId);
      void fetch('/api/docs/espelhos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: espId }),
      });
      const bloco = acharBloco(editor.document, espId);
      if (bloco) editor.removeBlocks([espId]);
    }
    setEspelhos(new Map(espelhosRef.current));
    executarExclusao(avisoEspelhos.id);
    setAvisoEspelhos(null);
  }, [avisoEspelhos, editor, executarExclusao]);

  const aoRenomear = useCallback(
    (id: string, texto: string) => {
      const block = acharBloco(editor.document, id);
      if (!block || texto.trim() === '' || texto === extrairTexto(block)) return;
      editor.updateBlock(block, { content: texto });
    },
    [editor],
  );

  // arrastar nó no mapa e soltar perto de outro = vira filho dele (id preservado)
  const aoReplugar = useCallback(
    (id: string, novoPaiId: string) => {
      if (id === novoPaiId || id === RAIZ_ID) return;
      const bloco = acharBloco(editor.document, id);
      if (!bloco) return;
      if (novoPaiId !== RAIZ_ID && acharBloco([bloco], novoPaiId)) {
        setErroMapa('Não dá para mover um item para dentro dele mesmo.');
        return;
      }
      const copia = clonarComIds(bloco);
      if (novoPaiId === RAIZ_ID) {
        // virar item de primeiro nível: vai pro fim do documento
        editor.removeBlocks([id]);
        const ultimo = editor.document[editor.document.length - 1];
        if (!ultimo) return;
        editor.insertBlocks([copia], ultimo, 'after');
        return;
      }
      editor.removeBlocks([id]);
      const novoPai = acharBloco(editor.document, novoPaiId);
      if (!novoPai) return;
      editor.updateBlock(novoPai, {
        children: [...((novoPai.children ?? []) as PartialBlock[]), copia],
      });
    },
    [editor],
  );

  // duplicar documento (menu lateral): cópia SEM ids — o BlockNote gera novos
  const aoDuplicar = useCallback(
    (id: string) => {
      const b = acharBloco(editor.document, id);
      if (!b) return;
      const semIds = (x: Block): PartialBlock => {
        const { id: _descartado, ...resto } = clonarComIds(x);
        return { ...resto, children: (x.children ?? []).map(semIds) };
      };
      editor.insertBlocks([semIds(b)], b, 'after');
    },
    [editor],
  );

  // mover documento no menu (arrastar sobre outro): vira irmã logo após o alvo,
  // com ids preservados
  const aoMoverDoc = useCallback(
    (id: string, alvoId: string) => {
      if (id === alvoId) return;
      const b = acharBloco(editor.document, id);
      const alvo = acharBloco(editor.document, alvoId);
      if (!b || !alvo) return;
      if (acharBloco([b], alvoId)) {
        setErroMapa('Não dá para mover um item para dentro dele mesmo.');
        return;
      }
      const copia = clonarComIds(b);
      editor.removeBlocks([id]);
      const alvoAtual = acharBloco(editor.document, alvoId);
      if (alvoAtual) editor.insertBlocks([copia], alvoAtual, 'after');
    },
    [editor],
  );

  // Alt + arrastar no mapa: cria um ESPELHO da linha sob a nova mãe
  const aoEspelhar = useCallback(
    (id: string, novaMaeId: string) => {
      if (id === RAIZ_ID || novaMaeId === RAIZ_ID || id === novaMaeId) return;
      if (espelhosRef.current.has(id)) return; // espelho de espelho não existe
      const orig = acharBloco(editor.document, id);
      const mae = acharBloco(editor.document, novaMaeId);
      if (!orig || !mae) return;
      if (acharBloco([orig], novaMaeId)) {
        setErroMapa('Não dá para espelhar um item dentro dele mesmo.');
        return;
      }
      // duplicidade exata (mesma linha na mesma mãe) é barrada pelo unique do banco
      void (async () => {
        try {
          const res = await fetch('/api/docs/espelhos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linhaId: id, maeId: novaMaeId, ordem: 'zz' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.erro ?? 'Falha ao espelhar');
          const esp = data.espelho as DocEspelho;
          espelhosRef.current.set(esp.id, esp.linhaId);
          setEspelhos(new Map(espelhosRef.current));
          const maeAtual = acharBloco(editor.document, novaMaeId);
          if (maeAtual) {
            editor.updateBlock(maeAtual, {
              children: [
                ...((maeAtual.children ?? []) as PartialBlock[]),
                {
                  id: esp.id,
                  // biome-ignore lint/suspicious/noExplicitAny: união discriminada do BlockNote
                  type: orig.type as any,
                  // biome-ignore lint/suspicious/noExplicitAny: idem
                  props: orig.props as any,
                  content: extrairTexto(orig),
                },
              ],
            });
          }
        } catch (e) {
          setErroMapa(e instanceof Error ? e.message : 'Falha ao espelhar');
        }
      })();
    },
    [editor],
  );

  // divisor arrastável (modo lado a lado)
  useEffect(() => {
    const mover = (e: MouseEvent) => {
      if (!arrastando.current) return;
      const pct = Math.min(80, Math.max(20, (e.clientX / window.innerWidth) * 100));
      setLarguraEditor(pct);
    };
    const soltar = () => {
      arrastando.current = false;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
    return () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
    };
  }, [setLarguraEditor]);

  const alternarTema = useCallback(() => {
    setTema((t) => {
      const novo = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('rmm-tema', novo);
      } catch {
        /* storage indisponível — só não persiste */
      }
      return novo;
    });
  }, []);

  // documento sem NENHUMA linha de conteúdo = empty state com CTA
  const docVazio =
    doc.filter((b) => extrairTexto(b).trim() !== '' || (b.children?.length ?? 0) > 0).length === 0;

  // foco de documento: só vale se a linha ainda existe (senão cai pra raiz)
  const focoBloco = focoId ? acharBloco(doc, focoId) : null;
  const focoTexto = focoBloco ? extrairTexto(focoBloco) : null;

  const cores = coresCustom ?? CORES_NIVEL;
  // cores custom viram variáveis CSS das guias do editor
  const estiloCores = coresCustom
    ? (Object.fromEntries(
        coresCustom.map((c, i) => [`--guia-n${i + 1}`, c]),
      ) as React.CSSProperties)
    : undefined;

  return (
    <div
      className={`rmm-root rmm-tema-${tema} rmm-menu-${menuEstado} ${focoBloco ? 'rmm-foco' : ''} ${telaCheia ? 'rmm-tela-cheia' : ''}`}
      data-modo={modo}
      style={estiloCores}
    >
      {/* foco de documento: isola a subárvore também no editor — os ancestrais
          somem e os níveis internos sobem de hierarquia (recuo zerado) */}
      {focoBloco && (
        <style>{`
          .rmm-foco .bn-editor > .bn-block-group > .bn-block-outer:not([data-id="${focoBloco.id}"]):not(:has([data-id="${focoBloco.id}"])) { display: none; }
          .rmm-foco .bn-block-outer:has([data-id="${focoBloco.id}"]) .bn-block-outer:not([data-id="${focoBloco.id}"]):not(:has([data-id="${focoBloco.id}"])):not([data-id="${focoBloco.id}"] .bn-block-outer) { display: none; }
          .rmm-foco .bn-block-outer:not([data-id="${focoBloco.id}"]):has([data-id="${focoBloco.id}"]) > .bn-block > .bn-block-content { display: none; }
          .rmm-foco .bn-block-group:has([data-id="${focoBloco.id}"]) { margin-left: 0 !important; padding-left: 0 !important; }
          .rmm-foco .bn-block-group:has([data-id="${focoBloco.id}"])::before { display: none !important; }
          .rmm-foco .bn-block-outer[data-id="${focoBloco.id}"] > .bn-block > .bn-block-content { display: none; }
          .rmm-foco .bn-block-outer[data-id="${focoBloco.id}"] > .bn-block > .bn-block-group { margin-left: 0 !important; padding-left: 0 !important; }
          .rmm-foco .bn-block-outer[data-id="${focoBloco.id}"] > .bn-block > .bn-block-group::before { display: none !important; }
        `}</style>
      )}
      <header className="rmm-topbar">
        <button
          type="button"
          className="rmm-icone"
          title="Menu de documentos"
          onClick={alternarMenu}
        >
          ☰
        </button>
        <span className="rmm-brand">RoadMapMind</span>
        {focoTexto && <span className="rmm-chip-foco">📂 {focoTexto}</span>}
        {progresso.total > 0 && (
          <span className="rmm-chip" title="Tarefas concluídas / total">
            ✓ {progresso.feitas}/{progresso.total}
          </span>
        )}
        <div className="rmm-modos">
          <button
            type="button"
            className={modo === 'doc' ? 'ativo' : ''}
            onClick={() => setModo('doc')}
          >
            ▤ Documento
          </button>
          <button
            type="button"
            className={modo === 'split' ? 'ativo' : ''}
            onClick={() => setModo('split')}
          >
            ◫ Lado a lado
          </button>
          <button
            type="button"
            className={modo === 'mapa' ? 'ativo' : ''}
            onClick={() => setModo('mapa')}
          >
            ⿻ Mapa
          </button>
        </div>
        <div className="rmm-actions">
          <button
            type="button"
            className={modoNumeros ? 'ativo' : ''}
            onClick={() => setModoNumeros((m) => !m)}
          >
            {modoNumeros ? '• Marcadores' : '1.1 Números'}
          </button>
          <button
            type="button"
            className={painelCores ? 'ativo' : ''}
            onClick={() => setPainelCores((p) => !p)}
          >
            🎨 Cores
          </button>
          <button type="button" onClick={() => void copiarMarkdown()}>
            {copiado ? '✓ Copiado' : '⧉ Markdown'}
          </button>
          <button type="button" onClick={() => void colarMarkdown()}>
            ↧ Colar
          </button>
          <button
            type="button"
            title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={alternarTema}
          >
            {tema === 'dark' ? '☀︎' : '☾'}
          </button>
          <button
            type="button"
            className={telaCheia ? 'ativo' : ''}
            title={telaCheia ? 'Sair da tela cheia' : 'Tela cheia (cobre o menu do TinDo)'}
            onClick={() => setTelaCheia((t) => !t)}
          >
            ⛶
          </button>
        </div>
        <span className="rmm-status" data-status={status}>
          {ROTULOS[status]}
        </span>
        <button type="button" className="rmm-btn" onClick={() => void salvar()}>
          Salvar
        </button>
      </header>

      {painelCores && (
        <div className="rmm-cores">
          <span>Cores dos níveis:</span>
          {(coresCustom ?? CORES_NIVEL.map(rgbaParaHex)).map((c, i) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa de 5 níveis
              key={i}
              type="color"
              value={
                coresCustom ? (coresCustom[i] ?? '#888888') : rgbaParaHex(CORES_NIVEL[i] ?? '')
              }
              title={`Nível ${i + 1}`}
              onChange={(e) => {
                const base = coresCustom ?? CORES_NIVEL.map(rgbaParaHex);
                const novas = [...base];
                novas[i] = e.target.value;
                setCoresCustom(novas);
              }}
            />
          ))}
          <button type="button" onClick={() => setCoresCustom(null)}>
            ↺ Automático
          </button>
        </div>
      )}

      {/* linhas dobradas: esconde os filhos e troca o marcador por › */}
      {dobradas.size > 0 && (
        <style>
          {[...dobradas]
            .map(
              (id) => `
              .bn-block-outer[data-id="${id}"] > .bn-block > .bn-block-group { display: none; }
              .bn-block-outer[data-id="${id}"] > .bn-block > .bn-block-content::before {
                content: '›' !important; color: #2caf93 !important; font-weight: 700;
              }`,
            )
            .join('\n')}
        </style>
      )}

      <div className="rmm-corpo">
        {menuEstado !== 'fechado' && (
          <MenuDocumentos
            doc={doc}
            focoId={focoBloco ? focoId : null}
            rotuloRaiz={titulo}
            aoFocar={aoFocar}
            aoRenomear={aoRenomear}
            aoDuplicar={aoDuplicar}
            aoExcluir={aoExcluir}
            aoMover={aoMoverDoc}
          />
        )}

        <div className="rmm-paineis">
          {modo !== 'mapa' && (
            <section
              className="rmm-painel-editor"
              style={modo === 'split' ? { width: `${larguraEditor}%` } : { width: '100%' }}
            >
              <main
                className={`rmm-editor ${modoNumeros ? 'rmm-numeros' : ''}`}
                onClickCapture={aoClicarNoDoc}
              >
                <h1 className="rmm-doc-titulo">{focoTexto ?? titulo}</h1>
                {docVazio && status === 'ok' && (
                  <div className="rmm-vazio">
                    Documento vazio — comece a digitar abaixo, use <strong>↧ Colar</strong> para
                    transformar um markdown em árvore, ou crie nós direto no mapa.
                  </div>
                )}
                <Editor
                  editor={editor}
                  tema={tema}
                  onChange={onChange}
                  onSelectionChange={atualizarCursor}
                />
              </main>
            </section>
          )}

          {modo === 'split' && (
            <div
              className="rmm-divisor"
              role="separator"
              aria-label="Redimensionar painéis"
              tabIndex={0}
              onMouseDown={() => {
                arrastando.current = true;
                document.body.style.cursor = 'col-resize';
              }}
            />
          )}

          {modo !== 'doc' && (
            <section className="rmm-painel-mapa">
              <div className="rmm-mapa-header">
                <span>MINDMAP</span>
                <button
                  type="button"
                  className="rmm-mapa-botao"
                  title="Direção do mapa: horizontal (esquerda→direita) ou vertical (cima→baixo)"
                  onClick={alternarOrientacao}
                >
                  {orientacao === 'horizontal' ? '⇄' : '⇅'}
                </button>
                <button
                  type="button"
                  className={`rmm-mapa-botao ${focoEdicao ? 'ativo' : ''}`}
                  title="Zoom acompanha o nó que você está editando"
                  onClick={alternarFocoEdicao}
                >
                  🎯 foco de edição
                </button>
                {focoBloco && (
                  <button
                    type="button"
                    className="rmm-mapa-foco"
                    onClick={() => {
                      aoFocar(null);
                      router.push('/docs');
                    }}
                  >
                    ✕ sair do foco
                  </button>
                )}
              </div>
              <Mindmap
                doc={doc}
                focoId={focoId}
                cursorId={cursorId}
                cores={cores}
                focoEdicao={focoEdicao}
                orientacao={orientacao}
                rotuloRaiz={titulo}
                editarNoId={editarNoId}
                aoFimEdicaoNo={() => setEditarNoId(null)}
                aoClicarNo={aoClicarNo}
                aoToggleTarefa={aoToggleTarefa}
                aoAdicionarFilho={aoAdicionarFilho}
                aoAdicionarIrma={aoAdicionarIrma}
                aoExcluir={aoExcluir}
                aoRenomear={aoRenomear}
                aoReplugar={aoReplugar}
                aoEspelhar={aoEspelhar}
                espelhos={espelhos}
              />
            </section>
          )}
        </div>
      </div>

      {/* espelhos: marcador ↻ nas linhas-reflexo do editor */}
      {espelhos.size > 0 && (
        <style>
          {[...espelhos.keys()]
            .map(
              (id) => `
              .bn-block-outer[data-id="${id}"] > .bn-block > .bn-block-content::before {
                content: '↻' !important; color: #2caf93 !important; font-weight: 700;
              }`,
            )
            .join('\n')}
        </style>
      )}

      {erroMapa && <div className="rmm-toast">{erroMapa}</div>}

      {avisoEspelhos && (
        // biome-ignore lint/a11y/useSemanticElements: modal custom com backdrop próprio (sem <dialog> nativo)
        <div className="rmm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rmm-modal">
            <h3>
              “{avisoEspelhos.texto}” tem {avisoEspelhos.espelhoIds.length} espelho
              {avisoEspelhos.espelhoIds.length > 1 ? 's' : ''}
            </h3>
            <p>
              Esta linha aparece em outros lugares. Apagar a original apaga também todos os reflexos
              dela.
            </p>
            <div className="rmm-modal-actions">
              <button
                type="button"
                className="rmm-btn-secundario"
                onClick={() => setAvisoEspelhos(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rmm-btn-primario rmm-btn-perigo"
                onClick={excluirComEspelhos}
              >
                Apagar tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarExclusao && (
        // biome-ignore lint/a11y/useSemanticElements: modal custom com backdrop próprio (sem <dialog> nativo)
        <div className="rmm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rmm-modal">
            <h3>Excluir “{confirmarExclusao.texto}”?</h3>
            <p>
              Este item leva junto {confirmarExclusao.dentro} item
              {confirmarExclusao.dentro > 1 ? 's' : ''} de dentro dele.
            </p>
            <div className="rmm-modal-actions">
              <button
                type="button"
                className="rmm-btn-secundario"
                onClick={() => setConfirmarExclusao(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rmm-btn-primario rmm-btn-perigo"
                onClick={() => {
                  executarExclusao(confirmarExclusao.id);
                  setConfirmarExclusao(null);
                }}
              >
                Excluir tudo
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        // biome-ignore lint/a11y/useSemanticElements: modal custom com backdrop próprio (sem <dialog> nativo)
        <div className="rmm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rmm-modal">
            <h3>
              Esta tarefa ainda tem {aviso.abertas} subtarefa{aviso.abertas > 1 ? 's' : ''} aberta
              {aviso.abertas > 1 ? 's' : ''}
            </h3>
            <p>Para concluir a tarefa-mãe, todas as subtarefas precisam estar concluídas.</p>
            <div className="rmm-modal-actions">
              <button type="button" className="rmm-btn-secundario" onClick={() => setAviso(null)}>
                Cancelar
              </button>
              <button type="button" className="rmm-btn-primario" onClick={confirmarFechamento}>
                Concluir tudo ({aviso.abertas + 1})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
