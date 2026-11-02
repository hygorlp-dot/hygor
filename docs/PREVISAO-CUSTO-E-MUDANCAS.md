# Previsão de custo final e mudanças — validação local

Implementação de 31/10/2026. Alterações mantidas localmente, sem publicação ou deploy nesta entrega.

## Onde usar

- **Financeiro → Custos por etapa:** memória dos valores, revisão do restante, reserva e histórico.
- **Obras → abrir obra → Visão geral:** mudanças e aditivos; previsão executiva calculada pela mesma base do Financeiro.
- **Ajuda da previsão / Ajuda de mudanças:** passos, responsáveis, exemplos e tratamento das pendências. A fonte é `src/features/help/help-content.js`, que gera `docs/MANUAL_DO_APP.md`.

## Cálculo

**Custo final = incorrido + custo restante + reserva de risco + impactos explicitamente adicionais.**

O custo restante informado inclui as compras ainda não faturadas. A referência automática é o máximo entre zero, orçamento menos incorrido e compras ainda não faturadas. Custos de mão de obra não abatem pedidos que ainda não viraram custo. Pagamentos não geram outro custo nessa soma.

O saldo não faturado usa os documentos reconhecidos do pedido, com limite no valor do próprio pedido. Em pedidos multietapas, o saldo é distribuído proporcionalmente ao valor dos itens, conservando centavos. É um critério de estimativa, exposto na ajuda e no memorial; não comprova medição física. Compromissos e documentos refletem o cadastro atual, enquanto incorrido segue a competência e pagamentos seguem a data informada na tela.

Exemplo validado: R$ 80 mil incorridos + R$ 70 mil restantes (incluindo R$ 50 mil em compras pendentes) + R$ 5 mil de reserva + R$ 8 mil de mudança adicional = **R$ 163 mil**. Ao incorporar os R$ 8 mil no restante revisado, escolher **Já incluído** evita somá-los outra vez.

## Mudanças e aditivos

O valor comercial do aditivo, seu prazo e a decisão do cliente são separados do custo restante e da execução. Uma proposta não altera o contrato vigente. A aprovação real registrada pelo administrador atualiza valor e prazo contratuais; o acompanhamento pode continuar em qualquer situação.

Responsável, etapa, execução e impacto de custo têm revisão própria e histórico. Depois da decisão, **Atualizar acompanhamento** preserva os termos decididos e permite complementar evidência, execução e estimativa. Novos termos comerciais exigem outra mudança, preservando a decisão anterior.

O usuário escolhe **Não incluir**, **Adicional** ou **Já incluído**. Cancelar ou recusar não elimina automaticamente um impacto ainda marcado como adicional: pode haver custo remanescente. O app avisa para conferir e mantém a escolha explícita. Valores negativos representam economias; quando elas superam o custo restante, o app avisa.

## Pendências

Ausência de orçamento, responsável, etapa, evidência ou premissas; execução antes da aprovação; e base de previsão desatualizada geram avisos. A revisão manual continua em uso quando a base muda. É possível atualizar a base mantendo os valores e registrar uma nova revisão.

Sem orçamento aprovado, a previsão pode ser salva em **Sem apropriação**, sem comparação orçamentária. Revisões de etapas removidas ficam no histórico, fora do total atual, com aviso para transferência explícita. Uma previsão manual sem apropriação também avisa sobre possível sobreposição com etapas orçadas.

Permissões, identificação de registros, números e datas válidos, integridade dos termos decididos e conflitos de edição continuam verificados. São proteções dos dados; pendências processuais não impedem registrar a previsão ou acompanhar a mudança.

## Referências de produto

- [Procore — Forecast to Complete](https://support.procore.com/faq/which-calculation-method-should-i-choose-when-using-the-forecast-to-complete-feature): separar custos projetados e estimativa restante, evitando repetir valores já capturados.
- [Procore — Standard Budget Views](https://support.procore.com/faq/what-are-procores-standard-budget-views): distinguir orçamento, compromissos, custos e previsão de conclusão.
- [Autodesk Build — Cost Forecast](https://help.autodesk.com/cloudhelp/ENU/Build-Cost/files/Cost_Forecast.html): revisar o custo de conclusão com premissas explícitas.
- [Autodesk Build — Potential Change Orders](https://help.autodesk.com/cloudhelp/ENG/Build-Cost/files/change-orders/Cost_Potential_Change_Orders.html): acompanhar mudanças potenciais separadamente das decisões contratuais.

Esses padrões foram adaptados à regra deste app: pendências geram avisos, sem exigir a conclusão de uma etapa anterior para acompanhar o trabalho.

## Verificação reproduzível

O navegador usa dados fictícios e APIs interceptadas; cada gravação executa o comando real do domínio em memória. Não altera dados de produção.

```powershell
npx vitest run src/LegacyApp src/features/financeiro src/domains/financeiro src/domains/obras src/domains/sync src/domains/dre src/features/help server/operational-command-policy.test.js
npm run lint
npm run typecheck
npm run architecture:check
npx vite build --outDir artifacts/ajuda/forecast-build
npx playwright test --config playwright.cost-forecast.config.mjs
```

O build é invocado diretamente para não executar o `prebuild` do projeto, que inclui migrações remotas. Evidências e capturas ficam em `artifacts/ajuda/forecast-*`.

Resultado local: **544 testes em 95 arquivos aprovados**, **6 cenários de navegador aprovados** em desktop, celular e 320 px, incluindo igualdade da previsão na visão geral da obra. Lint, tipos, arquitetura, geração/conferência do manual e build passaram. Detector das superfícies alteradas: zero achados. O build conserva o aviso do projeto para chunks maiores que 650 kB.
