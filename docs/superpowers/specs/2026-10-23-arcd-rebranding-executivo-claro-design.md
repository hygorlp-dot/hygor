# ARCD — rebranding executivo claro

Status: direção aprovada pelo usuário, incluindo hierarquia dos textos, cores de estado e linguagem clara.

## Direção confirmada

O usuário escolheu executivo claro: marfim, grafite e bronze discreto. A referência é uma ferramenta de gestão para uma empresa de engenharia e obras: precisa transmitir precisão, confiança e discrição, com operação rápida para gestores e equipes administrativas.

O nome ARCD permanece como ponto de partida. A identidade terá aplicações coerentes de marca, tipografia, navegação, controles, indicadores, tabelas e documentos. A implantação começa no Financeiro como tela de referência e segue pelos oito módulos dentro da mesma aprovação de escopo.

## Diagnóstico da tela apresentada

| Antes | Depois proposto | Por quê |
| --- | --- | --- |
| Cartão “Fluxo do módulo” seguido por outra navegação | Navegação lateral para destinos e uma única navegação contextual por nível | Reduzir a dúvida sobre onde o usuário está e qual controle deve usar |
| Fundo quadriculado e muitos contornos | Fundo marfim liso, superfícies brancas e separadores discretos | Dar prioridade ao conteúdo |
| Indicadores com cores fortes em toda parte | Valores predominantemente em grafite; cor semântica acompanhada de texto | Identificar problemas sem competir com todos os demais valores |
| Texto operacional muito pequeno | Corpo de 14–16 px, rótulos de 12–13 px e títulos de 24–30 px | Melhorar leitura e hierarquia |
| Resultado financeiro cortado | Valor integral e margem em linha própria | Permitir avaliar o resultado sem depender de tooltip |
| Muitos indicadores com o mesmo peso | Três grupos principais e informações complementares abaixo | Ajudar a decidir o que fazer primeiro |
| Ranking e destaques decorativos | Lista de obras que exigem atenção, com motivo e acesso ao detalhe | Priorizar ação e entendimento |

## Sistema visual

Paleta candidata, sujeita à medição de contraste na implementação:

| Papel | Cor |
| --- | --- |
| Fundo da aplicação | Marfim `#F5F2EC` |
| Superfícies de trabalho | Branco `#FFFFFF` |
| Texto e ação principal | Grafite `#202421` |
| Texto secundário | `#62665F` |
| Identidade e seleção | Bronze `#7C6039` |
| Fundo de seleção | `#EDE5D9` |
| Separadores | `#DAD6CE` |
| Situação positiva | Verde discreto `#2E6652` |
| Situação crítica | Vermelho discreto `#A63B3B` |

- Consolidar IBM Plex Sans, já prevista nos tokens do projeto, como referência tipográfica operacional. Evitar alternância de famílias entre o legado e os componentes compartilhados.
- Usar algarismos tabulares em valores e tabelas, alinhamento monetário à direita e pesos consistentes.
- Reservar bronze para identidade, seleção e pequenos detalhes. Ações principais em grafite, com texto de alto contraste.
- Usar espaçamento de 4/8 px, respiro de 24–32 px entre seções e arredondamentos moderados, de 6–10 px.
- Preferir separadores e agrupamento por proximidade. Usar sombra apenas onde houver sobreposição, como menus e diálogos.
- Padronizar ícones de uma mesma família e escala. Manter texto nas ações que não sejam evidentes.
- Respeitar movimento reduzido. Animações breves apenas para orientar abertura, fechamento e confirmação.
- Harmonizar as aplicações da marca ARCD em navegação, acesso e documentos, incluindo versões monocromáticas. Mudança de nome não faz parte da proposta.

## Financeiro: tela de referência

Ordem de leitura:

1. Identificação da página, competência, obra selecionada e ação principal já existente e autorizada.
2. Navegação contextual compacta; destinos de módulo permanecem no menu lateral.
3. Três grupos de informação: resultado por competência; entradas e saídas de caixa; contas a pagar e a receber.
4. Pendências que exigem ação, com motivo, quantidade e acesso ao registro real.
5. Obras no período, em tabela legível com resultado, situação e acesso ao detalhe.
6. Análises complementares, metodologia dos indicadores, histórico e exportações.

Regras:

