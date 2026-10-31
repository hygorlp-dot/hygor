# Histórico de preços por material — entrega local

Implementação em 30/10/2026, em `C:/dev/repositorio-mrc`. Autorização: consolidar/validar mudanças locais e ampliar o histórico, sem push, PR ou deploy.

## Uso

Compras → Preços por material. Selecione material e obra(s) visíveis. Há filtros de fornecedor, datas e unidade de referência quando o mesmo cadastro contém medidas diferentes. A ficha da compra pode ser aberta em cada registro.

## Regras

- Recebimentos efetivos são a base padrão. Pedidos emitidos são uma consulta distinta; rascunhos e cancelados ficam fora. Cotações não entram na média.
- Identidade do material usa o ID cadastral; nomes iguais não autorizam mistura de materiais.
- Quantidade na unidade de referência = quantidade comprada × fator informado. Preço por unidade de referência = preço por unidade de compra ÷ fator.
- Unidades diferentes nunca produzem média conjunta. Sem fator válido, o registro permanece para conferência, fora da média.
- Preço dos itens usa `precoUnitCotado` quando disponível. Custo final usa o preço rateado do pedido somente quando frete, desconto, impostos e despesas estão documentados. Zero explícito é válido; ausência não significa isenção.
- Propostas e pedidos antigos sem detalhamento comercial não recebem custo final inventado. É possível consultar seu preço de item quando houver dados suficientes.
- Média ponderada usa a quantidade convertida. Último, mínimo e variação cronológica usam apenas registros comparáveis no recorte.
- Datas são do recebimento ou do pedido conforme a base selecionada. Recebimentos legados sem data própria exibem explicitamente a data do pedido. Recebimentos revertidos não são reconstituídos a partir do saldo acumulado.
- Consulta e abertura da ficha não gravam nem aprovam registros financeiros.

## Organização local

`material-price-history.js` contém a seleção e os cálculos puros. `MaterialPriceHistory.jsx` contém filtros, resumo e rastreabilidade. `PurchaseWorkspace.jsx` expõe o atalho; `ComprasView.jsx` integra o componente e remove a implementação visual anterior, preservando os cálculos de histórico usados em outras rotinas.

Mudanças existentes em Financeiro Hoje, previsão de caixa, central documental, memorial, fechamento, resultado por etapa e filtros de divergência foram preservadas. Não foi feito commit conjunto de arquivos de outros chats, que continuam trabalhando neste checkout.

## Verificação

Testes de domínio cobrem conversão, média ponderada, unidades incompatíveis, isolamento de obra/material, filtros, legado e estornos. O cenário de navegador cobre custo final, preço original, acesso à ficha, consulta sem comandos e largura de 390 px. Logs e capturas ficam em `artifacts/compras/`; verificações do financeiro em `artifacts/financeiro/`.

A suíte geral do repositório não é disparada novamente enquanto há execuções pesadas de outros chats. A entrega usa testes direcionados de domínio/componentes, suíte de navegador de Compras, verificação do Financeiro, lint, tipos, arquitetura e build local.

## Resultados desta rodada

- 69 testes direcionados de domínio/componentes passaram (12 arquivos), incluindo as mudanças locais de Financeiro, DRE e conciliação e os 6 testes do histórico.
- 31 testes de navegador de Compras passaram. O cenário de histórico foi repetido após o refinamento final de gráfico, tokens e apresentação móvel e passou.
- A verificação integrada do Financeiro passou em 390 e 1440 px: Hoje, obra, memoriais, previsão, resultado por etapa, documentos, pagamentos, fechamento/permissões e filtros da conciliação, sem erros de página.
- Lint, tipos, arquitetura e build local passaram; o build mantém o aviso de chunks grandes.
- O detector visual apontou apenas o tamanho literal de 16 px em controles móveis; foi substituído pelo token existente `--arcd-type-control-touch`. Título usa o token `--arcd-type-section-title`.
- Não houve push, PR ou deploy. Fontes e evidências permanecem locais; a suíte geral de todos os módulos não foi repetida em paralelo com as execuções de outros chats.
