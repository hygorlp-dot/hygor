# Critique e roadmap de redesign — ARCD / MARCELL

Data: 02/11/2026 · Método: skill `frontend-design` (Anthropic), leitura do código e das 130 capturas
da revisão de layout (`artifacts/consolidation-browser/erp-layout-review-*`, 1440×1000 e 390×844,
tema MARCELL Claro, dados de teste locais).

Nada foi alterado no código. Este documento é diagnóstico e proposta.

---

## 1. Resumo em uma frase

O ERP não tem um problema de estética, tem um problema de **acúmulo**: seis direções visuais
empilhadas, 65 entradas de menu e cada tela escolhendo sozinha seu cabeçalho, seus filtros e suas
caixas. As caixas, o desalinhamento e o fluxo estranho que você vê são sintomas disso.

## 2. O que os números mostram

| Medida | Valor | Por que importa |
|---|---|---|
| Camadas de tema carregadas ao mesmo tempo | 6 (`marcell.css`, `marcell-clean`, `marcell-pilot`, `marcell-workspaces`, `operating-contract`, `module-standard`) | Cada camada corrige a anterior. A ordem do import decide o visual, não o token. |
| Temas selecionáveis | 3 (Operacional, Claro, Preciso) | Toda tela precisa funcionar 3 vezes; nenhuma fica boa. |
| Linhas em `src/index.css` | 6.814 | CSS global sem dono; regras de módulos antigos ainda valem. |
| `style={{…}}` em JSX | 5.772 (1.358 só no `LegacyApp.jsx`, 680 no Orçamento) | Espaçamento e tamanho decididos tela a tela. **Esta é a causa direta do texto desalinhado.** |
| Cores hex fixas em JSX | 319 | Ignoram o tema; geram os tons “quase iguais”. |
| Entradas de menu (`TAB_META_BASE`) | 65 (20 só no Comercial) | O usuário escolhe ferramenta antes de saber o que precisa fazer. |
| Textos com plural “(s)” | 560 | “3 crítica(s) · 7 ação(ões)” — leitura de sistema, não de pessoa. |
| Famílias tipográficas citadas no `DESIGN.md` | 6 (IBM Plex Sans, Source Sans 3, Inter, 72, P052, Nimbus Sans) + mono | O próprio contrato se contradiz. |

## 3. Critique por tela

### Shell (todas as telas)
- **Três padrões de cabeçalho** convivem: título na mesma linha das abas (Compras, Financeiro);
  título + subtítulo + botão à direita com fio embaixo (Orçamento, Diário, Medição); título grande +
  bloco de indicadores (Dashboard, Obras). No Ponto, o título “Ponto da quinzena” aparece **abaixo**
  de uma barra de abas e de um botão de largura total — hierarquia invertida.
- **Nome do menu ≠ título da tela**: “Gestão financeira” abre “Financeiro”; “Orçamento” abre
  “Orçamentos”; “Dashboard” abre “Visão gerencial”; “Medicao” abre “Medição da obra”.
- **Rótulos sem acento** no menu e em indicadores: “Diario de obra”, “Medicao”, “Avanco fisico”,
  “Servicos”, “Medidos pelo diario”, “Evolucao por servico”.
- **Duplicidade de conceito**: “Dashboard” aparece 2× (Visão gerencial e Comercial), “Relatórios” 2×,
  “Medicao” (Obras) e “Medições” (Financeiro) são coisas diferentes com o mesmo nome. Ponto tem
  **quatro portas**: “Ponto por obra”, “Gestão do ponto”, “Ponto eletrônico (app)” e o botão
  “Ponto” no topo.
- **Botão de chat verde flutuante** cobre conteúdo em todas as telas (no Obras, cobre o botão de
  excluir do terceiro card) e traz uma cor que não pertence à paleta.
