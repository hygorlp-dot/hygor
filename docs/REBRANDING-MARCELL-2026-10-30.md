# Rebranding MARCELL — diagnóstico e proposta

Atualização: a direção foi aprovada e o piloto de Dashboard, Compras e
Financeiro foi implementado localmente. Consulte a [entrega e validação do
piloto](PILOTO-VISUAL-MARCELL.md). O diagnóstico abaixo registra o estado
anterior à implementação.

Data: 30/10/2026. Estado: diagnóstico realizado; direção e especificação propostas para revisão. A interface do app ainda não foi alterada por este trabalho.

Decisão confirmada pelo usuário: **manter MARCELL e a logo oficial; renovar todo o sistema visual**.

## 1. Diagnóstico executivo

O produto já tem muitos recursos de um ERP de construção e uma fundação visual aproveitável. A inconsistência vem principalmente da coexistência de implementações: controles legados, primitivas próprias, componentes shadcn e regras corretivas globais. Cada módulo também organiza títulos, escopo, navegação e ações de maneira diferente.

O rebranding deve unificar a experiência de trabalho: onde estou, qual obra e período estou vendo, o que exige atenção, quais registros explicam isso e qual ação posso executar. Alterar apenas cores e fontes preservaria o principal problema.

Recomendação: renovar o sistema visual e os padrões de página de forma incremental, com um piloto em Compras e Financeiro. Depois expandir para todos os módulos, portais, relatórios e aplicativo de campo, respeitando as particularidades de cada superfície.

## 2. Escopo e evidências

### Código e configuração

Inspecionados: entradas do app, composição operacional, navegação e permissões, componentes compartilhados, tokens, tema, camadas CSS, Compras, Financeiro, Folha, Conciliação, Equipe nas Obras, portais e configuração do aplicativo Android. Também foram consultadas as instruções de projeto e as especificações anteriores de rebranding.

Stack web confirmada: React 18, Vite, Tailwind 4, Radix, shadcn/ui, Lucide, componentes próprios e Storybook. `npx shadcn@latest info --json` reconheceu a configuração e sete componentes: alert, button, card, input, label, popover e tabs.

Levantamento textual em `src/**/*.jsx` e `src/**/*.css`, excluindo arquivos `.test.` e `.stories.`:

| Medida | Resultado | Interpretação |
| --- | ---: | --- |
| Arquivos JSX | 169 | Superfície ampla; exige migração por famílias de tela |
| Linhas JSX | 52.065 | Contagem física, incluindo comentários e templates |
| Arquivos CSS | 61 | Regras distribuídas entre fundação e módulos |
| Linhas CSS | 11.197 | Não representa necessariamente código exclusivo em produção |
| Ocorrências `style={{` | 6.080 | Ponto de investigação; nem toda ocorrência é inadequada |
| Tags `<Btn` | 881 | API legada ainda é dominante |
| Tags `<Button` | 162 | Inclui imports de origens diferentes |
| Tags HTML `<button` | 461 | Inclui controles legítimos de navegação e composição |
| Ocorrências CSS `!important` | 712 | Forte dependência da ordem e da especificidade |

`src/LegacyApp.jsx` tinha 18.238 linhas, 307 chamadas textuais a `useState` e 55 a `useEffect`. Essas chamadas estão distribuídas pelo arquivo; **não significam 307 estados em um único componente**, nem provam lentidão por si só. O tamanho e a mistura de responsabilidades aumentam o risco de uma mudança global.

Há trabalho local anterior em Compras, Financeiro, APIs e testes. Ele deve ser preservado e incorporado à leitura do produto. Os números acima são uma fotografia da árvore de trabalho, não de uma release publicada.

### Navegador

Inspeção local com APIs interceptadas e dados sintéticos: Dashboard, Financeiro/Hoje, Compras, Obras, Orçamento, Planejamento, Folha, Conciliação, Comercial, Locações, Ajustes e Equipe nas Obras. Foram capturadas telas em desktop, e amostras mobile de Compras, Financeiro e Folha; Compras também em 320 px e Conciliação em 768 px.

As amostras medidas não apresentaram transbordamento horizontal da página. Isso não certifica todos os registros, formulários, tabelas ou estados do produto.

Limitações da inspeção:

