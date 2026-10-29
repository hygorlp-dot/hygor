# Compras: custo final e ficha conjunta

## Comportamento

- A cotação registra frete, desconto, impostos adicionais, outras despesas e condições de pagamento por fornecedor. Campos ausentes são apresentados como não informados. Zero exige informação explícita.
- O comparativo destaca o menor custo apenas entre propostas completas para a mesma cesta. Preços unitários finais incluem os custos informados.
- Propostas novas incompletas não são pré-selecionadas e não geram pedidos. Propostas antigas sem a estrutura comercial mantêm compatibilidade com a decisão por preço dos itens, identificada na interface para conferência.
- Custos e descontos são rateados por valor dos itens com distribuição de centavos por maiores restos. Os pedidos e a alçada conjunta recebem o valor final, sem duplicar lançamentos financeiros.
- Uma oferta com adicionais/desconto só pode ser convertida integralmente: dividir exige nova cotação dos custos. A conferência da NF-e compara o preço do produto com o preço cotado original; o total do pedido continua sendo o custo final.
- Custos de propostas com itens já decididos não podem ser alterados. Alçadas, justificativas, versionamento e idempotência continuam sob os comandos existentes.

## Ficha conjunta

Disponível nos pedidos, histórico de compras e cotação expandida. Agrupa pedidos da mesma cotação e obra, incluindo origem, aprovação, condições comerciais, recebimentos, aceite, ajustes, notas fiscais com itens/rateios, pagamentos e conciliação vinculada. Pagamentos espelhados entre pedido e nota não são duplicados.

Reúne documentos da solicitação, propostas, aprovações, pedidos, recebimentos, notas e pagamentos. PDFs e links do Drive possuem visualização incorporada; os demais formatos podem ser abertos no serviço de origem. Permissões dos arquivos continuam valendo. Não há envio a fornecedor nem alteração financeira ao abrir a ficha.

## Verificação

Testes de domínio cobrem centavos, ausência de dados, rejeição de custos inválidos, divisão de frete, custo final nas alçadas e isolamento dos vínculos. O teste de navegador em `playwright.compras.config.js` usa APIs e arquivos simulados, verifica edição/persistência de condições, notas e anexos em desktop e celular. A publicação depende dos checks do repositório e da liberação da cota Vercel; a automação existente deve publicar a main atual sem retroceder commits.
