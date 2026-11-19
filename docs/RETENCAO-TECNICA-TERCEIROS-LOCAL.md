# Retenção técnica nas medições de terceiros — etapa 2

Revisão: 13/11/2026. Implementação, build e validações locais. Sem migração, publicação, conexão bancária ou alteração de dados reais.

## Informação reaproveitada da origem

A garantia pertence à medição existente em medicoesTerc. Contrato, obra, bruto, aprovação, beneficiário e condições tributárias são lidos da medição e do contrato de terceiros. Não se cria outro contrato, despesa ou cadastro de beneficiário. O valor de cada pagamento é calculado no servidor; o operador informa a garantia e as decisões/evidências, sem redigitar o bruto ou líquido.

A definição grava technicalRetention na medição: valor em centavos, bruto conferido, beneficiário por ID/nome, condição, justificativa, data e autor autenticado. technicalRetentionHistory preserva definições, liberação e pagamento. O versionamento utiliza a versão da própria medição, evitando que duas pessoas confirmem decisões sobre bases diferentes.

Ausência de garantia continua significando ausência de garantia definida. Nenhum percentual, cláusula ou aceite é inferido de nomes, notas, documentos ou valores parecidos. O contrato comercial com o cliente e suas cláusulas não são alterados.

## Operação

Em Financeiro → Custos por etapa → Compromissos por origem, abra Garantias técnicas das medições e selecione a medição. Em Terceiros → Medições, use Conferir garantia técnica no registro.

1. Definir ou remover garantia: informe valor, condição de liberação e justificativa. O total deve caber no bruto depois das retenções tributárias. Zero remove antes de qualquer baixa ou liberação. Rascunhos podem ter condição proposta, mas só a aprovação reconhece custo/obrigação.
2. Registrar pagamento do principal: confira o líquido calculado, data, pagador e justificativa. Ausência de fotografia exige aceitação expressa do risco, como no fluxo existente.
3. Liberar garantia técnica: após a aprovação da medição, informe evidência, data e vencimento, confirme a condição cumprida e justifique. Uma data futura não comprova liberação. A liberação é integral, expressa e preservada; não ocorre automaticamente por calendário.
4. Registrar pagamento da garantia: exige liberação anterior, saldo integral ainda aberto, data válida e período aberto. Os tributos do principal não são retidos novamente.
5. Histórico e estorno: a baixa continua em pagsTerceiros, identificada como principal ou garantia e vinculada à mesma medição. Estornar a garantia reabre somente seu saldo; não apaga o pagamento principal nem o custo reconhecido. Primeiro desfaça eventual conciliação bancária. A versão do pagamento e o motivo são conferidos.

O formulário mantém os campos após erro e reaproveita a mesma chave na repetição da mesma tentativa. Ajuda e proteção de saída mantêm o preenchimento; consultar não grava decisões.

Esta etapa não inclui liberação parcial, alteração de liberação já confirmada, cancelamento de garantia liberada, execução judicial, penalidade ou compensação com outro contrato. Depois de uma liberação, valor e condição ficam preservados. Pagamento indevido pode ser estornado; mudança contratual posterior exige tratamento próprio, sem reescrever o histórico.

## Conciliação e caminhos alternativos

A nota fiscal vinculada conserva o bruto e não cria segundo custo. Medição com garantia deve ser paga pela sua operação: a fila genérica da nota ou a criação de baixa a partir do extrato não pode consumir o valor retido.

O motor de conciliação oferece a baixa existente pelo líquido efetivamente registrado, com o identificador do pagamento e a mesma obra. Vincular o extrato não cria outro pagamento. A liberação não autoriza conciliar uma garantia que ainda não foi paga.

Há trava para definir ou mudar garantia se já houver baixa, inclusive por nota ou pagamento aninhado. É necessário conferir e estornar a origem pelos fluxos existentes; não se redistribuem pagamentos históricos automaticamente.

## Impacto no DRE, obrigações e caixa

A garantia não é ISS, INSS, desconto de custo ou economia. O DRE continua reconhecendo o bruto da medição aprovada uma única vez. Notas e pagamentos espelhados mantêm a deduplicação existente.

