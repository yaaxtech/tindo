// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('fronteira autenticada do RoadMapMind', () => {
  const codigo = readFileSync(join(process.cwd(), 'src/services/doc.ts'), 'utf8');

  it('não usa mais service role nem o usuário fixo', () => {
    expect(codigo).not.toContain('getAdminClient');
    expect(codigo).not.toContain('getUsuarioIdMVP');
    expect(codigo).not.toContain('@/lib/supabase/admin');
  });

  it('executa pelo cliente da sessão e preserva o guard de usuario_id', () => {
    expect(codigo).toContain('contexto.supabase');
    expect(codigo).toContain(".eq('usuario_id', contexto.usuarioId)");
    expect(codigo).toContain('usuario_id: contexto.usuarioId');
  });
});
