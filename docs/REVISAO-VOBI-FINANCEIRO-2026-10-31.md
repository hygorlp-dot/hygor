# Nova comparação do financeiro — Vobi e MARCELL

Data: 31/10/2026. Revisão de produto, fluxo e apresentação; nenhuma implementação
funcional, alteração de dados, reinício do servidor ou publicação nesta rodada.

## Evidência e limites

- A tentativa de abrir o resumo financeiro autenticado da Vobi redirecionou
  para login no navegador de automação. A sessão do navegador integrado não é
  compartilhada com essa ferramenta. Não foi realizada nova navegação da área
  privada; não se conclui que uma função está habilitada no plano da empresa.
- Documentação oficial da Vobi consultada novamente. A imagem oficial do
  extrato foi inspecionada no navegador: contas/saldos/conciliação no topo,
  recorte e busca junto à tabela. É evidência da documentação, não captura
  atual da conta do usuário.
- MARCELL: leitura dos componentes e domínios atuais; 12 capturas novas de seis
  áreas, em 1440 e 390 px, com cadastros fictícios e todas as APIs interceptadas.
  Nenhuma dessas capturas contém os dados reais da empresa.
- Áreas: Hoje, Visão financeira, Documentos, Relatórios financeiros, Custos por
  etapa e Fechamento. Não houve transbordamento horizontal da página nos 12
  casos. Isso não equivale a uma auditoria completa de acessibilidade ou de
  desempenho. Evidências em `artifacts/financeiro/revisao-vobi-2026-10-31/`.

## O que já foi resolvido e deve ser preservado

Memorial mensal e anual, indicadores com composição, continuidade entre filtros,
memorial e central, leitura de originais, prévias de importação/recorrência,
filas de conciliação, relatórios com exportação no mesmo recorte e custos por
etapa já existem. A próxima evolução deve melhorar sua utilização e cobertura,
em vez de criar novas telas que repitam essas funções.

Aprovações e alçadas também já têm motor próprio no projeto. Novas filas devem
reutilizar esse motor. A conciliação já possui operações em lote; não se trata
de adicionar uma segunda conciliação.

## Referências da Vobi que ajudam na decisão

A Vobi documenta contas e pendências de conciliação na mesma área do extrato,
com seleção de contas e filtros de lançamentos. Ressalta que os saldos dependem
de conciliação correta. Essa referência favorece tornar a origem do saldo e
a situação de conferência mais visíveis no MARCELL. [Extrato financeiro](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi).

