# Auditoria de design — linha de base (17/08/2026)

> Primeira rodada do framework formalizado em
> [ROADMAP_DESIGN.md](./ROADMAP_DESIGN.md). Executada **antes** de migrar
> qualquer tela do cluster Financeiro/DRE (Fase 2) e **depois** do
> Dashboard e do modal de despesa da obra já migrados — serve como
> referência para medir se as próximas fases realmente mudam a
> experiência, não só a estrutura do código.
>
> Metodologia: navegação real em navegador (Playwright), com login e dados
> fictícios (uma obra, um orçamento, um plano com uma tarefa atrasada, um
> RDO com pendência), sem tocar nenhuma credencial real. Rodada em dois
> viewports: desktop (1440px, seção "Os 5 testes de tarefa real" abaixo) e
> mobile (390px, seção "Rodada mobile"). Dois achados concretos viraram
> correção de código durante a auditoria (não só investigação, ao contrário
> do que a primeira versão deste documento previa) — registrados com o
> commit correspondente em cada seção.

## Os 5 testes de tarefa real

### 1. Registrar uma ocorrência com foto

**Caminho**: Obras → abrir a obra → aba "Geral" → expandir "Diário de
Obra" → "Abrir histórico e registrar RDO" → "Abrir e editar" no RDO do
dia → preencher "Ocorrências e observações" ou "Pendências e
providências" → "+ Foto".

**5-6 cliques até o editor, mais o preenchimento.** O achado mais
relevante: o editor de RDO exige completar um checklist de **5 etapas
obrigatórias** (Obra e data, Relato do dia, Clima confirmado, Serviço
executado, Revisão técnica) antes de liberar "Concluir relatório" — mesmo
quando a intenção real do usuário é só registrar uma pendência pontual
(ex.: uma trinca observada). A tarefa "registrar uma ocorrência" está
**acoplada** ao fluxo completo e burocrático de "preencher o diário do dia
inteiro", não é uma ação isolada e rápida.

**Pontos positivos**: rótulos claros sobre o que é obrigatório vs.
opcional ("Relato do dia · obrigatório", "Pendências e providências ·
opcional"), checklist visual numerado com estado (✓/pendente) dando
clareza de progresso, botão de foto bem visível.

**Pontos negativos**: nenhum atalho para "só registrar uma pendência" sem
passar pelo formulário inteiro — um caso de uso muito comum (observação
pontual em campo) sofre a mesma fricção que fechar o diário do dia.

### 2. Consultar o avanço físico da obra

**Caminho**: Obras → abrir a obra. **0 cliques adicionais** — "Avanço
físico" já é o primeiro KPI card visível na aba "Geral", e é repetido no
card "Previsão executiva da obra" logo abaixo, junto com desvio de prazo
e conclusão prevista. **Excelente** — está no primeiro olhar, exatamente
onde a régua do framework pede.

### 3. Identificar uma atividade atrasada

**Caminho**: Obras → abrir a obra. **0 cliques adicionais** — "Tarefas
atrasadas" é um KPI card no topo (contagem), e a seção "Maiores atrasos
medidos" logo abaixo já lista as etapas atrasadas por nome com o desvio em
dias ("Fundações +77 dias", "Estrutura +57 dias"). **Excelente** — o
gestor responde "está atrasada? quanto? onde?" sem clicar em nada, exatamente
o teste que o framework do usuário propõe para o bloco de dashboards.

### 4. Comparar orçamento previsto × realizado

**Caminho superficial**: Obras → abrir a obra → os campos "Orçado" e
"Comprometido" já aparecem no mesmo card "Previsão executiva da obra" do
topo (**0 cliques adicionais** para o resumo).

**Caminho aprofundado** (por etapa): expandir o accordion "Orcamento"
dentro do detalhe da obra (1 clique) — achado #2 nos achados de
consistência, **corrigido** durante esta auditoria (commit `1e25004`): o
rótulo estava sem cedilha ("Orcamento", não "Orçamento"). Também existe um
caminho totalmente separado pela sidebar (`Financeiro → Gestão
financeira` ou o módulo Orçamento dedicado) para uma comparação linha a
linha por serviço/insumo, que é uma tela bem mais profunda e não foi
medida em detalhe nesta rodada (fica para quando a Fase 2 chegar ao
Orçamento).

**Resumo**: bom para uma leitura rápida (0 cliques), split entre dois
caminhos (resumo no topo vs. detalhe no accordion) que fazem sentido; o
rótulo inconsistente do accordion já foi corrigido.

### 5. Encontrar um documento ou projeto específico

**Caminho testado**: Obras → abrir a obra → expandir "Arquivos da obra".
Essa seção depende de uma pasta vinculada no OneDrive (não é um
repositório de documentos genérico do próprio app) — sem uma pasta
vinculada, mostra "Esta obra ainda não tem uma subpasta vinculada" e
"Nenhum documento enviado pelo ArcD", com um botão para "Abrir pasta
geral". **Não foi possível medir o caminho completo nesta rodada** (exigiria
uma integração OneDrive real, fora do escopo de um teste com dados
fictícios) — registrado como limitação da auditoria, não como nota.

