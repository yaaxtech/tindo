import { Card } from './ui';

/**
 * Abertura do painel: quem faz o quê, em duas linhas. A divisão de papéis é
 * decisão do dono, não leitura do ledger — por isso é texto fixo, e a
 * configuração real por terreno (titular, fallback, esforço) fica no bloco
 * Terrenos logo abaixo. O aviso do rodapé é o que impede leitura errada:
 * o que está declarado na configuração não prova o que rodou de fato, e o
 * ledger só confirma quando o registro de execução está completo.
 */
export function Resumo() {
  return (
    <Card className="flex flex-col gap-3">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-bold text-jade-accent">Claude</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
            Orquestra o trabalho, planeja, faz o frontend e revisa o que o Codex entrega.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-bold text-jade-accent">Codex</dt>
          <dd className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
            Executa as tarefas despachadas e revisa o que o Claude entrega.
          </dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-text-muted">
        Divisão decidida pelo dono. A configuração declarada por terreno não confirma o modelo
        executado. A confirmação do modelo usado depende de registros completos de execução.
      </p>
    </Card>
  );
}
