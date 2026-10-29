# Projeção de mão de obra da quinzena ativa

Implementação baseada em `main` 9172996a, conferida novamente em 29/10/2026. Entrega por PR; sem merge, deploy de produção, migração ou novo APK.

## Entrada e grupos

- Folha → Projeção de mão de obra.
- Relatórios → Projeção de mão de obra, sem conceder acesso à Folha ao Financeiro.
- Folha, Ponto por obra e Gestão do ponto oferecem Consolidado, Obras e Administração Central. O cadastro da equipe usa o mesmo nome.
- `workArea=administrativo` identifica a central. Engenheiros e mestres entram provisoriamente nesse grupo por decisão do responsável; a lotação e os apontamentos não são regravados.
- A Administração Central não é uma obra `admin_only`. O responsável pelo custo continua seguindo `splitPayrollResponsibility`.
- Fechamento, reabertura e arquivamento globais permanecem na visão Consolidado. Ações individuais e importações de ponto usam a lista visível.

## Fotografia e segurança

`LaborProjection` → `consultarProjecaoMaoObra` → ação autenticada `labor-fortnight-projection` em `api/data.js` → `server/labor-projection.js` e `labor-projection-source.js`.

A API usa a empresa da conexão, o perfil autenticado e o dataset composto de `completarLinha`. O navegador envia somente filtros; salários, totais, taxa e data enviados pelo cliente não são fontes autoritativas. A consulta não grava ponto, ARP, folha, DRE, pagamentos ou fotografias persistentes.

Admin/RH precisam de Folha ou Relatórios e podem receber detalhe individual. Financeiro precisa de acesso a Relatórios ou Folha e recebe somente agregados; filtro individual retorna 403. Outros papéis são recusados. `obraId` do perfil restringe o resultado, inclusive as exportações. Não são retornados CPF, PIX, documentos, biometria, notas médicas ou arquivos brutos.

O servidor fornece corte e atualização em `America/Bahia`. O resolvedor puro recebe o corte e usa `getQ`: dias 01–05 mantêm Q2 anterior, 06–20 usam Q1, e 21–fim usam Q2. Seletores históricos da Folha e de Relatórios não alteram esse ciclo. Pagamento vem de `getPayrollPaymentCalendar` e não muda a competência.

Cada resposta contém versão derivada de revisão dos dados, arquivos, metodologia, acesso, corte, instante e filtros. Não há cache compartilhado; a resposta usa `private, no-store`. PDF e Excel usam a fotografia já carregada, sem outra consulta nem recálculo no navegador. Exportações ficam bloqueadas durante atualização ou erro; a última consulta é identificada quando uma atualização falha.

## Janela, arquivos e frequência

Para Q2 de outubro: ciclo 21/10–05/11, janela 21/07–20/10 e intervalos 21/07–20/08, 21/08–20/09 e 21/09–20/10. A janela permanece igual em 01/11. São meses de calendário, não 90 dias nem meses civis completos.

O loader seleciona todas as chaves arquivadas que intersectam a janela/ciclo, por empresa, e usa `decodeAppData`, inclusive gzip. Recorta datas após leitura. Valida estrutura, IDs, datas, limites e contagem de lançamentos quando disponível. Arquivo ausente, inválido, truncado ou erro de leitura suspende a taxa histórica e sinaliza cobertura parcial.

Fotografias efetivamente fechadas prevalecem sobre duplicatas vivas. Quando a quinzena está restaurada, os registros vivos já mesclados prevalecem. Sobreposição divergente entre arquivos vira conflito e dado ausente, não falta. `employeesSnapshot` completa a referência histórica, sem presumir vínculo atual de pessoas que existem só em arquivo. `archivedLaborCosts` não substitui frequência e não é somado outra vez ao custo individual.

O histórico é indexado por pessoa/data e eventos por pessoa; transferências, mudanças de função/modalidade e reativações são considerados. Grupo comparável usa função, modalidade, área e jornada compatíveis na data, dentro do escopo permitido.

Taxa = soma de F / soma de P + M + F, ponderada pelos denominadores dos três intervalos. M aparece separado e não é falta. FE/AT/FG são afastamentos excluídos da exposição ordinária. Vazio, desconhecido ou batida bruta incompleta são pendências. Usa o calendário da Folha e o vínculo na data.

Política centralizada em `PROJECTION_POLICY`: individual com pelo menos 20 dias classificados e cobertura de 80%; depois grupo comparável; caso contrário taxa indisponível e referência integral. Cobertura = observados / (previstos − afastamentos). Os limiares são heurísticas de produto, não garantias estatísticas. Exibem-se três intervalos, exposição, observados, pendentes, afastamentos, M e origem da taxa. A limitação de F legado possivelmente incluir afastamentos antigos acompanha o resultado; notas livres não são interpretadas.

## Custo e memória

O motor `createLaborCostEngine` ganhou `calculateDailyCosts` e um resolvedor opcional de fotografia do funcionário. As regras e as saídas agregadas anteriores permanecem preservadas. A projeção chama o motor por ano quando o ciclo cruza dezembro/janeiro, sem mudar o caminho antigo da DRE nem a versão de suas projeções.

