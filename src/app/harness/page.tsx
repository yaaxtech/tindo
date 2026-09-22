'use client';

import { type Estado, PaginaHarness } from '@/app/harness/_components/PaginaHarness';
import { responderProposta } from '@/app/harness/acoes';
import { getHarnessDadosCru, getRespostasDono, souDonoHarness } from '@/services/harness';
import { useEffect, useState } from 'react';

/** Em desenvolvimento, `?fixture=v2` mostra a página com dados de exemplo. */
async function carregar(): Promise<unknown | null> {
  if (
    process.env.NODE_ENV !== 'production' &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('fixture') === 'v2'
  ) {
    return (await import('./__fixtures__/snapshot-v2.json')).default;
  }
  return getHarnessDadosCru();
}

export default function HarnessPage() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  useEffect(() => {
    let vivo = true;
    carregar()
      .then((d) => vivo && setEstado(d == null ? { tipo: 'vazio' } : { tipo: 'pronto', dados: d }))
      .catch(
        (e: unknown) =>
          vivo && setEstado({ tipo: 'erro', msg: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      vivo = false;
    };
  }, []);

  // Quem é o dono e o que ele já respondeu. Falha aqui não derruba a página:
  // sem sessão, as propostas só mostram o status.
  const [dono, setDono] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, -1 | 1>>({});
  useEffect(() => {
    souDonoHarness()
      .then(setDono)
      .catch(() => setDono(false));
    getRespostasDono()
      .then((rs) =>
        setRespostas(
          Object.fromEntries(
            rs.filter((r) => r.tipo === 'aprovacao').map((r) => [r.alvo_id, r.valor]),
          ),
        ),
      )
      .catch(() => setRespostas({}));
  }, []);

  return (
    <PaginaHarness estado={estado} respostas={{ dono, respostas, responder: responderProposta }} />
  );
}