- Receita reconhecida, custo incorrido, resultado, caixa e obrigações continuam sendo conceitos separados, com identificação explícita.
- O resultado deve mostrar valor integral e margem separada, com espaço suficiente para valores altos e negativos.
- Métricas secundárias, como valores não alocados, ficam agrupadas em seção complementar. Pendências reais permanecem perceptíveis.
- Critérios e dados do ranking existente são preservados; sua apresentação pode se tornar uma tabela de prioridades, com metodologia disponível.
- Cada área terá uma ação principal clara. A criação, edição, baixa e aprovação continuam usando os comandos e permissões existentes.
- Estados de carregamento, indisponibilidade e valor zero permanecem distintos.

## Aplicação aos oito módulos

| Módulo | Prioridade de leitura |
| --- | --- |
| Visão gerencial | Resultado, evolução, fontes e desvios |
| Financeiro | Obrigações, recebimentos, caixa, conciliação e fechamento |
| Obras e projetos | Obra, orçamento e memorial, planejamento, execução e medições |
| Compras e suprimentos | Necessidade, decisão, pedido, recebimento e acompanhamento financeiro |
| Equipamentos e locações | Disponibilidade, contrato, operação, cobrança e manutenção |
| Pessoas e terceiros | Equipe, apontamentos, conferência da folha e relatórios |
| Comercial | Relacionamentos, oportunidades, propostas, contratos e passagem para a obra |
| Administração | Cadastros, acessos, aprovações, auditoria e configurações |

Identidade comum, com densidade apropriada para cada tarefa. Preservar organização operacional útil, destinos antigos e acessos diretos. Remover a duplicação visual dos caminhos do módulo, preservando todos os destinos autorizados.

## Implementação e preservação

- Reutilizar o sistema existente em `src/design-system/tokens/`, os componentes compartilhados e a organização atual dos módulos.
- Migrar estilos fixos do legado para os tokens e componentes necessários. Não depender de uma camada global de sobrescritas que esconda divergências entre as telas.
- Manter Compras, locações e folha integrados ao DRE canônico, com obra e competência corretas.
- Preservar pagamentos, vínculos de conciliação, fórmulas, documentos reais, valores e permissões. Nenhum lançamento será criado para preencher um layout.
- Aplicar identidade compatível aos relatórios destinados ao cliente, mantendo informações, totais, impressão e paginação verificáveis.
- Para a tela de ponto em campo, manter legibilidade, alvos grandes e rapidez operacional ao harmonizar a identidade. Seguir as instruções específicas do aplicativo se houver alteração em sua pasta.

## Skills selecionadas

Disponíveis no ambiente:

- `brainstorming`: fechar intenção, escopo e critérios antes da implementação.
- `data-dashboard-design`: hierarquia de indicadores, contexto e detalhamento progressivo.
- `emil-design-eng`: consistência de componentes, interação e refinamento.
- `web-design-guidelines`: revisão de acessibilidade e comportamento da interface.

Encontradas na pesquisa, ainda não instaladas nesta tarefa:

- Impeccable: recomendado como apoio principal para crítica, simplificação, tipografia, layout, adaptação e acabamento. Fonte: https://github.com/pbakaus/impeccable
- UI UX Pro Max: referência complementar para sistemas visuais, tipografia, gráficos e critérios de UX. Fonte: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

As skills apoiam decisões específicas deste produto. Não substituem os critérios operacionais e financeiros do sistema.

## Critérios de aceitação

- Uma navegação contextual por nível, sem dois conjuntos concorrentes para a mesma tarefa.
- Conteúdo financeiro essencial legível e integral, incluindo valores altos, negativos e descrições longas.
- Fundo liso, tipografia coerente e paleta restrita; cor de estado acompanhada de texto ou símbolo compreensível.
- Contraste mínimo de 4,5:1 em texto normal e de 3:1 em texto grande e elementos de interface aplicáveis.
- Foco de teclado visível, rótulos acessíveis e operação sem depender de hover.
- Uso em 320, 390, 768, 1024 e 1440 px, além de zoom de 200%. Tabelas extensas podem ter rolagem própria identificada; a página não deve transbordar.
- Alvos de toque de pelo menos 44 px nas ações móveis.
- Capturas e revisão visual das telas reais renderizadas, incluindo formulários, diálogos, erros e estados vazios.
- Testes dos fluxos, permissões, recortes do DRE e exportações; comparação de pagamentos e permissões antes e depois da publicação.

## Próximo passo

Aprovar esta proposta e a instalação do Impeccable. Depois, implementar a tela de referência, validar o padrão, aplicar aos módulos e documentos previstos e executar a validação completa antes de publicar. A aprovação cobre a implantação deste desenho no escopo descrito, sem exigir nova autorização para cada módulo.
