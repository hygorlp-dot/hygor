# Reauditoria do ERP publicado — 17/11/2026

**Nota geral 8,6/10, ante 8,4. A meta de 9,5 ainda não foi atingida.**

O domínio de produção apontava para o deploy `dpl_8rfCCSp587CHbKh2xsXmrNhi8MiM`, commit `a180eb34`. A aba nativa autenticada estava carregada com a versão anterior. Após recarregar, confirmou o novo arquivo de entrada `index-C2nFZtoc.js`. Usei essa aba para consultar 38 telas dos oito setores em 390 × 844 e 12 áreas internas do Financeiro. Verifiquei o menu em 320 px e deixei a aba no Dashboard com a largura original de 805 px.

Em sessões novas do navegador, a versão publicada renderizou 65 telas em 390 px e dez em 1440 px com dados simulados. A varredura não registrou erro de inicialização, transbordamento horizontal do documento ou tentativa das gravações monitoradas. Os 60 testes de fluxo passaram. Um ensaio adicional com atraso proposital reproduziu a mistura temporária de recortes no DRE por obra. [Cobertura](../artifacts/reauditoria-operador-a180eb34/coverage.json) · [Testes](../artifacts/reauditoria-operador-a180eb34/flows.log) · [Reprodução do DRE](../artifacts/reauditoria-operador-a180eb34/dre-troca-obra.json)

## Notas por setor

Régua mantida da rodada anterior. Clareza pesa 25%, uso no celular 25%, próxima ação 20%, passagem de contexto entre setores 20% e orientação 10%. A média das notas ponderadas, antes de arredondar cada setor, foi 8,5875. As notas são heurísticas. A comparação visual combina algumas leituras reais com ensaios de dados equivalentes entre as versões.

| Setor | Anterior | Clareza | Celular | Próxima ação | Contexto | Orientação | Atual |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 8,6 | 8,0 | 9,0 | 8,5 | 8,0 | 9,0 | **8,5** |
| Comercial e contratos | 8,4 | 8,5 | 8,5 | 8,0 | 8,5 | 8,5 | **8,4** |
| Obras e projetos | 8,2 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Compras e estoque | 8,7 | 8,5 | 8,5 | 9,0 | 9,0 | 8,5 | **8,7** |
| Financeiro | 8,4 | 8,5 | 8,0 | 8,5 | 8,5 | 9,0 | **8,4** |
| Equipamentos e locações | 8,4 | 8,5 | 8,5 | 8,5 | 8,0 | 8,5 | **8,4** |
| Pessoas e terceiros | 8,5 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Administração | 8,4 | 8,5 | 9,0 | 8,5 | 8,0 | 8,5 | **8,5** |

## Jornada

