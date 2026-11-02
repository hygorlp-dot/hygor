# Referências para a ajuda contextual

Pesquisa em 31/10/2026. Foram consultadas documentações oficiais de produtos consolidados; não se trata de um ranking de fornecedores.

| Referência | Padrão documentado | Aplicação no MARCELL |
| --- | --- | --- |
| [Microsoft Dynamics 365 — Help experience](https://learn.microsoft.com/en-us/dynamics365/fin-ops-core/dev-itpro/get-started/help-connect) | Painel no produto reúne artigos e guias relacionados à página atual, com busca. | Abrir o guia da página e permitir pesquisar outros fluxos no manual. |
| [SAP — Context-sensitive user assistance](https://help.sap.com/docs/SAP_GLOBAL_TRADE_SERVICES_EDITION_HANA/61a9deae2f1940a18b1000aaddf27523/8b062b9529e24622bf0a7ca3f430e3ed.html) | Assistência contextual no ambiente Fiori. | Associar a orientação à tela em uso e manter um ponto de acesso consistente. |
| [Intercom — Messenger](https://www.intercom.com/help/en/articles/6612589-set-up-and-customize-the-messenger) | Central de ajuda dentro do produto, busca de artigos e checklists de tarefas. | Consulta de instruções dentro do app, sem perder o contexto operacional. |

As decisões de implementação são uma adaptação desses padrões: painel lateral não modal no desktop e painel de largura total no celular; acesso por botão com texto; etapas numeradas; preparação, resultado e cuidados; glossário; índice por acesso. A fonte local compartilhada mantém ajuda e manual consistentes, sem assinatura de serviço externo.

## Manutenção

1. Confira o fluxo real e atualize `src/features/help/help-content.js`.
2. Revise a linguagem para iniciantes e a data do conteúdo.
3. Execute `npm run manual:generate` e `npm run manual:check`.
4. Confira o botão e o guia no desktop e no celular, incluindo fechar, voltar ao foco, buscar sem acentos e consultar o manual sem modificar registros.

A geração sincroniza o documento com a fonte; não interpreta automaticamente mudanças de código. A revisão da precisão das instruções é obrigatória em cada mudança do app, conforme `AGENTS.md`.
