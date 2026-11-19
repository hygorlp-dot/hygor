# Continuação do roadmap — tipografia e planos antigos

**Continuação posterior no mesmo dia:** [saneamento histórico e conciliação do DRE](SANEAMENTO-E-CONCILIACAO-DRE-2026-11-15.md). Conferência sobre cópia da origem real, seis identificações saneadas localmente e memorial de manutenções canceladas corrigido; dados financeiros preservados. O saneamento dos recebimentos excedentes e dos vínculos sem obra exige comprovação. As medições abaixo pertencem à rodada de tipografia e planos.

Execução automática autorizada em **15/11/2026**, com implementação e validação locais. Sem push, PR, publicação na Vercel ou migração remota. Evidências: `artifacts/tipografia-planos-20261115/`. Continuação de [gzip e relatórios](GZIP-E-RELATORIOS-2026-11-14.md).

## Resultado

| Pendência | Resultado comprovado |
| --- | --- |
| Herança tipográfica | O corpo legado passou a consumir a fonte do tema. IBM Plex Sans confirmada e efetivamente carregada nos quatro temas, em desktop/celular. |
| Sincronização antes de ler o armazenamento | O alinhamento automático aguarda a leitura das edições protegidas, a fila disponível e a permissão de edição. A prontidão e a existência de edição protegida são publicadas juntas. |
| Planos e vínculos ambíguos | Sincronização pausada e edição do cronograma bloqueada para conferência; registros preservados. O seletor existente permite mudar de obra. |
| Preservação do planejamento | Tarefas anteriores, datas, progresso, dependências, tarefas órfãs/avulsas e linha de base mantidos. Completar o vínculo não duplica tarefas após recarregar. |
| DRE | Valores preservados nas consultas e nos envios de sincronização, incluindo outra obra e a competência anterior. Pagamento continuou sem duplicar custo no roteiro financeiro. |
| Orçamento de desempenho | **1.811.185 bytes gzip**, abaixo do limite inalterado de 1.891.328: **80.143 bytes de margem**. |

Essas duas pendências locais foram atendidas. Os bloqueios não saneiam dados históricos ambíguos; a conferência desses registros e a homologação de integrações externas permanecem no roadmap.

## Herança tipográfica

A raiz da diferença estava em `src/LegacyApp.jsx`: `--type-body` e `--type-display` fixavam Nimbus Sans, enquanto o registro dos temas e os controles compartilhados usavam IBM Plex Sans. O corpo da página consumia a alias antiga e, portanto, não acompanhava a família do tema.

As aliases agora referenciam `--arcd-font-sans`; `--type-data` referencia `--arcd-font-mono`. A família de compatibilidade operacional em `tokens/typography.css` também usa IBM Plex Sans. As declarações dos três cortes de IBM Plex Sans foram concentradas nessa base, removendo sua repetição em `marcell-workspaces.css`. Cores, tamanhos, pesos, densidades e dados não receberam alterações por módulo.

Foram comparadas **24 combinações antes e 24 depois**: Dashboard, Financeiro e Planejamento × MARCELL Preciso, Claro, Operacional e Vidro × 1440/390 px. A referência encontrava Nimbus Sans no corpo; a rodada final confirmou IBM Plex Sans no corpo, nos títulos e nos textos amostrados, com o corte regular realmente carregado pelo navegador. As 24 verificações finais com axe não encontraram violações e não houve transbordamento global.

Outras duas verificações conferiram a entrada do portal do cliente, uma em cada largura. Sua família operacional permaneceu IBM Plex Sans. Essas verificações cobrem a entrada do portal; não representam uma nova homologação das publicações privadas de clientes.

Relatórios e PDFs continuam em **Nimbus Sans incorporada**, com os mesmos hashes dos dois arquivos de fonte. A mensagem institucional do acesso mantém P052. Os seis cenários de geração de relatórios foram repetidos: valores e tabelas comparados ao build anterior, fonte do corpo conferida no navegador, PDFs produzidos e dois HTMLs reabertos sem rede. A consolidação da interface não migrou a tipografia dos documentos.

## Sincronização de planos antigos

A compilação anterior reproduziu a abertura de **Recuperar salvamento** antes de terminar a leitura local, quando o plano precisava completar seu vínculo de versão. Uma regressão de componente também reproduziu um ciclo em que a prontidão ficava verdadeira antes de chegar a informação de que existia uma edição protegida.

