# Etapa 4 — Operação no celular e recuperação do salvamento

Implementada e validada localmente em 17/11/2026. Sem publicação, push, commit ou migrações. As alterações das etapas anteriores e as demais edições do workspace foram preservadas. Não foram acessadas ou alteradas edições reais do navegador do usuário.

## Listas e próximas ações

Adicionada paginação compartilhada, com até 12 registros por página, nas listas de Obras, Fornecedores, Equipes, Ponto por obra, resumo de obras do DRE e serviços de Avanço físico. O intervalo apresentado identifica o recorte. A busca alcança todos os registros disponíveis e retorna à primeira página ao mudar o filtro; páginas inválidas são ajustadas quando a lista diminui. Os filtros e a página ficam na sessão de trabalho, sem campos persistidos no cadastro.

As coleções completas permanecem como fonte de totais, indicadores, relatórios e comandos existentes. No Ponto, a busca e a página organizam somente a leitura: os lotes mantêm todos os funcionários da obra, data e grupo selecionados. O aviso Ações em lote e a ajuda explicam essa abrangência. Não foi trocada a lista usada para enviar o lote pela lista da página.

- Obras: busca e seleção de situação preservadas; Indicadores da área pode ser expandido no celular para consultar os totais sem afastar a tarefa.
- Fornecedores: ranking e avaliações continuam calculados sobre o recorte completo de obra/período. Indicadores de fornecedores fica recolhido inicialmente no celular e aberto no desktop; a busca e a página organizam os registros apresentados.
- Equipes: busca principal antes da lista; Filtros reúne lotação e as prioridades Documentação vencida e Sem lotação. Os nomes completos passam a quebrar linha, mantendo a identidade legível.
- Ponto por obra: pesquisa por nome/função e paginação, com os comandos e o alcance dos lotes preservados.
- DRE: pesquisa em Resumo por obra e paginação dos cartões. Demonstrativo consolidado completo e Gráficos do consolidado organizam a consulta, inicialmente recolhidos no celular e abertos no desktop. Indicadores e exportações não são recalculados pela busca.
- Avanço físico: serviços pesquisados são paginados; totais, boletins e integrações continuam usando os serviços completos do planejamento.

Os controles usam os componentes, tokens e a linguagem compartilhados. Não houve aumento da baseline de exceções visuais. A opção recolhível de indicadores foi acrescentada ao PageHero compartilhado; os demais usos mantêm o comportamento anterior por padrão.

## Pipeline com toque e teclado

Visualização do Pipeline oferece Lista · toque e teclado e Quadro por etapa. A lista é a apresentação inicial no celular; o quadro permanece disponível, com o comportamento anterior no desktop.

A lista permite pesquisar nome, serviço e contato, priorizar Atividade vencida ou Sem data para próxima ação e consultar a próxima tarefa com responsável e prazo. Os nomes abrem a ficha existente. Para mover, o usuário escolhe Mover etapa de e aciona Mover lead; selecionar a etapa sozinho não grava.

A ação usa a função `moverLead` existente e conserva seu histórico, regras e tratamento de perda. Perdido continua abrindo os dados de perda. O novo botão bloqueia toques repetidos enquanto aguarda a ação e apresenta recuperação em caso de falha. O quadro e os demais fluxos comerciais foram preservados. Não foi criado vínculo por nome, nem alterado o valor negociado.

## Percentuais e RH

O campo compartilhado de evolução percentual mostra até duas casas decimais com vírgula na leitura. Ao focar, apresenta o valor completo para edição, aceitando ponto ou vírgula. Focar e sair sem alterar não chama a atualização nem arredonda o valor do modelo. O slider conserva seus passos existentes; cancelar o gesto de toque recupera o valor completo anterior.

Os cálculos de acumulado, diferença e valor da medição mantêm os números originais. Exemplo validado no app: 34,4826% aparece como 34,48% na leitura e 34,4826% no campo focado, conservando `34.4826` nos dados. A medição anterior não foi regravada. O componente também foi testado com o anterior de 17,2414%, apresentado como 17,24% sem mudar o original.

Indicadores de RH deixou de mostrar o caminho do motor e a expressão próxima rodada. A orientação identifica o conteúdo do painel, a consulta de folha por obra/período e o DRE por competência. Consultar Folha aparece conforme o acesso existente. A regra de acesso ao DRE não foi ampliada.

## Aviso Edição protegida pendente

O usuário pediu a revisão do aviso mostrado na Conciliação. O journal de recuperação pertence à conta/navegador e vale para o aplicativo inteiro: a edição pode ter origem em outra tela. O print, sozinho, não determina o conteúdo específico dessa edição nem comprova erro nos movimentos bancários.

O aviso e Recuperar salvamento agora identificam Área da edição, com rótulos legíveis, e explicam que a pendência pode ser de outra área. Os nomes e valores de campos não são usados como resumo global. A consulta, a verificação do acesso e a comparação explícita continuam necessárias; abrir a tela não reenvia uma edição nem a descarta.

Quando a comparação já coincide com o servidor, Concluir conferência tem um caminho separado da fila de salvamento:

