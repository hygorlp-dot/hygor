# Projeção de mão de obra da quinzena ativa

Implementação iniciada sobre `9172996ac61b0168e37c62bfcc32a29977632096`, em 29/10/2026.

## Acesso e finalidade

O mesmo relatório está disponível em **Folha → Projeção da quinzena** e **Relatórios → Projeção de mão de obra**. A consulta ajuda a distinguir custo já apurado, eventos futuros confirmados, estimativa ordinária e reserva provisória para ponto pendente.

O servidor verifica papel, abas personalizadas e obra antes de reconstruir as fontes. Admin e RH com acesso à Folha podem consultar pessoas e memória diária; Financeiro recebe agregados autorizados, sem ganhar acesso à Folha ou aos arquivos brutos de RH. Filtros e exportações obedecem ao mesmo escopo.

A ação `labor-projection-report` é uma leitura autenticada. A simulação não cria ponto, títulos, pagamentos ou fatos de DRE. A projeção mensal preexistente do Fluxo de Caixa permanece com seu comportamento anterior.

## Ciclo e histórico

A referência temporal vem do servidor, no fuso `America/Bahia`. Dias 6–20 pertencem à Q1; dias 21–fim do mês à Q2; dias 1–5 continuam na Q2 do mês anterior. Em 29/10/2026 e 01/11/2026, o ciclo é `2026-10-Q2`, de 21/10 a 05/11.

O histórico são os três meses de calendário imediatamente anteriores à abertura, sem incluir a quinzena projetada. Nesse exemplo, 21/07–20/10, dividido em 21/07–20/08, 21/08–20/09 e 21/09–20/10. O calendário e o pagamento previsto seguem os helpers existentes da Folha.

O servidor combina o ponto tratado com arquivos que intersectam a janela e com o contexto necessário aos feriados. Arquivos fechados são autoritativos; quinzenas restauradas preservam correções atuais e completam lacunas com a fotografia. Conflitos, arquivos ausentes e metadados incompletos ficam explícitos. Um resumo financeiro arquivado não substitui os registros de frequência.

Os carimbos de todas as linhas compostas são conferidos antes e depois da leitura. Os arquivos são relidos e comparados por versão e conteúdo. Mudança durante a consulta devolve `409`, evitando um resultado construído com versões incompatíveis.

## Metodologia

A taxa operacional é `F / (P + M + F)`, somando os numeradores e denominadores da janela. Não é a média simples dos percentuais mensais. M tem probabilidade separada; FE, AT e FG são afastamentos excluídos da exposição ordinária. Dias vazios, conflitos ou ponto incompleto são dados ausentes, não faltas. Feriados e fins de semana ficam separados segundo o calendário da Folha.

A política centralizada exige **20 dias classificados e 80% de cobertura**. Esses limiares são uma heurística de produto, não garantia estatística. Usa-se primeiro a pessoa; depois, um grupo comparável por modalidade, função, centro e jornada. Sem amostra suficiente, a taxa e a estimativa dependente de presença ficam indisponíveis; a reserva com presença integral continua disponível quando houver remuneração e vínculo suficientes.

F histórico anterior à classificação separada de afastamentos é identificado como classificação limitada. A estimativa permanece provisória e nunca gera desconto automático ou avaliação punitiva.

| Parcela | Tratamento |
| --- | --- |
| Apurada | Fontes válidas até o corte; não recebe desconto estatístico. |
| Futuro confirmado | Eventos explícitos, afastamentos e salário fixo de competência, conforme a modalidade. |
| Estimada | Dias ordinários futuros, usando custos canônicos dos cenários P/M/F. |
| Pendente | Dia passado ou corrente sem classificação suficiente; reserva provisória por presença integral, quando calculável. |

`partial` identifica parcelas sem valor/reserva calculável ou fontes omitidas. `provisional` identifica hipóteses ainda pendentes, como classificação limitada e feriado condicional. Subtotal disponível, valor indisponível e estimativa provisória têm apresentações distintas.

O exemplo de aceitação é testado: R$ 900 apurados + quatro dias futuros de R$ 150 com taxa de 10% = **R$ 1.440**. A reserva de presença integral é **R$ 1.500**.

## Revisão de 29/10/2026 (metodologia 2026-10-29.2)

Achados conferidos com contagens agregadas da base de produção, sem dados pessoais:

