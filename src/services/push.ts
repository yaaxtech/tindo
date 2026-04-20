/**
 * Serviço de Web Push — server-only, edge-compatible.
 * Usa Web Crypto API nativa em vez de `web-push` (Node.js only).
 * NUNCA importar em componentes client.
 */
import {
  type PushSubscription as EdgePushSubscription,
  sendPushNotification,
} from '@/lib/push/webpush-edge';
import { getAdminClient } from '@/lib/supabase/admin';

function getVapidConfig() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error(
      'VAPID keys não configuradas. Defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT.',
    );
  }
  return { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY };
}

export interface PayloadPush {
  titulo: string;
  corpo?: string;
  url?: string;
  tag?: string;
  renotify?: boolean;
}

export async function enviarPush(
  usuarioId: string,
  gatilho: string,
  payload: PayloadPush,
): Promise<{ enviadas: number; falhas: number }> {
  const vapid = getVapidConfig();
  const admin = getAdminClient();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('usuario_id', usuarioId);

  if (!subs || subs.length === 0) return { enviadas: 0, falhas: 0 };

  let enviadas = 0;
  let falhas = 0;

  for (const sub of subs) {
    const subObject: EdgePushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    };
    try {
      const res = await sendPushNotification(subObject, JSON.stringify(payload), vapid);
      if (res.ok || res.status === 201) {
        enviadas++;
        await admin
          .from('push_subscriptions')
          .update({ ultima_usada_em: new Date().toISOString() })
          .eq('id', sub.id);
      } else if (res.status === 410 || res.status === 404) {
        // Subscription expirada — remove
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
        falhas++;
      } else {
        falhas++;
      }
    } catch (_err) {
      falhas++;
    }
  }

  await admin.from('push_envios').insert({
    usuario_id: usuarioId,
    gatilho,
    titulo: payload.titulo,
    corpo: payload.corpo ?? null,
    sucesso: enviadas > 0,
  });

  return { enviadas, falhas };
}

/**
 * Verifica os 3 gatilhos e dispara notificações quando necessário.
 * Chamado pelo cron diário e pelo endpoint /api/push/disparar-gatilhos.
 */
export async function verificarEDispararGatilhos(
  usuarioId: string,
): Promise<Record<string, unknown>> {
  const admin = getAdminClient();
  const { data: cfg } = await admin
    .from('configuracoes')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  // biome-ignore lint/suspicious/noExplicitAny: config row jsonb dinâmico
  const c = cfg as any;
  if (!c?.push_habilitado) return { pulado: 'push_habilitado off' };

  const resultados: Record<string, unknown> = {};

  // 1. Tarefas com prazo hoje
  if (c.push_gatilho_prazo_hoje) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { count } = await admin
      .from('tarefas')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('status', 'pendente')
      .is('deleted_at', null)
      .or(`prazo_conclusao.eq.${hoje},data_vencimento.eq.${hoje}`);
    if (count && count > 0) {
      resultados.prazo = await enviarPush(usuarioId, 'prazo_hoje', {
        titulo: 'Tarefas com prazo hoje',
        corpo: `Você tem ${count} tarefa${count > 1 ? 's' : ''} com prazo para hoje.`,
        url: '/cards',
        tag: 'prazo-hoje',
      });
    }
  }

  // 2. Streak em risco (após 18h sem concluir)
  if (c.push_gatilho_streak_risco) {
    const agora = new Date();
    if (agora.getHours() >= 18) {
      const hoje = agora.toISOString().slice(0, 10);
      const { data: gami } = await admin
        .from('gamificacao')
        .select('streak_atual')
        .eq('usuario_id', usuarioId)
        .maybeSingle();
      const { count: concluidasHoje } = await admin
        .from('historico_acoes')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .eq('acao', 'concluida')
        .gte('created_at', `${hoje}T00:00:00`);

      // biome-ignore lint/suspicious/noExplicitAny: db row
      const streak = (gami as any)?.streak_atual ?? 0;
      if (streak > 0 && (!concluidasHoje || concluidasHoje === 0)) {
        resultados.streak = await enviarPush(usuarioId, 'streak_risco', {
          titulo: 'Seu streak está em risco',
          corpo: `${streak} dia${streak > 1 ? 's' : ''} de streak. Conclua 1 tarefa ainda hoje para manter.`,
          url: '/cards',
          tag: 'streak-risco',
        });
      }
    }
  }

  // 3. Sugestões IA pendentes
  if (c.push_gatilho_sugestoes_ia) {
    const { count } = await admin
      .from('sugestoes_ai')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'sugerir_nova')
      .eq('status', 'pendente');
    if (count && count > 0) {
      resultados.sugestoes = await enviarPush(usuarioId, 'sugestoes_ia', {
        titulo: 'Novas sugestões da IA',
        corpo: `${count} nova${count > 1 ? 's' : ''} sugestão de tarefa te esperam.`,
        url: '/sugestoes',
        tag: 'sugestoes-ia',
      });
    }
  }

  return resultados;
}
