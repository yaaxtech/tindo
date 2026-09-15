import { Card } from './ui';

export function Resumo() {
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Cada tipo de tarefa tem um modelo titular e fallbacks definidos. Essa rota é a mesma
        começando pelo Claude ou pelo ChatGPT; se um provedor falhar, o outro assume.
      </p>
      <p className="text-xs leading-relaxed text-text-muted">
        A configuração declarada por terreno não confirma o modelo executado. A confirmação do
        modelo usado depende de registros completos de execução.
      </p>
    </Card>
  );
}
