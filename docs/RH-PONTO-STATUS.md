# RH e ponto — acompanhamento

Atualizado em **25/10/2026**. [Roadmap](RH-PONTO-ROADMAP.md) · [Simulação completa](SIMULACAO_COMPLETA_FULANO_SICLANO.md) · [Revisão financeira](REVISAO_FINANCEIRA_HOMOLOGACAO.md).

## Decisão atual

O usuário pediu a execução autônoma, a simulação completa e a compilação do APK, com **custo adicional zero**. A frente atual usa a Vercel e o Supabase de homologação. Reaproveita o PR #119 e os módulos existentes. A decisão antiga de aguardar o ambiente ficou registrada no [histórico do PR #119](RH-PONTO-STATUS-PR119.md); não descreve a autorização atual.

**O sistema por diária será mantido.** A escolha é por funcionário: diária, com seu valor, ou CLT mensal, com seu salário. As duas formas coexistem na mesma quinzena. Diária e salário são campos independentes; preencher o salário não converte um cadastro diário. Alterações usam vigência e histórico, preservando fechamentos anteriores. A produção atual e o APK de produção permanecem separados desta homologação. Evidências: [preservação da diária](PRESERVACAO_DIARIA.md).

Branch de trabalho: `codex/fulano-siclano-integracao`. Base reaproveitada: `900a6b1ff12dea5f308f2a7f7288c73f846468f6`, do [PR #119](https://github.com/hygorlp-dot/hygor/pull/119). A árvore de trabalho contém alterações posteriores a essa base. O identificador da base não comprova sozinho as fontes de um APK.

O candidato está no [PR #120](https://github.com/hygorlp-dot/hygor/pull/120). O frontend completo foi publicado a partir de `012604ac698a8fcd14c2c0f65f5b2e9128661ea5`, no deployment `dpl_Ag6g6VF5Pbf6Ee2qzynm3B1tYVdQ`, e passou na conferência real de navegador descrita abaixo. Publicação, testes, documentos, financeiro e APK estão reunidos na [evidência consolidada da entrega](evidencias/homologacao-2026-10-25.json).

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
| Celular integrado | APK 7 compilado, assinado, conferido e disponibilizado como arquivo de entrega. Endpoint e pacote isolados; contratos de pareamento, catálogo e sincronização testados. Instalação e uso em Android estável ainda pendentes. |
| Documentos do RH | Dezesseis PDFs sintéticos, oito por pessoa, enviados ao prontuário privado remoto. Upload, abertura autorizada e download conferidos; os hashes dos arquivos baixados correspondem aos originais. |
| Quinzena e competência | Cortes 06–20 e 21–05 mantidos. Adiantamento pago no dia 20 separado do saldo mensal. CLT por diária exige memória identificada; o app não inventa salário mensal. |
| Financeiro e obra | A aprovação cria a obrigação no financeiro existente. Baixas parciais e finais zeram o saldo sem criar novamente o custo da mão de obra. |
| Registrador formal | A ARP e os NSRs foram preservados. A conformidade formal do REP-P continua sendo uma etapa própria. |
| Piloto contínuo | Roteiro disponível. Duas quinzenas e um fechamento mensal reais continuam necessários para operação ampliada. |
| Expansão | Deve partir dos resultados do piloto. Rotinas adicionais e integrações não são declaradas concluídas apenas porque a simulação passou. |

## Simulação local completa

O ensaio de `src/integration/simulacao-completa.test.js` passou usando os handlers reais da API, PostgreSQL em memória, migrations reais e comandos financeiros reais. A identidade autenticada, o relógio e os sensores foram controlados pelo teste; isso está detalhado no [relatório](SIMULACAO_COMPLETA_FULANO_SICLANO.md).

- **180 marcações e 180 NSRs únicos**, com fila offline e reenvio de resposta perdida sem duplicação.
- Fulano: salário de R$ 3.300,00, adiantamento pago de R$ 1.320,00 e saldo de teste de **R$ 1.695,40**.
- Siclano: diária de R$ 120,00, adiantamento pago de R$ 600,00 e saldo de teste de **R$ 1.891,71**, calculado pela memória fictícia identificada.
- Baixa parcial, saldo restante e reenvio idempotente. Saídas simuladas de **R$ 5.507,11** e contas a pagar da folha zeradas.
- Origem de ponto, auditoria, permissões, competência seguinte e desligamento posterior preservados.
- Um dia em duas obras permaneceu como pendência identificada; não foi duplicado nem aprovado silenciosamente.

O fechamento de outubro foi ensaiado com o relógio local avançado para novembro. O sistema remoto não foi autorizado a fechar um mês ainda em andamento. Os valores tributários são premissas da memória de teste, não validação fiscal.

## Ensaio remoto financeiro aprovado

O relatório `.tools/homologacao-adiantamentos-report.json` terminou com `status: completed` em **25/10/2026, às 20:53:02 UTC**. Foram usados a API real de homologação, os comandos oficiais, persistência remota e um extrato sintético identificado. A data de emissão/pagamento registrada no cenário é 20/10; a execução ocorreu em 25/10, sem alterar o relógio.

| Verificação remota | Resultado |
| --- | --- |
| Adiantamento de Fulano | R$ 1.320,00; baixa de R$ 660,00 e outra de R$ 660,00; saldo zero. |
| Adiantamento de Siclano | R$ 600,00; baixa de R$ 300,00 e outra de R$ 300,00; saldo zero. |
| Extrato e reenvio | Quatro movimentos, duas liquidações por título; repetição verificada sem duplicação. |
| Caixa do cenário | R$ 1.920,00 de saídas registradas; R$ 0,00 a pagar nesses adiantamentos. |
| DRE operacional | R$ 270,00 de custo de mão de obra antes e depois das baixas. O pagamento não duplicou o custo. |
| Cadastros e ponto | Permaneceram iguais à fotografia anterior do ensaio. |
| Fechamento e transferência | Outubro permanece aberto; nenhuma transferência bancária real ou mudança de relógio. |

O relatório `.tools/homologacao-dre-report.json` confirma respostas bem-sucedidas das consultas reais de DRE da obra e da empresa, com `source: canonical_ledger`, nenhuma questão reportada, custo de R$ 270,00 e saídas de R$ 1.920,00. O caixa de teste ficou em −R$ 1.920,00, pois não houve entradas. Esses valores pertencem a dimensões diferentes: custo operacional e movimentação de caixa. As respostas registram `engineEnforced: false`; a prova é das consultas e dos valores retornados, não de uma imposição nova de motor ou de uma contabilidade fiscal completa.

Os adiantamentos pagos ficam disponíveis para a compensação programada, conforme suas datas. O ensaio não aprovou antecipadamente a folha mensal de outubro. O relatório local completo e este ensaio remoto têm escopos distintos; os R$ 5.507,11 da simulação local não foram lançados como pagamento remoto.

## Validação desta árvore

No checkpoint anterior, lint, TypeScript, fronteiras arquiteturais e build Vite passaram. A revisão financeira encontrou dois problemas na tela de folha — classificação do CLT por diária e atualização após baixa de adiantamento — reproduzidos em testes e corrigidos.

A suíte geral desse checkpoint terminou sem falhas: **3.059 testes passaram e 13 foram ignorados; 411 arquivos passaram e dois foram ignorados**, em 881,22 segundos. A execução anterior, interrompida quando o Android e os testes disputaram recursos, não conta como aprovação.

**A rodada final terminou em 25/10/2026 às 21:15:55 UTC: 3.113 testes aprovados, nenhuma falha e 13 ignorados, de 3.126 testes; 423 arquivos aprovados e dois ignorados, em 433,47 segundos.** Os relatórios `.tools/validation-delivery/tests-exit.json` e `tests.json` registram `success: true` e código de saída zero. Os lotes específicos de NTP e das rotas auxiliares tiveram, respectivamente, 58 e 32 testes aprovados, descritos no [relatório do ambiente](HOMOLOGACAO-VERCEL-SUPABASE.md). Lint, fronteiras arquiteturais e TypeScript passaram; os registros estão em `lint.log`, `architecture.log` e `typecheck.log` no diretório de validação. **O build Vite final passou em 3,00 segundos**, com saída zero em `.tools/validation-delivery/build-exit.json`. O frontend final ficou `READY` e foi conferido pelo navegador real.

No primeiro lote local de navegador, 29 dos 30 casos passaram na primeira execução. O único caso de navegação móvel que falhou passou na repetição isolada, sem alteração de código. O fluxo novo de CLT por diária passou tanto no computador quanto na tela de celular; o relatório preserva a ocorrência e as evidências.

Depois disso, a [ficha do operário](FICHA_DO_OPERARIO.md) passou nos dois cenários locais de navegador, desktop e celular, em 27,4 segundos, além das verificações de autorização, auditoria, transferência de obra e arquivo. As respostas de rede do navegador são fictícias; a prova de persistência dos avisos usa API real e Postgres local. A [preservação da diária](PRESERVACAO_DIARIA.md) passou em **59 testes de oito arquivos**, incluindo coexistência com CLT mensal, valores independentes, adiantamentos antigos, histórico fechado e montagem dos relatórios PDF/Excel.

O relatório `.tools/homologacao-seed-report.json` confirma os dois funcionários e **16 documentos com `uploadAndDownloadVerified: true`**, incluindo a conferência SHA256. Isso comprova o envio e a recuperação dos anexos privados. A consulta pela tela também foi conferida no ensaio remoto abaixo.

## Navegador real de homologação — aprovado

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

## APK 7 disponível; teste físico pendente

O arquivo final **`ponto-obra-homologacao-7.apk`** foi compilado localmente e disponibilizado para entrega, com 121.489.302 bytes e SHA256 `2a7b20d2329b731b8ac5c3aef19386fde07208a8ee8d1737fad0bf2c1c856014`. Foram conferidos assinatura, pacote isolado, versão 7, endpoint, modelos faciais e correspondência das fontes. A permissão desnecessária `READ_PHONE_STATE` foi removida. Os builds 5 e 7 mantêm pacote e certificado compatíveis para o ensaio de atualização.

A conferência final voltou a validar os 63 arquivos do manifesto de fontes móveis, sem alteração em relação ao APK 7, com `fontesSha256` igual a `316884caba0bca7dc1676f0ce3322e0e40fcbdd41aad1d17fcc3a072781b1dc7`.

**O emulador não chegou a instalar o aplicativo.** Sem aceleração KVM, as tentativas com Android 35 e AOSP 30 falharam nos serviços do próprio sistema; a instalação terminou com `Can't find service: package`. Não houve abertura do app, pareamento nem marcação por esse ensaio. Compilação e assinatura foram aprovadas; instalação, atualização 5→7, persistência da fila no aparelho, câmera, GPS e biometria permanecem para o Android estável da equipe. Detalhes e manifestos estão no [relatório do build](../apps/ponto-obra/docs/BUILD-LOCAL-HOMOLOGACAO.md).

## Critério para liberar a obra

O resultado técnico é um **candidato de homologação para simulação e operação assistida**, com as evidências descritas separadamente e os critérios pendentes acima. A compilação e a verificação da assinatura não comprovam instalação, câmera, GPS ou biometria no aparelho de Hygor.

Antes do uso com a equipe real: conferir jornada, calendário e regra coletiva; cadastrar as pessoas reais; executar o roteiro físico abaixo; indicar o responsável e o meio oficial de registro. O app mantém a situação formal declarada em `rep-p.js`. A [orientação oficial do MTE](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep) e as [perguntas e respostas](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP) são referências do roteiro formal, não uma certificação deste candidato.

## Roteiro no Android de Hygor

1. Instalar o APK de homologação e conferir o nome do ambiente.
2. Abrir a gestão web, gerar o pareamento da obra fictícia e parear o aparelho.
3. Cadastrar a biometria com o PIN autorizado. Conferir câmera, identificação, localização e aviso de hora.
4. Fazer uma marcação de teste sem internet. Fechar o app, reiniciar o aparelho e conferir que a fila permanece.
5. Restabelecer a rede. Conferir recebimento no web e repetir a sincronização, verificando que não há duplicata.
6. Conferir o dia no RH. Um dia incompleto ou com pendência permanece para revisão.
7. Atualizar o APK mantendo os dados. Conferir pareamento, histórico e fila novamente.

O ensaio financeiro usa somente extratos e pagamentos fictícios. Recibo ou demonstrativo não efetua transferência nem prova que houve pagamento.
