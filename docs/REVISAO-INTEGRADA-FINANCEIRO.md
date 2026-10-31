# Revisão integrada das quatro etapas do financeiro

> Histórico da primeira revisão das quatro etapas. A consolidação das evoluções posteriores, correções e reprodução atual está em [CONSOLIDACAO-FINANCEIRO.md](./CONSOLIDACAO-FINANCEIRO.md).

Data: 30/10/2026. Repositório: `C:/dev/repositorio-mrc`. Implementação e validação locais; nenhum push, PR ou deployment realizado por esta revisão.

## Resultado e correções

As quatro etapas foram verificadas em conjunto: fila Hoje e visão financeira; previsão por vencimentos e conciliação por divergência; documentos e pendências do fechamento; custos por obra/etapa.

Correções desta revisão:

- Custo acumulado por etapa agora filtra pela competência até o mês de referência. Nota emitida depois do mês não desaparece do custo da sua competência. Pagamentos continuam pela data efetiva.
- Troca de conta na conciliação limpa a seleção anterior; ações em lote não mantêm movimentos ocultos de outra conta selecionados. O mesmo vale para filtros de divergência.
- A central reconhece documentos vinculados à movimentação e valida URLs antes de considerar um registro documentado.
- Memorial de títulos preserva os metadados enriquecidos, inclusive a movimentação bancária quando disponível.
- Etapa explicitamente inválida não é substituída por uma etapa inferida do pedido. O custo permanece em Sem apropriação.
- A interface de custos explica o recorte por competência, data efetiva e cadastro atual das compras.

## Evidências

| Verificação | Resultado |
|---|---|
| Domínios financeiro, DRE e conciliação; componentes financeiros; controle de compras; projeção/memorial no servidor | 386 testes passaram em 48 arquivos |
| Regressão final de custos por etapa, incluindo etapa inválida | 6 testes passaram |
| DRE anual, mensal e mensal fechado; conciliação com operações aplicadas ao servidor em memória | 14 testes de navegador passaram, desktop e celular |
| Jornadas integradas, duas obras, duas contas, perfis administrador e financeiro | 18 verificações de jornada concluídas, sem erros de página |
| Lint, tipos e build local | Aprovados; build conserva aviso de chunks grandes |

A contagem de 6 regressões finais contém testes já incluídos na bateria de 386; não deve ser somada como se todos fossem testes distintos.

Jornadas integradas: saldo parcial de Hoje; isolamento por obra; documentos e Escape; sete indicadores com composição sem diferença residual na fixture; previsão com horizonte e saldo simulado; cinco colunas de uma etapa com baseline válida e memorial; central documental e ficha fiscal; pagamentos; pendências do fechamento e retorno à central no mês; restrição de fechamento para perfil financeiro; filtro de divergência/conta e limpeza de seleção na conciliação. Também foi verificado que a página não transborda horizontalmente em 390px. Tabelas extensas conservam rolagem interna.

Os testes usam dados fictícios e APIs interceptadas. As operações dos cenários de conciliação são aplicadas ao handler real em memória; não há gravação financeira em produção.

## Reprodução local

1. Iniciar `node scripts/finance-workspace-preview.mjs` a partir da raiz. É uma prévia com dados fictícios e API local isolada na porta 4185; não serve para publicação.
2. Executar `node scripts/finance-integration-verify.mjs`.
3. Executar `npx playwright test --config playwright.finance-review.config.js`.
4. Para os testes de domínio: `npx vitest run src/domains/financeiro src/domains/dre src/domains/conciliacao src/features/financeiro src/domains/compras/budget-tracking.test.js server/dre-memorial.test.js server/dre-projection.test.js --maxWorkers=2`.
5. Verificações estáticas: `npm run lint`, `npm run typecheck`. Build sem prebuild de migrações: `npx vite build`.

Logs: `artifacts/financeiro/revisao-integrada-tests.log`, `revisao-e2e.log`, `revisao-browser.json` e `revisao-build.log`. Capturas: `integracao-1440.png` e `integracao-390.png`, além das capturas específicas das etapas.

## Comparação com a Vobi

A documentação oficial foi revisitada nesta rodada. A Vobi relaciona lançamentos à estrutura orçamentária, expõe itens sem apropriação e permite consultar origens. Esses princípios foram conferidos no MARCELL com orçamento de custo, etapas explícitas e memoriais. O MARCELL separa recebido físico, incorrido, pago e pagamento direto do cliente para evitar ambiguidade de “realizado”.

No extrato, a Vobi distingue registro pago de conciliação bancária e apresenta filtros por conta. A revisão do MARCELL conferiu o isolamento de contas e a seleção em lote ao mudar de contexto. Não foi feita nova auditoria da sessão autenticada da Vobi nesta rodada; a comparação atual é documental, complementando a navegação anterior.

Fontes oficiais:

- [Orçado × realizado e apropriação](https://ajuda.vobi.com.br/pt-br/articles/8837723-como-utilizar-o-relatorio-orcado-x-realizado-para-o-sucesso-de-suas-obras).
- [Extrato financeiro](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi).

## Limites que permanecem explícitos

- O saldo inicial da previsão é uma hipótese informada; não é obtido automaticamente de saldo bancário certificado.
- A estimativa para concluir é uma regra baseada em orçamento, compras e custo incorrido; não substitui avaliação física de serviços restantes.
- Documentos originais abrem no provedor em nova aba. Visualização incorporada e captura por novas integrações não foram adicionadas.
- Quantidades recebidas e compromissos de compras refletem o cadastro atual; não há reconstrução histórica dos recebimentos físicos.
- Custos/pagamentos sem vínculos suficientes ficam em Sem apropriação. Não se cria rateio artificial. Sem início válido da obra há aviso de incompletude do acumulado de ponto/equipamentos.
- Alertas documentais não ampliam automaticamente os bloqueios de fechamento. Fechamento e alterações financeiras mantêm validação e permissões existentes.

## Preservação e coordenação

O checkout compartilhado já continha trabalho de Compras/histórico de preços e de gestão à vista. Essa revisão não reverteu nem incorporou esses arquivos em commit conjunto. Foram consultados o status e o escopo do outro chat. Não foi iniciada uma suíte geral adicional; a bateria foi limitada aos domínios envolvidos e dois workers.

O resultado permanece como alterações locais revisáveis. Publicação depende de solicitação explícita do usuário.
