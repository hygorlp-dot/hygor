# Revisão de provisões, prontuário e indicadores do RH

Data da revisão: 25/10/2026. Complementa o ensaio de Fulano e Siclano e o aceite do RH. As alterações reutilizam o cadastro, os comandos operacionais, o prontuário privado e o razão financeiro existentes.

## Falhas reproduzidas e correções

| Falha observada | Prova antes da correção | Comportamento corrigido |
| --- | --- | --- |
| CLT por diária excluído silenciosamente das provisões | `newProvisionDraft` retornava `included:false`, base herdada de salário antigo, FGTS 8% e multa 40%, sem erro de pendência | O vínculo CLT por diária entra como apuração pendente. Base e percentuais não são presumidos. |
| Ausência ou tipo errado virava zero na reserva | Revisão cruzada reproduziu `null` nos percentuais aceito com auditoria; teste do comando também aceitou `base:true` | Campos numéricos obrigatórios rejeitam `null`, `undefined`, booleanos, espaços e arrays. Zero numérico ou textual informado é preservado. Campos opcionais ausentes permanecem não apurados. |
| Rascunho passado usava salário atual | Leitura direta de `employee.monthlySalary`, sem considerar vigência | Base mensal de rascunho novo usa o salário vigente na competência e o último dia civil real, inclusive fevereiro. |
| Simulação mensal herdava o contrato diário real | Para o mesmo cenário hipotético de R$ 3.000 e 22 dias, acrescentar vínculo CLT diário ao cadastro gerava seis erros e mudava o resultado da simulação | O consumidor constrói as premissas do cenário mensal escolhido. Mantém o contrato real e o método manual das reservas reais. |
| Falha de consulta ao prontuário parecia falta de documento | Teste React recebeu erro de API e também encontrou “Nenhum documento cadastrado” e checklist zerado | Resumo documental só aparece depois de consulta bem-sucedida. Falha de leitura é apresentada como falha. |
| Checklist escondia falta de arquivo e contava vencidos como ativos suficientes | Teste React não encontrou pendências visíveis de ASO e identidade arquivada | Pendências de conferência aparecem antes do envio; distinguem ausência, arquivamento, vencimento, validade ausente do ASO e emissão futura. |
| Indicador de adiantamento ignorava baixas | Após pedido de R$ 600, baixa de R$ 250 e legado de R$ 500, mostrava R$ 1.100 | “Adiantamentos a pagar” mostra R$ 350. Legados permanecem no histórico, fora da nova obrigação. |
| Funcionário com desligamento futuro sumia do alerta de vencimentos | ASO vencido de funcionário com término em 31/10 não era contado em 25/10 | Pendências permanecem visíveis até o último dia do vínculo. |

As falhas de classificação, prontuário, saldo de adiantamento e desligamento futuro tiveram testes falhando antes e passando depois. O caso de vigência salarial foi adicionado à mesma revisão como regressão de rascunho histórico.

## Provisão manual para CLT por diária

O novo contrato usa `assessmentMethod: 'manual_daily_clt_reserve'`. O RH informa a base da reserva, as médias, o percentual de FGTS, o cenário de multa e a incidência sobre férias. Registra referência, responsável e memória da apuração, depois confirma a conferência. Alterar qualquer campo relevante retira a confirmação.

O comando `EMPLOYEE_SAVED` valida a apuração e grava usuário e hora do servidor em `manualAssessmentAudit`. O cliente não pode forjar esse carimbo. A classificação usa o contrato vigente, por isso não é possível retirar o método manual do payload para contornar a conferência. Uma exclusão automática antiga aparece como pendência ao consultar, mas seu registro original permanece preservado até a revisão explícita.

A fórmula gerencial já existente foi mantida: reserva de 13º, férias, terço, FGTS das verbas e multa contingente. Não foi criada conversão diária × 26 ou salário mensal implícito. A base da reserva não muda o salário contratual, o ponto ou o líquido do holerite. O exemplo dos testes usa base fictícia de R$ 2.550,00 e média de R$ 50,00, resultando em R$ 645,38 mensais com as incidências informadas no próprio teste; não é recomendação fiscal para contratos reais.

