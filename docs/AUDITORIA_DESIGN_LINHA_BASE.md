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
> RDO com pendência), sem tocar nenhuma credencial real. Nenhuma mudança
> de código de produto foi feita durante a auditoria — só investigação.

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
dentro do detalhe da obra (1 clique) — mas isso é outro achado (ver #2 nos
achados de consistência): o rótulo desse accordion está **sem cedilha**
("Orcamento", não "Orçamento"). Também existe um caminho totalmente
separado pela sidebar (`Financeiro → Gestão financeira` ou o módulo
Orçamento dedicado) para uma comparação linha a linha por serviço/insumo,
que é uma tela bem mais profunda e não foi medida em detalhe nesta rodada
(fica para quando a Fase 2 chegar ao Orçamento).

**Resumo**: bom para uma leitura rápida (0 cliques), split entre dois
caminhos (resumo no topo vs. detalhe no accordion) que fazem sentido, mas
o rótulo inconsistente do accordion tira pontos de "Consistência visual".

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
2. **Grafia inconsistente em rótulos do mesmo painel**: dentro do
   accordion do detalhe da obra, "Orcamento" e "Medicoes" aparecem sem
   cedilha, enquanto as abas do mesmo painel ("Gestão da qualidade",
   "Suprimentos") e o resto do app usam acentuação correta ("Orçamento" em
   toda a Fase 2 já vista, "Medições" na sidebar principal). É um caso
   real e concreto do "botão Salvar aparece azul em uma tela e verde em
   outra" que o usuário citou como exemplo — pequeno, mas mede exatamente
   o critério "Consistência visual e UI" do framework.
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
| Experiência mobile/em campo | 15% | não avaliado nesta rodada | Auditoria rodou só em viewport desktop; ver "Próximos passos". |
| Dashboards e visualização de dados | 10%¹ | 9/10 | Responde "atrasada? quanto? onde?" sem nenhum clique — exatamente o padrão-ouro do framework. |

¹ Conforme nota no roadmap, os pesos individuais somam 100% nos 10
critérios originais; aqui o peso de "Dashboards" (10 dos 15% do bloco
"Eficiência") é preservado como está, sem redistribuir para 30/100 — essa
redistribuição (proposta pelo usuário) é usada como **sub-régua de
pontuação interna** do critério, não como novo peso do bloco. Ver
"Detalhamento de 3 critérios" no roadmap.

**Subtotal**: mobile não avaliado — nota do bloco fica incompleta até a
próxima rodada (ver "Próximos passos").

### Bloco: Qualidade visual (peso 15)

| Critério | Peso | Nota observada | Evidência |
| --- | ---: | ---: | --- |
| Consistência visual e UI | 8% | 6/10 | Achado #2 (grafia "Orcamento"/"Medicoes") é um ponto concreto de inconsistência; resto do painel é coerente. |
| Qualidade estética | 2% | 7/10 | Paleta ARCD Carbon (dourado/grafite) aplicada de forma consistente nas telas vistas. |

**Subtotal estimado**: ~11/15.

### Nota geral (parcial)

**~46/65 pontos avaliados** (Experiência do usuário + Dashboards +
Consistência + Estética) — **mobile/em campo não avaliado nesta rodada**,
então uma nota final de 0-100 seria prematura e enganosa. Convertendo só o
que foi medido para 100 pontos: **~71/85 ≈ 84** nos critérios avaliados —
mas isso **não deve ser lido como a nota final do app**, só como a
fotografia do que já foi possível medir.

## Próximos passos para fechar esta rodada

1. **Repetir os 5 testes em viewport mobile/tablet** (`resize_window`
   preset mobile) — é o maior buraco desta rodada e pesa 15% sozinho.
2. **Medir a Tarefa 5 pelo caminho de busca global** (`⌘K`), não só pelo
   accordion de arquivos que depende de OneDrive.
3. **Corrigir o achado #2** (grafia "Orcamento"/"Medicoes") como parte da
   Fase 2, já que é exatamente o tipo de inconsistência que essa fase
   existe para eliminar — baixo risco, achado concreto, fácil de
   verificar.
4. Repetir esta auditoria completa depois que Financeiro/DRE (Fase 2,
   próxima tela) for concluído, para medir a variação real de nota.
