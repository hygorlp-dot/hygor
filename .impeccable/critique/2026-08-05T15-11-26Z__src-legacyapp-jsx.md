---
target: terceirizados
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-05T15-11-26Z
slug: src-legacyapp-jsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Bons totais, progresso e estados pendentes; mudanças de status e erros ainda dependem de toast transitório. |
| 2 | Match System / Real World | 4 | Vocabulário e modelo causal de obra, medição, retenção, obrigação e DRE são excelentes. |
| 3 | User Control and Freedom | 2 | Cancelamentos usam prompt/confirm nativos e o formulário longo não possui rascunho. |
| 4 | Consistency and Standards | 2 | O núcleo segue ARCD Carbon, mas medições usam estilos locais, tipografia pequena e verbos destrutivos inconsistentes. |
| 5 | Error Prevention | 3 | Evidência, retenções e origem de pagamento são validadas; alterações de quadro e exclusão ainda têm prevenção insuficiente. |
| 6 | Recognition Rather Than Recall | 3 | Percentual anterior, delta e totais são visíveis; o usuário ainda precisa lembrar a diferença entre medido, devido, pago e saldo. |
| 7 | Flexibility and Efficiency | 3 | Filtros, reaproveitamento de prestador e atalhos de movimento ajudam; faltam busca, lote, filtros salvos e teclado. |
| 8 | Aesthetic and Minimalist Design | 2 | A densidade combina com operação, mas KPIs, alertas, abas e quadros disputam prioridade; cadastro expõe campos demais. |
| 9 | Error Recovery | 3 | Mensagens de risco são concretas; erros de servidor e validações por toast não oferecem recuperação persistente. |
| 10 | Help and Documentation | 3 | Microcopy contextual é forte; orientação está dispersa e não há jornada por papel. |
| **Total** | | **28/40** | **Saudável, com riscos operacionais importantes** |

## Design Specificity Verdict

**LLM assessment:** altamente específico e genuinamente operacional. Quadro por obra, contratos independentes por prestador, etapas, medição acumulada, evidência fotográfica, retenções ISS/INSS e reconhecimento no DRE não seriam intercambiáveis com um painel genérico. A fraqueza é transformar toda essa riqueza em uma única área para RH, engenharia e financeiro, sem prioridade suficientemente diferente por função.

**Deterministic scan:** 91 achados no arquivo monolítico: 71 `side-tab`, 12 `overused-font`, 7 `layout-transition` e 1 `border-accent-on-rounded`. Apenas dois são diretamente relevantes à superfície analisada, em `src/LegacyApp.jsx:12619` e `:12648`: cartões arredondados com borda lateral de 4px nos resumos de pagamento. Os achados de fontes e transições ficaram fora do módulo e foram tratados como falsos positivos de escopo. A folha específica de Terceirizados usa majoritariamente bordas estruturais coerentes com ARCD Carbon.

**Visual overlays:** automação de navegador não estava disponível nas ferramentas dos avaliadores; nenhuma sobreposição visual confiável foi apresentada. A evidência alternativa foi a inspeção independente de JSX e CSS.

## Overall Impression

É um módulo com excelente conhecimento do domínio e um fluxo de medição acima da média, mas com uma arquitetura de informação que exige que o operador compreenda sozinho qual número representa contrato, execução, obrigação ou caixa. A maior oportunidade é organizar a jornada financeira por tipo de contrato e papel do usuário.

## What's Working

- A medição mostra percentual anterior, acumulado, delta percentual, valor incremental, evidência e consequência no DRE no momento da decisão.
- Multiobra é estrutural: quadros por obra, filtros globais, identidade reutilizável do prestador e contratos independentes.
- Auditabilidade aparece no comportamento: cancelamentos e estornos preservam histórico, comandos impedem duplicidade e a evidência identifica o responsável.

## Priority Issues

### [P0] Controles críticos pequenos e Kanban sem alternativa acessível completa