- **“Salvo às 12:00” parece um botão** (borda, fundo, mesma altura das ações). É informação, não ação.
- No celular, o topo vira **quatro ícones sem rótulo** (aparência, ajuda, um ponto verde, relógio).

### Dashboard (Visão gerencial)
- Abre com **oito números**, quatro deles R$ 0,00 ou 0. A primeira coisa vista não ajuda a decidir.
- **Números contraditórios**: o cabeçalho diz “3 crítica(s)”; o card “Pendências críticas” diz 0.
  Confirmado no código: o cabeçalho conta `fila` (Central de ações, `LegacyApp.jsx:2492`) e o card
  conta `prioridades` (`LegacyApp.jsx:2871`). São duas listas diferentes com o mesmo nome.
- “Despesas R$ 800,00 — 0% da receita” quando a receita é zero: o percentual não tem sentido.
- “Mais indicadores” é um texto solto, centralizado, sem aparência de controle.
- “Suas obras hoje” coloca três blocos coloridos (Em dia / Atenção / Crítico) **dentro** do card,
  ao lado do título — caixa dentro de caixa.
- Central de ações: os filtros (Todas, RH, Campo, Financeiro, Engenharia, Comp…) **estouram** a
  largura; cada ação é um card dentro do card.

### Obras (Central de obras)
- Antes do primeiro dado há **quatro camadas de controle**: indicadores, abas de filtro,
  alternador Painel/Fluxo e busca.
- Cada obra é um card com um **painel azul de 300 px** à esquerda, mais sub-caixas de Contrato /
  Área / Equipe, mais uma faixa verde “Cadastro operacional regular”, mais um botão azul de largura
  total “Abrir obra →”. Três obras ocupam a tela inteira.
- “Somente MO” e o avatar “Er” não se explicam.
- A lista “Obras ativas” também aparece no menu lateral, repetindo a tela.

### Compras
- É a tela mais madura: fila em tabela, prazo como selo, **uma ação por linha com verbo claro**
  (“Analisar solicitação”, “Receber materiais”, “Comparar propostas”). **Deve ser o modelo.**
- Problemas: a faixa “Em andamento / Prazo vencido / Atenção / Em aprovação” parece uma segunda
  linha de abas; a linha selecionada fica bege (ouro) enquanto o resto da seleção do tema é azul;
  os dois blocos recolhíveis do rodapé têm estilos diferentes entre si.

### Financeiro
- Três selects com larguras arbitrárias (“Movimentação” ocupa metade da tela).
- Seis botões de prazo com o padrão “Vencidos · 1  R$ 750,00” — ponto médio, contagem e valor
  colados.
- Na linha, “Próxima ação” é uma frase **e** um botão dizendo a mesma coisa.
- “Abrir caixa por conta e previsão” fica órfão abaixo da tabela, sem relação visual com nada.

### Orçamento
- Valores em **fonte monoespaçada azul**, contrariando a regra do próprio `DESIGN.md`
  (valores financeiros em sans com algarismos tabulares; mono só para códigos).
- Dois botões primários lado a lado (“Abrir” e “Aprovar baseline”). Aprovar baseline é uma ação
  de consequência e não deveria ter o mesmo peso de “Abrir”.
- Lista de orçamentos em cards quando o conteúdo é tabular (obra, versão, área, R$/m², total).

### Diário de obra
- Seis filtros para uma lista **vazia**, e o estado vazio diz “Ajuste os filtros” quando nunca houve
  registro. O vazio deveria convidar a criar o primeiro diário.

### Medição
- Quatro indicadores com **bordas superiores de cores diferentes** (azul, preto, verde, ouro) sem
  significado.
- O parágrafo explicando a regra do boletim fica solto entre dois painéis.

### Gestão do ponto
- Legenda com cinco cores, mas as células vazias são cinza com “·”. O feriado usa marrom, que não é
  nenhum token semântico.
- Botão “Definir diária ou CLT pelo ponto” de largura total acima do título.

