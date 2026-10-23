# DRE anual ajustável

Em **Financeiro → DRE empresa → DRE anual ajustável**, a empresa consulta janeiro a dezembro e o total do ano, por competência. A visão mensal e os lançamentos continuam acessíveis no botão ao lado.

O botão **Ajustar linhas** permite renomear, ordenar, adicionar linhas dentro de cada grupo e transferir fontes entre linhas. A seleção informa a linha de origem. Cada fonte pertence a exatamente uma linha; excluir exige transferir suas fontes primeiro. Linhas vazias podem ser preparadas para uso futuro, mas não criam receitas ou despesas. Para reconhecer um novo valor, registre o fato no módulo financeiro correspondente.

As fontes iniciais contemplam receitas de obras e locações, mão de obra, benefícios, terceirizados, rescisões, compras e outras despesas diretas, repasses e manutenção de equipamentos, categorias de despesas administrativas e provisões tributárias. Os grupos e subtotais são protegidos. Despesas financeiras aparecem depois do resultado operacional. A margem anual divide o lucro anual pela receita líquida anual; não é a média das margens mensais.

## Dados e persistência

- `financial-annual-dre-report` usa o mesmo `buildRequestedDreProjectionRows` da consulta mensal, com os eventos de títulos nativos. Uma requisição calcula as 12 competências. Não escreve lançamentos nem snapshots.
- `financial-annual-dre-layout` grava somente `config.dreAnnualLayout`, com versão própria, sob o bloqueio transacional da linha CONFIG e auditoria existente. Incrementa também a versão geral da configuração para impedir um formulário antigo de sobrescrever a alteração. Não altera pagamentos, notas fiscais ou conciliação.
- Ambas as ações exigem autenticação, papel admin/financeiro, acesso a `dre_emp` e ausência de restrição por obra. O retorno da gravação projeta a configuração conforme as permissões; não expõe a configuração completa ao financeiro.
- A estrutura vale para todos os anos. Escritas concorrentes recebem conflito; repetir a mesma gravação após perda da resposta não incrementa a versão novamente.
- Cada fonte deve estar vinculada uma única vez, no grupo compatível. Diferenças de arredondamento e componentes residuais do motor permanecem explícitos e não são lançamentos novos.
- A visão anual não vincula movimentos bancários. O movimento de R$ 7.160 permanece pendente de comprovação da composição do aporte.

O CSV inclui todas as linhas e 12 meses, independentemente do filtro de linhas zeradas. Nomes de linhas são protegidos contra interpretação como fórmulas na exportação.

## Validação

Testes de domínio cobrem partição das fontes, preservação de resultados, centavos, margem anual, concorrência, retentativa e preservação de pagamentos. Testes do handler cobrem competências, permissões e ano inválido. Playwright cobre computador e celular, ajustes, transferência de fonte, falha e retentativa, atualização e exportação. Auditoria somente leitura dos dados reais de 2026 comparou receita líquida, lucro bruto e lucro líquido de cada mês com a projeção mensal: nenhuma diferença.