Sem apuração válida, a tela mostra a pendência e bloqueia a exportação do total. O relatório de custos por funcionário mantém a provisão como “Não apurada”. Com a memória conferida e salva, o PDF inclui base, referência, responsável, memória e revisão registrada. Nenhum título, pagamento ou lançamento de DRE é criado por salvar essa reserva.

## Prontuário e cadastro

O resumo orienta a conferência inicial de identificação, endereço e contrato. Para vínculo CLT reconhecido na data, inclui registro/CTPS e ASO. Para trabalho em campo, inclui certificados e entrega de EPIs. A existência de um arquivo não comprova seu conteúdo ou cumprimento de obrigação; o RH define o que se aplica ao contrato e à função. Férias, afastamentos e desligamento não são tratados como ausentes obrigatórios antes de ocorrerem.

O cadastro mostra os dados pessoais disponíveis, contato e endereço, e aponta campos incompletos usando a validação de RH já existente. CLT por diária exige os dados CLT pertinentes, sem exigir salário mensal. A validade do ASO no cadastro e a validade do arquivo continuam explícitas: anexar um PDF não modifica automaticamente ASO ou NRs do funcionário.

O armazenamento privado e as permissões de `api/upload.js` e `server/rh-documents.js` foram reaproveitados. Não houve alteração de acesso, bucket, schema ou arquivo remoto nesta revisão.

## O que já é automático e o que permanece apurado

O ponto continua alimentando o motor canônico de custeio da obra e a DRE operacional. Solicitações de novos adiantamentos criam obrigações; baixas comprovadas alimentam caixa e saldo; apenas o valor pago fica elegível para compensação em folha. O indicador passou a acompanhar esse saldo real.

As provisões desta tela são **reservas gerenciais**. Ainda não são provisões contábeis integradas automaticamente à DRE, não apuram todos os encargos patronais e não comprovam recolhimento. Integrar isso exige fonte identificada, incidências conferidas, competência e compensação do custo já reconhecido, para não somar salário e reserva em duplicidade. A revisão não alterou regras fiscais ou fórmulas da DRE para aparentar essa integração concluída.

## Verificações

Lote focal: **10 arquivos, 44 testes aprovados**, duração de **17,87 s**. Inclui:

- `src/domains/ponto/labor-provisions.test.js` e `components/LaborProvisions.test.jsx`;
- `src/domains/rh/labor-provision-command.test.js`;
- `src/domains/rh/employee-dossier-status.test.js` e `components/EmployeeDossier.test.jsx`;
- `src/domains/rh/analytics.test.js` e `components/IndicadoresView.test.jsx`;
- regressões de `employee-costs.test.js` e `employee-commands.test.js`;
- `src/integration/simulacao-adiantamentos.test.js`.

Os testes React usam controles e API de documentos simulados. A persistência da reserva é exercitada pelo comando oficial, com validação e carimbo de servidor. O ensaio remoto continua separado e depende do ambiente liberado; esta revisão não afirma publicação ou validação remota concluídas.

Depois do lote de 44 testes, a revisão cruzada identificou a coerção numérica descrita acima. O novo teste do comando falhou antes da correção e passou depois. O lote final dos quatro arquivos afetados (`labor-provisions`, comando, componente e relatório de custos) aprovou **16 testes em 7,44 s**. O `npm run lint` canônico também passou. Não houve nova instalação de dependências, migration ou alteração de fórmula financeira nesta revisão.

A revisão seguinte encontrou o consumidor `pay-mode-simulation.js` usando o funcionário real como premissa de um cenário mensal hipotético. O teste reproduziu os seis erros antes do ajuste e aprovou depois; **10 testes passaram em 1,67 s**. Para o exemplo específico do teste, a simulação mensal volta a R$ 744,67 de reserva e R$ 5.288,84 de custo total, independentemente de o cadastro real ser CLT por diária. Esses valores são evidência do cenário fixo, não base fiscal presumida para o trabalhador.
