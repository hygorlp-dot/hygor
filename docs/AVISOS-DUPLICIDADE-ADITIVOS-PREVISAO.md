# Possíveis duplicidades entre aditivos e previsão

Alteração local de 31/10/2026. Sem deploy ou publicação nesta entrega.

## Onde aparece

O aviso **Confira possíveis duplicidades de custo** aparece no acompanhamento de Mudanças e aditivos e na revisão da previsão por etapa. Na previsão, a análise inclui o rascunho antes da confirmação. Ao salvar uma previsão ou atualizar um aditivo, o comando também devolve os avisos; o histórico e a resposta idempotente preservam a evidência da gravação.

## Indícios usados

- A conferência declara que o impacto já está no restante, enquanto o aditivo ainda está marcado como adicional.
- As premissas mencionam inclusão do aditivo por seu número ou por termos de sua descrição. Expressões de negação e custo separado são tratadas para reduzir falsos avisos.
- A variação do restante entre revisões coincide com o impacto de custo adicional ou com a soma dos impactos adicionais da etapa. Revisões consecutivas sem alteração do restante não apagam o indício ainda pendente de conferência.

São comparados registros da mesma obra e etapa de primeiro nível, incluindo subetapas. Revisões órfãs de etapas removidas não entram na análise atual. Sem orçamento, o acompanhamento permanece em Sem apropriação. Não são comparados preço comercial do aditivo, saldo pago ou reserva de risco como se fossem o mesmo custo. Valores iguais sem um indício de inclusão ou de variação não bastam para gerar aviso.

A análise numérica usa centavos e tolerância de um centavo. Considera o impacto individual e a soma dos impactos ainda não conferidos da etapa; não busca todas as combinações possíveis de subconjuntos. Texto e coincidência numérica são indícios para análise humana, não uma comprovação de duplicidade ou uma auditoria exaustiva.

## Como conferir

1. Leia a etapa, o aditivo, o valor e o motivo apresentados no aviso.
2. Confira o **Custo restante para concluir** e as premissas.
3. Em **Conferência dos aditivos no custo restante**, escolha **Já está no restante informado** ou **Fora do restante — considerar separadamente**. **Ainda não conferido** permite manter a pendência.
4. Se o impacto já estiver dentro do restante, abra **Editar** ou **Atualizar acompanhamento** do aditivo e altere a opção para **Já incluído no restante da etapa**.
5. Se continuar separado, registre essa análise na conferência e confirme a previsão. Os valores permanecem os informados; a conferência não exclui custos automaticamente.

Todas as etapas podem continuar com o aviso. A escolha fica na revisão e no histórico com autor, data, valor do impacto e valor restante conferido. A conferência deixa de ser aplicável quando o valor restante, impacto ou orçamento conferido muda. Permissões, identidades, versões concorrentes e integridade dos números continuam protegidas.

## Exemplo validado

R$ 80 mil incorridos + R$ 70 mil restantes + R$ 5 mil de reserva + R$ 8 mil de aditivo adicional = **R$ 163 mil**.

Se o restante passar a R$ 78 mil e o aditivo continuar adicional, o resultado é **R$ 171 mil**, com aviso de possível sobreposição de R$ 8 mil. O usuário pode salvar assim, registrar que o aumento tem outra causa e manter o custo separado, ou confirmar a inclusão e marcar o aditivo como Já incluído. Na última opção, o total retorna a **R$ 163 mil**.

O mesmo raciocínio vale para uma economia: reduzir o restante e manter uma mudança negativa adicional pode abater o valor duas vezes.

## Validação local

```powershell
npx vitest run src/LegacyApp src/features/financeiro src/domains/financeiro src/domains/obras src/domains/sync src/domains/dre src/features/help server/operational-command-policy.test.js
npm run lint
npm run typecheck
npm run architecture:check
npx vite build --outDir artifacts/ajuda/duplication-build
npx playwright test --config playwright.forecast-duplication.config.mjs
```

O build direto evita o `prebuild` com migrações remotas. As APIs do navegador executam os comandos reais em memória com dados fictícios. A cobertura inclui resolução por conferência, correção do aditivo, alteração do valor conferido, economias, múltiplos aditivos, isolamento entre etapas, retorno idempotente, ajuda e uso em desktop, celular e 320 px.

A ajuda e o manual são gerados de `src/features/help/help-content.js`. Evidências desta etapa: `artifacts/ajuda/duplication-*`.

Resultado: **563 testes em 96 arquivos e 9 cenários de navegador aprovados**. Lint, tipos, arquitetura, manual e build aprovados. Detector das interfaces alteradas sem achados. O build conserva o aviso de chunks maiores que 650 kB. Dois testes que dependiam da localização de código no LegacyApp foram ajustados às extrações concorrentes, sem alterar o comportamento do app.
