# Aceite operacional — K1-10

Atualizado em 25/10/2026. Responsável provisório da operação: **Hygor**, informado nesta sessão. Responsável por este documento/testes: sessão de integração, branch `codex/ponto-rh-aceite`.

**Resultado: prontidão ainda não demonstrada para iniciar pelo fluxo completo.** Há evidência automática do trecho cadastro → lógica do aparelho → recebimento → consulta → apropriação e de cálculos/conciliação separados. Falta integrar e verificar a quinzena mista, obrigação financeira e aparelho no ambiente isolado. Nenhum dado fictício foi enviado ao registro fiscal de produção. Nenhum pagamento real foi executado.

Critérios adotados: roadmap RH `docs/RH-PONTO-ROADMAP.md` e acompanhamento `docs/RH-PONTO-STATUS.md`, lidos na worktree `compras-ux-flow` da sessão RH enquanto ainda não publicados nesta base. Cortes mantidos: **06–20 e 21–05**. Datas de pagamento, parcelas CLT e regras coletivas dependem dos dados validados pela operação. Não presumir 50%. Operação ampliada continua dependendo de duas quinzenas e um fechamento mensal reais acompanhados.

## Versões e limites da evidência

**Referência RH mais recente informada em 25/10:** PR #119 HEAD `900a6b1`, ainda rascunho segundo RH. Conferido no Git local: esse commit altera apenas `docs/RH-PONTO-STATUS.md`; a diferença acumulada contra `5e96e4b` limita-se a README e documentos RH. Portanto não há mudança de código a retestar por esse avanço documental. RH relata segundo pre-push completo verde e CI GitHub ainda em andamento; não declarar todos os checks finais aprovados. Ponte Android v1 continua fora dessa PR. A referência anterior `eb2ca6d` abaixo permanece como histórico da primeira consulta.

**Preview da PR não autorizado para ensaio fictício:** RH informou deploy automático Vercel `EAsjySD3vyoHUkSHY2PTtJi9Die3`, projeto existente `mrc`, com estado SUCCESS. Variáveis e isolamento não foram verificados; esse preview **não é a API isolada A2**. Não usar para cadastro, marcação ou pagamento fictício. Sucesso de deploy não altera I03 nem aprova integração. Checks GitHub ainda em curso segundo RH; esta atualização não confirma resultado final de CI.