Foram corrigidos os seguintes pontos:

1. **Leitura e proteção:** `SaveRecovery` publica prontidão e disponibilidade de edição protegida no mesmo efeito. Uma leitura mais antiga que termine depois de outra é ignorada. Falha de leitura mantém a inicialização bloqueada.
2. **Conta correta:** a prontidão é vinculada ao ID da conta atual. O estado de uma conta anterior não libera outra conta.
3. **Fila disponível:** o contexto compartilhado só permite gravação automática quando a leitura terminou, não há recuperação aberta/pendente nem preenchimento em memória, e a fila está ociosa.
4. **Permissão e obra:** o Planejamento confere a permissão existente de edição e o vínculo de obra do usuário antes do alinhamento automático. A API continua sendo a autoridade para autorização e persistência.
5. **Identidade sem ambiguidade:** mais de um plano por obra, tarefas concorrendo pela mesma etapa, múltiplos orçamentos sem vínculo ou referência antiga incompatível pausam a operação. A tela mostra a orientação e conserva a escolha de obra, com edição bloqueada nesse estado. A prioridade da baseline de controle aprovada foi mantida.

Os vínculos usam IDs existentes. Completar `budgetVersionId` reaproveita o orçamento identificado pelo fluxo atual. Não foi criada outra tabela, campo cadastral, fornecedor, material ou relação por semelhança de nome. A rotina anterior de organização das etapas foi mantida para os casos inequívocos.

## Cenários do início do planejamento

A fixture de navegador compila o aplicativo real com sua configuração de produção e controla somente o tempo de leitura do diário local. Usa IndexedDB real do contexto de teste e uma API isolada que aplica deltas por ID, sem produção ou PostgreSQL. Foram executados dez cenários em desktop e celular: **20 casos**.

| Cenário, por largura | Envios de salvamento | Resultado |
| --- | ---: | --- |
| Armazenamento lento e vazio | 1 após liberar a leitura | Nenhum envio ou modal prematuro antes da leitura; vínculo e nova etapa completados uma vez |
| Edição protegida existente | 0 | Orientação de recuperação; nenhum reenvio automático |
| Falha de armazenamento e Verificar armazenamento | 1 após a verificação | Leitura inicialmente bloqueada; conferência explícita libera o alinhamento |
| Conflito de versão | 1 recusado | Alternar entre obras não repete a confirmação recusada |
| Resposta perdida após aplicar o delta | 2 tentativas, 1 alteração no estado simulado | Mesmos registros reutilizados; tarefa nova e custo sem duplicação |
| Dois planos da mesma obra | 0 | Registros preservados; edição bloqueada; navegação para outra obra e retorno testados |
| Duas tarefas vinculadas à mesma etapa | 0 | Tarefas preservadas para conferência |
| Mais de um orçamento sem vínculo | 0 | Não escolhe automaticamente uma versão |
| Vínculo antigo incompatível | 0 | Não substitui a origem silenciosamente |
| Perfil de consulta com acesso à aba | 0 | Abertura e ajuda sem gravação automática |

Nos cenários válidos, a comparação incluiu linha de base, datas, progresso, dependências, custo já anotado no cronograma e tarefas órfãs/avulsas. A nova tarefa recebeu progresso zero. Depois da gravação, a página foi recarregada e a leitura local liberada novamente: não houve outro alinhamento. A normalização existente já conserva os metadados; não foi mantida uma segunda implementação desse normalizador.

## DRE em cada etapa

| Etapa | Evidência financeira | Conclusão |
| --- | --- | --- |
| Referência tipográfica | Consultas com NF aprovada de R$ 1.234,56 em novembro/2026, sem pagamento | Motor canônico: custo R$ 1.234,56, receita zero e resultado −R$ 1.234,56 |
| Mudança de fonte | Mesmas consultas após a consolidação, com zero gravações | Fonte, tema e geometria não criaram fatos financeiros |
| Sincronização e recusas | Comparação antes/depois de cada caso e de cada delta aceito pela API isolada | Mesmo custo e resultado; obra de controle e competência anterior preservadas |
| Resposta perdida | Duas tentativas sobre os mesmos IDs, uma alteração no estado simulado | Nenhum custo, tarefa ou pagamento duplicado |
| Relatórios | Seis gerações com células e valores iguais aos documentos de referência | Custo gerencial de R$ 2.034,56 preservado; gerar documento não grava operação |
| Roteiro financeiro | Vinte etapas com valores esperados independentes, incluindo reconhecimento, pagamento, conciliação e estorno | Final: receita R$ 5.000, custo R$ 3.000 e resultado R$ 2.000; pagamento sem novo custo |

