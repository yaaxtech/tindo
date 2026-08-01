import { describe, expect, it } from 'vitest';
import { ROTAS_PUBLICAS, ROTAS_TECNICAS, classificarAcessoRota, ehRotaRoadMapMind } from './routes';

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
