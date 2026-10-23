# Organização dos módulos do ERP

A navegação segue a organização aprovada para obras e locações, usando como referência os princípios de módulos integrados e base financeira compartilhada descritos em https://www.oracle.com/br/erp/erp-modules/.

| Módulo | Destinos existentes |
| --- | --- |
| Visão gerencial | Dashboard, DRE empresa (mensal/anual), DRE obras, relatórios, Modo TV, comunicação e aprovações |
| Financeiro | Gestão financeira, medições e cobranças, caixa e conciliação |
| Obras e projetos | Obras, orçamento e memorial, planejamento, Marcos e Curva A, diário, medições técnicas, conferência e licenciamento |
| Compras e suprimentos | Compras (solicitações, pedidos e recebimentos), cotações, estoque e fornecedores |
| Equipamentos e locações | Locações, cobrança, manutenção, disponibilidade, cadastro e frota |
| Pessoas e terceiros | Equipes, ponto, folha, rescisões, terceirizados e indicadores |
| Comercial | Relacionamentos, oportunidades, propostas, contratos e gestão comercial |
| Administração | Cadastros, acessos, auditoria, configurações e ferramentas |

## Contratos preservados

`src/navigation/erp-navigation.js` é a fonte da organização visual. Os identificadores das telas não mudaram. `allowedTabsForUser`, as políticas da API e a projeção dos dados por usuário permanecem intactos. Um módulo só apresenta destinos já permitidos ao operador. Estar no módulo Visão gerencial não concede acesso ao DRE; ver o módulo Administração não concede ações administrativas.

A central de locações saiu do grupo Financeiro, mas seus fatos financeiros continuam alimentando o mesmo razão e DRE. Reorganizar o menu não cria receitas, títulos, pagamentos ou notas. Nenhum vínculo bancário é alterado. O movimento de R$ 7.160 continua pendente de comprovação da composição do aporte.

Todos os destinos, incluindo os comerciais antigos e permissões personalizadas, têm um único módulo. A busca global, os atalhos, o caminho da página e a abertura automática da seção lateral usam o mesmo mapeamento. Um cadastro com acesso apenas a uma tela comercial antiga continua podendo encontrá-la sem receber as novas telas do módulo.

No celular, quatro módulos prioritários e Mais módulos ocupam no máximo cinco botões. O módulo atual permanece visível; os demais ficam no menu adicional. Nomes curtos cabem na barra e os nomes completos permanecem acessíveis ao leitor de tela e no menu. O chat fica acima da navegação.

## Validação

Os testes verificam a cobertura e a unicidade de todos os destinos existentes, o filtro de todos os perfis, as permissões personalizadas e a localização de cada tela. Os testes de navegador incluem busca e atalhos para Financeiro, Engenharia e RH; acesso comercial legado; navegação pelos oito módulos no celular; ausência de transbordamento da barra inferior; e abertura de todos os módulos administrativos no computador.

A suíte completa mantém as verificações de compras, orçamento, DRE, cobrança, ponto, pagamentos, conciliação, API e permissões. A publicação é acompanhada de comparação somente leitura no Supabase, sem registros fictícios de produção.