- **Obras sem ninguém trabalhando recebiam custo.** Dia sem ponto (futuro ou pendente) usava a lotação do cadastro. Como as equipes rodam entre obras, a lotação ficava desatualizada: ALPHAVILLE, K1-02, PRÉDIO e BASE DE DADOS (concluída) não tiveram ponto na quinzena 2026-10-Q2 e apareciam com custo. Agora o dia sem ponto vai para a obra do último P/M até o corte, a mesma regra do feriado. Uma transferência registrada no cadastro depois desse dia prevalece. Sem trabalho nos 31 dias anteriores, vale a lotação.
- **Cobertura derrubada por período sem sistema.** Os registros começam em 21/08/2026, e a janela 21/07–20/10 contava o primeiro mês como dado ausente. A cobertura média caía para cerca de 65% e 34 de 38 pessoas ficavam sem taxa; daí os "dias sem valor calculável". Dias anteriores ao primeiro ponto da empresa (`history.trackingStart`) não entram como esperados. De 21/08 em diante a cobertura média é de 96%.
- **Diarista ativo parado.** Diarista ativo, admitido há mais de 30 dias e sem nenhum ponto nos últimos 30 dias sai do subtotal e da reserva, com a pendência `NO_RECENT_ATTENDANCE` (conte em `totals.excludedStaleEmployees`). CLT mensal não é excluído, porque o salário de competência continua devido.

## Integridade dos custos e do caixa

O módulo usa `createLaborCostEngine`, com uma pessoa/data/cenário por chamada. O custo de mão de obra já incorpora encargos; o total acrescenta benefícios uma única vez. A simulação limpa resumos arquivados agregados para não duplicar a fotografia bruta reconstruída.

CLT mensal mantém o salário de competência e os denominadores próprios de cada mês. A frequência pode estimar benefícios, mas não reduz o salário. A memória separa as parcelas de salário e de presença. O centro Administrativo vem de `workArea`; obra por administração é uma responsabilidade contratual distinta. Sem lotação é um centro próprio.

O caixa reutiliza os helpers existentes de adiantamentos, sindicato, fechamento e responsável pelo pagamento. Títulos fechados substituem a previsão da mesma obrigação. Liquidações usam os eventos do próprio razão financeiro, inclusive seu arredondamento por obra. Estornos e espelhos da mesma transação não duplicam o pagamento.

O líquido e o saldo exibidos são **aos funcionários**. Encargos/provisões de competência não são tratados como dinheiro a transferir. Retenção sindical permanece separada do eventual repasse, cujo valor por vencimento exige uma obrigação identificável.

Casos sem base suficiente permanecem explícitos: líquido CLT sem título válido vinculado ao ciclo; mudança de modalidade parcialmente coberta; pagamento sem ciclo ou data; título sem rateio; obrigação sem pessoa projetável; filtro que seleciona apenas parte das parcelas de uma pessoa. Holerite isolado ainda não é utilizado como fonte desse líquido. Os subtotais conhecidos não são apresentados como caixa completo.

## Tela e exportações

Os filtros não alteram ciclo nem histórico. Filtros em edição ficam separados dos confirmados; uma atualização malsucedida preserva a última fotografia identificada. Perda de autenticação/permissão remove os dados da tela.

PDF e Excel usam o objeto retornado pelo servidor, sem nova consulta. O PDF segue o padrão MARCELL, com fontes locais, marca d’água, valores completos, cabeçalhos de tabela e anexo individual autorizado. Notas repetidas são referenciadas na memória diária e mantidas integralmente por pessoa.

O Excel tem seis abas: Resumo, Obras e Administrativo, Pessoas autorizadas, Histórico, Memória de cálculo e Pendências. Dinheiro é numérico, datas são tipadas e ausência de valor permanece nula. Perfis sem acesso individual recebem apenas a indicação de restrição nas abas correspondentes.

## Evidência de validação

Foram acrescentados 142 testes focados: 63 de domínio, 19 de caixa, 33 de fontes/permissões, 10 de integração da API e 17 de interface/exportações. Regressões dos achados financeiros foram reproduzidas antes das correções, incluindo duplicação de pagamento legado, centavos divergentes do razão, lotação histórica herdada indevidamente e falso conflito em saldo parcial.

Quatro cenários Playwright exercitam RH e Financeiro em 1440×1000 e 390×844: navegação, filtros, diálogo e foco, ausência de alterações persistentes, resposta `409`, privacidade e exportação PDF/XLSX real do mesmo snapshot. As capturas e os documentos sintéticos são produzidos nos artefatos do teste.

Uma revisão independente conforme `dre-integration-guardian` verificou os consumidores financeiros e liberou os casos corrigidos. Os gates gerais e seus resultados definitivos ficam registrados no PR e no workflow de qualidade associado ao commit publicado.

## Limites explícitos

O relatório não promete reconstruir retroativamente uma consulta sem uma fotografia armazenada naquele momento. Fontes ausentes continuam como pendências. Terceirizados sem motor e calendário suficientes para este ciclo não recebem multiplicadores semanais arbitrários. MEI/contrato fixo sem modalidade canônica implementada não é convertido em diária por aproximação.

Uma evolução separada poderá salvar fotografias de projeções e comparar previsão com custo apurado após o encerramento, antes de qualquer alegação de precisão estatística.