**Why it matters:** ações de movimento e exclusão usam alvos próximos de 26×26px; arrastar não possui modelo de teclado ou anúncio de destino. Em tablet/campo e para usuários com limitação motora, o risco de erro é alto.

**Fix:** elevar áreas de toque, nomear ações pelo destino real, oferecer menu de mudança de status acessível e separar cancelamento das ações cotidianas.

**Suggested command:** `$impeccable adapt terceirizados`

### [P1] Contratado, medido, devido e pago não formam um único modelo visível

**Why it matters:** pagamentos semanais e liquidação de medições coexistem; um contrato por medição pode parecer pagável também na rotina semanal. O saldo cadastral pode ser confundido com obrigação reconhecida.

**Fix:** condicionar ações ao tipo de contrato e apresentar uma sequência única: contratado → medido → devido → pago, com valores e datas.

**Suggested command:** `$impeccable clarify terceirizados`

### [P1] Cadastro de contrato concentra cerca de 30 campos sem rascunho

**Why it matters:** PF/PJ, contrato, pagamento, retenções e documentos aparecem em um único modal longo. Fechar por engano perde trabalho e aumenta abandono.

**Fix:** aplicar etapas ou seções progressivas condicionais, resumo antes de salvar e preservação de rascunho.

**Suggested command:** `$impeccable distill terceirizados`

### [P1] Cancelamentos e exclusões usam primitivas frágeis

**Why it matters:** `window.prompt` e `window.confirm` não mostram impacto financeiro, histórico afetado ou distinção entre retirar do quadro e cancelar o registro auditável.

**Fix:** confirmação contextual com entidade, obra, medições/pagamentos vinculados, motivo obrigatório, impacto e resultado esperado.

**Suggested command:** `$impeccable harden terceirizados`

### [P2] Dívida visual e tipográfica nas áreas de medição/pagamento

**Why it matters:** legendas de 8,5–10px, cores e raios locais e referências a Inter divergem do IBM Plex e dos tokens ARCD Carbon, reduzindo legibilidade.

**Fix:** migrar para tokens de tipo, espaçamento, estado e componentes estruturais; remover cartões com borda lateral arredondada detectados.

**Suggested command:** `$impeccable polish terceirizados`

## Persona Red Flags

**Operador experiente:** não encontra busca textual, ações em lote, filtros salvos ou fluxo denso de teclado. Muitos quadros horizontais degradam com o crescimento da carteira.

**Usuário iniciante:** não há jornada canônica entre Quadro, Cadastro e Medições. “Medido”, “saldo”, “a medir”, “previsto”, “obrigação” e “pago” aparecem sem um ciclo visual unificador.

**Engenheiro de campo:** a evidência é adequada, mas o formulário usa grade densa e texto pequeno; falhas de rede/upload não oferecem rascunho. Arrastar horizontalmente em tela tátil compete com a rolagem.

**Financeiro:** pagamentos semanais e pagamentos de medição aparecem sem bloqueio suficientemente explícito por tipo de contrato. “Desfazer” não comunica que é um estorno auditável; a confirmação deveria resumir bruto, retenções, líquido, pagador, obra, competência e obrigação baixada.

## Minor Observations

- Pluralizações como “medição(ões)” e “contrato(s)” reduzem acabamento.
- “Nome / Apelido” precisa distinguir nome operacional de razão social.
- “CND vencida” pode estar incorreto quando outro documento é o vencido.
- Estado vazio após filtro deveria oferecer “Limpar filtros”.
- A ajuda do Kanban aparece depois dos quadros, tarde demais para iniciantes.
- O quarto KPI muda conforme o papel sem explicar essa personalização.

## Questions to Consider

1. O objeto central é o prestador, o contrato ou a obrigação financeira?
2. Um contrato “por medição” deveria aparecer na rotina semanal de pagamento?
3. Qual pergunta deve ser respondida primeiro para cada papel: quem executa, o que medir, o que pagar ou quem está irregular?
4. “Excluir contrato do quadro” comunica corretamente um cancelamento auditável permanente?
