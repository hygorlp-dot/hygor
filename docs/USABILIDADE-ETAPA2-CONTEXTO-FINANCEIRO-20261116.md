# Etapa 2 — Contexto da obra e indicadores financeiros

Implementada e validada localmente em 16/11/2026. Sem publicação, push, commit, migrações ou operações de negócio remotas. Alterações anteriores do checkout preservadas.

## Contexto e continuidade

- Caixa da obra acompanha a Obra em foco nos dois sentidos. Uma obra sem caixa ativado aparece com orientação explícita; outro caixa não é selecionado silenciosamente. O modal identifica a obra do lançamento. Sem caixa disponível, não oferece operações.
- A navegação comum para Gestão financeira respeita a obra sincronizada. Corrigida a reaplicação de contexto antigo pela intenção de navegação sem vínculo; intenções vinculadas a registros mantêm seu comportamento.
- Dashboard mantém mês e expansão de indicadores ao retornar. Os atalhos financeiros levam a mesma competência e escopo consolidado ao DRE. DRE obras mantém filtros próprios; a orientação identifica obra, período e modo. DRE empresa identifica seu escopo consolidado. A Obra em foco permanece disponível para a operação.
- A fila de cobranças e o ranking de conferências continuam com seus recortes de carteira. As notas explicam que a seleção local da lista não filtra esses quadros; não houve associação por nome nem mudança dos critérios para forçar igualdade entre contadores.

## Origem e interpretação dos valores

Os valores do painel continuam vindos de `calcDREConsolidado` e do resumo executivo. `recebido` corresponde às entradas de caixa, que podem incluir aportes; o rótulo passa a ser **Entradas de caixa**. Faturamento por competência aparece separado. Custos reconhecidos usam a mesma competência; o percentual compara com faturamento. Sem faturamento positivo, comparação e margem mostram **N/A**, em vez de sugerir uma taxa zero.

O antigo Saldo atual é apresentado como **Movimento líquido de caixa**: entradas menos saídas no mês, não saldo bancário acumulado. Resultado por competência mantém sua fonte e cálculo. A explicação recolhível respeita as permissões de DRE; não revela custos ou caixa a perfis sem o respectivo acesso.

O cartão Obras ativas e o quadro Suas obras hoje usam critérios distintos já existentes. A orientação distingue cadastro completo/critério executivo de recorte operacional diário; as contagens não foram recalculadas.

Na fila de medições a faturar, o valor exibido passa a ser o restante após recebimentos, usando `totalRecebidoMedicao` e `statusRecebimentoMedicao`. A elegibilidade usa `active`, a regra canônica existente. Quitadas e canceladas ficam fora da cobrança. Exemplo validado: cobrança de R$ 100,00 com R$ 25,00 recebidos apresenta R$ 75,00; com outra de R$ 200,00, o total é R$ 275,00. A confirmação identifica a obra e o saldo consultado. O comando existente já calculava o restante e continua sendo revalidado no servidor; não foi substituído.

## Impacto no DRE e permissões

Nenhuma fórmula contábil, fato financeiro, permissão persistida ou comando de pagamento/recebimento foi alterado. Previsão, compromisso, estoque físico, custo reconhecido e pagamento permanecem distintos. Aportes de caixa não foram classificados como receita; a explicação torna essa diferença visível. A mudança de apresentação não reconhece custo nem cria outro custo no pagamento. Os testes comparam os dados, o razão, o DRE e o caixa antes/depois e recusam tentativas de gravação.

As permissões de navegação e apresentação foram verificadas com perfil amplo e perfil sem DRE. Isto não substitui uma auditoria completa de autorização no servidor ou a homologação dos dados reais. As divergências históricas e transações integradas da etapa 5 continuam pendentes. Não foi atribuída uma nova nota de usabilidade nem declarada a meta 9,5.

## Validação local

| Verificação | Evidência |
|---|---|
| Unitários | 67 testes aprovados em 6 arquivos: leitura financeira, contexto, resumo executivo, gestão à vista, razão e conciliação |
| DEV | 10 cenários aprovados, sessões novas em 390 e 1440 px |
| Build final | 20 cenários aprovados: 10 desta etapa e 10 regressões da etapa 1 |
| Interação | Troca de obra, ausência de caixa, modal/cancelamento, manutenção de filtros e mês, cobranças parciais/quitadas/canceladas, ranking e acesso restrito |
| Integridade | Dados fictícios; APIs locais interceptadas, gravações de negócio bloqueadas; zero erros de página e zero tentativas de gravação nos cenários |
| Qualidade | Lint, design:check, manual:check e typecheck aprovados; nenhuma baseline aumentada |
| Inicialização | Análise de 920 arquivos e 3.211 arestas sem ciclos de importação; sessões novas no DEV e build |
| Bundle final | 1.821.765 bytes gzip, abaixo do teto vigente de 1.891.328; sem violações individuais ou aumento de limites |
| Ajuda | Fonte revisada em 16/11/2026; manual regenerado e sincronizado, 143 guias e 65 abas |
| Revisão visual | Capturas do build em celular e desktop: painel, DRE, caixa sem ativação, cobranças e ranking; sem overflow horizontal da página nos cenários |

Executado `npx vite build --outDir artifacts/roadmap-usabilidade-etapa2/dist`, sem o prebuild que executa migrações. Build, métricas, logs e capturas ficaram na pasta desta etapa; o `dist` e as métricas preexistentes da raiz não foram sobrescritos por esta validação.

Para repetir: prévia DEV local na porta 4400 com `scripts/rebranding-pilot-preview.mjs` e `MARCELL_PREVIEW_PORT=4400`; testes com `npx playwright test --config artifacts/roadmap-usabilidade-etapa2/playwright.config.mjs`. Para o build, servir `artifacts/roadmap-usabilidade-etapa2/preview.mjs` na porta 4401 e executar `npx playwright test --config artifacts/roadmap-usabilidade-etapa2/playwright.build.config.mjs` com `ROADMAP_MODE=stage2-build`. As prévias e testes usam dados fictícios locais.

## Capturas revisadas

![Painel no celular](../artifacts/roadmap-usabilidade-etapa2/dashboard-stage2-build-390.png)

![DRE com o mês recebido do painel](../artifacts/roadmap-usabilidade-etapa2/dre-mes-vinculado-stage2-build-390.png)

![Cobranças com saldo restante no celular](../artifacts/roadmap-usabilidade-etapa2/cobrancas-saldos-stage2-build-390.png)

![Cobranças no desktop](../artifacts/roadmap-usabilidade-etapa2/cobrancas-saldos-stage2-build-1440.png)

![Caixa sem ativação no desktop](../artifacts/roadmap-usabilidade-etapa2/caixa-sem-ativacao-stage2-build-1440.png)
