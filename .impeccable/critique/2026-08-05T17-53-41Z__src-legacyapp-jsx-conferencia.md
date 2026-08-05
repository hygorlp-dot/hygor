---
target: Conferência técnica
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T17-53-41Z
slug: src-legacyapp-jsx-conferencia
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Progresso, abertos e upload são visíveis; a persistência e a autoria das alterações de metadados não são. |
| 2 | Match System / Real World | 4 | Vistoria, patologia, ajuste, etapa, prazo e evidência correspondem muito bem ao trabalho de obra. |
| 3 | User Control and Freedom | 2 | Cancelar preserva histórico, mas prompts nativos e autosave sem desfazer reduzem controle. |
| 4 | Consistency and Standards | 2 | O fluxo é coerente, porém tipografia local, azul, raios e sombras divergem do ARCD Carbon. |
| 5 | Error Prevention | 2 | Bloqueia conclusão com pendências abertas, mas uma vistoria vazia pode aparecer pronta e concluir sem comprovação. |
| 6 | Recognition Rather Than Recall | 3 | Rótulos são claros; seletores extensos e ausência de filtros exigem varredura e memória. |
| 7 | Flexibility and Efficiency | 2 | A câmera e a barra móvel são eficientes; falta triagem por status, impacto, prazo e responsável. |
| 8 | Aesthetic and Minimalist Design | 2 | A densidade é correta, mas badges, microtexto e bordas coloridas fragmentam a hierarquia. |
| 9 | Error Recovery | 2 | Toasts ajudam, mas não há recuperação clara de autosave, upload parcial ou edição acidental. |
| 10 | Help and Documentation | 3 | A microcopy operacional é boa; critérios para nota, impacto, aprovação e conclusão seguem implícitos. |
| **Total** | | **25/40** | **Bom — base sólida, com riscos importantes de confiança e escala** |

## Design Specificity Verdict

**LLM assessment:** a Conferência Técnica é funcionalmente autoral. O ciclo achado → responsável → foto da correção → validação → histórico pertence claramente à construção civil e não parece um CRUD apenas renomeado. A especificidade visual é menor: cards arredondados, badges, azul, sombras e tipografia local aproximam a tela de um dashboard administrativo genérico e diluem a precisão estrutural do ARCD Carbon.

**Deterministic scan:** 90 avisos em `src/LegacyApp.jsx`: 70 `side-tab`, 1 `border-accent-on-rounded`, 12 `overused-font` e 7 `layout-transition`. No escopo da Conferência há cinco achados: uma borda lateral no card vivo de achado (`:31164`) e quatro no relatório gerado (`:31090`), incluindo Arial e combinação de borda acentuada com painel arredondado. Os outros 85 são falsos positivos de escopo do arquivo monolítico. O modal de novo achado não gerou aviso determinístico.

**Visual overlays:** não há sobreposição visual confiável. O ambiente não expôs navegador mutável nem `agent-browser`; a produção respondeu HTTP 200, e a evidência alternativa foi inspeção do JSX e do CSS responsivo (`src/index.css:4591–4624`).

## Overall Impression

A tela entende a vistoria em campo melhor do que a maioria dos sistemas: câmera, atribuição, prazo e validação formam uma cadeia operacional real. A maior oportunidade é transformar “ausência de pendência” em “evidência de inspeção concluída” — hoje o sistema pode comunicar sucesso sem provar que a vistoria aconteceu.

## What's Working

- O ciclo completo de correção é específico, legível e auditável: achado, responsável, foto, parecer e histórico.
- O mobile trata a câmera como ferramenta principal, com ação fixa, captura ambiente, galeria e anotação técnica.
- Cancelamento e arquivamento preservam registros e autoria em vez de apagar evidências silenciosamente.

## Cognitive Load and Emotional Journey

- O objetivo e a próxima ação móvel são reconhecíveis, mas listas grandes não têm busca, agrupamento ou triagem.
- Etapa do orçamento, responsável e categoria podem oferecer mais de quatro escolhas em seletores lineares sem contexto adicional.
- A entrada transmite controle; o registro fotográfico transmite rigor. A conclusão produz uma falsa sensação de segurança quando zero achados equivale visualmente a 100%.
- A nota inicial 10 ancora uma conclusão positiva antes da inspeção. Muitos microtextos e sinais coloridos aumentam a fadiga no campo.

## Priority Issues

### [P1] Vistoria vazia parece 100% concluída

**Why it matters:** ausência de achados não comprova inspeção. O sistema pode formalizar uma conferência vazia sem checklist, observação conclusiva ou declaração explícita de conformidade.

**Fix:** introduzir estado “não iniciada”; exigir checklist mínimo ou declaração “vistoria realizada sem inconformidades”, com escopo verificado, autoria e horário; só então calcular 100% e liberar conclusão.

**Suggested command:** `$impeccable harden Conferência técnica`

### [P1] Alterações centrais não têm trilha visível nem desfazer