### Celular
- O Dashboard gasta ~330 px de cabeçalho (saudação, data, atualização, contagem, mês, busca,
  atualizar, “Abrir prioridade”) antes do primeiro número.

## 4. Diagnóstico: as três causas

1. **Sem fonte única de layout.** Tokens existem (`src/design-system/tokens`) e há padrões prontos
   (`PageHeader`, `FilterBar`, `ModuleLayout`, `DataTable`), mas 5.772 estilos inline e 6 camadas de
   tema passam por cima deles. Enquanto isso for permitido, qualquer correção visual volta a
   desalinhar no próximo PR.
2. **Navegação por ferramenta, não por obra.** Numa construtora, a pergunta é “o que está
   acontecendo na obra X”. Hoje cada módulo tem seu próprio select “Obra” (Compras, Financeiro,
   Medição, Diário, Ponto…) e o usuário re-escolhe a obra a cada troca de tela.
3. **Caixa como resposta padrão para agrupar.** Indicador, filtro, ação, lista e aviso viram
   cartões; cartões entram em cartões. A tela fica cheia de bordas e sem hierarquia.

## 5. Direção proposta: “Prancha”

O vocabulário vem da própria obra: a prancha de projeto tem **um carimbo** que diz de que obra,
de que folha e de que revisão se trata, e o resto da folha é desenho limpo. O ERP deve funcionar
do mesmo jeito.

### O elemento memorável (e só ele): o carimbo de contexto
Uma barra fixa abaixo do topo que diz **obra · período · situação** e serve de seletor. Todas as
telas leem a obra do carimbo; os selects “Obra” de cada módulo saem. “Todas as obras” é uma opção
do carimbo, não um filtro de cada tela.

```
┌──────────┬─────────────────────────────────────────────────────────────────┐
│ MRC      │ Residencial Alameda ▾   Novembro 2026 ▾   Em execução · 149 dias │ ← carimbo
│          ├─────────────────────────────────────────────────────────────────┤
│ Hoje     │ Compras                                    [Nova solicitação]   │ ← cabeçalho único
│ Obra     │ Fila  Solicitar  Cotar  Aprovar  Pedidos  Receber  Pagar         │ ← abas
│ Compras  │─────────────────────────────────────────────────────────────────│
│ Financ.  │ 3 em andamento · 2 vencidas · R$ 250,00              🔍 Buscar  │ ← resumo em linha
│ Pessoas  │                                                                 │
│ Comercial│ SC-001  Cimento CP II        4 dias de atraso   [Analisar]       │ ← tabela, sem cards
│ ──────── │ PC-001  Cimento Portland…    3 dias de atraso   [Receber]        │
│ Ajustes  │ COT-001 Cimento Portland…    sem prazo          [Comparar]       │
└──────────┴─────────────────────────────────────────────────────────────────┘
```

### Tokens
**Cor** — mantém a marca (compromisso do `PRODUCT.md`), corta o resto:

| Nome | Hex | Uso |
|---|---|---|
| Marinho | `#0D1B2E` | navegação, texto principal |
| Concreto | `#EEF0F0` | fundo da área de trabalho |
| Papel | `#FFFFFF` | a folha (uma por tela) |
| Aço | `#235BB0` | **uma** ação primária por tela, links, foco |
| Ouro | `#B9985B` | marca e item ativo no menu; nunca seleção de linha |

Estados (sucesso, atenção, erro, informação) continuam com os tokens semânticos já existentes.
O verde do chat e o marrom do feriado saem.

**Tipo** — uma família: **IBM Plex Sans** (já é a do `themeRegistry`; tem algarismos tabulares e uma
variante Condensed útil para tabelas largas como Ponto e Orçamento). Plex Mono só para códigos
(NSR, CPF, patrimônio, PC-001). Source Sans 3, Inter e 72 saem das telas de operação; P052 e Nimbus
Sans ficam restritas ao acesso e aos impressos, como já diz o contrato.
Escala: 24 (título da tela) · 18 (seção) · 15 (corpo) · 13 (rótulo) · 12 (apoio). Sem caixa-alta em
rótulos.