Particiona apurado, programado confirmado, estimativa futura ordinária e pendências passadas/correntes estimáveis. Nenhuma presença ou falta é presumida como fato no dia atual. O cenário diário ordinário calcula `(1 − taxa) × custo(P) + taxa × custo(F)` em memória; não cria apontamentos. Fatos conhecidos, afastamentos confirmados e horas extras explicitamente confirmadas preservam seu custo. Não se presumem horas extras futuras nem efeito financeiro de M futuro.

Salário CLT mantém o denominador de dias úteis de cada mês e os encargos do motor. Salário fixo fica apurado/programado; benefícios variáveis ficam separados. CLT sem salário mensal segue a diária legada do motor, com aviso. `chargesCost` já está em `laborCost`; provisões não são adicionadas outra vez. Centavos CLT são distribuídos por pessoa/competência antes dos filtros; consultar uma obra não muda seu custo.

Feriado mantém a regra vigente e a obra do último P/M anterior. Elegibilidade dependente de dias adjacentes não classificados fica condicional; se anterior ao corte, não se apresenta como custo definitivamente apurado. A reserva preserva fatos e programações e usa P somente nos ordinários/pendências calculáveis; não é teto absoluto.

Remuneração ou vínculo essenciais ausentes geram parcelas desconhecidas. Pessoa, centro e consolidado ficam parciais, e o custo desconhecido não vira zero real. Sem lotação fica visível como centro próprio; contagem consolidada é distinta por ID.

## Líquido e saldo

Títulos fechados ativos da mesma quinzena substituem a estimativa da obrigação, sem somar título ao custo. `totalLiquidadoFolha` e `saldoTituloFolha` tratam pagamento parcial e estornos. Rateios em centavos usam `allocateNetByWork`; saldo deriva do líquido alocado menos o pago.

Na diária aberta, `advanceDeductionForPeriod`, `calculateUnionDue` e `calculatePayrollSettlement` estimam o líquido, sem reduzir custo por adiantamento. O rateio por obra/área ocorre após o cálculo integral da pessoa. Pagamentos de folha ou transações sem título/período inequívocos deixam saldo indisponível e pedem conferência, em vez de declarar zero pago.

Líquido CLT sem obrigação de quinzena identificável, rateio fechado ausente e título sem divisão histórica por área permanecem indisponíveis. Retenções são separadas: sem classificação/vencimento confirmado não são anunciadas como obrigação de repasse vencida. Custo/encargos não são apresentados como transferência ao funcionário.

## Limitações explícitas

- A base atual de terceiros tem contratos por medição, semana ou diária, mas não apropriação diária canônica suficiente para este novo ciclo. O relatório informa a quantidade excluída e o motivo, separadamente. Não converte `weeklyRate × 4,3`, não transforma pagamento em competência e não interpreta contrato da obra como vínculo do trabalhador.
- A projeção não é holerite, não aplica descontos e não altera direitos. A classificação histórica legada e lacunas de dados tornam a previsão provisória.
- A versão é uma referência de consulta; nenhuma fotografia persistente foi adicionada nesta entrega.

## Verificação

Testes de domínio cobrem limites de ciclo, ano/bissexto, janela estável, 6/60 = 10%, cenário R$900 + 4 × R$150 × 90% = R$1.440 (reserva R$1.500), apurado invariável, estados/afastamentos/M, cobertura/fallback, arquivos fechados/restaurados/conflitantes/ausentes, admissão/desligamento/reativação/modalidade, CLT por competência, centros, encargos, pagamentos/estornos, parcelas de adiantamento, rateios de centavos, não mutação e exportações.

Integração da API verifica 401/403, papéis, abas personalizadas, obra, corte autoritativo e ausência de mutações/PII. O loader tem teste de leitura gzip e consulta restrita à empresa. As suítes existentes de Folha, motor e DRE mantêm seus cenários de referência.

Playwright em desktop e celular verifica navegação Folha/Relatórios, filtros de Administração Central, ponto, tabela sem vazamento horizontal da página e exportações da mesma versão. A regressão da Folha confirma totais completos em uma linha: o dimensionamento agora considera o rodapé em negrito e reserva largura mínima para ele, inclusive com preferência de colunas salva.

Capturas com dados exclusivamente sintéticos: [desktop](assets/projecao-mao-obra/desktop.png), [celular](assets/projecao-mao-obra/mobile.png). PDF de conferência fica em `output/pdf/projecao-quinzena-sintetica.pdf`, fora do repositório. O PDF foi renderizado e inspecionado; o histórico usa tabelas independentes para blocos com números de colunas diferentes.

Revisão `dre-integration-guardian`: após corrigir arredondamento anterior aos filtros e propagação de incompletude, não foram encontrados novos P1/P2 nos caminhos revistos. Gates de entrega: lint, architecture:check, typecheck, suíte geral e `npx vite build`; números finais ficam na PR.

## Evolução separada

Uma próxima entrega pode oferecer fotografias opcionais aprovadas no fechamento para comparar previsto × realizado, registrar revisões de hipótese e medir erro por centro/modalidade. Isso exige política de retenção, permissões e versionamento próprios; não deve alterar os fatos operacionais nem atribuir confiança estatística sem método validado.
