---
target: aba Mapa de ocupação — Central de locação de equipamentos (src/domains/equipamentos/components/EquipamentosView.jsx, aba "gestao")
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
timestamp: 2026-10-02T22-00-00Z
slug: equipamentos-mapa-ocupacao
stage: antes
---
# Revisão Impeccable — Mapa de ocupação (ETAPA A · antes)

**Método**: capturas reais em Chromium a 1440 e 1024px (fixture de 6 equipamentos, 3 obras, Setembro/2026, relógio em 15/09); leitura do código da aba (`aba==="gestao"` em `EquipamentosView.jsx`); `DESIGN.md`, `.impeccable/config.json` e a crítica de 17/08/2026 (Equipamentos), que já apontava a grade como problema (heurísticas 6, 8 e 10). Autoavaliação, não crítica independente.

## Design Health Score

| # | Heurística | Nota | Evidência |
|---|---|---|---|
| 1 | Visibilidade do status do sistema | 2 | Não há marca de "hoje"; o mês corrente parece igual a qualquer outro. Situação de cada dia só aparece em `title` nativo. |
| 2 | Correspondência com o mundo real | 2 | "102 dias ociosos — equipamento parado": a conta é dias-equipamento sem nenhuma locação, não "equipamento parado". Um período contínuo de locação vira 18 células "L1" separadas. |
| 3 | Controle e liberdade | 2 | Só mês (12 meses para trás, nenhum futuro — impossível planejar), obra e busca. Sem limpar filtros, sem ‹ ›, sem "hoje". Clique na célula abre direto o formulário de edição da locação. |
| 4 | Consistência e padrões | 1 | Estilos inline com tamanhos 7,5–11,5px fora dos tokens `--arcd-type-*`; cards de KPI com borda superior colorida de 3px (decoração); hero repete KPIs ("Em uso no mês", "Livres no mês") que a própria aba recalcula de outro jeito. |
| 5 | Prevenção de erros | 2 | Conflito (demanda > capacidade) só aparece como fundo rosado numa célula, sem rótulo nem contagem. |
| 6 | Reconhecimento vs. memorização | 1 | Exige decorar 8 siglas (L, R, M, I, T, A, B, Q) e o número de baixo ("unidades livres"). **A legenda de cores por obra não corresponde à grade**: as células são coloridas pelo TIPO do evento (`corTipo`), não pela obra (`corDaObra` só é usada na legenda). |
| 7 | Flexibilidade e eficiência | 2 | Sem agrupar, sem filtrar por situação/propriedade/categoria, sem "livres hoje" / "liberam esta semana". Não há próxima disponibilidade. |
| 8 | Estética e minimalismo | 1 | Microtexto repetido em 30 células por linha ("L1 / 0", "— / 10"); azul em quase toda a grade; grade do fundo global compete com a grade de dias; nomes truncados em 150px. |
| 9 | Recuperação de erros | 2 | Estado vazio genérico ("Nenhum equipamento no filtro.") sem caminho de volta. |
| 10 | Ajuda e documentação | 2 | Parágrafo explicando a estrutura da tabela + legenda de siglas distante da grade. |

**Total: 17/40.**

## Achados específicos pedidos

- **Microtexto em célula**: 2 linhas de 7,5–8px em cada dia (sigla + unidades livres).
- **Repetição**: o mesmo código repetido por dia; "Empresa" em cada linha própria.
- **Excesso de cor**: azul em ~70% da grade; laranja/vermelho/verde nos KPIs por faixa arbitrária (≥70% verde).
- **Hierarquia**: quatro KPIs de mesmo peso (dois financeiros) acima da ferramenta operacional.
- **Memorização**: siglas + cor por obra que não existe na grade.
- **Responsividade**: em 1024px só 20 dias cabem; não há como pular para hoje.
- **Scrolling**: cabeçalho e coluna sticky existem (bom), mas sem contexto de mês/hoje.
- **Leitura da tabela**: colunas "Dias/Ocup./Receita/Result." ficam fora da tela à direita.
- **Status**: conflito sem texto; manutenção indistinguível de locação a não ser pela sigla.
- **Acessibilidade**: células clicáveis são `<td onClick>` — não focáveis, sem teclado, sem `aria-label`; estado só em `title`.

## Problemas

**[P0] Células interativas inacessíveis.** `<td onClick>` sem `tabIndex`, `role` ou teclado: quem usa teclado ou leitor de tela não abre nenhuma locação pelo mapa.

**[P1] Legenda de obras falsa.** Mostra uma cor por obra que a grade não usa; induz leitura errada de onde está cada equipamento.

**[P1] Período contínuo fragmentado em células.** Uma locação de 18 dias vira 18 "L1"; não se vê início, fim nem obra sem abrir o tooltip.

**[P1] Sem "hoje", sem futuro, sem próxima disponibilidade.** A tela não responde "o que está livre hoje" nem "quando libera".

**[P1] Conflito sem rótulo nem contagem.**

**[P2] "Dias ociosos — equipamento parado"** descreve mal a conta (dias-equipamento sem locação).

**[P2] KPIs financeiros com o mesmo peso dos operacionais** e cards com borda colorida decorativa.

**[P2] Grade global do fundo compete com a grade temporal.**

**[P3] Nomes truncados em 150px sem alternativa além do `title`.**