**Layout** — regras de alinhamento:
- Tudo alinhado à esquerda numa única margem; números alinhados à direita em colunas.
- **Um nível de contêiner.** Fundo concreto → uma folha branca por tela. Dentro da folha, grupos se
  separam por espaço e por fio, nunca por outra caixa com borda.
- Indicadores viram **uma linha de resumo** (texto + número), não cards.
- Listas de registros são **tabelas**; card só no celular (o `MobileRecordCard` já existe).
- Cabeçalho único: título = nome do menu, uma ação primária à direita, abas embaixo. Nada acima do
  título.

### Revisão contra o padrão genérico
O primeiro rascunho desta proposta era “menu marinho, cards brancos, ação azul, KPIs no topo” — é
exatamente o kit SaaS que qualquer ERP teria, e é o que o app já tenta ser. O que mudei:
- KPIs no topo → **frase de decisão** no Dashboard (“1 obra precisa de decisão: Edifício Jardim das
  Palmeiras, 3 pendências”), seguida da lista do que fazer hoje.
- Filtro “Obra” por tela → **carimbo** único, que vem do vocabulário da prancha e resolve o fluxo.
- Seleção em ouro nas linhas → ouro só na marca e no menu; seleção usa Aço, como o resto.

## 6. Roadmap

Cada etapa é um PR pequeno, sem mudar cálculo, permissão ou regra de negócio, e com a revisão de
layout (`e2e/erp-layout-review.spec.js`) como prova antes/depois.

### Etapa 0 — Travar a regressão (antes de redesenhar)
1. **Catraca de estilos inline** — *feita em 02/11/2026.* A `main` já tinha `npm run design:check`
   (fonte, espaçamento e cor fixos em `style`); ele passou a contar também `inline-style` (qualquer
   `style={{…}}`, exceto objeto só com variáveis CSS) e `plural-parenthesis` (“crítica(s)”). Teto
   registrado em `scripts/design-system-baseline.json`: 5.880 estilos inline e 529 plurais. O número
   por arquivo só pode cair.
2. **Um tema só**: decidir qual (recomendo MARCELL Preciso, o padrão atual) e congelar os outros.
   *Decisão sua — pendente.* Preferências salvas caem no escolhido.
3. **Acentos e plurais** — *feito em 02/11/2026 para o que aparece na tela*: menu (“Diário de obra”,
   “Medição”), Medição, Diário, Planejamento, Orçamento, Folha e avisos do motor de planejamento.
   Ficaram de fora, de propósito: prompts de IA, cabeçalhos de exportação, parsers SINAPI/ORSE e
   mensagens enviadas a fornecedores. Helper `contar()` em `design-system/copy.js`, aplicado ao
   Dashboard, Suas obras hoje, fila de Compras, Financeiro Hoje, Diário e Orçamentos.
4. **Chat e salvamento** — *feito em 02/11/2026.* O chat vai para o topo, ao lado de Ajuda, em todos
   os tamanhos (no celular ele estava escondido por uma regra de `operating-contract.css` e não
   aparecia em lugar nenhum). “Salvo às…” virou texto com ponto de estado.

### Etapa 1 — Esqueleto
5. **Cabeçalho único** usando o `PageHeader` existente em todas as telas; o teste de layout passa a
   exigir um único `.mrc-screen-header` com título de 24 px e no máximo uma ação primária.
6. **Carimbo de contexto** (obra + período) no shell. Os módulos passam a ler a obra dele.
   Atenção à armadilha já conhecida: `ObraDetalhe` recebe dados isolados por obra
   (`dadosDaObraIsolados`); recurso entre obras precisa de prop não isolada.
