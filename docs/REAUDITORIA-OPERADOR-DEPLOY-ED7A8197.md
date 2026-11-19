# Reauditoria do ERP publicado em 18/11/2026

**Nota geral de 9,0/10, ante 8,9. Faltam 0,5 ponto para a meta de 9,5.**

Percorri os oito setores na aba nativa autenticada, com foco em 390 × 844 px, e repeti os pontos mais estreitos em 320 px. O ERP estava no deploy `dpl_7RWnV6fv2qC73RDiZ1STUm4TDS5L`, versão `ed7a8197`. A aba voltou ao Dashboard a 1198 × 883 px. [Deploy](https://vercel.com/hygor-s-projects1/mrc/7RWnV6fv2qC73RDiZ1STUm4TDS5L)

## Notas

Mantive a régua heurística anterior. Clareza e celular pesam 25% cada. Próxima ação e continuidade entre setores pesam 20% cada. Orientação e recuperação pesam 10%. A nota geral usa os resultados ponderados antes do arredondamento.

| Setor | Anterior | Clareza | Celular | Próxima ação | Continuidade | Orientação | Atual |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Comercial e contratos | 8,8 | 9,0 | 9,5 | 9,0 | 8,5 | 9,0 | **9,0** |
| Obras e projetos | 8,9 | 9,0 | 9,5 | 9,5 | 8,5 | 9,0 | **9,1** |
| Compras e estoque | 9,0 | 9,0 | 9,0 | 9,0 | 9,0 | 8,5 | **9,0** |
| Financeiro | 8,8 | 9,0 | 9,5 | 9,0 | 8,5 | 9,0 | **9,0** |
| Equipamentos e locações | 8,9 | 9,0 | 9,5 | 9,0 | 8,0 | 8,5 | **8,9** |
| Pessoas e terceiros | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Administração | 8,9 | 9,0 | 9,5 | 9,0 | 8,0 | 8,5 | **8,9** |

## Jornada por setor

1. **Gestão e relatórios.** Dashboard → Comunicação → aprovações → relatórios. O escopo dos indicadores permanece explícito. Comunicação ainda mede aproximadamente 4.248 px de conteúdo a 390 px, o que alonga a triagem das tarefas. [Comunicação com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/390-chat.png)
2. **Comercial e contratos.** Comando → Pipeline → Relacionamentos → Propostas e contratos → Gestão comercial. A 390 px, o primeiro cartão ocupou a faixa de 530 a 752 px, acima da barra inferior, que começava a 782 px. O filtro de prioridade pôde ser aberto e recolhido. Na carteira consultada, o primeiro cartão trazia data de ação vencida e responsável não informado. A data aparecia no cartão, e o estado de atraso era acessível pelo filtro. [Primeiro cartão a 320 px com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/pipeline-320.png)
3. **Obras e projetos.** Carteira → Projetos → Arquivos → Orçamento → Planejamento → Diário → Avanço → Conferência → Licenciamento. No Licenciamento, o resumo real mostrou 10 de 14 documentos concluídos. Abri a área de responsabilidade técnica e o protocolo sem editar campos. Com a mesma base fictícia nas duas rodadas, a altura inicial caiu de aproximadamente 5.756 para 765 px em 390 px. [Resumo de Licenciamento com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/licenciamento-390.png)
4. **Compras e estoque.** Compras → Curva e preços → Estoque → Fornecedores. O ranking continuou exibindo os cartões e a nota geral. A relação de fornecedores mede cerca de 2.600 px na primeira página real. O ensaio de recebimento parcial manteve o vínculo com o pedido e atualizou estoque e saldo fictícios sem registrar pagamento. [Fornecedores com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/390-fornecedores.png)
5. **Financeiro.** Hoje → Caixa por conta → Documentos → Pagamentos → Custos por etapa → Relatórios → Notas → Homologação. Em 320 e 390 px, os três filtros ficaram no primeiro quadro, logo abaixo de Atualizar relatório. O relatório real mostrou 799 ocorrências e uma verificação pendente. **Somente avisos** exibiu estado vazio. A triagem ainda exige abrir e conferir a origem de cada diferença. [Filtros a 320 px com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/homologacao-320.png)
6. **Equipamentos e locações.** Central de locação → Equipamentos → Frota. A primeira página da Frota manteve os cartões compactos, com cerca de 2.274 px a 390 px. O controle da aba ficou instável ao sair da Frota. Retomei por recarga e usei o menu desktop para continuar, sem atribuir o incidente a uma falha do ERP. [Frota com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/390-equip.png)
7. **Pessoas e terceiros.** Equipes → Equipe nas Obras → Ponto → Folha → Terceirizados → Indicadores. O Ponto por obra ainda mede cerca de 4.479 px e a Folha cerca de 3.407 px. As telas permaneceram em consulta. [Folha com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/390-folha.png)
8. **Administração.** Central → Patrimônio → Cadastros → Ajustes. Os Ajustes recolhidos continuaram compactos, com cerca de 698 px. O Patrimônio mede cerca de 3.329 px na primeira página. Não acionei alterações de cadastros ou permissões. [Ajustes com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/390-config.png)

## Seletor e cobertura

A árvore de acessibilidade anunciou **Telas de Pessoas e terceiros**, **Telas de Comercial** e **Telas de Financeiro** ao entrar nos setores correspondentes. Em 320 px, o menu Mais módulos pôde ser aberto e a volta a Pessoas anunciou o nome correto. Na simulação, a navegação entre telas do mesmo setor conservou o controle. [Seletor a 320 px com dados fictícios](../artifacts/reauditoria-operador-ed7a8197/seletor-320.png)

As 65 telas a 390 px e dez a 1440 px renderizaram em sessões isoladas, sem erro de página, falha de asset, rolagem lateral do documento ou tentativa de gravação detectada na abertura. Passaram **21 cenários operacionais** e **15 direcionados**. Estes incluíram a regressão do aviso de cálculo local e bloqueio do PDF no DRE por obra. Os ensaios interceptaram as APIs e as confirmações foram feitas somente em dados fictícios. Nenhum dado real foi alterado pela auditoria. [Cobertura](../artifacts/reauditoria-operador-ed7a8197/coverage.json) · [Cenários operacionais](../artifacts/reauditoria-operador-ed7a8197/flows.log) · [Cenários direcionados](../artifacts/reauditoria-operador-ed7a8197/targeted.log)

A distância para 9,5 concentra-se no esforço para priorizar listas longas, na conferência registro a registro da Homologação e na continuidade entre setores. Assinaturas, baixas, fechamentos, lançamentos de ponto e alterações no OneDrive ficaram limitados à simulação ou à consulta anterior à confirmação.
