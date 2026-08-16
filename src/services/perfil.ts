import { ErroValidacao } from '@/lib/api/erros';
import type { ContextoAuth } from '@/lib/auth/server';
import { CORES_PERFIL, type CorPerfil, ehCorPerfil } from '@/lib/perfil/cores';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PerfilUsuario {
  nome: string;
  email: string;
  whatsapp: string | null;
  cor: CorPerfil;
}

function db(contexto: ContextoAuth): SupabaseClient {
  return contexto.supabase as unknown as SupabaseClient;
}

function corAleatoria(): CorPerfil {
  return CORES_PERFIL[Math.floor(Math.random() * CORES_PERFIL.length)] ?? CORES_PERFIL[0];
}

async function nomeInicial(contexto: ContextoAuth): Promise<string> {
  const { data } = await contexto.supabase.auth.getUser();
  const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
  const nome = meta.name ?? meta.full_name;
  if (typeof nome === 'string' && nome.trim()) return nome.trim().slice(0, 80);
  return contexto.email?.split('@')[0]?.slice(0, 80) || 'Pessoa';
}

export async function obterPerfil(contexto: ContextoAuth): Promise<PerfilUsuario> {
  const { data, error } = await db(contexto)
    .from('perfis_usuario')
    .select('nome, whatsapp, cor')
    .eq('usuario_id', contexto.usuarioId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;

  if (data) {
    const cor = typeof data.cor === 'string' && ehCorPerfil(data.cor) ? data.cor : CORES_PERFIL[0];
    return {
      nome: String(data.nome),
      email: contexto.email ?? '',
      whatsapp: typeof data.whatsapp === 'string' ? data.whatsapp : null,
      cor,
    };
  }

  const novo = {
    usuario_id: contexto.usuarioId,
    nome: await nomeInicial(contexto),
    whatsapp: null,
    cor: corAleatoria(),
  };
  const { error: erroInsert } = await db(contexto).from('perfis_usuario').insert(novo);
  if (erroInsert) throw erroInsert;
  return { nome: novo.nome, email: contexto.email ?? '', whatsapp: null, cor: novo.cor };
}

export async function atualizarPerfil(
  contexto: ContextoAuth,
  entrada: { nome: string; whatsapp?: string | null; cor: string },
): Promise<PerfilUsuario> {
  const nome = entrada.nome.trim();
  const whatsapp = entrada.whatsapp?.trim() || null;
  const cor = entrada.cor.toUpperCase();
  if (!nome || nome.length > 80) throw new ErroValidacao('Informe um nome com até 80 caracteres.');
  if (whatsapp && whatsapp.length > 30) {
    throw new ErroValidacao('O WhatsApp deve ter até 30 caracteres.');
  }
  if (!ehCorPerfil(cor)) throw new ErroValidacao('Escolha uma cor disponível.');

  const { error } = await db(contexto)
    .from('perfis_usuario')
    .upsert(
      { usuario_id: contexto.usuarioId, nome, whatsapp, cor, deleted_at: null },
      { onConflict: 'usuario_id' },
    );
  if (error) throw error;

  return { nome, email: contexto.email ?? '', whatsapp, cor };
}