O caminho alternativo (busca global, ícone de lupa "Buscar..." no topo da
sidebar, atalho `⌘K` visível) não foi exercitado nesta rodada — é o
próximo passo natural para medir essa tarefa com mais precisão numa
próxima rodada.

## Achados de consistência (fora dos 5 testes, mas relevantes para a nota)

1. **Toast de erro persistente e não relacionado à ação do usuário**: em
   várias telas do detalhe da obra apareceu "O OneDrive não retornou a
   estrutura das obras." — um erro de integração externa sendo exibido
   como se fosse relevante para qualquer navegação, não só para quem está
   mexendo em arquivos. Isso é ruído: o usuário lançando uma despesa ou
   consultando avanço físico não deveria ver um erro do OneDrive. Vale
   investigar se esse toast deveria ser escopado só à seção "Arquivos da
   obra" (não é uma correção desta sessão — só um achado a registrar).
2. **Grafia inconsistente em rótulos do mesmo painel — corrigido** (commit
   `1e25004`): dentro do accordion do detalhe da obra, "Orcamento" e
   "Medicoes" apareciam sem cedilha, enquanto as abas do mesmo painel
   ("Gestão da qualidade", "Suprimentos") e o resto do app usam
   acentuação correta. Era um caso real e concreto do "botão Salvar
   aparece azul em uma tela e verde em outra" que o usuário citou como
   exemplo do critério "Consistência visual e UI".
3. **Renderização não-defensiva do campo `pendencias` do RDO**: durante a
   investigação, um dado de teste malformado (array em vez de string) fez
   a lista de RDOs mostrar `[object Object]` na tela em vez de texto. Isso
   **não é um bug ativo** — o formato usado no fixture estava errado, não
   o produto — mas expôs que a linha de código que monta esse resumo
   (`[item.descricao,item.ocorrencias,item.pendencias].filter(Boolean).join(" · ")`
   em `src/LegacyApp.jsx`, componente `DiarioObra`) não valida o tipo do
   dado antes de exibir. Não é uma correção urgente (o caminho normal do
   app sempre grava string ali), mas é um ponto de fragilidade sem
   nenhuma rede de segurança caso um dado malformado chegue por outra via
   (migração, edge case futuro). Registrado como observação de robustez,
   não como item da Fase 2 (que é sobre design visual, não hardening).

## Rodada mobile (viewport 390×844)

Repetição dos testes 1–3 em viewport mobile, para fechar o critério
"Experiência mobile/em campo" que ficou sem nota na primeira passada.

**Navegação**: o app usa uma barra inferior fixa de 4-5 ícones (Painel,
Engenharia, Compras, Financeiro, Mais) — padrão mobile reconhecível, bom
para navegação com uma mão. Tocar em "Engenharia" já leva direto para a
"Central de obras" com KPIs (obras ativas, requer atenção, prazo ≤30 dias,
carteira ativa) — sem passo extra para ver o resumo do portfólio.