O razão divide a obrigação em principal (bruto menos garantia) e garantia retida, com sourceType garantia_terceiro. O total a pagar inclui ambas, sem duplicar o bruto. A garantia fica Sem vencimento até a liberação, e só passa à agenda do caixa quando a liberação já ocorreu na data de consulta. As previsões atuais não reconstroem versões contratuais historicamente desconhecidas.

Exemplo validado, com ISS/INSS configurados no contrato:

| Evento | Custo reconhecido acumulado | Principal em aberto | Garantia em aberto | Caixa pago acumulado |
| --- | ---: | ---: | ---: | ---: |
| Medição aprovada: R$ 1.000; garantia R$ 100 | R$ 1.000 | R$ 900 | R$ 100 | R$ 0 |
| Principal baixado: ISS R$ 50 + INSS R$ 110 + líquido R$ 740 | R$ 1.000 | R$ 0 | R$ 100 | R$ 740 |
| Garantia liberada com vencimento | R$ 1.000 | R$ 0 | R$ 100 | R$ 740 |
| Garantia paga | R$ 1.000 | R$ 0 | R$ 0 | R$ 840 |
| Estorno apenas da garantia | R$ 1.000 | R$ 0 | R$ 100 | R$ 740 |

ISS/INSS permanecem campos tributários do modelo existente; a entrega não gera guias nem comprova recolhimento ao fisco. Baixado e pago líquido são valores diferentes. O desembolso de pagamentos do novo fluxo com garantia usa o líquido gravado; registros anteriores sem garantia mantêm o comportamento existente.

A liberação e o pagamento podem ocorrer em período aberto mesmo quando a competência original da medição estiver fechada: não alteram seu custo. Definir retenção numa competência fechada é bloqueado. Saldo a medir do contrato continua descontando o bruto aprovado, incluindo a parcela retida. Garantia não entra novamente no custo restante, nos compromissos ou na cobertura de estoque das fases 1B/1C.

## Autorização e persistência

Administrador ou financeiro com acesso a Financeiro ou Terceiros e à obra pode definir, liberar e pagar garantia. Os demais perfis com acesso às medições consultam. A API substitui autoria/papel informados pelo cliente pelos dados da sessão.

Os novos comandos são GARANTIA_TERCEIRO_DEFINIDA, GARANTIA_TERCEIRO_LIBERADA e GARANTIA_TERCEIRO_PAGA. Usam os mecanismos existentes de persistência, versão, recibo de idempotência e autorização. Estorno utiliza PAGAMENTO_TERCEIRO_ESTORNADO. Não há tabela ou migração nova.

Snapshots não podem alterar garantia, histórico, conteúdo da medição protegida ou suas baixas, inclusive como administrador. Defaults de normalização sem mudança de conteúdo não são considerados edição. A tentativa de inserir garantia na criação genérica da medição também é recusada. Datas, centavos seguros, saldo, bruto, beneficiário, evidência, duplicidade e período são revalidados na origem.

## Validação e preservação

Os testes verificam conservação do DRE, obrigação total, líquido, tributos, saldo retido, liberação em período aberto, rejeição de datas/condições inválidas, retenção integral, remoção anterior à baixa, identidade/idempotência, conflito, escopo, proteção por snapshot, pagamento por nota/extrato, vínculo bancário existente e estorno.

O handler /api/data foi exercitado com banco simulado para persistir, recarregar, liberar e pagar, conferir autoria autenticada e negar perfil/aba/obra incompatíveis. O navegador percorreu a operação, falha/repetição, ajuda, recarga e estorno no desktop/celular, incluindo acesso pelo registro em Terceiros. Dados e serviços reais não foram utilizados.

Evidências: artifacts/technical-retention-*.log, capturas em artifacts/technical-retention/browser-results e revisão independente em artifacts/technical-retention/finish-review.md. Ajuda terc_garantia e manual sincronizados (122 guias e 65 abas). Testes pertinentes: 1.067 em 128 arquivos, além da repetição final dos testes de API; navegador: 22 cenários. Build, lint, tipos, arquitetura e orçamentos de pacotes conferidos sem aumentar limites ou baseline de design.

Contratos comerciais, suas cláusulas, revisões e emissão PDF/DOCX desativada permanecem preservados. As fases 1A–1C continuam cobertas pela regressão local.
