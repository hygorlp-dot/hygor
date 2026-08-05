---
target: equipes
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-05T17-30-57Z
slug: src-legacyapp-jsx-equipe
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | O desligamento termina com desaparecimento da lista ativa e toast transitório, sem comprovante ou estado persistente. |
| 2 | Match System / Real World | 3 | A linguagem de obra e RH é boa, mas “Demitir” também representa pedido de demissão e término contratual. |
| 3 | User Control and Freedom | 2 | Cancelamento existe, mas faltam correção, reativação e desfazer claramente definidos. |
| 4 | Consistency and Standards | 2 | “Demitir”, alterar Status e arquivar são três modelos concorrentes de ciclo de vida. |
| 5 | Error Prevention | 1 | Data futura pode marcar `active:false` imediatamente e o formulário genérico contorna o fluxo estruturado. |
| 6 | Recognition Rather Than Recall | 3 | KPIs, busca e identidade ajudam; ações icon-only e expansão não são plenamente reconhecíveis. |
| 7 | Flexibility and Efficiency | 1 | Sem ordenação, lote, atalhos ou visão compacta para uma carteira maior. |
| 8 | Aesthetic and Minimalist Design | 2 | A leitura básica funciona, mas cards, badges e ações perigosas disputam atenção e há deriva do ARCD Carbon. |
| 9 | Error Recovery | 3 | Erros do servidor são específicos, porém validações ficam apenas em toast e longe dos campos. |
| 10 | Help and Documentation | 2 | O modal explica preservação, mas não define a semântica da data nem encaminha para rescisão. |
| **Total** | | **21/40** | **Aceitável — melhorias significativas necessárias** |

## Design Specificity Verdict

**LLM assessment:** parcialmente autoral. Obra, lotação, diária, ponto, adiantamentos e desligamento são próprios da ARCD, e a preservação do histórico traduz auditabilidade. A composição, porém, ainda é um CRUD genérico: hero com KPIs, filtros, cards arredondados e ações repetidas. Faltam distribuição multiobra, linha temporal trabalhista, desligamento agendado e vínculo visível com folha, ponto e rescisão.

**Deterministic scan:** 88 avisos no arquivo monolítico — 68 `side-tab`, 1 `border-accent-on-rounded`, 12 `overused-font` e 7 `layout-transition` — mas nenhum fica dentro de `Equipe` (linhas 8013–8450); são falsos positivos de escopo, não necessariamente do aplicativo. A inspeção manual encontrou um ponto cego: uso local de Inter em camelCase JSX, além de falhas semânticas que o detector não cobre.

**Visual overlays:** automação de navegador mutável não estava disponível; nenhuma sobreposição visual confiável foi apresentada. A evidência visual alternativa foi a captura fornecida pelo usuário e a inspeção independente de JSX/CSS.

## Overall Impression

A tela oferece boa orientação inicial e a nova confirmação de desligamento é uma melhora real. A maior oportunidade é transformar o CRUD de funcionários num painel de ciclo trabalhista multiobra, com estados inequívocos e consequências operacionais previsíveis.

## What's Working

- Os KPIs de ativos, obras com equipe, administrativo e sem lotação dão contexto operacional imediato.
- O desligamento identifica pessoa, função e obra, classifica o evento e alerta sobre adiantamentos.
- Cadastro, frequência, pagamentos, adiantamentos e obra anterior são preservados, respeitando a auditabilidade do produto.

## Priority Issues

### [P1] A data prometida e o efeito operacional não coincidem

**Why it matters:** `active:false` é gravado imediatamente, inclusive para data futura. Isso pode retirar hoje o funcionário da equipe/ponto, enquanto o motor trata `endDate` como inclusiva.

**Fix:** usar “Último dia trabalhado”, explicar quando a exclusão operacional começa, bloquear data futura até existir `desligamento_agendado`, e mostrar consequências antes de confirmar.

**Suggested command:** `$impeccable harden equipes`

### [P1] Ciclo de vida fragmentado e histórico invisível

**Why it matters:** “Demitir”, `Status: Inativo / Demitido` e “Arquivar cadastro” concorrem. Tipo, notas e operador do desligamento não aparecem depois.

**Fix:** estados ativo → desligamento agendado → desligado → arquivado; remover desligamento do formulário genérico; renomear para “Registrar desligamento”; exigir motivo em “Outro”; exibir evento e permitir correção/reativação auditável.