O material de atualização de julho de 2024 documenta retenção de filtros e
ações em massa; são referências já publicadas, não novidades verificadas no
plano atual. [Filtros e operações em lote](https://ajuda.vobi.com.br/pt-br/articles/9650673-atualizacoes-vobi-29072024).

A central de lançamentos assistida descrita pela Vobi recebe documentos,
pré-preenche e sugere classificações antes da revisão humana. A oportunidade
para o MARCELL é reunir a entrada e a conferência; isso não exige começar
por WhatsApp ou por novas integrações de IA. [Central assistida](https://ajuda.vobi.com.br/pt-br/articles/12691800-agente-de-ia-financeiro-da-vobi-sua-rotina-no-piloto-automatico).

A documentação do DRE prevê recortes por projeto e centro de custo; o cronograma
físico-financeiro relaciona valores orçados e datas do planejamento. Essas duas
referências ajudam a orientar a evolução dos agrupamentos e da previsão por
etapa. [DRE](https://ajuda.vobi.com.br/pt-br/articles/9641347-como-analisar-os-resultados-da-sua-empresa-com-o-dre-gerencial),
[Cronograma físico-financeiro](https://ajuda.vobi.com.br/pt-br/articles/9071053-otimize-o-controle-da-sua-obra-com-o-cronograma-fisico-financeiro-e-a-curva-s-na-vobi).

## Melhorias prioritárias

| Prioridade | Evidência no MARCELL | Melhoria proposta | Critério de aceite |
|---|---|---|---|
| P0 — Origem do saldo | `CashForecast.jsx` converte campo inicial vazio em zero; o usuário informa uma hipótese e não seleciona uma conta na previsão | Distinguir saldo do sistema, saldo conferido em determinada data e hipótese. Exigir confirmação explícita para saldo zero; permitir seleção de conta e revelar pendências | Não mostrar saldo acumulado como conhecido quando o saldo inicial está ausente. Exibir fonte, data, contas e composição. Uma soma do cadastro não ganha o rótulo de saldo bancário certificado |
| P0 — Conferência antes de fechar | Na captura móvel, Fechar competência aparece antes do seletor do mês e das pendências; o estado financeiro positivo convive com alertas documentais | Ordenar mês → resumo da conferência → pendências → ação final. Separar claramente motor sem divergências de documentação revisada | Competência sempre visível na confirmação; alertas e bloqueios distinguíveis. Preservar regras atuais do motor e perfis, sem transformar automaticamente alertas em bloqueios |
| P1 — Resultado visível no celular | A tela de relatórios em 390 px mostra quase apenas filtros na primeira dobra | Exibir resumo do recorte e resultado cedo; recolher filtros adicionais; resumir filtros ativos com remoção individual | Resultado identificável na primeira tela; conta/categoria/busca acessíveis sem perder seus valores; exportação continua com o mesmo recorte |
| P1 — Hoje orientado à próxima ação | Cenário capturado: fila Pagar hoje vazia, mas dois títulos vencidos aparecem apenas na outra opção | Aviso acionável de vencidos e pendências, com prioridade por vencimento/valor e próxima ação compatível com o perfil | A tela vazia oferece acesso direto às pendências existentes. A escolha do usuário não é trocada silenciosamente; nenhum pagamento é criado por navegação |
| P1 — Documento em todos os fluxos | A central genérica mostra links e dados; a prévia com campos editáveis está concentrada na ficha fiscal | Estender o leitor existente a comprovantes e anexos de pedidos/medições; informar tipo, pedido, parcela, envio e estado do acesso | Documento acessível a partir do mesmo registro no memorial e na central. Conferência de recibo não exige criar uma nota fiscal. Falha de leitura não é tratada automaticamente como anexo inexistente |
| P1 — Consultas salvas | A continuidade documentada é em memória enquanto o módulo permanece montado | Salvar preferências por usuário/empresa: por exemplo, vencidos da obra e documentos pendentes do mês | Reabrir uma consulta recompõe filtros válidos e autorizados. Não persistir credenciais, dados financeiros ou links assinados como preferências |
| P2 — Cobrança por atraso | Relatórios reconhecem vencidos, mas agrupamentos atuais são obra, categoria e contraparte; não há faixa de atraso na central | Visão por faixas de atraso, cliente e medição, com responsável e histórico de acompanhamento | Recebimentos parciais reduzem o saldo corretamente; faixas usam uma data de posição explícita. Lembretes externos somente após configuração e autorização |
| P2 — Classificação em lote | Apropriação assistida confirma vínculos por custo; central documental apresenta ações por registro | Selecionar documentos para sugerir categoria, obra ou encaminhamento à conferência, com prévia do lote | Reutilizar comandos e alçadas existentes; excluir itens bloqueados do lote, indicar motivo por item e impedir nova execução duplicada |
| P2 — Centro de custo nos relatórios | `GROUP_LABELS` em `report-center.js` expõe obra, categoria e contraparte; centro de custo já existe em parte dos cadastros | Mapear a dimensão existente e adicioná-la ao relatório e memorial | Sem centro de custo continua explícito; nenhum setor é inferido sem evidência; exportação, total e detalhamento permanecem consistentes |
| P2 — Custo restante no tempo | Custos por etapa já estima montantes e permite revisão; não distribui nessa tela os desembolsos pelo cronograma | Relacionar previsão revisada, datas das etapas e títulos efetivos para mostrar necessidade mensal por obra | Diferenciar estimativa de custo, compromisso e pagamento previsto; evitar contar a mesma compra como compromisso e estimativa adicional; não distribuir custos sem datas válidas |

## Sequência recomendada

1. **Clareza da operação:** resumo e filtros compactos, aviso de vencidos, ordem
   do fechamento e indicação de saldo inicial não informado. Revisão visual
   dirigida; reaproveitar componentes existentes e a identidade MARCELL.
2. **Caixa por conta:** regras de saldo de abertura, data e origem; vínculo à
   conciliação e indicação de cobertura. Começar por dados existentes; integração
   bancária automática é escopo adicional, não requisito para mostrar a origem.
3. **Entrada e conferência documental:** leitor para todos os tipos de anexo,
   fila única e preferências salvas. O cadastro real ainda tem cobertura
   documental limitada; organizar a entrada deve anteceder automações maiores.
4. **Controle gerencial:** atraso por faixas, centro de custo, classificação em
   lote e previsão temporal por etapa, reutilizando aprovações e comandos.

## Ajustes de layout específicos

- Preservar a navegação e a marca atuais. Reduzir mudanças de organização entre
  as áreas: obra, período, conta e base de cálculo devem aparecer em lugares
  previsíveis, respeitando que Hoje não usa competência como recorte implícito.
- Central: lista mais densa no computador; resumo do lançamento e original
  juntos após seleção. No celular, priorizar o documento ou o próximo passo,
  mantendo filtros adicionais recolhidos e fáceis de recuperar.
- Relatórios: separar filtros essenciais dos adicionais. O resultado e a base
  de cálculo devem preceder explicações longas. Não repetir todos os critérios
  em parágrafos extensos quando um resumo acessível resolve.
- Fechamento: a cor positiva deve se referir ao que foi efetivamente conferido,
  sem sugerir conclusão documental completa quando há alertas pendentes.
- Reavaliar o botão flutuante de ajuda nas listas e formulários móveis: nas
  capturas ele ocupa a mesma região dos controles e pode competir com a ação
  financeira. É observação de posicionamento, não demonstração de clique bloqueado.

## Medição proposta

Comparar o mesmo conjunto de tarefas antes/depois: localizar um vencido, obter
o original a partir de um indicador, retomar um relatório e conferir a origem
do saldo. Medir tempo, cliques, retorno sem perder filtros e conclusão sem
auxílio. Não há percentual de produtividade estimado ou ganho validado nesta
revisão. Pagamento, fechamento e automações externas exigem seus testes de
comando/permissão próprios quando forem implementados.

## Escopo entregue nesta rodada

Análise, referências e capturas sintéticas. Não foi modificada a implementação
do financeiro, nem reiniciado o servidor com a sessão OneDrive em memória.
Preservados os vínculos dos originais já verificados e todo o trabalho existente.
Nada foi enviado a serviços de publicação, Vercel, branches remotas ou PRs.