7. **Menu de 65 para cerca de 25 entradas**:
   - Ponto: uma entrada com abas (Quinzena, Por obra, App); sai o botão “Ponto” do topo.
   - Comercial: 20 → 5 (Funil, Clientes, Propostas e contratos, Agenda, Relatórios).
   - Medição (avanço físico) e Medições (faturamento) ganham nomes distintos:
     “Avanço físico” e “Medições a faturar”.
   - Um só “Dashboard”; “Telas antigas” sai do menu; IA e Gemini vão para Ajustes.
   - A lista “Obras ativas” sai do menu e vai para o seletor do carimbo.
   - Nome do menu = título da tela, sempre.

### Etapa 2 — Superfícies (as caixas)
8. Regra “um nível de contêiner”, aplicada módulo a módulo, na ordem de uso: Dashboard, Obras,
   Financeiro, Orçamento, Medição, Ponto, Diário, Comercial.
9. Indicadores em linha de resumo; somem as bordas coloridas da Medição e os três blocos coloridos
   de “Suas obras hoje”.
10. Obras e Orçamentos em **tabela** (como Compras), com a linha abrindo o detalhe.
11. Valores do Orçamento em Plex Sans tabular; “Aprovar baseline” vira ação secundária com
    confirmação.

### Etapa 3 — Fluxos
12. **Dashboard = “o que exige decisão hoje”**: frase de decisão, depois a fila de ações. Os oito
    indicadores vão para “Mais indicadores” (que vira um botão de verdade).
13. **Unificar a contagem de críticas** (`fila` × `prioridades`). Isto toca regra: precisa da sua
    definição de qual lista é “crítica”.
14. **Obra como hub**: dentro da obra, o ciclo real em sequência — Orçamento → Planejamento →
    Compras → Diário → Medição → Faturamento. Aqui a numeração faz sentido, porque é uma sequência.
15. Estados vazios que convidam a agir (Diário: “Registre o primeiro diário desta obra”).
16. Financeiro: filtros de prazo como abas simples (contagem e valor separados), select
    “Movimentação” vira duas abas (A pagar / A receber), frase duplicada da “Próxima ação” sai.

### Etapa 4 — Celular de campo
17. Cabeçalho de no máximo 120 px; ícones do topo com rótulo ou dentro de “Mais”.
18. Diário e Ponto primeiro (são as telas usadas na obra), com alvos de 52 px no contexto de campo,
    como já prevê o `DESIGN.md`.

### Etapa 5 — Contrato e limpeza
19. Reescrever o `DESIGN.md` como **um** contrato (hoje são quatro direções datadas no mesmo arquivo).
20. Apagar as camadas de tema absorvidas e as regras mortas do `index.css`, com a catraca
    garantindo que nada volta.

## 7. Como medir

| Métrica | Hoje | Meta ao fim da Etapa 2 |
|---|---|---|
| `style={{` em JSX | 5.772 | < 2.000 |
| Cores hex em JSX | 319 | 0 fora de impressos |
| Camadas de tema | 6 | 1 |
| Entradas de menu | 65 | ~25 |
| Padrões de cabeçalho | 3 | 1 (testado no e2e) |
| Selects “Obra” por módulo | 1 por tela | 0 (carimbo) |
| Profundidade de caixas | até 3 | 1 |

## 8. Decisões que são suas

1. Qual tema fica (recomendo MARCELL Preciso).
2. O carimbo de contexto global (muda o fluxo de todas as telas).
3. Os cortes e renomeações do menu, principalmente Comercial e Ponto.
4. Qual lista define “crítica” no Dashboard.

## Observações
- As capturas usam o tema MARCELL Claro (o padrão do teste), não o Preciso (padrão de produção).
  Os problemas de estrutura são os mesmos nos dois.
- Os dados são de teste, então algumas telas aparecem vazias; o critique de fluxo vale mesmo assim.
- A aba Memória de Cálculo continua com o fluxo do Impeccable, como combinado.