**Suggested command:** `$impeccable clarify equipes`

### [P1] Fluxo incompleto para teclado e leitor de tela

**Why it matters:** busca/filtro sem rótulos, expansão sem `aria-expanded`, ações icon-only sem nome e modal sem focus trap dificultam ou impedem a operação assistiva.

**Fix:** rotular controles, nomear ações, associar acordeão, conter foco no modal e levar erros aos campos com foco no primeiro inválido.

**Suggested command:** `$impeccable audit equipes`

### [P2] Lista expõe perigo demais e escala mal

**Why it matters:** “Demitir” aparece em toda linha e novamente no detalhe; arquivar, desvincular e desligar têm peso semelhante. Cards completos aumentam rolagem.

**Fix:** visão compacta com Nome, Função, Lotação, Pendências e Status; separar ativos/agendados/desligados/arquivados; mover ações raras para “Mais ações” e expor desligamento somente no detalhe.

**Suggested command:** `$impeccable distill equipes`

### [P2] Deriva visual do ARCD Carbon e riscos móveis

**Why it matters:** raios locais, azul/roxo, Inter e pesos 800–900 diluem a identidade; grupos flex sem quebra e grade fixa de duas colunas podem comprimir no celular.

**Fix:** migrar para tokens e componentes ARCD, reservar cores para estado, adicionar quebra/uma coluna no mobile e usar distribuição multiobra/histórico como assinatura visual.

**Suggested command:** `$impeccable polish equipes`

## Persona Red Flags

**Alex — RH experiente:** precisa abrir pessoa por pessoa; não há ordenação por obra, função, pendência ou data, seleção em lote nem exportação filtrada. Três rotas de inativação reduzem previsibilidade.

**Sam — teclado, leitor de tela ou baixa visão:** busca/filtro sem label, editar/cancelar adiantamento sem nome acessível, expansão não anunciada, foco escapa do modal e textos chegam a 8,5–10,5px.

**Riley — casos extremos:** data futura desativa imediatamente, “Outro” aceita vazio, formulário genérico contorna a classificação, confirmação não bloqueia duplo clique e o resultado salvo não fica visível.

## Minor Observations

- O vazio não distingue base vazia de filtro sem resultado nem oferece limpar filtros.
- O CTA “Funcionário” deveria ser “Cadastrar funcionário”.
- Falta uma pista visual de expansão no card.
- A diária verde parece sucesso, apesar de ser apenas dado financeiro.
- “Sem lotação” deveria abrir o filtro correspondente.
- O alerta de adiantamentos não leva à conferência das parcelas.
- O fluxo termina sem “Ir para Rescisões” ou “Ver desligamento”.

## Questions to Consider

1. A data informada é o último dia trabalhado ou o primeiro dia fora da operação?
2. Por que inativar, demitir e arquivar podem alterar o mesmo cadastro por caminhos diferentes?
3. Qual comprovante o RH precisa ver imediatamente após registrar o desligamento?
4. Se a operação é multiobra, por que distribuição e pendências por obra não estruturam a tela?

## Resolução — 05/08/2026

- A data foi definida como **último dia trabalhado**, com efeito inclusivo na folha e no ponto; datas futuras geram `desligamento_agendado` e só passam a desligado após a data.
- O ciclo foi consolidado em ativo → desligamento agendado → desligado → arquivado. O status saiu da edição genérica; correção, reativação e arquivamento agora são ações explícitas e auditáveis.
- Tipo, observações, data e responsável pelo desligamento permanecem visíveis no detalhe do funcionário.
- Busca, lotação e situação receberam rótulos; a expansão ganhou `aria-expanded`/`aria-controls`; ações têm nomes; o modal global ganhou contenção de foco; erros essenciais aparecem nos campos.
- Os cards foram substituídos por linhas compactas com funcionário, função, lotação, pendências, situação e ações. Ações críticas ficam no detalhe.
- A interface passou a usar uma faixa operacional, estrutura Carbon, raios discretos, IBM Plex, estados semânticos e layouts móveis de uma coluna com alvos de 44 px.
- Estados vazios distinguem base vazia de filtros sem resultado e oferecem a próxima ação adequada.

Validação: 201 arquivos de teste / 929 testes aprovados; build de produção aprovado.