- As filas estavam vazias e havia uma obra de demonstração. Tabelas extensas, nomes longos, muitos documentos e erros transacionais precisam de cenários próprios na implementação.
- As integrações externas foram bloqueadas. Avisos de CUB e OneDrive nesse cenário não são evidência de defeito em produção.
- A primeira resposta simulada de Equipe nas Obras não tinha o contrato específico de pessoas e obras e provocou erro de renderização. Após corrigir a resposta simulada, a tela abriu. O erro inicial não foi classificado como falha do produto.
- Planejamento foi observado no estado sem orçamento; a edição do cronograma não foi certificada.
- Portais e Android foram examinados no código e nas instruções; não tiveram suas jornadas completas executadas nesta etapa.

As capturas estão em `artifacts/rebranding-2026-10-30/`. São evidências do estado atual, não propostas do novo visual.

## 3. Problemas prioritários

| Prioridade | Evidência | Consequência | Tratamento proposto |
| --- | --- | --- | --- |
| Alta | `LegacyApp.jsx` exporta `Btn`; há outros Buttons em `components/ui` e `design-system/primitives` | Variantes e dimensões divergem | Uma implementação canônica, com adaptadores temporários |
| Alta | CSS base, tema, CSS injetado pelo legado e `marcell-clean.css` | Aparência depende de sobrescritas globais | Definir autoridade dos tokens e migrar componente por componente |
| Alta | Compras abre com cabeçalho; Financeiro com abas; Folha com escopo antes do título | O usuário precisa reaprender a hierarquia | Mesma ordem estrutural nos módulos |
| Alta | No mobile de Compras, cabeçalho e navegação ocupam a maior parte da primeira tela | A tarefa demora a aparecer | Contexto resumido, seleção curta de área e filtros recolhíveis |
| Média | Dashboard repete prioridades, pendências, ações, indicadores e resumos | Concorrência visual e repetição | Uma fila de decisões e indicadores que levam à origem |
| Média | Folha repete o líquido em resumo e composição; Locações tem período em mais de uma área | O escopo e a finalidade de cada bloco ficam menos claros | Contexto único, detalhes da composição sob demanda |
| Média | Títulos operacionais e explicações técnicas convivem com slogans e frases promocionais | Tom irregular e leitura mais longa | Linguagem direta orientada à tarefa |
| Média | Há títulos h1, h2 e h3 usados de forma diferente entre módulos | Hierarquia visual não corresponde sempre à semântica | Um título principal por tela, seções e subseções consistentes |
| Média | `--arcd-gold-500` vale `#18304C`, um azul, em `tokens/primitives.css` | Nome da cor não descreve seu valor | Primitivos por cor; papéis de ação nos tokens semânticos |
| Média | Nimbus Sans Regular é declarada para pesos 400–600 | Pedir 500 ou 600 não cria uma diferença visual real de corte | Assumir regular/bold ou adotar família com pesos reais, após avaliação |
| Média | Portal e aceite possuem cores e controles locais | Identidade pode divergir fora do ERP | Compartilhar os papéis visuais, com layouts adequados a cada público |

As prioridades acima são de design e manutenção. Não equivalem à classificação de incidentes de segurança ou bugs financeiros.

## 4. Skills verificadas

`finfin/awesome-frontend-skills` é um catálogo de links, não uma skill única. As origens das skills citadas foram localizadas no catálogo e seus arquivos principais consultados. Não foi instalado um pacote global de skills nem alterado o AGENTS.md.

| Skill/fonte | Papel neste trabalho | Aplicação e limites |
| --- | --- | --- |
| impeccable | Direção, hierarquia, densidade, consistência e revisão visual | Modo Operate: o usuário deve reconhecer a tarefa e os controles imediatamente |
| shadcn | Composição, variantes, tokens e acessibilidade dos componentes | Reaproveitar Radix e a configuração local; evitar uma biblioteca concorrente |
| anthropics/skills — frontend-design | Identidade intencional, tipografia e composição | Aplicar ao ambiente operacional; regras de hero de marketing não são modelo de tela ERP |
| addyosmani — frontend-ui-engineering | Separação entre dados e apresentação, responsividade, estados | Componentes compostos e estados explícitos; exemplos não são autorização para trocar a stack |
| vercel-labs — vercel-react-best-practices | Carregamento, bundle e renderizações | Priorizar o que se aplica ao React/Vite; recomendações de RSC e Next.js não se aplicam diretamente |
| millionco — react-doctor | Diagnóstico automatizado e comparação de regressões | Distinguir alertas estáticos de falhas reproduzidas; não usar nota como aprovação visual |
| wshobson — react-state-management | Escolha de onde cada estado deve viver | Estado local para interação; contexto de obra e filtros explícito; preservar a sincronização existente |
| sanyuan0704 — code-review-expert | Revisão de responsabilidades, riscos e mudanças incrementais | Insumos para a análise; não foi realizada auditoria completa de segurança de todos os endpoints |
| awesome-skills — code-review-skill | Revisão de arquitetura, acessibilidade, qualidade e comportamento | Adaptar ao React 18 existente; exemplos de React 19 não devem ser copiados automaticamente |
| brainstorming | Alinhamento da proposta antes de implementar | Esta entrega prepara a revisão da direção e do escopo |
| verification-before-completion | Evidência antes de afirmar aprovação | Resultados de comandos registrados ao final |

