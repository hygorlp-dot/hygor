# RH e ponto — acompanhamento

## Continuidade do D6 — validação parcial

**D6 permanece parcialmente validado; D7 continua condicionado.** As correções
de código passaram pelos gates locais e foram publicadas em homologação.
O APK 10 foi instalado como app novo sobre um sistema Android clonado e
recebeu a recusa real com a marca MARCELL. **O layout com teclado foi
reprovado**; a nova correção para o APK 11 foi aplicada ao código e aguarda
validação própria. Ainda
faltam o percurso autenticado completo e sua conferência pelo RH. O candidato
não é declarado liberado para operação ampliada.

Evidência deste checkpoint: [D6 — fechamento técnico e limites](evidencias/d6-fechamento-2026-10-26.json).
A fonte do APK 10 e do frontend é o commit `64c8b7b`; este registro documental
não representa nova compilação ou mudança dessa fonte.

### Correções e verificações deste checkpoint

- O servidor passou a usar MARCELL em sete mensagens visíveis de pareamento,
  identificação/revogação de aparelho e funcionário inativo. Status HTTP,
  códigos de erro, identificadores técnicos e persistência foram preservados.
- A alteração de layout entrou no APK 10, mas a prova nativa reprovou o estado
  com teclado: botão encoberto, swipe sem revelar a ação e células do código
  cortadas nas extremidades. O ajuste para o APK 11 foi aplicado ao código,
  com seus gates, build e ensaio nativo ainda pendentes.
- Os testes focais do servidor/transporte tiveram seis falhas reproduzidas
  antes da correção da marca e **33 testes aprovados em quatro arquivos**
  depois. Os cenários verificam respostas do handler real, código inexistente,
  expiração, reutilização e uso único diante de tentativas simultâneas.
- Os gates gerais terminaram em 26/10/2026 às 14:09:11 UTC: **3.155 testes
  aprovados, 13 ignorados e nenhuma falha**, em 427 arquivos aprovados e dois
  ignorados. Lint, fronteiras arquiteturais, TypeScript, build web e diff-check
  terminaram com código zero. As **1.420 fontes verificadas permaneceram
  inalteradas** durante a execução.
- O CI remoto deste commit não foi repetido (`[skip ci]`), para respeitar a
  restrição de custo enquanto a cota de artefatos não estava confirmada. Os
  resultados acima são dos gates locais do commit `64c8b7b`, fonte do APK 10;
  não aprovam o patch do APK 11 ainda sem validação final. Não há nova nota de
  scorecard mobile nesta rodada.

### Código publicado e homologação identificada

As correções estão no commit
`64c8b7b52b256e0d83847bbdf84cbe6dc9f13936`, publicado na PR #121:
https://github.com/hygorlp-dot/hygor/pull/121.

O serviço Edge `ponto-api-homologacao` está na versão **9, ACTIVE**. Os 12
arquivos remotos foram comparados e são iguais byte a byte ao payload
revisado. A autenticação existente foi preservada. O frontend está no deploy
Vercel `dpl_CF9poo7VUKPVManpcHJDK1nhxBtF`, estado **READY**, com o mesmo
commit, no endereço https://ponto-homologacao.vercel.app. A prontidão do
frontend foi registrada em 26/10/2026 às 14:24:01 UTC.

Essa publicação é de homologação isolada. Não houve promoção para produção.
O ensaio nativo do APK 10 confirmou a recusa pública MARCELL e reprovou o
layout com teclado, conforme o checkpoint abaixo.

### Verificações públicas e comunicação

A consulta `ponto-ambiente` em `/api/data` retornou HTTP 200 e ambiente
`homologacao` às 14:27:48 UTC, sem desabilitar TLS. Às 14:32:11 UTC, houve
smoke da tela pública de login em **desktop 1363 × 936**, com marca renderizada,
campos vazios e nenhum envio de formulário ou sessão autenticada. Não foram
observados erros de console da aplicação; a coleta completa de HTTP não estava
disponível. A aba foi encerrada.

**O viewport mobile web não foi executado nesta rodada.** A API do navegador
remoto não oferece resize/emulação documentada. A tentativa local de Chromium
parou por `ERR_CERT_AUTHORITY_INVALID` antes de HTTP, sem bypass TLS. O smoke
desktop não comprova percurso autenticado ou execução nativa.

