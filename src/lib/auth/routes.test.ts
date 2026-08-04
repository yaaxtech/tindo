import { describe, expect, it } from 'vitest';
import {
  ROTAS_PUBLICAS,
  ROTAS_TECNICAS,
  classificarAcessoRota,
  ehRotaMultiusuario,
  ehRotaRoadMapMind,
  podeAcessarRotaAutenticada,
} from './routes';

describe('classificarAcessoRota', () => {
  it.each(ROTAS_PUBLICAS)('mantém %s pública', (rota) => {
    expect(classificarAcessoRota(rota)).toBe('publica');
  });

  it.each(ROTAS_TECNICAS)('mantém %s na fronteira técnica', (rota) => {
    expect(classificarAcessoRota(rota)).toBe('tecnica');
  });

  it.each(['/docs', '/cards', '/configuracoes', '/api/docs', '/api/tarefas'])(
    'classifica %s como autenticada',
    (rota) => {
      expect(classificarAcessoRota(rota)).toBe('autenticada');
    },
  );

  it('não torna rotas parecidas públicas por prefixo', () => {
    expect(classificarAcessoRota('/login-falso')).toBe('autenticada');
    expect(classificarAcessoRota('/api/cron/diario/falso')).toBe('autenticada');
  });
});

describe('ehRotaRoadMapMind', () => {
  it.each(['/docs', '/docs/abc', '/api/docs', '/api/docs/espelhos'])(
    'inclui a superfície autenticada %s',
    (rota) => expect(ehRotaRoadMapMind(rota)).toBe(true),
  );

  it.each(['/', '/login', '/api/tarefas', '/documentos', '/api/docs-falso'])(
    'não inclui %s',
    (rota) => expect(ehRotaRoadMapMind(rota)).toBe(false),
  );
});

describe('ehRotaMultiusuario', () => {
  it.each(['/docs', '/api/docs', '/api/perfil', '/harness'])('libera a área isolada %s', (rota) => {
    expect(ehRotaMultiusuario(rota)).toBe(true);
  });

  it.each(['/cards', '/tarefas', '/api/tarefas', '/configuracoes'])(
    'mantém %s como legado do dono',
    (rota) => expect(ehRotaMultiusuario(rota)).toBe(false),
  );
});

describe('podeAcessarRotaAutenticada', () => {
  it('permite RoadMapMind e perfil para uma conta nova', () => {
    const nova = { usuarioId: 'novo', email: 'novo@example.com' };
    expect(podeAcessarRotaAutenticada('/docs', nova, 'dono')).toBe(true);
    expect(podeAcessarRotaAutenticada('/api/perfil', nova, 'dono')).toBe(true);
  });

  it('impede uma conta nova de acessar dados dos módulos legados', () => {
    expect(
      podeAcessarRotaAutenticada(
        '/api/tarefas',
        { usuarioId: 'novo', email: 'novo@example.com' },
        'dono',
      ),
    ).toBe(false);
  });

  it('preserva os módulos legados para a conta original', () => {
    expect(
      podeAcessarRotaAutenticada(
        '/cards',
        { usuarioId: 'dono', email: 'falecomseucamarao@gmail.com' },
        'dono',
      ),
    ).toBe(true);
  });
});
