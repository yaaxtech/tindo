# Harness YaaX: execução, evidência e autorregulação

## Pedido do dono

Corrigir dados do painel, fallbacks fortes entre provedores (inclusive SQL),
adoção dos modelos/efforts configurados e testes A/B/C mensuráveis antes das
trocas definitivas. Arena Agent Pareto por tokens de saída é a referência externa.

## Causas verificadas

- O painel publicava apenas `defaults.terrenos`, sem as rotas Codex.
- A aba A/B/C continha textos estáticos; o sorteador não era chamado pelo executor.
- O executor validava pares fixos, sem consumir mudanças dos defaults.
- Registros manuais explicitamente classificados eram considerados ambíguos.
- Captura da sessão por arquivo mais recente não era segura sob concorrência.
- Mudança de modelo no motor antigo nunca recebia o delta de qualidade; custo
  vinha de constantes, sem medição por experimento.

## Contrato de entrega

1. Fonte operacional local comum: `~/.claude/orquestracao/defaults-terreno.json`.
2. Resolver único para despacho; par efetivamente solicitado e braço registrados.
3. Experimentos configurados com identificador versionado e número arbitrário
   de braços; apenas execuções atribuídas ao teste entram em sua amostra.
4. Promoção automática exige qualidade julgada, tokens e duração completos,
   ao menos 20 amostras por braço, incerteza de não inferioridade limitada a
   5 pontos, economia de pelo menos 20% e tempo não pior. Amostra pequena é
   exibida sem virar decisão. SQL preserva piso forte e fica fora do sorteio.
5. Falta de medição permanece nula. Sessões compartilhadas entre registros
   não têm seus tokens atribuídos a uma tarefa individual.
6. Snapshot público recebe agregados de experimentos, rotas por frente,
   estado do motor e benchmark datado; não recebe prompts, IDs de sessão ou segredos.
7. Publicação horária existente avalia os testes; nenhum novo loop de LLM
   recorrente é necessário. O teste aproveita tarefas já autorizadas.

## Limites

O benchmark externo não mede nossa cota ChatGPT nem determina o melhor effort
local. A ferramenta de resolução escolhe novos despachos, sem prometer trocar
o modelo de uma conversa que já está rodando. Pilotos sintéticos validam o
encadeamento técnico e permanecem separados das amostras operacionais.

## Verificação e implantação

Testes puros do resolver, execução simulada até ledger, agregação e promoção;
testes da interface, typecheck, lint proporcional, build e CI. Revisão cruzada
antes da instalação local e merge. Backup dos arquivos locais substituídos,
registro de cada mudança e read-back do snapshot publicado. Sem migration,
alteração de credenciais ou escrita em dados operacionais de cliente.
