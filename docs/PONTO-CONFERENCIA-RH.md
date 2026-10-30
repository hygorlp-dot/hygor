# Escala e conferência das batidas

A escala disponível é de 44 horas: segunda a quinta 07:00–12:00 / 13:00–17:00; sexta 07:00–12:00 / 13:00–16:00; sábado e domingo sem expediente.

## Operação

1. No cadastro do funcionário em Equipes, o RH define a escala de 44h, informa o início da vigência e salva. Cadastros anteriores não recebem uma vigência presumida. O histórico de escalas é preservado.
2. No Ponto eletrônico, selecionar obra e dia. O painel distingue batidas a conferir, dias aguardando RH e dias integrados. Uma quantidade par de batidas não fecha a jornada.
3. Em Conferir e integrar, revisar as batidas originais e os horários previstos, informar os quatro horários tratados, confirmar presença/meio dia e a obra do lançamento. Batidas antigas sem tipo não são classificadas automaticamente.
4. Justificar horários ajustados, alertas ou substituição de um lançamento existente. Confirmar a integração. O registro aparece na Gestão do ponto e passa a compor seus cálculos. O intervalo não é inventado nem descontado automaticamente.
5. Para corrigir um dia integrado, usar Revisar conferência. O histórico anterior permanece na auditoria. Se novas batidas forem recebidas, o painel pede nova conferência, sem sobrescrever o lançamento já aprovado.

## Garantias e limites

- Apenas RH e administrador conferem, com validação no servidor.
- A integração usa a transação existente de ponto, com `POSTGRES_URL_NON_POOLING`. Sem essa configuração, falha explicitamente e não grava parcialmente.
- A transação relê lançamento, escala e batidas de todas as obras do funcionário. Mudança desde a abertura da conferência exige atualizar a tela.
- Guarda identificadores das batidas, escala aplicada, responsável, data, justificativa e revisão junto ao lançamento; não altera eventos originais.
- Preserva dias bloqueados, quinzenas arquivadas e competências financeiras fechadas. Uma repetição da mesma operação não duplica o registro.
- O lançamento atual representa um funcionário/dia/obra. A conferência permite atribuir a obra, mas não divide automaticamente um dia entre várias obras.
- Dias sem expediente ou sem escala vigente ficam pendentes para tratamento; não geram presença, falta ou extra automaticamente.
- Esta implementação não altera a exportação fiscal nem configura tolerâncias ou regras trabalhistas adicionais.

## Verificação local

Testes em `server/attendance-review.test.js`, `server/attendance-review-source.test.js` e `server/attendance-review-transaction.test.js` verificam regras, consultas e persistência transacional em PostgreSQL de teste (PGlite). `npx playwright test --config playwright.ponto-review.config.js` exercita os componentes reais em desktop e celular com dados isolados.