O checkpoint do APK 10, com mensagem aprovada e layout reprovado, foi
registrado na descrição da [PR #121](https://github.com/hygorlp-dot/hygor/pull/121)
às 15:41:54 UTC e na seção `marcell-d6-status` da
[PR #120](https://github.com/hygorlp-dot/hygor/pull/120) às 15:41:56 UTC. Não houve
contato direto nem confirmação de leitura da sessão Windows do Codex.

### Histórico comprovado do APK 9

O APK 9, compilado do candidato `b17f5320c8eff9b422af092c357ff95ed0b3abed`,
foi instalado por atualização sobre o APK 8, com a assinatura então disponível.
O ensaio preservou `firstInstallTime` e `dataDir`. O aplicativo abriu no clone
Android 9/API 28 e recebeu do servidor a recusa esperada para um código
inexistente. Não houve pareamento válido nem criação de ponto nesse ensaio.
Preservar instalação não comprova, por si só, preservação de fila pendente.

A verificação de rede retornou HTTP 200 com validação TLS e de hostname
mantidas, usando CA pública gerenciada somente no clone temporário. A limpeza
foi conferida, com os 16 hashes originais preservados e os componentes
temporários restaurados/removidos ou parados. Essa evidência mantém seu escopo;
não comprova a configuração de qualquer aparelho físico da equipe.

O APK 9 não inclui a alteração posterior de splash do head `71810eb`. Os
achados de layout e a mensagem ARCD registrados naquele ensaio explicam esta
rodada de correção. O comentário técnico foi publicado na PR #120:
https://github.com/hygorlp-dot/hygor/pull/120#issuecomment-6417030728.
A comunicação ocorreu por comentário na PR; não houve envio direto ao chat
Windows do Codex.

### APK 10 — instalação nova do app; layout reprovado

A segunda tentativa terminou com código zero em **26/10/2026 às 14:47:41 UTC**,
com verificação final às **14:48:56 UTC**. A primeira tentativa foi preservada:
um recurso Android gerado ficou truncado. A repetição usou a mesma fonte,
chave e versão. O manifesto de fontes permaneceu igual antes/depois, e a
árvore estava limpa ao fim do build.

- Arquitetura: **somente x86_64**, para ensaio em AVD.
- Tamanho: **61.200.534 bytes**.
- SHA256 do APK: `dce808d9fadab64eed5cfcffef73d58f541e3ef871eea6a1fbfe615417880f0c`.
- SHA256 do certificado público: `a82b8b69c1b7ae7856aa5e05c6548f502cd943f248174d0ce351263c5bc89c23`.
- Fonte: `64c8b7b52b256e0d83847bbdf84cbe6dc9f13936`.

O artefato **não foi distribuído**. A instalação foi concluída em
26/10/2026 às **15:25:27 UTC**, como **instalação nova do aplicativo sobre uma
cópia descartável do sistema operacional do clone 9 offline**. O APK 9 foi
removido somente dessa cópia, sem manter os dados do app. A ausência do pacote
foi comprovada antes da instalação do APK 10, executada sem `-r`.

A chave original não foi recuperada, e o certificado do APK 10 é diferente
do APK 9. O ensaio **não é upgrade 9→10, migração de fila/sessão nem execução
em Android virgem**. Os APKs 8/9 e os dados originais não foram usados como
instalação a substituir.

A tentativa anterior em AVD virgem não ficou utilizável após a criptografia
inicial. Foi encerrada às 15:06:55 UTC, sem instalação de app ou teste de rede;
a limpeza registrou zero erros e 28 arquivos originais com hashes iguais.
Esse resultado pertence à tentativa virgem. A limpeza do clone usado no
APK 10 foi concluída às **15:42:23 UTC**, sem erros: proxy restaurado
exatamente, reverse e CA gerenciada removidos, AVD e relay parados e
**28 hashes protegidos iguais**. A cópia do SO e o material de assinatura
exclusivo do ensaio ficaram preservados offline para a continuidade interna.

No clone, apareceu um ANR inicial do **System UI**; foi acionado “Aguardar”
uma vez. Não há avaliação de desempenho do aplicativo a partir dessa ocorrência.

Uma sonda pública separada, às 15:26:35 UTC, obteve HTTP 200 e ambiente
`homologacao`, com TrustManager e verificação de hostname padrão. No app,
um único código sintético `00000000` foi enviado às **15:33:25 UTC**. A resposta
real exibida foi **“Código inválido ou já usado. Gere outro no MARCELL.”**
O aparelho permaneceu não pareado. O status HTTP dessa chamada do app não foi
observado e não é deduzido do HTTP 200 da sonda.

As consultas SQL de 15:30:15 e 15:35:06 UTC registraram, antes e depois,
**um dispositivo, um pareamento usado e ausência do código sintético**, sem
alteração dessas contagens. Não houve pareamento válido ou captura de ponto.

**A UI do APK 10 foi reprovada.** Com o teclado iniciado em y=473, o botão
ocupava `[30,600][450,699]` e permanecia encoberto; o swipe não o revelou.
A linha das oito células do código apresentou corte nas extremidades.
Com o teclado fechado, a recusa era legível, mas o botão ficou fora da área
inicial visível; o alcance pela rolagem complementar não foi estabelecido.
A presença de ScrollView no código não constituiu solução comprovada.

### Próximas ações e dependências

A nova correção de layout para o **APK 11 foi aplicada ao código**. Os gates
previstos, o build, a instalação e o aceite visual desse novo candidato ainda
não foram comprovados neste checkpoint.
Os resultados do APK 10 permanecem identificados com a fonte `64c8b7b`.

O `access.json` da sessão antiga também não foi recuperado na busca legítima.
Essa é uma dependência de acesso operacional, separada da assinatura do APK.
O **acesso legítimo de operador** é necessário para gerar o pareamento e
realizar a conferência RH. O PIN autorizado é exigido nos fluxos pertinentes,
como o cadastro biométrico, e não em cada marcação. O contrato
`exigirVerificacao: false` foi preservado. O percurso autenticado continua
pendente por falta de acesso legítimo. Nesta rodada, nenhuma credencial foi
redefinida, nenhuma validação de autenticação foi removida e nenhum dado de
pareamento foi editado diretamente.

O roteiro separa duas provas: um lote de 20 capturas para persistência/reenvio
e outro de duas ou quatro batidas por pessoa/dia para conferência do RH. O
importador atual não aceita transformar 20 batidas da mesma pessoa no mesmo
dia em jornada automática. Usa todas as capturas do dia e exige origem
confiável, intervalos conferidos e ausência de ponto/período protegido.

No ensaio financeiro histórico, outubro estava aberto e os adiantamentos
sintéticos estavam registrados. Esses fatos não resultam de nova consulta
financeira nesta rodada e não atestam saldos ou estado remoto atuais. Nenhum
fechamento remoto foi executado nesta rodada. Uma continuidade autorizada
deverá reconferir e reaproveitar os registros pelos mesmos IDs, sem duplicar
obrigações, baixas ou compensações. O ciclo mensal completo pode ser
reproduzido em ambiente local controlado e assim identificado; não constitui
fechamento remoto nem operação mensal real.

Testes físicos e duas quinzenas consecutivas mais um fechamento mensal reais
acompanhados continuam pendentes. A disponibilidade do Android físico da
equipe precisa ser confirmada; ela não foi verificada nesta sessão. A situação
formal do registrador permanece a declarada pelo projeto. Nenhum resultado
desta rodada substitui esses critérios.

As seções históricas abaixo registram os checkpoints anteriores. Menções a
APKs antigos, bloqueios daquele ambiente ou suites anteriores não substituem
o estado atual descrito nesta seção.

## Retomada MARCELL — 26/10/2026

O usuário informou que a recuperação de 63 arquivos não foi salva em pasta, patch ou commit. Esta retomada parte do checkpoint remoto `61c9e456a59264af2d62d60812b8a4b21cb268fa` da PR #120; não declara recuperada uma árvore local indisponível.

- Refeitos textos visíveis do aplicativo, nome de exibição, ícone, cores MARCELL e Nimbus Sans embutida/offline. Identificadores de pacote, banco, API, assinatura, permissões e históricos permanecem compatíveis. O nome do REP-P continua provisório, sem declaração de conformidade. O texto de consentimento com a nova marca recebeu versão própria; consentimentos antigos não foram regravados.
- Transporte diferencia servidor ausente, leitura de sessão local, timeout, falha de conexão e resposta inválida. Erro genérico de fetch não afirma mais “Sem internet”. HTTP 200 com corpo inválido não confirma uma operação. Falhas locais/de rede continuam permitindo repetição; não eliminam batidas ou fotos.
- PDFs: fallbacks MARCELL preservam a identificação empresarial preenchida. Cabeçalho e totais seguem a apresentação comum, sem mudar células ou valores. Quatro modelos renderizados: holerite CLT, folha diária, rescisão e relatório longo (cinco páginas, 130 linhas conferidas, zero e negativo preservados). Evidências locais: `C:/tmp/pr120-pdfs/` e `C:/tmp/pr120-pdf-qa.log`.
- Validação: 233 testes focais mobile/relatórios aprovados; 32 cenários de navegador desktop/celular aprovados; 22 testes focais de transporte, relatórios, parser e plano de adiantamento aprovados. Lint, TypeScript e arquitetura aprovados. A suíte geral inicial revelou preparação Windows com Python/UTF-8 e dependência externa por junction; os dois problemas foram corrigidos. O gate final de publicação registra a suíte geral e build em `C:/tmp/pr120-retomada-push.log`.
- Exportação Hermes Android concluída com as fontes e modelos locais (`C:/tmp/pr120-android-export`); não é um APK novo nem prova de execução nativa. APKs anteriores não contêm estes ajustes.
- A ação pública `ponto-ambiente` respondeu HTTP 200 e `ambiente=homologacao` em `https://ponto-homologacao.vercel.app/api/data`. Nenhum pareamento, cadastro, pagamento ou lançamento remoto foi executado nesta retomada.

**Histórico da retomada do APK:** na sessão Windows, o AVD remoto ainda não estava acessível e os resultados anteriores eram relatados. O ensaio posterior do APK 9 comprovou atualização 8→9, abertura e recusa pública de código inexistente. Isso atualiza aquele bloqueio específico, sem comprovar pareamento válido, captura ou fila no aparelho físico. Os registros anteriores permanecem em [retomada Android](../apps/ponto-obra/docs/RETOMADA-ANDROID-2026-10-26.md) e [evidência declarada](evidencias/android-retomada-2026-10-26.json).

O gate da alteração `b17f532` registrou **3.151 testes aprovados e 13 ignorados**, lint, arquitetura, TypeScript e build aprovados. Esse checkpoint histórico permanece preservado. A correção D6 atual tem **3.155 testes aprovados e 13 ignorados**, os demais gates locais concluídos e homologação implantada no commit `64c8b7b`. O APK 10 foi compilado e instalado como app novo x86_64 sobre uma cópia do SO do clone 9, com assinatura diferente. A recusa MARCELL foi observada, mas o layout com teclado foi reprovado; APK 11 tem correção aplicada ao código e ensaio pendente. O CI remoto do novo commit não foi repetido.

Checkpoint de **25/10/2026**. A continuidade atual do D6 está registrada no início deste documento. [Roadmap](RH-PONTO-ROADMAP.md) · [Simulação completa](SIMULACAO_COMPLETA_FULANO_SICLANO.md) · [Revisão financeira](REVISAO_FINANCEIRA_HOMOLOGACAO.md).

## Contexto e decisões do checkpoint de 25/10/2026

O usuário pediu a execução autônoma, a simulação completa e a compilação do APK, com **custo adicional zero**. A frente atual usa a Vercel e o Supabase de homologação. Reaproveita o PR #119 e os módulos existentes. A decisão antiga de aguardar o ambiente ficou registrada no [histórico do PR #119](RH-PONTO-STATUS-PR119.md); não descreve a autorização atual.

**O sistema por diária será mantido.** A escolha é por funcionário: diária, com seu valor, ou CLT mensal, com seu salário. As duas formas coexistem na mesma quinzena. Diária e salário são campos independentes; preencher o salário não converte um cadastro diário. Alterações usam vigência e histórico, preservando fechamentos anteriores. A produção atual e o APK de produção permanecem separados desta homologação. Evidências: [preservação da diária](PRESERVACAO_DIARIA.md).

Branch daquele checkpoint: `codex/fulano-siclano-integracao`. Base reaproveitada: `900a6b1ff12dea5f308f2a7f7288c73f846468f6`, do [PR #119](https://github.com/hygorlp-dot/hygor/pull/119). A árvore de trabalho contém alterações posteriores a essa base. O identificador da base não comprova sozinho as fontes de um APK.

Na entrega de 25/10/2026, o candidato estava no [PR #120](https://github.com/hygorlp-dot/hygor/pull/120). O frontend completo foi publicado a partir de `012604ac698a8fcd14c2c0f65f5b2e9128661ea5`, no deployment `dpl_Ag6g6VF5Pbf6Ee2qzynm3B1tYVdQ`, e passou na conferência real de navegador descrita abaixo. Publicação, testes, documentos, financeiro e APK estão reunidos na [evidência consolidada da entrega](evidencias/homologacao-2026-10-25.json).

## Ambiente isolado

| Item | Destino |
|---|---|
| Gestão web e API | `https://ponto-homologacao.vercel.app` e `/api/data` |
| Projeto Vercel | `ponto-homologacao`, plano Hobby, sem conexão com a main |
| Banco | Supabase `ukkzpttnbyylkyujzwnv`, plano Free |
| Marcador obrigatório | `arcd_ambiente.ambiente = homologacao` |
| Pacote Android | `br.com.arcd.pontoobra.homologacao` |
| Obra fictícia | `piloto-k110`, nome K1-10 |

As credenciais ficam fora do repositório. A API não oferece bootstrap público de administrador. O app confere o ambiente antes de parear e sincronizar. O endpoint de produção não recebe esta massa de teste. Não houve upgrade, contratação ou pagamento real nesta execução.

## O que avançou

| Frente do roadmap | Entrega |
|---|---|
| Regras e saldos | Vigência de vínculo, remuneração, jornada e desligamento. Adiantamento novo só é compensado depois da liquidação comprovada. Pagamento parcial, reversão e repetição protegidos. |
| Diária e CLT mensal | Escolha individual preservada, valores independentes e aprovação dos dois na mesma quinzena. Cadastros antigos sem vínculo informado continuam por diária. |
| Cadastro único | Fulano profissional mensalista e Siclano ajudante por diária, com vínculo CLT explícito. Históricos, contatos, jornada, matrícula e dados fictícios para os testes. |
| Ficha do operário | Sete seções no cadastro existente: resumo/pendências, dados, documentos/fotos, ponto, pagamentos, histórico e engenharia. Consulta de ponto arquivado sem restaurar ou duplicar registros. Permissões e avisos auditados no servidor. |
| Celular integrado | Histórico 8→9 preservado. APK 10, fonte 64c8b7b, instalado como app novo sobre cópia descartável do SO do clone 9, com outro certificado; sem distribuição, upgrade ou migração da linhagem anterior. Uma recusa real MARCELL foi observada e as contagens remotas permaneceram iguais. UI com teclado reprovada; patch do APK 11 ainda sem validação final. Pareamento válido, captura/fila, ponte RH e teste físico continuam pendentes. |
| Documentos do RH | Dezesseis PDFs sintéticos, oito por pessoa, enviados ao prontuário privado remoto. Upload, abertura autorizada e download conferidos; os hashes dos arquivos baixados correspondem aos originais. |
| Quinzena e competência | Cortes 06–20 e 21–05 mantidos. Adiantamento pago no dia 20 separado do saldo mensal. CLT por diária exige memória identificada; o app não inventa salário mensal. |
| Financeiro e obra | A aprovação cria a obrigação no financeiro existente. Baixas parciais e finais zeram o saldo sem criar novamente o custo da mão de obra. |
| Registrador formal | A ARP e os NSRs foram preservados. A conformidade formal do REP-P continua sendo uma etapa própria. |
| Piloto contínuo | Roteiro disponível. Duas quinzenas e um fechamento mensal reais continuam necessários para operação ampliada. |
| Expansão | Deve partir dos resultados do piloto. Rotinas adicionais e integrações não são declaradas concluídas apenas porque a simulação passou. |

## Histórico — simulação local completa

O ensaio de `src/integration/simulacao-completa.test.js` passou usando os handlers reais da API, PostgreSQL em memória, migrations reais e comandos financeiros reais. A identidade autenticada, o relógio e os sensores foram controlados pelo teste; isso está detalhado no [relatório](SIMULACAO_COMPLETA_FULANO_SICLANO.md).

- **180 marcações e 180 NSRs únicos**, com fila offline e reenvio de resposta perdida sem duplicação.
- Fulano: salário de R$ 3.300,00, adiantamento pago de R$ 1.320,00 e saldo de teste de **R$ 1.695,40**.
- Siclano: diária de R$ 120,00, adiantamento pago de R$ 600,00 e saldo de teste de **R$ 1.891,71**, calculado pela memória fictícia identificada.
- Baixa parcial, saldo restante e reenvio idempotente. Saídas simuladas de **R$ 5.507,11** e contas a pagar da folha zeradas.
- Origem de ponto, auditoria, permissões, competência seguinte e desligamento posterior preservados.
- Um dia em duas obras permaneceu como pendência identificada; não foi duplicado nem aprovado silenciosamente.

O fechamento de outubro foi ensaiado com o relógio local avançado para novembro. O sistema remoto não foi autorizado a fechar um mês ainda em andamento. Os valores tributários são premissas da memória de teste, não validação fiscal.

## Histórico — ensaio remoto financeiro de 25/10/2026

Os valores e a situação da competência abaixo pertencem ao ensaio histórico. Não foram reconfirmados por nova consulta financeira na rodada D6 de 26/10. Nenhum fechamento remoto foi executado nesta rodada.

O relatório `.tools/homologacao-adiantamentos-report.json` terminou com `status: completed` em **25/10/2026, às 20:53:02 UTC**. Foram usados a API real de homologação, os comandos oficiais, persistência remota e um extrato sintético identificado. A data de emissão/pagamento registrada no cenário é 20/10; a execução ocorreu em 25/10, sem alterar o relógio.

| Verificação remota | Resultado |
| --- | --- |
| Adiantamento de Fulano | R$ 1.320,00; baixa de R$ 660,00 e outra de R$ 660,00; saldo zero. |
| Adiantamento de Siclano | R$ 600,00; baixa de R$ 300,00 e outra de R$ 300,00; saldo zero. |
| Extrato e reenvio | Quatro movimentos, duas liquidações por título; repetição verificada sem duplicação. |
| Caixa do cenário | R$ 1.920,00 de saídas registradas; R$ 0,00 a pagar nesses adiantamentos. |
| DRE operacional | R$ 270,00 de custo de mão de obra antes e depois das baixas. O pagamento não duplicou o custo. |
| Cadastros e ponto | Permaneceram iguais à fotografia anterior do ensaio. |
| Fechamento e transferência | Outubro permaneceu aberto naquele ensaio; nenhuma transferência bancária real ou mudança de relógio. |

O relatório `.tools/homologacao-dre-report.json` confirma respostas bem-sucedidas das consultas reais de DRE da obra e da empresa, com `source: canonical_ledger`, nenhuma questão reportada, custo de R$ 270,00 e saídas de R$ 1.920,00. O caixa de teste ficou em −R$ 1.920,00, pois não houve entradas. Esses valores pertencem a dimensões diferentes: custo operacional e movimentação de caixa. As respostas registram `engineEnforced: false`; a prova é das consultas e dos valores retornados, não de uma imposição nova de motor ou de uma contabilidade fiscal completa.

No ensaio, os adiantamentos pagos ficaram disponíveis para a compensação programada, conforme as datas registradas. O ensaio não aprovou antecipadamente a folha mensal de outubro. O relatório local completo e este ensaio remoto têm escopos distintos; os R$ 5.507,11 da simulação local não foram lançados como pagamento remoto.

## Histórico de validação — checkpoint de 25/10/2026

No checkpoint anterior, lint, TypeScript, fronteiras arquiteturais e build Vite passaram. A revisão financeira encontrou dois problemas na tela de folha — classificação do CLT por diária e atualização após baixa de adiantamento — reproduzidos em testes e corrigidos.

A suíte geral desse checkpoint terminou sem falhas: **3.059 testes passaram e 13 foram ignorados; 411 arquivos passaram e dois foram ignorados**, em 881,22 segundos. A execução anterior, interrompida quando o Android e os testes disputaram recursos, não conta como aprovação.

**A rodada final terminou em 25/10/2026 às 21:15:55 UTC: 3.113 testes aprovados, nenhuma falha e 13 ignorados, de 3.126 testes; 423 arquivos aprovados e dois ignorados, em 433,47 segundos.** Os relatórios `.tools/validation-delivery/tests-exit.json` e `tests.json` registram `success: true` e código de saída zero. Os lotes específicos de NTP e das rotas auxiliares tiveram, respectivamente, 58 e 32 testes aprovados, descritos no [relatório do ambiente](HOMOLOGACAO-VERCEL-SUPABASE.md). Lint, fronteiras arquiteturais e TypeScript passaram; os registros estão em `lint.log`, `architecture.log` e `typecheck.log` no diretório de validação. **O build Vite final passou em 3,00 segundos**, com saída zero em `.tools/validation-delivery/build-exit.json`. O frontend final ficou `READY` e foi conferido pelo navegador real.

No primeiro lote local de navegador, 29 dos 30 casos passaram na primeira execução. O único caso de navegação móvel que falhou passou na repetição isolada, sem alteração de código. O fluxo novo de CLT por diária passou tanto no computador quanto na tela de celular; o relatório preserva a ocorrência e as evidências.

Depois disso, a [ficha do operário](FICHA_DO_OPERARIO.md) passou nos dois cenários locais de navegador, desktop e celular, em 27,4 segundos, além das verificações de autorização, auditoria, transferência de obra e arquivo. As respostas de rede do navegador são fictícias; a prova de persistência dos avisos usa API real e Postgres local. A [preservação da diária](PRESERVACAO_DIARIA.md) passou em **59 testes de oito arquivos**, incluindo coexistência com CLT mensal, valores independentes, adiantamentos antigos, histórico fechado e montagem dos relatórios PDF/Excel.

O relatório `.tools/homologacao-seed-report.json` confirma os dois funcionários e **16 documentos com `uploadAndDownloadVerified: true`**, incluindo a conferência SHA256. Isso comprova o envio e a recuperação dos anexos privados. A consulta pela tela também foi conferida no ensaio remoto abaixo.

## Histórico — navegador real de homologação em 25/10/2026

O ensaio de leitura em [ponto-homologacao.vercel.app](https://ponto-homologacao.vercel.app) passou entre **21:38:38 e 21:39:52 UTC de 25/10/2026**, em **74,359 segundos**. Foram executados dois contextos sequenciais de Chromium: computador, 1440 × 1000, e tela de celular, 390 × 844. O login usou a conta real de homologação por e-mail e senha; não houve resposta simulada da API.

| Conferência nas duas telas | Resultado |
| --- | --- |
| Fichas de Fulano e Siclano | As sete abas abriram, com pendências, dados, ponto, documentos, pagamentos, histórico e engenharia. |
| Escolha e valores no cadastro | Fulano: CLT mensal de R$ 3.300,00 e referência de custeio de R$ 150,00. Siclano: diária de R$ 120,00, sem salário mensal criado por conversão. Os dois vínculos CLT foram definidos explicitamente na massa fictícia. O editor foi aberto apenas para consulta. |
| Documentos privados | Oito documentos ativos por pessoa. Um PDF de cada pessoa foi baixado pelo botão da tela em cada contexto: quatro downloads, com URL temporária e SHA256 igual ao arquivo enviado. Os temporários foram apagados. |
| Ponto de outubro | Consulta de 25 linhas de calendário para Fulano e 20 para Siclano, conforme suas admissões e a data do ensaio. Essas linhas não equivalem a dias de presença confirmada. |
| Pagamentos visíveis | Fulano: R$ 1.320,00 aprovado e pago; Siclano: R$ 600,00 aprovado e pago. Cada título mostrou duas baixas e saldo zero. |
| Preservação | Os hashes de cadastro, ponto e financeiro permaneceram iguais antes e depois. Nenhum comando de mutação foi tentado. |
| Erros | Nenhum erro JavaScript, de console ou resposta HTTP de erro. Nenhuma falha inesperada de requisição. |

O relatório `.tools/homologacao-web-report.json` terminou com `status: passed` e `success: true`. Ele registra quatro eventos `ERR_ABORTED` esperados quando a navegação do PDF se transforma em download; os quatro arquivos foram recebidos e conferidos, portanto esses eventos não representam download perdido.

As duas tentativas anteriores pararam antes do login por DNS e confiança da CA no ambiente do runner. O ajuste usou o proxy e a CA pública oficial em uma base NSS isolada, aplicada apenas ao processo filho do Chromium. A validação TLS permaneceu ativa, sem mudança de `HOME`, da confiança global ou do app. As tentativas e o ajuste estão preservados na evidência da entrega.

Não foram produzidos screenshots pessoais, vídeos ou traces. O navegador em tela de celular comprova este fluxo web; não substitui o teste físico do APK.

## Histórico do APK 7 — compilação e limite daquele ensaio

O arquivo final **`ponto-obra-homologacao-7.apk`** foi compilado localmente e disponibilizado para entrega, com 121.489.302 bytes e SHA256 `2a7b20d2329b731b8ac5c3aef19386fde07208a8ee8d1737fad0bf2c1c856014`. Foram conferidos assinatura, pacote isolado, versão 7, endpoint, modelos faciais e correspondência das fontes. A permissão desnecessária `READ_PHONE_STATE` foi removida. Os builds 5 e 7 mantêm pacote e certificado compatíveis para o ensaio de atualização.

A conferência final voltou a validar os 63 arquivos do manifesto de fontes móveis, sem alteração em relação ao APK 7, com `fontesSha256` igual a `316884caba0bca7dc1676f0ce3322e0e40fcbdd41aad1d17fcc3a072781b1dc7`.

**No ensaio específico do APK 7 descrito abaixo, o emulador não chegou a instalar o aplicativo.** Sem aceleração KVM, as tentativas com Android 35 e AOSP 30 falharam nos serviços do próprio sistema; a instalação terminou com `Can't find service: package`. Não houve abertura do app, pareamento nem marcação por esse ensaio. Compilação e assinatura foram aprovadas; instalação, atualização 5→7, persistência da fila no aparelho, câmera, GPS e biometria permanecem para o Android estável da equipe. Detalhes e manifestos estão no [relatório do build](../apps/ponto-obra/docs/BUILD-LOCAL-HOMOLOGACAO.md).

O ensaio posterior do APK 9 comprovou atualização 8→9 e abertura, conforme o início deste documento. Os limites de pareamento válido, captura, fila e teste físico permanecem identificados separadamente.

## Critério para liberar a obra

O resultado técnico é um **candidato de homologação, com D6 parcialmente validado**. O percurso autenticado no Android, sua conferência pelo RH e o aceite operacional continuam necessários antes de declarar prontidão para operação assistida. O APK 10 x86_64 foi instalado como app novo no SO clonado e não foi distribuído. Sua resposta negativa passou, mas o layout com teclado foi reprovado. Não comprova atualização da linhagem 8/9, fila migrada, câmera, GPS ou biometria no aparelho da equipe. Operação ampliada mantém o critério de duas quinzenas consecutivas e um fechamento mensal reais acompanhados.

Antes do uso com a equipe real: conferir jornada, calendário e regra coletiva; cadastrar as pessoas reais; executar o roteiro físico abaixo; indicar o responsável e o meio oficial de registro. O app mantém a situação formal declarada em `rep-p.js`. A [orientação oficial do MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) e as [perguntas e respostas](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP) são referências do roteiro formal, não uma certificação deste candidato.

## Roteiro pendente para Android físico

A disponibilidade do aparelho precisa ser confirmada. O APK 10 x86_64 é restrito ao ensaio em AVD; este roteiro físico depende de artefato e aparelho compatíveis, acesso legítimo e responsável identificado.

1. Instalar o APK de homologação e conferir o nome do ambiente.
2. Abrir a gestão web, gerar o pareamento da obra fictícia e parear o aparelho.
3. Cadastrar a biometria com o PIN autorizado. Conferir câmera, identificação, localização e aviso de hora.
4. Fazer uma marcação de teste sem internet. Fechar o app, reiniciar o aparelho e conferir que a fila permanece.
5. Restabelecer a rede. Conferir recebimento no web e repetir a sincronização, verificando que não há duplicata.
6. Conferir o dia no RH. Um dia incompleto ou com pendência permanece para revisão.
7. Na mesma linhagem de assinatura, verificar atualização mantendo pareamento, histórico e fila. A instalação nova do APK 10, com outro certificado, não realiza essa prova para a linhagem 8/9.

O ensaio financeiro usa somente extratos e pagamentos fictícios. Recibo ou demonstrativo não efetua transferência nem prova que houve pagamento.