**Why it matters:** data, responsável, nota e observações mudam diretamente. Meses depois, não fica claro quem alterou o quê, e um toque acidental pode modificar o registro técnico.

**Fix:** salvar metadados por comando auditável com ator, diff e horário; mostrar “última alteração”; agrupar edição em modo explícito e oferecer desfazer imediato.

**Suggested command:** `$impeccable harden Conferência técnica`

### [P1] Legibilidade e toque ficam abaixo do padrão de campo

**Why it matters:** textos de 8–10 px, badges de 7 px e ações compactas prejudicam leitura sob sol, movimento ou uso com luvas, embora a barra móvel principal já respeite 44 px.

**Fix:** aplicar tokens `--arcd-type-*`; nunca reduzir abaixo do caption; garantir 44×44 px em editar, cancelar, validar e arquivar evidência; manter ações com texto e ícone.

**Suggested command:** `$impeccable audit Conferência técnica`

### [P2] Hierarquia visual fragmenta criticidade, navegação e ação

**Why it matters:** azul, laranja, bordas laterais, badges, sombra e raios competem com o ouro e com os estados críticos. O detector confirma uma borda lateral relevante na tela e deriva tipográfica no relatório.

**Fix:** ouro somente para seleção, foco e ação primária; verde/amarelo/vermelho apenas para estados; painéis estruturais sem sombra, raio de até 4 px e tipografia IBM Plex também no relatório.

**Suggested command:** `$impeccable polish Conferência técnica`

### [P2] A operação não escala para muitas pendências

**Why it matters:** dezenas de achados, etapas ou responsáveis exigem varrer cards e seletores lineares. O usuário não recebe uma fila clara do que vencerá, do que é crítico e do que aguarda validação.

**Fix:** adicionar busca e filtros persistentes por status, impacto, vencimento, responsável e etapa; ordenar por risco/prazo; tornar contagens acionáveis; oferecer visão compacta e agrupamento.

**Suggested command:** `$impeccable distill Conferência técnica`

## Persona Red Flags

**Engenheiro auditor:** consegue concluir uma vistoria vazia; aprovação conforme aceita parecer opcional; autosave não apresenta comprovante persistente nem histórico comparável.

**Engenheiro de campo:** a câmera é bem priorizada, mas microtexto e ações pequenas prejudicam uso em obra; falta uma fila “o que corrigir agora” ordenada por prazo e criticidade.

**Administrador:** pode reatribuir responsável e alterar nota, data e observações sem enxergar o diff; ranking e nota parecem objetivos apesar de não existir rubrica explícita.

## Minor Observations

- A nota inicial 10 produz viés de ancoragem; deixe-a vazia ou derive-a de critérios.
- “Relatório PDF” abre uma página para impressão; “Gerar relatório” descreve melhor a ação.
- O motivo de arquivamento da foto não aparece junto à miniatura arquivada.
- O código chama a operação de `excluirConferencia`, enquanto a interface corretamente fala em cancelar.
- O relatório usa Arial e uma linguagem visual distinta do restante do produto.
- Aprovação conforme deveria exigir pelo menos um critério/verificação objetiva, mesmo que o parecer textual permaneça opcional.

## Questions to Consider

1. Se uma conferência sem achados vale 100%, o sistema está medindo qualidade ou apenas ausência de registros?
2. A nota 0–10 é reproduzível por dois auditores diferentes ou é uma impressão subjetiva com aparência de precisão?
3. Em seis meses, alguém consegue reconstruir cada mudança sem confiar na memória da equipe?
4. Qual deve ser o primeiro sinal visual: criticidade, próxima ação ou marca ARCD? Hoje os três competem.

## Resolução — 05/08/2026

Os cinco problemas prioritários foram resolvidos e validados em quatro frentes de aceite:

| Frente | Resultado | Evidência |
|---|---:|---|
| Integridade do fluxo | 4/4 | Estado “não iniciada”, declaração obrigatória para vistoria sem achados, bloqueio por pendência aberta e rubrica calculada. |
| Rastreabilidade | 4/4 | Edição explícita, ator/horário/detalhes em trilha visível, confirmação após persistência e cancelamentos com motivo estruturado. |
| Operação em escala | 4/4 | Busca, filtros por status/impacto/responsável/vencimento, ordenação por risco e prazo e estado vazio orientado. |
| Campo e linguagem visual | 4/4 | Alvos de toque de 44 px, texto legível, IBM Plex no relatório, superfícies estruturais ARCD Carbon e ações nomeadas. |

Validação executada após a implementação:

- detector Impeccable: **zero achados no escopo da Conferência Técnica**;
- testes automatizados: **934/934 aprovados** em 202 arquivos;
- testes novos do motor de conferência: fluxo vazio, declaração, bloqueio, nota ponderada, reincidência, filtro e prioridade;
- build de produção: **aprovado**.

O scanner ainda aponta ocorrências históricas fora desse escopo no arquivo monolítico; elas não pertencem à Conferência Técnica e não foram alteradas nesta correção.