**Achado #4 (o mais sério desta auditoria) — corrigido** (commit
`206a9d6`): a barra de abas do detalhe da obra ("Geral", "Obra", "Gestão
da qualidade", "Suprimentos", "Financeiro", "RH", "Recursos") usava
`display: grid` com 7 colunas de largura igual. Em 390px de tela, cada
coluna ficava menor que o próprio texto, e como o botão não cortava o
overflow, "Financeiro" e "RH" apareciam **fisicamente sobrepostos e
ilegíveis** — não dava para tocar em um sem o risco de acertar o outro.
Corrigido trocando para rolagem horizontal (mesmo padrão já usado em
outra tela do app, `.equipment-center.is-financial`), confirmado
visualmente antes/depois via screenshot.

Isso é exatamente o tipo de achado que o critério "Adaptação correta a
diferentes tamanhos de tela" (0–4 pontos na sub-régua) existe para pegar —
e que só aparece testando de verdade em viewport estreito, não só olhando
o desktop e assumindo que "é responsivo porque encolhe".

**Consultar avanço físico e identificar atividade atrasada**: os mesmos
cards do desktop ("Avanço físico 0%", "Tarefas atrasadas 2") reorganizam
em grid 2×2 corretamente em mobile, sem cortar informação e sem exigir
zoom. **0 cliques adicionais**, igual ao desktop — bom sinal de que a
tela de detalhe da obra foi pensada responsiva desde a base, não só a
barra de abas (que era a exceção, já corrigida).

## Pontuação

### Bloco: Experiência do usuário (peso 50)

| Critério | Peso | Nota observada | Evidência |
| --- | ---: | ---: | --- |
| Usabilidade e facilidade de aprendizado | 20% | 7/10 | Painel "Geral" da obra é auto-explicativo; RDO tem checklist claro mas acopla tarefas simples a um fluxo longo. |
| Organização da informação | 15% | 8/10 | Avanço, atraso e financeiro no mesmo card, sem precisar navegar — muito bom. |
| Prevenção de erros e feedback | 7% | 5/10 | Toast de erro do OneDrive aparece fora de contexto (achado #1); resto do fluxo tem feedback claro (checklist do RDO). |
| Acessibilidade e legibilidade | 5% | 6/10 | Não testado a fundo (contraste/leitor de tela) nesta rodada — nota provisória baseada só em tamanho/hierarquia visual observados. |
| Percepção de velocidade | 3% | 7/10 | Navegação responsiva no ambiente de teste; não testado sob carga real. |

**Subtotal estimado**: ~35/50 (nota ponderada pelos pesos relativos acima).

### Bloco: Eficiência para gestão de obras (peso 35)

| Critério | Peso | Nota observada | Evidência |
| --- | ---: | ---: | --- |
| Eficiência nas tarefas de obra | 15% | 6/10 | Consultar avanço/atraso: excelente (0 cliques). Registrar ocorrência: fraco (acoplado a formulário de 5 etapas). |
| Experiência mobile/em campo | 15% | 7/10² | Bottom nav claro, cards responsivos sem cortar dados; achado #4 (abas sobrepostas) corrigido nesta auditoria. Contraste sob sol forte, offline e velocidade sob rede ruim não foram testados — nota conservadora nesses sub-itens, não avaliação negativa. |
| Dashboards e visualização de dados | 10%¹ | 9/10 | Responde "atrasada? quanto? onde?" sem nenhum clique — exatamente o padrão-ouro do framework. |

¹ Conforme nota no roadmap, os pesos individuais somam 100% nos 10
critérios originais; aqui o peso de "Dashboards" (10 dos 15% do bloco
"Eficiência") é preservado como está, sem redistribuir para 30/100 — essa
redistribuição (proposta pelo usuário) é usada como **sub-régua de
pontuação interna** do critério, não como novo peso do bloco. Ver
"Detalhamento de 3 critérios" no roadmap.

² Sub-régua de 45 pontos aplicada e convertida para a escala 0-10: navegação
com uma mão 6/7, tamanho de botões 5/6, legibilidade 4/5, contraste sob sol
2/4 (não testado, nota cautelar), fotos/documentos 5/6, velocidade de ações
frequentes 4/6 (não testado sob rede real), adaptação a tamanhos de tela
3/4 (era 0/4 antes da correção do achado #4), offline 1/4 (não testado),
feedback após salvar 3/3 → 33/45 ≈ 7/10.

**Subtotal estimado**: ~24.5/35 (nota ponderada pelos pesos relativos acima).

### Bloco: Qualidade visual (peso 15)

| Critério | Peso | Nota observada | Evidência |
| --- | ---: | ---: | --- |
| Consistência visual e UI | 8% | 8/10 | Achado #2 (grafia "Orcamento"/"Medicoes") corrigido nesta auditoria; resto do painel já era coerente. |
| Qualidade estética | 2% | 7/10 | Paleta ARCD Carbon (dourado/grafite) aplicada de forma consistente nas telas vistas. |

**Subtotal estimado**: ~11.7/15.

### Nota geral

**~71/100** (35 de Experiência do usuário + 24,5 de Eficiência para
gestão de obras + 11,7 de Qualidade visual) — **Bom, com melhorias
importantes**, na faixa de classificação do roadmap (70–79). Primeira
nota completa nos 3 blocos, com os 3 achados corrigidos já refletidos
(verde de cor, grafia sem cedilha, abas mobile sobrepostas). Os pontos
mais baixos hoje são a fricção do fluxo de RDO (tarefa 1) e sub-itens de
mobile não testados nesta rodada (contraste sob sol, offline, rede
ruim) — não porque sejam ruins, mas porque ainda não foram medidos.

## Próximos passos para fechar esta rodada

1. **Medir a Tarefa 5 pelo caminho de busca global** (`⌘K`), não só pelo
   accordion de arquivos que depende de OneDrive — ainda não foi possível
   dar nota a essa tarefa.
2. **Testar contraste sob luz forte, modo offline e rede ruim** — os 3
   sub-itens de mobile que ficaram com nota cautelar por falta de teste,
   não por avaliação negativa real.
3. **Avaliar se vale simplificar o checklist obrigatório do RDO** (achado
   da Tarefa 1) para permitir registrar uma pendência pontual sem passar
   pelo fluxo completo do diário do dia — é uma decisão de produto, não
   de token/componente, então fica fora do escopo mecânico da Fase 2.
4. Repetir esta auditoria completa depois que Financeiro/DRE (Fase 2,
   próxima tela) for concluído, para medir a variação real de nota.