Links das fontes:

- [Catálogo finfin](https://github.com/finfin/awesome-frontend-skills)
- [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
- [frontend-ui-engineering](https://github.com/addyosmani/agent-skills/blob/main/skills/frontend-ui-engineering/SKILL.md)
- [Vercel React](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md)
- [React Doctor](https://github.com/millionco/react-doctor/blob/main/skills/react-doctor/SKILL.md)
- [React State Management](https://github.com/wshobson/agents/blob/main/plugins/frontend-mobile-development/skills/react-state-management/SKILL.md)
- [Code Review Expert](https://github.com/sanyuan0704/sanyuan-skills/blob/main/skills/code-review-expert/SKILL.md)
- [Code Review Skill](https://github.com/awesome-skills/code-review-skill/blob/main/SKILL.md)

## 5. Referências de ERP e o que aproveitar

As referências são fontes públicas dos próprios produtos, não acesso autenticado às suas plataformas. A tradução para MARCELL abaixo é uma proposta de design.

| Referência | Evidência pública | Aplicação proposta para MARCELL |
| --- | --- | --- |
| Vobi | Solicitação, ordem de compra e ligação com o financeiro; telas públicas com status, filtros e detalhe | Continuidade entre as etapas e acesso ao documento de origem |
| Omie | Resumo financeiro com saldos, pagar/receber do dia e acesso ao detalhe | Separar posição do dia, atrasos e previsão; cada número deve explicar seu escopo |
| Sienge | Dashboard de gestão de obras e acompanhamento gerencial | Comparar obras por indicadores consistentes e abrir as causas dos desvios |

Fontes:

- [Vobi — compras e integração financeira](https://ajuda.vobi.com.br/pt-br/articles/8781320-atualizacoes-vobi-08012024)
- [Vobi — exemplos visuais de gestão de compras](https://www.vobi.com.br/funcionalidades/gestao-de-compras)
- [Omie — resumo financeiro](https://ajuda.omie.com.br/pt-BR/articles/9260936-visualizando-e-entendendo-o-resumo-financeiro)
- [Sienge — dashboard de gestão de obras](https://ajuda.sienge.com.br/support/solutions/articles/153000221278-sistema-de-gerencial-de-obras-dashboard-de-gest%C3%A3o-de-obras)

Não importar automaticamente regras financeiras dos concorrentes. A identidade, os dados e os contratos de cálculo continuam sendo os da MARCELL.

## 6. Caminhos possíveis

| Caminho | Benefício | Limitação |
| --- | --- | --- |
| Atualizar apenas tokens e aparência | Mudança inicial menor | Mantém a fragmentação dos layouts e dos fluxos |
| **Renovar sistema visual e padrões por módulos — recomendado** | Resolve consistência e organização, preservando a operação | Exige acompanhar a migração e retirar adaptadores ao final |
| Reconstruir todo o frontend | Liberdade estrutural ampla | Maior risco e tempo até recuperar a cobertura funcional existente |

O caminho recomendado inclui extrações pontuais do legado necessárias ao novo sistema visual. Não depende de reescrever todo o ERP antes de entregar a primeira melhoria.

## 7. Tema proposto: MARCELL, gestão com precisão

O nome descreve uma direção de trabalho; não é um novo slogan para repetir nas telas.

Ambiente claro, superfícies de trabalho brancas, navegação institucional azul-marinho e ouro restrito à assinatura e à seleção. A marca aparece na qualidade da composição, no alinhamento e na legibilidade. Prioridades operacionais recebem mais espaço que a ornamentação.

Paleta proposta para avaliação:

| Papel | Cor | Uso |
| --- | --- | --- |
| Institucional | `#0D1B2E` | Navegação e ação principal |
| Ouro oficial | `#B9985B` | Logo e pequenos acentos; evitar texto pequeno sobre branco |
| Fundo operacional | `#F5F6F8` | Separar visualmente o espaço de trabalho da identidade institucional |
| Superfície | `#FFFFFF` | Tabelas, formulários, painéis |
| Texto secundário | `#536171` | Descrições e dados auxiliares |
| Divisória | `#D9DDE2` | Separação discreta entre registros e regiões |

Verde, âmbar e vermelho continuam com significado de situação, sempre acompanhados de texto ou ícone. Areia pode permanecer em superfícies institucionais de acesso e apresentação, sem dominar as áreas de dados. A substituição do fundo areia pelo neutro frio é uma proposta, não uma decisão já aplicada.

Alternativa a avaliar: dar maior presença às obras reais, com capas e um panorama de avanço no início, mantendo a mesma disciplina nas páginas de trabalho. Vantagem: aproximação com o portfólio da construtora. Risco: depende da qualidade e disponibilidade das imagens e pode disputar espaço com a fila de tarefas.

Outra alternativa é manter a materialidade atual em areia e tornar a composição mais compacta. Preserva mais familiaridade, mas comunica uma renovação visual menor.

### Tipografia e dimensões propostas

| Elemento | Padrão proposto |
| --- | --- |
| Família operacional inicial | Nimbus Sans local; avaliar os cortes reais antes de decidir troca de família |
| Título de página | 24 px, entrelinha 32 px; um único título principal |
| Título de seção | 18 px, entrelinha 24 px |
| Título de bloco e corpo | 14 px, entrelinha 20 px |
| Rótulo de campo | 13 px, com label persistente |
| Auxiliar | 12 px; não usar para a informação principal |
| Campo em dispositivo móvel | 16 px |
| Número financeiro | Algarismos tabulares, alinhamento à direita e valor completo |
| Controle desktop padrão | 40 px, compartilhado entre botão, input e select |
| Controle compacto | 36 px, apenas em contextos de alta densidade |
| Controle de toque | Mínimo de 44 px; ações frequentes de campo podem usar 48 px |
| Linha de tabela | Mínimo de 44 px no padrão; crescer quando houver conteúdo secundário |
| Ícone operacional | 16 px; 20 px quando a função ou o contexto pedir |
| Raio de controle | 6 px |
| Raio de painel | 8 px |
| Espaçamento | Escala 4, 8, 12, 16, 24 e 32 px |
| Margem de página | 24 px desktop, 16 px mobile |

Dimensões em rem na implementação e alturas como mínimos: rótulos longos, zoom e tradução não podem ser cortados. O padrão desktop de 40 px altera o atual confortável de 44 px e depende da aprovação da direção. A preferência de densidade existente deve continuar utilizável.

### Componentes

- **Botões:** primário, secundário/outline, ghost e destrutivo. Uma ação principal por região de tarefa; ações de apoio agrupadas. Ícone sem texto exige nome acessível. Loading mantém o tamanho, impede repetição e informa o estado.
- **Formulários:** mesma composição de label, controle, ajuda e erro. Agrupar por assunto. Validação junto ao campo e resumo quando houver múltiplos erros. Preservar entrada ao ocorrer falha.
- **Listas e tabelas:** mesma barra de busca/filtros, cabeçalho, alinhamento, seleção, ações e paginação. Valores sem truncamento. Distinguir zero, dado ausente e dado não carregado.
- **Estados:** carregando, vazio inicial, filtro sem resultado, falha, sem permissão, bloqueado, salvando, salvo e conflito. Cada estado deve explicar o que ocorreu e o próximo passo possível.
- **Detalhes:** drawer para consulta e edição curta; página dedicada para processos longos e comparação extensa. Evitar empilhar modais.
- **Confirmações:** explicitar efeito de aprovar, baixar, conciliar e fechar. A aparência do botão não altera o significado do comando.
- **Movimento:** retorno breve às ações; sem animação decorativa recorrente em dados e listas. Respeitar redução de movimento.

## 8. Fluxo lógico comum

```text
Módulo / tela
  → Título e ação principal
  → Obra + período pertinente + estado de atualização
  → Área de trabalho atual
  → Pendências e indicadores relevantes
  → Busca e filtros da lista
  → Registros e próxima ação
  → Detalhe, documentos e histórico
  → Confirmação da ação e retorno à mesma posição
```

Esse é um padrão de leitura, não uma obrigação de mostrar oito faixas vazias em toda tela. Regiões sem utilidade naquela tarefa não aparecem. Indicadores de uma subárea ficam junto ao conteúdo que explicam; não repetir o mesmo resumo acima de todas as abas.

O cabeçalho deve distinguir a data usada: **competência**, **vencimento**, **data do movimento**, **execução física** ou **última sincronização**. Um único filtro global de mês não pode representar todas essas datas indistintamente.

### Navegação

Manter os oito grupos funcionais existentes no primeiro ciclo. A expansão do menu deve privilegiar o módulo ativo e permitir ao usuário manter outros abertos quando necessário. Reduzir caminhos duplicados, sem remover atalhos úteis entre áreas.

No mobile: destino atual visível, seletor curto de subárea, filtros sob demanda e poucos destinos primários estáveis. A lista de trabalho deve aparecer cedo. Ações fixas só quando necessárias e com reserva de espaço para não encobrir registros. O botão de comunicação precisa respeitar esse espaço.

Preservar obra, período, busca, filtros, agrupamento, página e registro selecionado ao abrir e voltar. Evoluir o estado de navegação para URLs compartilháveis quando o contrato de permissões e os testes dessa navegação estiverem definidos. Não colocar tokens públicos de aceite/cotação em parâmetros que exponham credenciais ou alterem os fluxos existentes.

### Fluxos por domínio

| Área | Sequência de trabalho e leitura |
| --- | --- |
| Visão gerencial | Pendências do perfil → situação das obras → desvios → documentos e registros que explicam os números |
| Obras | Carteira → obra → orçamento/planejamento → execução → medição → custo e resultado |
| Compras | Necessidade → solicitação → cotação → comparação → aprovação → pedido → recebimento → documento → financeiro |
| Financeiro | Obrigações e recebimentos → vencimentos → documentos → pagamentos/recebimentos → conciliação → fechamento e análise |
| Pessoas | Cadastro → alocação → ponto → conferência → folha → fechamento → pagamentos e comprovantes |
| Terceiros | Contrato → execução/medição → aprovação → obrigação → pagamento |
| Locações | Disponibilidade → reserva/contrato → alocação → devolução/manutenção → cobrança |
| Comercial | Relacionamento → oportunidade → proposta → negociação → contrato → acompanhamento |
| Administração | Cadastros e regras → acessos → aprovações → integrações → auditoria |

Essas sequências organizam navegação e vínculos. Não criam pré-requisitos de negócio que o sistema não tenha. Compra direta, recebimento parcial, vínculo financeiro parcial e demais exceções existentes devem continuar explícitos.

## 9. Implementação proposta em etapas

| Etapa | Entrega | Critério de saída |
| --- | --- | --- |
| 1. Direção | Comparar a composição de Dashboard, Compras e Financeiro; escolher tema e densidade | Direção visual e hierarquia aprovadas |
| 2. Fundação | Tokens, botão/campo canônicos, tipos, estados e catálogo no Storybook | Componentes consistentes com teclado, toque e zoom |
| 3. Estrutura | Shell, navegação, título/contexto, filtros e retorno ao detalhe | Posição preservada; permissões mantidas |
| 4. Piloto | Compras e Financeiro completos, com dados representativos | Jornada de trabalho validada e diferenças resolvidas antes de expandir |
| 5. Expansão | Obras, Orçamento, Planejamento, Pessoas, Terceiros, Locações, Comercial e Administração | Mesmos padrões; exceções documentadas |
| 6. Ecossistema | Cliente, fornecedor, login, relatórios, impressão, TV e Android | Identidade comum e padrões próprios de cada contexto |
| 7. Consolidação | Retirar adapters e sobrescritas substituídas | Uma autoridade por componente e token; nenhuma migração visual incompleta escondida |

Na fundação, escolher uma implementação canônica apoiada nos componentes shadcn/Radix e nos padrões existentes do design system. `Btn` e imports anteriores podem ser adaptadores durante a migração, encaminhando às mesmas variantes e dimensões. Documentar compatibilidade de `loading`, `type`, ref, `asChild` e nomes acessíveis antes de substituir chamadas.

Estado local de interação deve ficar próximo ao componente. Contexto compartilhado de navegação não deve duplicar dados financeiros ou substituir a fila de gravação. Zustand, Redux, React Query ou uma nova biblioteca de formulários só entram com necessidade demonstrada; o rebranding não depende delas.

Para Android, consultar as skills e documentação Expo pertinentes antes da implementação. Preservar a máquina de estados, fluxo offline, relógio e invariantes de registro. Para TV, preservar leitura à distância; para relatórios, preservar dimensões, paginação, totais e legibilidade. O padrão de 40 px da web não é um padrão de impressão nem de quiosque.

## 10. Verificação e critérios de aceite

Linha de base executada nesta etapa:

- `npm run lint`: passou; fronteira financeira, nomes e armadilhas de UI aprovados.
- `npm run typecheck`: passou.
- Vitest de navegação, sessão, primitivas, tema, tokens, paridade e workflow: **7 arquivos e 64 testes passaram**.
- `npx shadcn@latest info --json`: executado; configuração local reconhecida.
- React Doctor 0.9.18: executado localmente com telemetria/score remoto e consulta de supply chain desativados. Relatório em `artifacts/rebranding-2026-10-30/react-doctor.json`. A varredura ampla atingiu o limite de tempo; `complete: false`, lint dos 1.478 arquivos não concluído e análise de código morto não realizada. **Não é uma aprovação do frontend.**

O scanner amplo retornou 22 diagnósticos heurísticos (1 error, 21 warnings), dos quais 18 estão em builds e arquivos gerados. Os quatro restantes se referem a dois pontos da API, um arquivo de rollback de RLS e um arquivo de projeção de mão de obra. A severidade é a classificação da ferramenta, não confirmação de exploração. A leitura inicial mostrou que o SQL sinalizado na API executa migrations locais de caminhos predefinidos, e o alerta de RLS está no script de rollback; não há evidência aqui de SQL interpolado pelo usuário ou de RLS desativado no ambiente atual. O spread de comando da API exige seguir a validação e autorização antes de classificar o risco. Nenhum desses pontos foi alterado no rebranding.

Uma segunda tentativa foi limitada a oito arquivos de entrada, componentes e fluxos compartilhados. O relatório `artifacts/rebranding-2026-10-30/react-doctor-ui.json` também terminou parcial: `complete: false`, zero arquivos efetivamente analisados pelo lint e oito ignorados ao atingir o limite. Os zero diagnósticos dessa execução **não representam ausência de problemas**. Para a implementação, é necessário resolver o custo de preparação/execução do scanner e excluir builds do escopo. Não há nota nem aprovação pelo React Doctor nesta entrega.

Não foi executado `npm run build`: o `prebuild` deste projeto inclui migrações e preparação de recursos remotos. Na implementação, a compilação local deve usar o bundler diretamente, conforme a necessidade, sem disparar esse ciclo por acidente.

Para aceitar cada módulo migrado:

1. Validar 320/390, 768, 1024 e 1440 px, com conteúdo realista e zoom de 200%.
2. Exercitar teclado, foco de abertura/retorno, labels, diálogos e ausência de dependência exclusiva de cor.
3. Conferir estados vazio, erro, bloqueio, falta de permissão, carregamento e conflito.
4. Confirmar que valores, classificações, vínculos, competências e comandos mantêm o comportamento anterior.
5. Validar importações, exportações e retorno ao registro após a ação nos fluxos afetados.
6. Comparar resultados dos testes e diagnósticos com a linha de base; triagem manual dos alertas automáticos.
7. Revisar visualmente o resultado renderizado e o catálogo de componentes.

Metas de produto: reduzir passos nas jornadas do piloto, trazer a fila antes da navegação secundária extensa no mobile e eliminar variações arbitrárias de controles equivalentes. Os passos atuais devem ser medidos com cenários representativos antes de prometer uma redução numérica.

## 11. Próxima decisão

Validar a direção **MARCELL, gestão com precisão**, incluindo fundo operacional claro e neutro, azul-marinho institucional, ouro contido e padrão comum de página. Com essa direção definida, preparar o piloto de Dashboard, Compras e Financeiro para revisão visual, antes de espalhar mudanças pelo ERP.

Este documento não substitui silenciosamente o DESIGN.md atual. Depois da aprovação, o sistema de design deve ser atualizado para refletir as decisões efetivamente adotadas. Nenhum push, pull request ou deployment foi solicitado nesta etapa.
