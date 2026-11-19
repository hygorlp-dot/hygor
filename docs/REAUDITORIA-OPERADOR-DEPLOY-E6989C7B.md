# Reauditoria do ERP publicado — 17/11/2026

**Nota geral 8,7/10, ante 8,6. Faltam 0,8 ponto para a meta de 9,5.**

O domínio de produção apontava para `dpl_7VW8DKWBrXK8N35mMfn4KHSrZ1hq`, commit `e6989c7b`. Usei a aba nativa autenticada em 390 × 844 para consultar 39 telas dos oito setores e 12 áreas internas do Financeiro. Também testei a barra inferior em 320 px. A aba voltou ao Dashboard na largura original de 1.198 px. As 65 telas de celular e dez de desktop renderizaram em sessões isoladas sem falha ou rolagem horizontal do documento. Os 69 testes de fluxo passaram. [Cobertura](../artifacts/reauditoria-operador-e6989c7b/coverage.json) · [Log dos testes](../artifacts/reauditoria-operador-e6989c7b/flows.log)

## Notas

A média usa a mesma régua heurística da rodada anterior. Clareza pesa 25%, celular 25%, próxima ação 20%, continuidade entre setores 20% e orientação 10%. A nota geral é a média das notas ponderadas antes do arredondamento setorial.

| Setor | Anterior | Clareza | Celular | Próxima ação | Continuidade | Orientação | Atual |
|---|---:|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 8,5 | 9,0 | 9,0 | 8,5 | 8,5 | 8,5 | **8,8** |
| Comercial e contratos | 8,4 | 8,5 | 8,5 | 8,0 | 8,5 | 8,5 | **8,4** |
| Obras e projetos | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Compras e estoque | 8,7 | 8,5 | 8,5 | 9,0 | 9,0 | 8,5 | **8,7** |
| Financeiro | 8,4 | 8,5 | 8,5 | 8,5 | 8,5 | 9,0 | **8,6** |
| Equipamentos e locações | 8,4 | 8,5 | 9,0 | 8,5 | 8,0 | 8,5 | **8,5** |
| Pessoas e terceiros | 8,9 | 9,0 | 9,0 | 9,0 | 8,5 | 9,0 | **8,9** |
| Administração | 8,5 | 9,0 | 9,5 | 9,0 | 8,0 | 8,5 | **8,9** |

## Jornada

1. **Gestão e relatórios.** Dashboard → Comunicação → aprovações → relatórios. A origem da tarefa e o retorno ao filtro passaram na simulação. No DRE por obra, o seletor permaneceu disponível, os indicadores sumiram durante a espera e a exportação ficou desabilitada. Ao voltar para A, a resposta atrasada de B foi descartada. Ao selecionar B novamente, apareceram os valores de B. Isso passou em 390 e 1440 px. O caminho de erro do DRE por obra ainda precisa identificar a fonte, conforme o achado abaixo.
2. **Comercial e contratos.** Comando → Pipeline → relacionamentos → propostas e contratos. O Pipeline ainda ocupou cerca de cinco alturas da janela. A central preservou o vínculo pela proposta e o retorno à ficha nos testes. A passagem de uma venda assinada para Obras ficou fora de confirmações reais.
3. **Obras e projetos.** Diretório → projetos e arquivos → orçamento → Planejamento → Diário → avanço → Conferência. As consultas abriram na aba nativa. No ensaio, abrir Obras ou Planejamento continuou sem disparar sincronização ou salvamento. O histórico de revisão antiga e a recuperação do visualizador após falha de acesso foram exercitados com respostas simuladas.
4. **Compras e estoque.** Fila → solicitação → cotação → pedido → recebimento. Na simulação, material, quantidade e apropriação acompanharam a origem. Receber parcialmente atualizou estoque e saldo fictícios sem criar pagamento. A listagem de fornecedores continua longa no celular.
5. **Financeiro.** Gestão → documentos → obrigação → caixa/conciliação → fechamento. Consultei 12 áreas internas. A homologação continuou mostrando projeções pendentes e 758 diferenças e avisos na sessão real. O ensaio confirmou o vínculo entre documento, obrigação e movimento bancário, a proteção para chave PIX divergente e a retomada de fechamento após erro. O atalho **Finanças** coube em 320 px e abriu o Financeiro.
6. **Equipamentos e locações.** Locação → Frota → detalhes do item. Confirmei a primeira página de 12 dos 24 equipamentos, a ação Transferir disponível e a abertura dos detalhes. A altura observada caiu de 5.063 para 4.087 px em 390 px, mas ainda equivale a quase cinco alturas da janela. [Frota](../artifacts/reauditoria-operador-e6989c7b/390-equip.png)
7. **Pessoas e terceiros.** Equipes → Gestão do ponto → Folha → Terceirizados. As telas abriram na aba autenticada. A busca da Folha continuou preservando os totais e o teste isolado confirmou a precisão do percentual de medição ao focar e sair do controle. Ponto, folha e pagamentos ficaram em consulta na sessão real.
8. **Administração.** Auditoria → Patrimônio → Ajustes. A paginação real avançou de 1–12 para 13–24 de 33 bens. A altura de Patrimônio caiu de 8.322 para 3.329 px. Ajustes, com seções recolhidas, caiu de 8.190 para 698 px. A seção Empresa abriu e fechou sem editar os campos reais. O ensaio confirmou que um preenchimento fictício é conservado ao recolher e reabrir. [Patrimônio](../artifacts/reauditoria-operador-e6989c7b/390-patrimonio.png) · [Ajustes](../artifacts/reauditoria-operador-e6989c7b/390-config.png)

As alturas são medições do conteúdo na primeira abertura, em 390 px, comparadas à sessão da rodada anterior. A paginação e o recolhimento reduzem a altura inicial e mantêm os demais registros e controles acessíveis.

## O que ainda pesa na nota

- **DRE por obra em falha canônica.** Simulei HTTP 503 para a obra B. O valor da obra A não voltou a aparecer. Depois da falha, B mostrou o faturamento calculado com os dados locais, no caso R$ 0,00, e a exportação em PDF voltou a ficar habilitada. A tela não identificou esse modo de leitura nem mostrou o erro da consulta. O ensaio conferiu a disponibilidade do botão e não gerou um PDF. [Captura da falha](../artifacts/reauditoria-operador-e6989c7b/dre-falha-sem-aviso.png) · [Resultado do ensaio](../artifacts/reauditoria-operador-e6989c7b/dre-falha.json)
- **Densidade de consultas e triagem.** Frota, Pipeline e Fornecedores ainda exigem várias telas de rolagem em 390 px. A homologação tem busca e paginação, mas revisar o volume de diferenças continua exigindo trabalho manual.
- **Validação de efeitos entre setores.** A jornada de consulta e os vínculos entre módulos foram exercitados. Assinatura, baixa financeira, fechamento, ponto e alterações no OneDrive foram simulados ou verificados até o passo anterior à confirmação.

Na aba autenticada, não acionei gravações operacionais. A troca de obra foi testada com o código publicado e a API simulada, porque a consulta canônica real pode materializar projeções. Nenhum código, documento ou registro operacional real foi alterado para executar a auditoria.
