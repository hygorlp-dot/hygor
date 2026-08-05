---
target: Solicitar materiais para Compras
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T18-19-45Z
slug: src-legacyapp-jsx-modalsolicitacaocompra
---
# Crítica — Solicitar materiais para Compras

## Design Health Score

| # | Heurística | Nota | Questão principal |
|---|---|---:|---|
| 1 | Visibilidade do estado do sistema | 2 | Busca informa carregamento, mas envio não mostra progresso, resumo ou proteção contra duplo clique. |
| 2 | Correspondência com o mundo real | 3 | SINAPI/ORSE, conversão e apropriação são específicos; “Supabase” e “1º nível” expõem linguagem interna. |
| 3 | Controle e liberdade | 1 | Fechar perde alterações, remover é imediato e linhas incompletas podem desaparecer no envio. |
| 4 | Consistência e padrões | 2 | O fluxo funciona, mas tipografia, cores por fonte, pesos e tamanhos locais divergem do ARCD Carbon. |
| 5 | Prevenção de erros | 1 | Linhas inválidas são filtradas; obra pode mudar após apropriações; não há trava visual durante o envio. |
| 6 | Reconhecimento em vez de memorização | 2 | Equivalência ajuda, mas as duas ações de criação e as cores das fontes precisam ser aprendidas. |
| 7 | Flexibilidade e eficiência | 3 | Busca com debounce, duplicação e conversão automática de aço ajudam operadores experientes. |
| 8 | Design estético e minimalista | 2 | Muitos controles simultâneos, caixas aninhadas, microtexto e peso excessivo fragmentam a sequência. |
| 9 | Reconhecimento e recuperação de erros | 1 | Validação por toast não aponta campos; remoção não tem desfazer; falha de busca não oferece tentar novamente. |
| 10 | Ajuda e documentação | 2 | Há boa ajuda contextual, mas o fluxo e a diferença entre item local e catálogo não são explicados. |
| **Total** | | **19/40** | **Precisa de revisão — domínio forte, segurança operacional insuficiente** |

## Design Specificity Verdict

**Avaliação de design:** a modelagem é claramente autoral para construção civil: base/data/UF/desoneração, unidade de compra versus referência, conversão automática de aço, orçamento em rascunho e apropriação por etapa. Visualmente, porém, essa riqueza está presa num mega-modal de administração genérico. Busca, cadastro de catálogo, conversão, apropriação e envio têm peso quase igual; microtexto, caixa sobre caixa e cores locais substituem uma sequência operacional clara.

**Varredura determinística:** 84 avisos no monólito `src/LegacyApp.jsx` — 66 `side-tab`, 11 `overused-font` e 7 `layout-transition`. **Nenhum** está entre as linhas 24200–24340 ou pertence a `ModalSolicitacaoCompra`; todos são ruído fora do escopo desta crítica. O detector, portanto, não contradiz os achados de fluxo e acessibilidade, mas também não consegue enxergá-los.

**Sobreposição visual:** não há overlay confiável. A produção respondeu HTTP 200, mas não havia navegador mutável operacional: `agent-browser` ausente, renderização web recusada e Chromium sem `libnspr4.so`. A evidência alternativa foi inspeção isolada do componente, dos primitivos compartilhados e do CSS/design system.

## Overall Impression

É um formulário competente para quem conhece a arquitetura interna do sistema, mas ainda não é um instrumento seguro para quem está em campo. A maior oportunidade é transformar o pedido numa sequência “contexto → materiais → revisão e envio”, deixando o sistema assumir conversões e impedindo que qualquer linha desapareça sem decisão explícita.

## What's Working

- O vocabulário e os dados pertencem ao trabalho real: SINAPI/ORSE, aço em kg/m/barra, orçamento e múltiplas obras.
- Busca com debounce, duplicação e equivalência imediata reduzem repetição para usuários frequentes.
- O diálogo base já possui semântica, contenção de foco, Escape e restauração do foco anterior.

## Cognitive Load and Emotional Journey

O fluxo reúne oito decisões: obra, prazo, prioridade, base, busca, tipo de criação, unidade/conversão, etapa orçamentária e envio. A complexidade de materiais é real, mas o cadastro global de insumo e a exposição de fatores de conversão adicionam carga extrínseca. A experiência começa confiante e termina com sensação de configurar um ERP; no momento de maior risco, “Enviar para Compras” não oferece uma revisão clara do que será efetivamente salvo.

## Priority Issues

### [P1] Linhas incompletas são descartadas silenciosamente

**Por que importa:** `salvarSolicitacao` filtra linhas sem descrição, unidade ou quantidade positiva e salva as demais. Um pedido pode aparentar sucesso enquanto um material digitado desaparece.

**Correção:** validar cada linha visível, marcar campos e focar o primeiro erro; nunca remover linha implicitamente. Se o descarte for desejado, pedir confirmação com a descrição do item.

**Comando sugerido:** `$impeccable harden Solicitar materiais para Compras`