1. Consulta novamente a versão do servidor.
2. Confere que a mesma revisão local continua protegida e que o acesso ainda permite recuperá-la.
3. Refaz a comparação sem presumir escolhas de conflito.
4. Se nada precisa ser enviado, encerra somente aquela revisão local e adota a versão confirmada. Não chama a fila de salvamento.

Se o servidor ou a revisão mudaram, a edição é preservada e o usuário precisa consultar novamente. Há bloqueio enquanto outro preenchimento/envio precisa de resolução. Falhas de consulta, armazenamento ou acesso não descartam o conteúdo. `snapshotJournal.release` continua verificando a revisão antes de remover o registro.

O transporte já tinha uma proteção contra envio de dados idênticos; esta entrega não declara que todo aviso anterior provocava gravação duplicada. O aprimoramento torna a conclusão explícita e revalidada antes de retirar a pendência local. A edição real retratada no print não foi removida, reenviada ou analisada no navegador do usuário. Os testes usaram journals fictícios em sessões novas.

## Origem das informações e impacto no DRE

As listas paginadas são fatias de apresentação das coleções existentes. Não são cadastros novos nem fontes para refazer agregados financeiros. Previsão, compromisso, estoque físico, receita/custo reconhecidos e pagamento permanecem distintos. Nenhum custo ou pagamento é criado por paginação, filtro ou conclusão de conferência.

A única gravação exercitada no cenário do Pipeline foi uma movimentação comercial em servidor fictício local, com o histórico existente. Os demais cenários de navegação e recuperação recusam comandos de gravação e comparam os dados antes/depois. Não houve transação real, reconstrução de instância ou alteração de permissões no servidor. As divergências financeiras e transações integradas da etapa 5 continuam pendentes.

## Validação local

| Verificação | Resultado |
|---|---|
| Unitários | 42 testes aprovados em 8 arquivos: paginação, revisão/conclusão, inicialização e fila de salvamento, campo percentual, Pipeline, textos e contrato compartilhado de botões |
| DEV | 23 cenários aprovados em sessões novas |
| Build final | 55 cenários aprovados, incluindo 32 regressões das etapas anteriores |
| Tamanhos | 390 e 1440 px; cenário adicional em 320 px com texto a 200% |
| Conteúdo | 26 obras, 30 funcionários, 30 fornecedores, 28 oportunidades, 22 serviços e nomes longos em dados fictícios |
| Navegação | Registro fora da primeira página encontrado pela busca, mudança de página/recorte, vazio, filtro de pendências, formulário percentual e recuperação global |
| Entrada | Pipeline sem arraste, botão com trava de repetição, Tab e precisão do percentual, zoom e ausência de overflow horizontal nos cenários |
| Recuperação | Conferência encerrada sem comandos de gravação; mudança posterior no servidor mantém o modal e a edição protegida |
| Qualidade | Lint, design:check, manual:check e typecheck aprovados; sem ampliar baseline |
| Importações | 930 arquivos, 3.278 dependências, nenhum ciclo estático ou dinâmico |
| Bundle | 1.831.635 bytes gzip, abaixo do teto vigente de 1.891.328, sem violações individuais ou aumento de limites |
| Ajuda/manual | Revisão de 17/11/2026; manual regenerado, 143 guias e 65 abas |
| Visual | Capturas do build revisadas no celular/desktop: Obras, Equipes, Fornecedores, Pipeline, medição e recuperação |

Uma primeira execução selecionou uma opção oculta de navegação ao procurar o nome de uma obra; o teste foi corrigido para consultar o cartão visível. Não se tratou de ausência da obra no app. A revisão visual também levou à quebra de linha do nome completo na equipe.

Executado `npx vite build --outDir artifacts/roadmap-usabilidade-etapa4/dist`. Não foi usado `npm run build`, cujo prebuild executa migrações. Os builds locais permitiram revisar o resultado e validar os ajustes; não houve build remoto. `dist` e `bundle-metrics.json` preexistentes na raiz foram preservados.

Evidências em `artifacts/roadmap-usabilidade-etapa4`: logs `unit.log`, `lint.log`, `typecheck.log`, `cycles.log`, `build.log`, `bundle.json`, `e2e-dev.log`, `e2e-build.log`, `e2e-recovery-final.log`, `e2e-pipeline-input.log`; capturas `*-stage4-build-390.png` e `*-stage4-build-1440.png`; cópias anteriores em `before/`.

Para repetir, usar a prévia DEV isolada em 4400 e `npx playwright test --config artifacts/roadmap-usabilidade-etapa4/playwright.config.mjs`. O build é servido por `artifacts/roadmap-usabilidade-etapa4/preview.mjs` em 4403; executar `npx playwright test --config artifacts/roadmap-usabilidade-etapa4/playwright.build.config.mjs` com `ROADMAP_MODE=stage4-build`.

Os testes de celular usam emulação de toque e viewport no Edge, não aparelho físico. Não foi atribuída nova nota de usabilidade nem declarada a meta 9,5. A avaliação ampliada e os cenários de rede/publicação da etapa 6 permanecem pendentes.