A projeção gerencial acrescenta R$ 800 do cálculo de mão de obra ao controle da NF e, por isso, apresenta custo de R$ 2.034,56 e resultado −R$ 2.034,56. Essa composição já existia na referência; os dois motores foram conferidos separadamente. Não houve alteração de regra financeira para forçar igualdade entre bases diferentes.

O alinhamento do cronograma organiza previsão e vínculos. Ele não confirma pedido de compra, estoque físico, custo reconhecido, folha ou pagamento. Os custos já anotados nas tarefas foram preservados; sua manutenção não cria por si só um lançamento no ledger.

## Regressões e desempenho

- **1.258 testes selecionados aprovados**, zero falhas e zero pulos: sincronização, planejamento, ponto/folha, finanças, DRE, interface, ajuda, relatórios e empacotamento. Os testes específicos de inicialização e de bloqueios estão incluídos nessa contagem.
- **133 cenários de navegador aprovados**, zero falhas e um pulo condicional de orientação no desktop, no build final. Não foram somados às repetições dos mesmos testes.
- **216 verificações de inicialização aprovadas**: 83 imports isolados, 130 consultas das 65 abas em desktop/celular e três entradas públicas.
- **26 verificações tipográficas finais**, incluindo quatro temas em três áreas e duas entradas do portal. **20 cenários específicos de planos antigos** e **seis cenários de relatórios**, mantidos separados das contagens anteriores.
- `lint`, `typecheck`, `design:check`, ajuda e manual conferidos. Manual regenerado com revisão de **15/11/2026**, **142 guias para 65 abas**. A ajuda explica a espera inicial, a recuperação e a conferência de vínculos ambíguos. A troca da família tipográfica não muda passos operacionais.
- Sem aumento da baseline de exceções. Foram inspecionadas imagens representativas de desktop/celular para a tipografia e para o estado de sincronização pausada.

O checkout iniciou esta rodada em **1.810.275 bytes gzip**. A versão final mede **1.811.185**, acréscimo de 910 bytes pelos controles e orientações, com **80.143 bytes de margem** para o limite de 1.891.328. Nas dezesseis entradas de carga, a variação combinada de JS/CSS gzip e fontes foi de até **75 bytes**, inferior a **0,01%**. O ganho obtido nas etapas anteriores continua preservado. Essa é uma estimativa por arquivos solicitados; não mede tempo de produção ou aparelho físico.

## Evidências e limites

Diretório `artifacts/tipografia-planos-20261115/`: `startup-before.json`, `startup-final.json`, `initialization-before.log`, `unit-tests.json`, `browser-tests-final.json`, `typography-before.json`, `typography-final.json`, `final/cold-build-all.json`, `report-browser-final.json`, `browser-before.json`, `browser-final.json`, `bundle-before.json`, `bundle-final.json`, `dre-walkthrough.json` e `verification.json`.

A reprodução antiga, as tentativas de instrumentação e as correções de fixtures estão preservadas em logs separados. Uma fixture de linha de base inicialmente usava o nome de campo incorreto; ela foi corrigida para o contrato existente `tarefaId` antes de aprovar a preservação. Uma tentativa de extrair o normalizador foi descartada após conferir o fluxo completo existente; esse código não foi mantido no aplicativo. Isso evita atribuir ao produto uma falha de montagem do teste.

A entrada isolada dos testes de inicialização recebeu a mesma configuração de viewport da entrada real. Os vinte casos finais conferem a largura efetiva de 1440/390 px e a ausência de rolagem horizontal; a revisão visual do bloqueio no celular foi repetida depois dessa correção da fixture.

Os testes específicos de sincronização usam persistência de API em memória e IndexedDB real do navegador. Não são uma nova execução dos testes PostgreSQL da etapa anterior nem certificam transações remotas. As imagens e o axe cobrem os estados executados; não substituem revisão com leitor de tela, navegador móvel físico ou homologação de todos os dados históricos.

**Próximas pendências:** conferir e sanear os registros históricos que forem sinalizados como ambíguos, por IDs e origem; conciliar os fechamentos e memoriais reais; homologar serviços externos, armazenamento e dispositivos físicos em ambiente autorizado. Os dados reais não foram alterados nesta rodada.