### [P1] Um único modal contém quatro fluxos diferentes

**Por que importa:** solicitar, pesquisar referência, administrar catálogo e apropriar orçamento coexistem sem progressão. “Criar item próprio” e “Cadastrar novo insumo” parecem variações da mesma ação.

**Correção:** organizar em `1 Contexto`, `2 Materiais`, `3 Revisar e enviar`; mover cadastro global para diálogo secundário; renomear para “Adicionar somente a este pedido” e “Cadastrar no catálogo e adicionar”.

**Comando sugerido:** `$impeccable distill Solicitar materiais para Compras`

### [P1] Interações móveis e destrutivas não são seguras

**Por que importa:** remover usa um `x` sem nome acessível, confirmação ou desfazer; botões compactos e textos de 8,5–9,5 px ficam abaixo do padrão de campo; a linha de material vira uma grade horizontal de sete colunas.

**Correção:** ação “Remover material” com 44×44 px e desfazer; `:focus-visible`; no mobile, card em uma coluna com quantidade/unidade agrupadas e ações sempre visíveis.

**Comando sugerido:** `$impeccable audit Solicitar materiais para Compras`

### [P2] Estados críticos de edição e envio estão ausentes

**Por que importa:** Escape/backdrop podem perder trabalho; o envio não bloqueia duplo clique; trocar obra pode manter etapas do orçamento anterior; busca falha sem ação de repetição.

**Correção:** dirty state com confirmação de saída, estado `salvando`, idempotência, limpeza/validação das apropriações ao trocar obra e botão “Tentar novamente”.

**Comando sugerido:** `$impeccable harden Solicitar materiais para Compras`

### [P2] Linguagem visual diverge do ARCD Carbon

**Por que importa:** azul, roxo e laranja codificam fontes; pesos 800–900, microtexto, Inter e caixas coloridas competem com o ouro e com os estados reais.

**Correção:** IBM Plex e tokens `--arcd-type-*`; superfícies estruturais neutras; ouro apenas em foco/seleção/primária; fontes identificadas por texto, não por código cromático.

**Comando sugerido:** `$impeccable polish Solicitar materiais para Compras`

## Persona Red Flags

**Engenheiro de campo no celular:** encontra rolagem horizontal dentro de modal vertical, texto pequeno e ações compactas. Pode remover uma linha por toque impreciso ou não perceber campos fora da viewport.

**Comprador responsável:** pode receber uma solicitação sem uma linha que o solicitante acreditava ter enviado. Sem resumo final, não consegue distinguir omissão intencional de descarte automático.

**Novo funcionário:** precisa inferir “base de referência”, desoneração, fator de conversão, baseline e a diferença entre duas ações de criação antes de concluir uma solicitação simples.

## Minor Observations

- A busca exige dois caracteres, mas não informa esse limite.
- Resultados truncam descrições sem expansão ou título.
- “Nenhuma base pronta no Supabase” deveria orientar uma ação sem expor infraestrutura.
- “Data necessária na obra” é mais claro que “Necessidade na obra”.
- “Etapa principal do orçamento” é mais natural que “Etapa de 1º nível”.
- Valores e códigos deveriam usar IBM Plex Mono/algarismos tabulares.
- Prioridade urgente deveria pedir justificativa operacional.

## Questions to Consider

1. O pedido de material é realmente o lugar certo para administrar o catálogo global?
2. O engenheiro precisa ver fatores de conversão ou basta informar “20 barras de 12 m” e deixar o sistema calcular?
3. “Enviar para Compras” cria um rascunho reversível ou formaliza uma solicitação auditável?
4. Qual é o mínimo que o campo deve informar, e quais enriquecimentos pertencem ao comprador?

## Resolução — 05/08/2026

Decisões confirmadas pelo produto: o catálogo permanece no fluxo, a conversão deve ficar visível e o envio formaliza uma solicitação auditável.

| Critério de aceite | Resultado | Evidência |
|---|---:|---|
| Persistência e formalização | 4/4 | O modal aguarda a fila e só fecha após confirmação do servidor; falha, conflito e offline preservam o formulário; autor e horário são registrados. |
| Prevenção e recuperação | 4/4 | Nenhuma linha é filtrada; erros são apresentados por item, urgência exige justificativa, remoção tem desfazer e saída suja exige confirmação. |
| Fluxo operacional | 4/4 | Sequência contexto → materiais → revisão; catálogo e conversões permanecem visíveis; resumo mostra exatamente o que será formalizado. |
| Campo e ARCD Carbon | 4/4 | Cards móveis sem rolagem horizontal, ações de 44 px, foco visível, IBM Plex, superfícies neutras e texto operacional ampliado. |

Validação final:

- **943/943 testes aprovados** em 204 arquivos;
- 9 regressões novas para validação, troca de obra, conversão, formalização e confirmação remota;
- build de produção aprovado;
- detector Impeccable: **zero achados no componente**.
