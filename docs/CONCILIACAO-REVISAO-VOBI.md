# Revisão da conciliação inspirada na observação funcional da Vobi

Observação da interface autorizada pelo usuário em 28/10/2026. Nenhum código,
API privada ou dado da Vobi foi incorporado ao produto.

## Fluxos observados e adaptação

- Contas com pendências e última importação: resumo por conta e filtro da fila.
- Extrato versus lançamento sugerido: comparação em duas colunas, empilhada no
  celular, com identidade, evidências, alertas e motivo da revisão.
- Busca com seleção múltipla: associação de um movimento a vários fatos de caixa
  existentes usando LINK_PARTIAL_CASH e suas validações no servidor.
- Total selecionado versus valor bancário: valores em centavos; bloqueio quando
  a seleção supera o saldo ou possui valor inválido. Saldo restante fica parcial.
- Alternativas na mesma tela: revisão da sugestão, classificação de nova entrada
  ou saída e identificação de transferência usam os fluxos existentes.
- Histórico de importações: mantém arquivo, conta, período, operador, status e
  quantidade conciliada, acrescentando contagem de pendências.

## Limites deliberados

As regras de automação não foram relaxadas. Nome ou valor isolado não autoriza
baixa. A automação pausa enquanto a comparação estiver aberta. A busca múltipla
vincula fatos de caixa já registrados, não liquida vários títulos em aberto nem
cria novos pagamentos. Títulos em aberto continuam pelo fluxo de sugestões.

Vínculos múltiplos são confirmados sequencialmente pelo servidor, cada um com
idempotência e validação de saldo. Se houver falha, a operação para e informa
quais confirmações anteriores permanecem através dos saldos atualizados. Não é
apresentada como uma transação atômica. Períodos fechados e bloqueios do motor
continuam sendo respeitados. A reversão mantém o gestor de vínculos existente.

Inclui a correção anterior que restaura a seção após recarregamento, ainda
pendente de deploy por limite da Vercel.
