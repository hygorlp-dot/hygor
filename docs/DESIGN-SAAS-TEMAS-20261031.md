# MARCELL — sistema de temas e rotina de trabalho

## Direção aplicada

O usuário rejeitou o peso visual da direção anterior e pediu uma experiência mais próxima da Vobi, com fluxo simples e temas consistentes. Esta implementação evolui o motor existente, preserva a marca e parte da versão consolidada `70969adc`. Branch local: `codex/saas-theme-system-20261031`; prévia com dados fictícios: http://127.0.0.1:4250/ (piloto@local.test / piloto-local). Sem deploy.

## Pesquisa e decisões

- [Atlassian: tokens e temas](https://atlassian.design/foundations/design-tokens): decisões visuais nomeadas por função, com valores centralizados. Aplicado ao registro de temas, superfícies, texto, seleção, navegação e estados.
- [SAP Fiori: princípios](https://www.sap.com/design-system/fiori-design-web/v1-139/discover/sap-design-system/vision-and-mission/design-principles): experiência simples, coerente, adaptativa e orientada à tarefa. Aplicado à redução das entradas primárias do Financeiro, filtros sob demanda e registros móveis compactos.
- [Carbon: tabelas](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications): hierarquia e medidas consistentes para dados. Aplicado a tipografia tabular, espaçamento ligado à densidade e ações próximas ao registro.
- [Vobi: compras](https://www.vobi.com.br/funcionalidades/gestao-de-compras): continuidade entre solicitação, cotação, ordem e financeiro. A implementação preserva os vínculos existentes; não reproduz regras financeiras de outro sistema. A aba autenticada não ficou acessível nesta sessão; referência pública e análise local anterior foram usadas.
- [Inter](https://github.com/rsms/inter/tree/v4.1): fonte variável para telas, com números tabulares. Distribuição 4.1 e licença OFL incluídas localmente, sem CDN.

## Contrato de implementação

`src/design-system/themes/themeRegistry.js` concentra os valores dos dois temas. MARCELL Claro usa navegação branca, Inter e ações azuis; MARCELL Institucional usa navegação marinho, Source Sans 3 e seleção em ouro. A identidade dos vetores oficiais é preservada.

O provedor aplica o contrato antes da pintura e persiste tema/densidade apenas no navegador. O tema não envia comandos de domínio. A aparência pode ser alterada pelo ícone de paleta no cabeçalho ou em Configurações. Uma preferência institucional já salva é respeitada; Claro é o padrão para uma instalação sem preferência.

Componentes usam papéis como superfície, texto, ação, seleção, alerta e foco. Layout e estados compartilhados ficam nas receitas, sem depender do nome de um tema. A ponte Tailwind/shadcn lê os mesmos tokens. As declarações locais que impediam a herança das cores, tipografia e densidade foram retiradas das camadas operacionais.

Botões mantêm um contrato comum entre as três APIs existentes. Controles de toque têm pelo menos 44 px; campos editáveis usam 16 px no celular. A densidade continua independente do tema. Não criar cores literais em novos componentes.

## Fluxo e composição

- Financeiro: Hoje, Caixa por conta, Documentos e Pagamentos ficam na navegação principal. Demais destinos ficam em Mais áreas no desktop; o seletor móvel mantém todos os destinos permitidos.
- Compras: a busca fica visível. Filtros adicionais abrem pelo botão Filtros e preservam os valores ao recolher. A introdução redundante antes da fila foi removida.
- No celular, cada registro de compra agrupa identificação, material, prazo, contato e ação, sem repetir os nomes das colunas em cada campo. O cabeçalho usa ajuda por ícone e prioriza o contexto da tela.

## Limites do contrato

Os temas disponibilizados são claros. A matriz de validação não autoriza considerar um tema escuro pronto. Vetores da marca, PDFs/relatórios, modo TV e séries de gráficos possuem requisitos próprios. Há trechos legados com paletas literais, especialmente relatórios e componentes antigos; a presença de dois temas não equivale à migração integral desses trechos. A próxima migração deve separar apresentação de interface e saída documental, evitando substituir cores de documentos por variáveis que não resolvam fora do navegador.

O piloto com operadores continua pendente de aplicação. Testes automatizados e revisão visual não demonstram tempo de tarefa real nem justificam uma nota de usabilidade 9,5/10.

## Validação concluída

- 56 testes automatizados em 14 arquivos: provedor/preferências, contrato dos temas, contraste dos pares previstos, componentes, Hoje e ajuda.
- 6 cenários de navegador para os dois temas em 1440, 390 e 320 px: troca na tarefa, permanência da busca durante a troca, persistência de tema/densidade após recarga, filtros recolhidos e acesso às áreas financeiras.
- 100 cenários de regressão: 44 de Compras (com a própria matriz de larguras dos cenários) e 56 de continuidade financeira/WF07–WF09 em desktop e celular. Incluem recebimentos parciais, condições comerciais, permissões, exportação, contexto de origem e recuperação de falhas. Executados sobre build estável.
- Build, lint, TypeScript e `git diff --check` aprovados. Ajuda e manual gerado cobrem 90 guias e 65 abas.
- O detector apontou preferência estética por fonte menos difundida e ausência inicial de Inter no frontmatter. Inter foi documentada; a escolha permanece intencional para um ERP operacional familiar. Não há erro bloqueante reportado pelo detector.

Os cenários antigos de filtros foram adaptados para abrir as opções sob demanda. Dois cenários de recebimento esperavam bloquear excesso, enquanto o modal da versão publicada permite declarar a chegada real com aviso; as expectativas passaram a verificar esse comportamento já existente. Nenhum cálculo ou comando de recebimento foi alterado por esta entrega.

Evidências locais: `artifacts/theme-system/`. O workspace compartilhado e sua prévia na porta 4198 foram preservados. A integração com trabalhos concorrentes deverá partir da branch acima, mantendo as alterações dessas outras frentes.
