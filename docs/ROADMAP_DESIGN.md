# Roadmap de padronização de design — ARCD Obras

> Criado em 17/08/2026. Este documento existe para dar sequência ao item já
> previsto em [MATRIZ_MODULOS_10_10.md](./MATRIZ_MODULOS_10_10.md) ("Migrar
> as telas de maior uso para primitives/tokens, com regressão visual e de
> contraste") com um plano concreto, priorizado e verificável — não é uma
> reescrita de uma vez, é uma sequência de fases pequenas, na mesma
> disciplina usada na extração de módulos de `LegacyApp.jsx`
> (`docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`): um passo por vez, suíte
> completa verde a cada passo, sem big bang.

## Por que não "refazer tudo de uma vez"

Este é um sistema financeiro real, em produção, com pessoas trabalhando
nele hoje. Reescrever a camada visual de 67 telas num único lote seria
trocar disciplina por velocidade — exatamente o oposto do método que este
projeto já usa (extração de módulos verificada teste a teste). Design não é
exceção a essa regra: cada fase abaixo é pequena o suficiente para ser
revisada, testada e revertida sozinha.

## Estado atual (auditoria de 17/08/2026)

| Achado | Evidência |
| --- | --- |
| O design-system moderno já é maduro | `src/design-system/` tem tokens completos (cor, espaçamento, tipografia, raio, sombra, motion, densidade, breakpoints), primitivos (`Button`, `Input`, `Select`, `Dialog`, `Drawer`, `Checkbox`, `Switch`, `Field`), padrões (`ConfirmDialog`, `FilterBar`, `PageHeader`, `SummaryCard`, `StatusBadge`) e tema Carbon com Storybook. |
| ...mas quase não é adotado nas telas operacionais | Só **14 de 67** arquivos `.jsx` fora de `design-system/` importam algo dele — majoritariamente a camada `src/mobile/` e o motor de edição genérico (`src/edit-engine/`). O fluxo desktop principal (`LegacyApp.jsx` e as views extraídas em `src/domains/*/components/`) usa primitivos locais (`Btn`, `Modal`, `Sel`, `Inp`) com estilo inline. |
| A densidade de estilo inline é alta e concentrada | `style={{` aparece **2.973 vezes** em `LegacyApp.jsx`. Nas views extraídas nesta sessão: OrcamentoView 666, ComprasView 557, ComercialView 298, TerceirosView 161. |
| A paleta de cor **já é a mesma**, só duplicada | O objeto `C` hardcoded em `LegacyApp.jsx` (`C.bg`, `C.yellow`, `C.text`...) bate **hex a hex** com os tokens `--arcd-gray-*`/`--arcd-gold-*` de `src/design-system/tokens/primitives.css` — confirmado por comparação direta. **Uma exceção real**: `C.green: #24A148` diverge de `--arcd-green-500: #198038`. Isso significa que unificar cor é migração mecânica de referência, não reconciliação de identidade visual — com uma decisão pontual pendente (qual verde é a fonte de verdade). |
| Dois "teleports" de feedback identificados e **corrigidos nesta sessão** | A classe `animUp`, aplicada a todo painel de modal do sistema, não tinha definição de CSS em lugar nenhum — todo modal aparecia/sumia sem transição. O toast (`showToast`, chamado em centenas de pontos) tinha o mesmo problema. Corrigido em `src/index.css` usando só os tokens de motion já existentes (`--arcd-motion-*`, `--arcd-ease-standard`) — commit `2e6e59a`. Verificado com a suíte completa (1110 testes) + 25 testes E2E + confirmação visual via Playwright. |
| Inconsistência interna de motion | O chevron de expandir/colapsar do card de contrato em Terceiros já usa os tokens corretamente (`src/index.css:6575`), mas o painel que ele anuncia abre em `display:grid` sem transição — o componente sinaliza uma coisa e entrega outra. |

## Princípios que ordenam as fases

1. **Bugs de feedback antes de decisões de estética.** Um modal sem
   transição de entrada não é opinião de design, é lacuna de implementação
   — corrigir custa pouco e não exige consenso de time.
2. **Tokens antes de componentes.** Como a cor já é a mesma, unificar a
   referência (trocar hex hardcoded por `var(--arcd-*)`) é mecânico e de
   risco quase zero. Fazer isso antes de trocar componentes evita refazer
   trabalho quando o componente novo herdar uma cor que ainda não bateu.
3. **Componentização é a fase cara — vai por tela de maior uso, uma de
   cada vez**, seguindo o mesmo método comprovado de extração de módulos
   desta sessão (ver `docs/PLANO_REDUCAO_LEGACYAPP_SUPABASE.md`): ler,
   mapear dependências, migrar, testar, só então seguir para a próxima.
4. **Movimento por último**, e só onde sobrevive ao filtro de frequência
   (`find-animation-opportunities`): nunca em ações de teclado/alta
   frequência, nunca em dado financeiro que o usuário está lendo.
5. **Densidade de informação não é negociável.** Ver a tabela de
   anti-padrões abaixo — ela é a régua de aceite para qualquer migração de
   tela financeira densa.

## Fases

### Fase 0 — Lacunas de feedback (concluída em 17/08/2026)

- [x] Animação de entrada de modal (`animUp`) — commit `2e6e59a`.
- [x] Animação de entrada de toast — commit `2e6e59a`.
- [ ] Painel expansível de contrato em Terceiros (`.terceiros-registry-contract__details`) — precisa de mudança de JS (o painel é hoje `{exp && (...)}`, desmontado por completo; uma transição de altura real exige manter o elemento montado e alternar uma classe). Maior risco que os dois itens acima porque toca lógica de componente, não só CSS — fazer como item isolado, com teste próprio.

### Fase 1 — Unificação de tokens de cor

**Decisão pendente antes de começar**: qual verde é a fonte de verdade —
`C.green: #24A148` (usado hoje em produção) ou `--arcd-green-500: #198038`
(o token do design-system)? Não é uma decisão técnica, é uma decisão de
marca — não deveria ser tomada unilateralmente numa sessão de refactor.

Depois de decidida:
1. Fazer `C` (em `LegacyApp.jsx`) referenciar os custom properties do
   design-system em vez de repetir os hex, ou o inverso — o que for menos
   invasivo, dado que `C` é importado por praticamente todo o app.
2. Confirmar visualmente (screenshot antes/depois) que nenhuma cor mudou
   de fato, exceto a do verde reconciliado.
3. Critério de saída: `grep` por hex literais em `LegacyApp.jsx` some da
   paleta principal; suíte completa e `architecture:check` continuam
   verdes.

### Fase 2 — Componentização das telas de maior uso

Ordem sugerida (por tráfego/superfície de erro, mesma lente já usada na
matriz de qualidade):

1. Dashboard
2. Financeiro / DRE
3. Compras
4. Obras
5. Ponto

Para cada tela: migrar um tipo de componente por vez (primeiro botões,
depois selects/inputs, depois modais — nessa ordem, do mais isolado ao
mais acoplado), rodando a suíte a cada passo. **Não migrar uma tela
inteira num commit só.**

Critério de saída por tela: `grep -c "style={{"` cai de forma mensurável,
zero teste quebrado, zero mudança de comportamento, aprovação visual em
claro e escuro (`ThemeSettings`).

### Fase 3 — Telas de uso médio

Terceirizados, Planejamento, Comercial, Administração, Folha, Medições,
Conciliação — mesma técnica da Fase 2, depois que o padrão estiver
validado nas 5 telas de maior uso.

### Fase 4 — Telas administrativas / baixo uso

Ajustes, Backup, Relatórios avançados, configurações pontuais. Só depois
de Fases 2 e 3 fechadas — são as que menos usuários veem por dia.

### Fase 5 — Polimento de movimento adicional

Depois que a Fase 0 provar o padrão em produção por um tempo:
- Painel expansível de Terceiros (ver Fase 0).
- Crossfade sutil no padrão `{pending?"Salvando...":"Salvar"}` (~15
  ocorrências) — **avaliar se vale o esforço**: é ação de alta frequência
  (tens de vezes/dia), então a régua do `find-animation-opportunities` é
  "nada, ou algo quase imperceptível". Pode ser que a resposta certa seja
  não mexer.
- Crossfade no badge de estado de salvamento (`.rdo-save-state`).

Não adicionar nada além disso sem rodar `find-animation-opportunities` de
novo — o relatório completo desta auditoria está registrado no histórico
desta sessão; não duplicar aqui.

## Anti-padrões a vigiar em toda migração de tela financeira densa

| Anti-padrão | Por que quebra uma tela financeira densa |
| --- | --- |
| Aumentar padding/whitespace por padrão | Cada padding extra numa tabela de 40 linhas é uma linha a menos visível sem rolar. |
| Envolver cada bloco de dado em `Card` | "Card dentro de card" — adiciona borda/sombra/padding sem adicionar informação. |
| Centralizar números financeiros | Precisam ficar alinhados à direita, fonte tabular, para comparação vertical rápida. |
| Animar valor financeiro ao mudar (count-up, crossfade de número) | É decoração num dado que o usuário está lendo para decidir — mesma regra do relatório de animação. |
| Suavizar cor de status (verde/vermelho/laranja) por estética | A cor tem significado formal (pago/pendente/vencido); reduzir contraste é regressão funcional disfarçada de polish. |
| Aplicar `Button`/`Input` padrão do design-system sem checar `density.css` | O padrão provavelmente foi dimensionado para toque/mobile; numa tabela densa de desktop isso infla a altura de cada linha. |

Régua prática: **se a mudança reduz quantas linhas cabem na tela ou quanto
tempo leva para comparar dois números, é regressão, não polish** — mesmo
que pareça mais "profissional" isoladamente.

## Regra de atualização

Cada fase concluída marca a caixa correspondente aqui e nesse mesmo commit
atualiza a evidência na tabela de estado atual. Este documento não é
prescritivo sobre prazo — é prescritivo sobre ordem e sobre o que não fazer
antes de fechar a fase anterior.