1. **Gestão e relatórios.** O Dashboard abre o recorte de competência, caixa e prioridades. Comunicação exibiu 81 tarefas com busca e paginação. O cenário isolado percorreu Comunicação → Conferência → retorno ao filtro. O DRE por obra reduziu de 3.340 para 1.506 px de conteúdo em 390 px com os mesmos dados de teste, mas perdeu nota pelo erro de troca de obra descrito abaixo. O DRE mensal da empresa continuou ocultando indicadores quando a consulta falha no ensaio. [Comunicação](../artifacts/reauditoria-operador-a180eb34/390-chat.png)
2. **Comercial e contratos.** Comando → Pipeline → relacionamentos → propostas e contratos. Em 390 px, a leitura em lista funciona e o Pipeline ainda ocupou cerca de cinco alturas de tela na sessão autenticada. A continuidade entre ficha e contrato preservou o vínculo exato por proposta e restaurou a edição no cenário simulado. A fila de propostas consultada na sessão real estava vazia. Assinatura e ativação operacional ficaram fora da sessão real. [Pipeline](../artifacts/reauditoria-operador-a180eb34/390-com_pipeline.png)
3. **Obras e projetos.** Diretório → arquivos → orçamento → cronograma → Diário → avanço. Abrir Obras ou Planejamento deixou de disparar a sincronização observada na rodada anterior. O ensaio explícito confirmou que preparar pastas continua funcional e que alinhar o cronograma preserva as tarefas avulsas, datas e progresso. No Diário real, a primeira ficha começou em y=442 px, acima da barra inferior de um celular de 844 px. Busca e filtros expansíveis responderam. A recuperação de revisão antiga e falha de acesso ao OneDrive passou com respostas simuladas. [Diário](../artifacts/reauditoria-operador-a180eb34/390-rdo.png)
4. **Compras e estoque.** Fila → cotação → pedido → recebimento → estoque. A fila e a curva de compras abriram na sessão real. No ensaio de origem a destino, material, quantidade e apropriação seguiram o pedido. O recebimento parcial alterou estoque e saldo simulados sem criar pagamento. A disposição inicial em Kanban e a tela de fornecedores ainda exigem rolagem. [Compras](../artifacts/reauditoria-operador-a180eb34/390-cmp.png)
5. **Financeiro.** Gestão → documentos → obrigação → banco → fechamento. A homologação real mostrou motor ativo, projeções pendentes e 758 diferenças e avisos. Essa contagem descreve o estado mostrado na sessão, sem revalidar cada divergência. Em respostas simuladas, a trilha do documento chegou à obrigação e ao banco, PIX explícito divergente impediu a confirmação e a falha de fechamento permitiu retomada. [Financeiro](../artifacts/reauditoria-operador-a180eb34/390-fin.png)
6. **Equipamentos e locações.** Locação → Frota → consulta de item. A abertura da frota real ocupou aproximadamente seis alturas de tela mesmo com paginação. O ensaio confirmou busca fora da primeira página. Reserva, cobrança e medição de locação ficaram no limite da consulta real. [Frota](../artifacts/reauditoria-operador-a180eb34/390-equip.png)
7. **Pessoas e terceiros.** Equipe → gestão do ponto → Folha → terceirizados. A Folha real apresentou 12 de 40 funcionários na primeira página. Uma busca sem resultados preservou os totais e foi limpa ao terminar. Com dados equivalentes entre as versões, a altura da Folha caiu de 2.802 para 1.935 px. O ensaio de medição manteve precisão percentual ao entrar e sair do campo. [Folha](../artifacts/reauditoria-operador-a180eb34/390-folha.png)
8. **Administração.** Central → auditoria → cadastros → patrimônio → ajustes. O seletor em largura inteira deu clareza à área ativa. A auditoria real apresentou 12 de 98 alterações, com filtros avançados recolhidos. Patrimônio e Ajustes ainda ocupam quase dez alturas de tela no celular. O teste isolado de perfil de obra confirmou a restrição a tarefas e solicitações do escopo permitido. [Administração](../artifacts/reauditoria-operador-a180eb34/390-admin_central.png)

## O que ainda separa o ERP de 9,5

- **DRE por obra apresenta o valor anterior sob o nome da nova obra enquanto carrega.** Com duas obras fictícias e uma resposta atrasada, a obra B já estava selecionada e o faturamento continuava em R$ 111.111,00, valor da obra A. Ele passou para R$ 222.222,00 após a resposta de B. A falha está demonstrada durante a espera e pode induzir leitura incorreta. [Captura da troca](../artifacts/reauditoria-operador-a180eb34/dre-troca-obra-pendente.png)
- **Menu inferior ainda corta “Financeiro” em 320 px.** Na sessão nativa, o seletor superior mediu 300 px e o documento coube na tela, mas o rótulo do atalho inferior excedeu o espaço. A medição foi de largura em navegador emulado e não constitui um teste de acessibilidade completo.
- **Consultas densas continuam no caminho diário.** Patrimônio, Ajustes, Frota e Pipeline ainda exigem várias telas de rolagem. No Financeiro, a homologação explica a situação, mas a triagem de centenas de diferenças continua sendo uma tarefa longa.
- **Integrações com efeitos reais têm cobertura de simulação.** As passagens entre comercial e obra, compras e estoque, documentos e banco, medição e financeiro foram avaliadas até a consulta ou por respostas controladas. Assinaturas, pagamentos, fechamento real, gravação de ponto e alterações no OneDrive não foram executados.

Nenhum comando de gravação foi acionado na sessão autenticada. A consulta canônica do DRE executada nos testes foi simulada, pois a ação real pode materializar projeções. As requisições de API da simulação foram interceptadas. A análise não alterou código, registros operacionais, permissões ou documentos.
