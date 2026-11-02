# P3 — ficha rápida, próxima ação e retorno ao contexto

Revisão: 01/11/2026. Implementação somente local no checkout `C:/dev/releases/marcell-precise-local-20261101`, branch `codex/marcell-precise-local-20261101`. Prévia com dados de demonstração em http://127.0.0.1:4260/. Sem push, preview remoto, deploy, migração ou alteração de dados reais.

## Resultado

O código de uma compra e o nome de um compromisso financeiro abrem a ficha rápida, tanto na tabela quanto no Kanban. A ficha apresenta informações do modelo atual: obra, material/descrição, situação ou direção, prazo/vencimento, responsável/contato e valor/saldo. O botão executa uma ação distinta. O Financeiro não repete mais Ver memorial em cada linha: Consultar detalhamento está dentro da ficha e mantém a consulta completa de origem e documentos.

O padrão compartilhado `RecordPanel` ocupa a lateral direita no desktop e a tela no celular. Compõe o Modal existente para manter a pilha de foco e os formulários atuais. Consultar e fechar não gravam. Recebimento e edição curta de pedido continuam nos formulários existentes, sobre a ficha; Cancelar retoma a ficha. Solicitações e cotações usam a área completa, com retorno explícito à origem. Conferir documento abre o fluxo fiscal existente; feche sua ficha antes de usar Voltar à fila financeira. Não foram criadas transições, confirmações automáticas ou novas permissões.

Ao voltar, a consulta conserva busca, filtros, página, seleção e posição de leitura; no quadro, também conserva a rolagem horizontal. Fechar a ficha devolve o foco ao código/nome. Área e IDs das obras isolam o contexto de Compras; o Financeiro usa o ID do escopo. Esses dados de navegação ficam na sessão montada, sem salvar registros ou consultas em localStorage. A apresentação continua usando as preferências restritas da P2. Recarregar reinicia o contexto da sessão.

A seleção guarda somente a identidade. Se o registro sair do modelo atual ou do recorte permitido, a ficha mostra indisponibilidade e não mantém um comando de uma cópia antiga. As ações financeiras continuam sendo resolvidas contra os dados e o perfil atuais. Recebimento físico, conferência fiscal e pagamento permanecem separados.

## Ajuda e padrão

Foram acrescentados os guias Compras · Ficha rápida e Financeiro · Ficha rápida, com `useHelpTopic` e Ajuda dentro da própria ficha. O cabeçalho compartilhado mantém Ajuda. O registro de tópicos agora conserva o guia da área ao desmontar uma consulta temporária e dá prioridade à ficha enquanto ela está aberta. Consultar a ajuda não fecha a ficha, muda filtros ou registra operações.

As orientações principais de Compras e Financeiro · Hoje foram revisadas, incluindo a remoção do antigo Ver memorial da fila. Manual regenerado: 101 guias, cobertura das 65 abas. A composição e o contrato de retorno foram registrados no padrão de interface.

## Crítica e refinamento

Os testes de paginação revelaram que o botão que abriu a ficha deixava de existir ao navegar para outra área. O retorno passou a resolver o acionador no registro remontado, preservando foco e rolagem. A pilha anterior de ajuda perdia o tópico pai ao fechar uma área interna; foi substituída por registros com prioridade e remoção por token. Um teste adicional cobre a troca de tópico do pai com a ficha aberta.

A inspeção visual identificou um limite global de altura de 900 px que reduzia o painel no desktop. A receita compartilhada foi ajustada para ocupar a altura disponível, mantendo a rolagem interna e a adaptação ao viewport. Hierarquia dos títulos da ficha usa os tokens comuns. A primeira captura durante a entrada do overlay foi substituída por capturas com animações desativadas para avaliar o estado final.

Para acomodar a etapa dentro do orçamento existente, foram removidas 210 regras CSS sem referência nas fontes atuais, de composições antigas de login, jornada de Compras, folha, equipamentos e cabeçalhos de relatórios. Seletores ainda usados foram mantidos; não houve aumento de teto nem exclusão de artefatos da métrica. A revisão das 65 abas verifica os efeitos dessa limpeza.

## Validação

- Dez cenários P3 em Chromium: desktop 1440 × 1000 e celular 390 × 844. Consulta, retorno, foco e Tab, Escape, Ajuda, cancelamento do recebimento, memorial, navegação completa, página 2 e rolagem de Kanban. Nenhum comando operacional confirmado pelos testes.
- Quatro cenários adversos: fichas de Compras e Financeiro em 320 px com fontes bloqueadas e em desktop com texto a 200%, também sem as fontes locais. Capturas e inspeção visual das fichas; o conteúdo permanece consultável por rolagem.
- 136 cenários gerais de layout, cobrindo as 65 abas em desktop/celular; seis cenários P2 e seis de fundação/temas aprovados.
- 38 testes de código em oito arquivos: fila/ações financeiras, memorial paginado, sessão, remoção do título, ajuda temporária e manual, além dos modelos de Compras e Financeiro.
- Lint, design, TypeScript e análise de dependências aprovados. Arquitetura: 1.494 módulos, 4.624 dependências, sem violações.
- Build local e gate de bundle aprovados: 1.789.127 bytes JS/CSS gzip; teto inalterado de 1.789.952 bytes.

Evidências em `artifacts/p3-browser-final.log`, `p3-browser`, `p3-stress.log`, `p3-stress`, `p3-whole-erp.log`, `p3-p2-regression.log`, `p3-foundation-regression.log`, `p3-unit-final.log`, logs de lint/tipos/arquitetura e `p3-bundle-final.log`. Fixtures e interceptação local das APIs, sem dados reais. Viewports emulados em Chromium; sem avaliação com operadores reais, aparelho físico ou Safari. P4 ainda deve aprofundar exceções, falhas e linguagem dos fluxos completos.

## Roadmap atualizado

| Etapa | Situação |
| --- | --- |
| P0 — pesquisa e decisões | Concluída |
| P1 — fundação compartilhada | Concluída localmente |
| P2 — gestão à vista | Concluída localmente |
| P3 — ficha e ação | Concluída localmente |
| P4 — exceções e linguagem | Próxima: parciais, adiantamentos, permissões, falhas e mensagens finais |
| P5 — revisão do piloto | Pendente: validação integral e roteiro de uso com operadores |

Nota interna provisória: **9,0/10**. A separação entre consultar e agir ficou mais clara e os retornos evitam reconstruir a pesquisa. A meta 9,5 depende das exceções da P4, da revisão P5 e de evidência de uso com operadores; a nota não representa teste de usabilidade com participantes.