**Publicação RH para revisão:** [PR #119](https://github.com/hygorlp-dot/hygor/pull/119), confirmada via GitHub em 25/10 como OPEN/DRAFT, branch `codex/rh-ponto-week-one`, HEAD `eb2ca6ddd1040434e171a9421a906fd27da43ac6` (documentação; código `5e96e4b`). Log local `C:/tmp/rh-weekone-prepush.log` confirma “pre-push: tudo verde”. RH relata 399 arquivos aprovados/2 ignorados, 2.958 testes aprovados/13 ignorados, lint/arquitetura/build/typecheck e 28 cenários browser aprovados; não são nova execução desta sessão. **A PR não inclui a ponte `c6956a8`**: o aceite dessa ponte refere-se ao candidato combinado local, não à PR isoladamente. Sem merge, promoção ou validação física. Próxima entrega de integração deve identificar explicitamente ambos os componentes no mesmo candidato remoto.

**Reteste da ponte Android/RH em 25/10:** candidato `c6956a8d6c936143698d562492e5071b9f0ebd97`, incorporado apenas à worktree de aceite (merge `af6d8ec`). Diff da árvore contra o candidato restrito aos documentos e testes próprios de aceite; módulos candidatos preservados. **21/21 testes em três arquivos** (aceite, leitor/consumidor servidor e API) passaram em 69,71 s. Depois, ampliado aceite com publicação/replay/meia-noite: **6/6 passaram** em 49,37 s; 22 testes distintos neste recorte. Logs `C:/tmp/ponto-rh-aceite-evidencias/ponte-c6956a8.log` e `ponte-final-c6956a8.log`.

O JOIN SQL real no PGlite entre evento, ARP e estabelecimento alimentou a publicação aprovada: IDs, NSRs e dispositivo iguais à captura, dois intervalos de 14.400.000 ms. Replay da mesma operação após fechamento manteve a publicação inalterada. Batidas 23:59 e 00:01 locais foram selecionadas em dias separados, cada uma com aviso de saída ausente; o teste **não aprova remuneração de jornada cruzando meia-noite**, que continua pendência de tratamento. Aprovação do título/parcial passa pelo mesmo encadeamento local já descrito, sem escrita financeira remota. APK, API implantada e ensaio físico continuam pendentes.

**Reteste do candidato RH em 25/10:** incorporado localmente `5e96e4be4e77964f9c1c34ad3b4ccd322405b039` (pai `cff3f2858ee1725d00dac64afe97c6b7acc1d46e`) à branch de aceite, merge `3a9748e`. Nenhuma promoção para main/produção. O código app/servidor usado neste reteste é o incluído nesse candidato RH, não o RC Android posterior `23a9e52`.

Passaram **75 testes / 8 arquivos** em 29,65 s: aceite, `server/attendance-mobile-import`, `src/integration/attendance-mobile-api`, `operational-command-locked-path`, `mixed-payroll`, `advance-commands`, `closed-period-protection`, `remuneration-values`. Depois foi acrescentado encadeamento independente no arquivo de aceite: **5/5 aprovados** em 11,47 s; 76 testes distintos neste recorte, não 80. Logs locais: `C:/tmp/ponto-rh-aceite-evidencias/candidato-5e96e4b.log` e `cadeia-5e96e4b.log`.

Novo encadeamento: quatro batidas de uma pessoa por diária, com intervalo de almoço → ARP PGlite → apropriações → leitor SQL real `loadMobileAttendanceSource` dentro de transação → importação revisada com IDs em `mobileSource` → aprovação canônica que **gera** título de 120 → conciliação de 40 → saldo 80, sem segunda despesa. Não injeta título pronto. A referência de hora é medição sintética no banco local; a ausência dela foi corretamente recusada antes de completar a fixture. O fechamento do ponto é entrada explícita revisada do teste. Após o leitor SQL, os comandos RH/financeiro executam em memória: **não prova persistência financeira remota, UI, transporte HTTP ou APK**. A suíte mista separada cobre diária/CLT, corte entre meses, parcela explícita, repetição e parcial 200/700 = saldo 500; ainda falta encadear tudo no ambiente remoto real.

D01: proteção retestada com sucesso no candidato acima pela suíte `advance-commands`, incluindo períodos fechados e obrigações. I02: leitor SQL e importador reais encadeados com origem preservada; API/permissões/concorrência cobertas pelos testes existentes com dependências simuladas. Multiobra/tardio/fechado permanecem bloqueados para importação automática, sem substituir tratamento operacional específico. Meia-noite não foi comprovada neste encadeamento. Resultados históricos abaixo continuam identificados por sua base; não são aprovação de RC posterior.

| Componente | Referência usada | Alcance |
|---|---|---|
| Web/RH, servidor e lógica Android da primeira execução | `c7d4e777e7263b823bd2ce60797346ea69bca402` (main consultada por fetch em 25/10) | Base da suíte; não comprova os próximos candidatos |
| Testes novos | `src/integration/ponto-rh-aceite.test.js` e `.fixture.js` nesta branch | Nenhuma alteração em módulos de RH/Android |
| Banco dos testes de ponto | PGlite, migrations 016–018 do helper existente | SQL, funções, constraints e commits locais reais; banco em memória. Não testa PostgREST remoto, concorrência entre processos, restore ou permanência após reiniciar o host |
| Aparelho dos testes | lógica `terminal.js`/`sincronizacao.js`; armazém de referência em memória | Rede/relógio controlados, autenticação injetada; não é APK, câmera, SQLCipher ou Android físico |
| SQLite | suíte existente `armazem-sqlite.test.js` | SQLite local; não valida SQLCipher/Keystore no Android |
| Novo Android | sessão Android, branch `codex/ponto-android-candidato`; produtor `3daf952` informado | Não incorporado automaticamente; publicação RH ainda sem consumidor/persistência integrada nesta verificação |
| APK anterior e piloto code 4 | referências da sessão Android: `4f8b84c1`/`7a5b73c`, `3150aa14`/`c7d4e77` | Apontam a produção; não usar com fictícios. Não são candidato homologado |

O checkout original estava em `feat/ponto-livro-migracoes`, `554ab31`, com um arquivo de crítica não rastreado. Foi preservado. Worktree própria criada a partir de `origin/main`; nenhuma PR #69–#77 foi mesclada por esta sessão.

## Ensaio executável

**Cadastros iniciais remotos de homologação, atualização 25/10:** RH informou pedido humano “Por enquanto crie Fulano e Siclano” e criou somente no projeto isolado `ukkzpttnbyylkyujzwnv` a obra `piloto-k110` e os IDs `piloto-k110-fulano`/`piloto-k110-siclano`. Segundo RH, sem CPF, PIX, documentos, modalidade, datas ou remuneração; marcados `testData` e `cadastroPendente`. Conferência independente agregada, somente leitura: marcador `homologacao`, **2 empregados / 2 cadastros de teste pendentes / 0 eventos / 0 registros fiscais / 0 títulos / 0 pagamentos de folha**. Esta atualização substitui a contagem inicial de zero cadastros, preservada abaixo como histórico. Não são equipe real nem fixture financeira completa; não liberam captura ou cálculo. A produção segue com equipe K1-10 pendente. Backend isolado ainda indisponível para abrir esses cadastros pelo app. Não preencher modalidade/valores por suposição nem reproduzir esses cadastros em produção.

Na raiz da worktree, com dependências instaladas, executar sem credenciais de produção:

```powershell
npx vitest run src/integration/ponto-rh-aceite.test.js --maxWorkers=2
npx vitest run apps/ponto-obra/src/logica/rep-p-ponta-a-ponta.test.js apps/ponto-obra/src/logica/funcionario-global.test.js apps/ponto-obra/src/dados/armazem-sqlite.test.js src/domains/rh/advance-commands.test.js src/domains/rh/remuneration-mode.test.js src/domains/ponto/clt-attendance.test.js src/domains/conciliacao/payroll.test.js src/integration/financial-permissions.test.js --maxWorkers=2
```

Não é necessário executar `prebuild`, migrations remotas ou popular produção. Fixture reaproveita IDs do helper existente com duas obras fictícias, diária de R$ 120, mensalista CLT de R$ 3.000, encarregado, RH e financeiro. Não representa cadastro real da K1-10.

Oráculo independente: 07h–11h na obra A e 12h–16h na B = 240 + 240 minutos, pausa de 60 minutos excluída. Quatro eventos, quatro NSRs e dois intervalos; reenvio mantém a contagem. Dia incompleto produz `sem_saida`, sem inventar intervalo. Diária de 120 − adiantamento de 20 = líquido 100; pagamento parcial de 40 deixa 60. Valores e datas são entradas de teste, não calendário aprovado da empresa. O título financeiro é montado explicitamente no teste: **não foi produzido por aprovação de fechamento**. A competência fictícia desse título não comprova apuração CLT entre meses.

Evidência em 25/10: execução inicial conjunta **9 arquivos / 50 testes aprovados**, 35,52 s. Esse total inclui teste que reproduz comportamento defeituoso de adiantamento (D01), portanto não significa aceite integral. Depois da ampliação com repetição da conciliação e recibo, o arquivo novo foi reexecutado: **4/4 aprovados**, 9,76 s. São 51 testes distintos verificados, não 54. Runtime Node v24.18.0, Vitest 4.1.11. `git diff --check` sem erros. Nenhuma execução remota/produção.

## Matriz dos 15 cenários

| # | Cenário | Resultado e evidência atual | O que ainda falta |
|---|---|---|---|
| 1 | Mesma identidade cadastro/aparelho/web | Passou no ensaio novo: `e1/e2` nos dois cadastros de aparelho; IDs dos eventos consultados iguais aos enviados | UI e APK final com cadastro persistido real |
| 2 | Offline sem perda/duplicação | Passou lógica app + SQL e SQLite existente | APK físico, reinício e envio real |
| 3 | Resposta perdida/reenvio | Passou: servidor confirma commit; fila reenvia e recebe mesmos registros | Transporte remoto e APK final |
| 4 | Sem sync não vira falta | Passou cadastro sem escrita de falta; `clt-attendance.test.js` exige resolver registro ausente | Fluxo final e UI |
| 5 | Duas obras e intervalo | Passou captura/apropriação 240+240; pausa preservada | Remuneração e custo ligados aos intervalos, sem duplicar presença |
| 6 | Corte entre meses | Fixture 21/10–05/11 preparada; importação CLT de mês civil testada na suíte existente | Fechamento misto atravessando competências |
| 7 | Vigência de valor | Modalidade por vigência testada na suíte existente | Retestar histórico de salário/diária do novo RH |
| 8 | Adiantamento uma vez | Cálculo 120−20 testado; defeito D01 reproduzido pela suíte existente | Compensação única persistida por aprovação/revisão |
| 9 | Total x demonstrativos | Pendente | Fechamento misto e obrigação emitidos pelo fluxo real |
| 10 | Pagamento parcial | Passou domínio de conciliação: 100−40=60 | API, banco e UI do candidato |
| 11 | Transferência falhou | Pendente | Confirmar estado de falha na rotina final; não houve integração bancária testada |
| 12 | Repetição sem segunda saída | Reenvio ARP passou; repetição de conciliação coberta no teste novo | Repetir aprovação/requisição de pagamento persistidas |
| 13 | Marcação tardia | Pendente nesta base | Consumidor/publicação versionada, período fechado e revisão identificada |
| 14 | Permissões | Passou negativa de gestão do encarregado e suíte `financial-permissions` | Matriz completa por obra/empresa no candidato real |
| 15 | Recibo sem assinatura inventada | Teste novo verifica campos em branco, aviso e ausência de mutação | Conferência do documento emitido pela UI final |

## Lista única de pendências e responsáveis

| ID | Pendência | Responsável | Próximo passo |
|---|---|---|---|
| O01 | K1-10 existe; consulta agregada da sessão RH encontrou zero funcionários ativos lotados nela | Hygor + RH | Conferir equipe do piloto e lotações, vínculos, remuneração e valores vigentes; não transferir cadastros automaticamente |
| O02 | Jornada, intervalos, regras aplicáveis, datas de pagamento e parcelas CLT não confirmados | Hygor + RH/contabilidade | Validar no cadastro; preservar cortes 06–20/21–05 sem inventar parcela |
| O03 | Responsável provisório Hygor; contas e permissões de conferir/aprovar/pagar não verificadas | Hygor + RH | Identificar contas reais e testar acessos por papel/obra |
| O04 | Saldos e adiantamentos de abertura desconhecidos | Hygor + financeiro | Conferir registros/comprovantes existentes sem criar saldo fictício |
| I01 | RH 5e96e4b entregue e retestado localmente; candidato remoto conjunto ainda pendente | RH + Android | Entregar revisão conjunta implantada no ambiente isolado, com SHAs e API identificados |
| I02 | Ponte versionada c6956a8 retestada com JOIN SQL real, publicação fiscal e replay preservados | RH + Android + integração | Verificar gravação pela API implantada e leitura após reconexão. Multiobra, tardio e jornada cruzada continuam tratamento específico |
| I03 | Banco isolado verificado em leitura por integração; deploy aguarda decisão de custo no chat Android; API e APK de homologação ainda não entregues | Android + Hygor | Resolver decisão existente sem duplicar solicitação; entregar API, migrations compatíveis, SHA app/servidor e build/hash APK; só então parear |
| I04 | Android disponível com Hygor, conforme acompanhamento RH; modelo/versão e conexão nesta sessão não confirmados | Hygor | Anotar modelo e versão; instalar candidato identificado e executar roteiro físico abaixo |
| I05 | Recuperação, atualização e troca de aparelho sem ensaio físico | Android + Hygor | Usar runbook existente; preservar pendências e testar restauração em destino isolado |
| I06 | Fluxo misto, compensação única e revisão de obrigação não verificados | RH + financeiro | Gerar aprovação real no teste e seguir até conciliação/custo |
| I07 | Meio oficial de contingência ainda não confirmado nesta sessão | Hygor | Definir procedimento usado pela empresa enquanto registrador é candidato; orientar equipe |
| D01 | Corrigido e retestado em 5e96e4b; falha histórica em c7d4e77 | RH + integração | Confirmar inclusão da correção no candidato remoto final |

Esses itens impedem declarar prontidão do fluxo digital completo. Não são afirmação de que a obra física não pode iniciar por um procedimento oficial alternativo definido pela empresa.

Atualização de coordenação em 25/10: a sessão Android informou ter confirmado a autorização histórica A1–A5 no chat “Análise do Roadmap”, de 13/10/2026 às 19:21 UTC: Supabase isolado, Vercel separado, URL EAS preview, keystore de homologação e dois APKs, condicionados a nenhum custo novo sem aprovação específica. A sessão Android verificará planos/custos e executará o provisionamento; esta sessão não consultou diretamente a autorização original nem provisionou recursos. O escopo informado não inclui main, produção, APKs antigos ou A6–A9. RC1 segue em reconciliação. Isso atualiza a dependência I03, sem aprovar ambiente, build ou teste ainda não entregues.

Nova consulta de coordenação em 25/10: RH e Android continuam ativos. O `RH-PONTO-STATUS.md` da worktree RH relata testes focais e aprovação transacional implementada, mas seu HEAD continua `c7d4e77` com alterações ainda abertas. Essas evidências são relato da frente RH, não reteste independente desta sessão. Android relata banco isolado criado sem custo e decisão de plano Vercel pendente com o usuário; esta sessão não verificou o banco nem recebeu URL de API utilizável. Solicitados às duas frentes: SHAs estáveis, migrations, contrato compatível, URL/marcador de teste e identificação do APK. Foi perguntada a disponibilidade de backend local real autorizado enquanto o deploy estiver pendente. Nenhum teste completo novo executado sem essas dependências.

Por solicitação do usuário, acompanhamento automático desta conversa ativo a cada hora (`aceite-k1-10-acompanhar-candidatos`): consultar entregas, executar o ensaio quando disponíveis e atualizar este documento, sem avisos quando não houver mudança relevante. A decisão de custo permanece no chat Android; o acompanhamento não autoriza custo, produção ou pagamento real.

Equipe K1-10: relato da consulta somente leitura RH corroborado pelo log agregado `C:/tmp/rh-k110-readonly.log`: `workFound=true`, `activeEmployees=0`. Isso descreve lotação cadastral, não prova inexistência de equipe designada fora do sistema e não impede identificação global no aparelho. Jornada e valores dessa equipe precisam ser conferidos. Campos de calendário do log não foram usados para concluir ausência de calendário: RH ainda verifica as chaves corretas. Nenhum cadastro real alterado nesta sessão.

## Defeito D01

- Reprodução: `src/domains/rh/advance-commands.test.js`, teste “achado: cancelar um adiantamento…”. Criar R$ 300 com parcela em 05/07; fechar julho; cancelar em agosto; recalcular 21/06–05/07.
- Ocorreu: cancelamento aceito e desconto histórico caiu de 300 para zero.
- Esperado: preservar o período fechado; correção por revisão/ajuste identificado, conforme roadmap.
- Versão: `c7d4e777e7263b823bd2ce60797346ea69bca402`; RH avisado pelo canal entre sessões em 25/10.
- Responsável: RH. Reteste: suíte de proteção aprovada em `5e96e4b`. O teste histórico de `c7d4e77` documentava o defeito; o candidato corrige a proteção. Implantação final ainda pendente.

Detalhe histórico de I02 em `c7d4e77`: `ponto-apropriacao-propor` devolve `intervalos[].eventos`; salvar/listar apropriações não persiste/devolve essa lista. O teste inicial comprova pessoa/obra/horário, sem perda dos eventos originais na ARP. Em atualização de 25/10, RH informou alternativa: `attendance-import-mobile` relê eventos e intervalos atuais no servidor sob trava, valida IDs/versões e grava origem em `attendance.mobileSource`. Persistir eventIds na própria apropriação não será exigido como solução única; o reteste deve comprovar a rastreabilidade e a consistência do mecanismo entregue. Importação limitada a duas/quatro marcas confiáveis em obra única, classificação P/M/OT explícita; multiobra e tardios/fechados não são convertidos automaticamente.

Verificação independente do banco isolado em 25/10, somente leitura pelo conector Supabase: projeto `ponto-homologacao`, ref `ukkzpttnbyylkyujzwnv`, região `sa-east-1`, estado `ACTIVE_HEALTHY`, PostgreSQL 17.11. Marcador `arcd_ambiente.ambiente = homologacao`; contagens exatas: eventos 0, registros fiscais 0, company_app_data 0, dispositivos 0. As 16 tabelas public listadas têm RLS habilitada; bucket `ponto-obra` privado. Isso confirma preparação inicial, não políticas completas nem migrations equivalentes ao candidato final. Android relata 016–018 e auth rate limit aplicadas, sete avisos search_path a tratar e `adb devices` vazio. Não houve escrita, seed, leitura de credenciais ou execução do fluxo remoto por esta sessão.

## Ensaio físico curto — pendente

Reaproveitar `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` e `homologacao-registro.csv` do candidato Android; consultados na worktree Android, ainda ausentes nesta main. Recuperação segue `docs/PONTO-OBRA-BACKUP-RESTAURACAO.md` da frente Android, sem assumir sua infraestrutura.

1. Anotar executor (Hygor provisoriamente), modelo, Android, build/versionCode, SHA do app, hash APK, SHA servidor/web e URL. Conferir ambiente isolado antes de parear. Todos esses campos, exceto executor, continuam pendentes.
2. Instalar o APK de homologação identificado por Android. Confirmar etiqueta de homologação e servidor no **Diagnóstico**. Não usar os APKs anteriores de produção.
3. Conferir os mesmos IDs de funcionários no cadastro web e no aparelho. Bater online; verificar confirmação e evento correspondente na consulta web/banco de teste.
4. Sem internet, bater, fechar/reabrir e reiniciar o aparelho. Conferir pendentes; religar internet; usar **Sincronizar agora**. Integração confere os mesmos IDs uma única vez, fila vazia e NSR correspondente.
5. Executar dois intervalos com pausa e mudança de obra. RH confere os intervalos; só depois prepara/aprova a quinzena no candidato disponível. Comparar demonstrativos, obrigação, parcial, saldo e custo por obra.
6. Com suporte Android, ensaiar atualização e troca com pendências, falha durante envio e restauração em destino isolado. Não desinstalar/limpar dados para tentar resolver fila pendente.

Guardar resultado APROVADO/REPROVADO/BLOQUEADO por passo e evidência sem CPF completo, rosto, PIN, token ou dados bancários. Fotos de outra versão, emulador e testes Node não aprovam aparelho. Registro físico atual: **PENDENTE, nenhuma execução**.

Próximo teste: receber SHA RH/Android compatível e executar importação revisada com origem persistida → QUINZENA_MISTA_APROVADA → título → pagamento parcial → conciliação → custo. Conferir D01, repetição e concorrência; depois verificar que duas obras e marcação tardia permanecem pendências identificadas sem sobrescrever fechamento ou duplicar remuneração. A conclusão completa desses casos depende do tratamento específico entregue. Guias por papel: [PONTO-RH-GUIAS.md](PONTO-RH-GUIAS.md).
