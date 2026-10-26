# Aceite operacional de RH, ponto e pagamentos

Este documento reúne o aceite de RH, ponto e pagamentos e os limites de cada
prova. O histórico de 25/10/2026 permanece identificado nas seções seguintes.
O resultado de cada execução, publicação e continuidade do D6 fica em
`RH-PONTO-STATUS.md`; capacidade implementada, ensaio local e operação real
são evidências distintas.

O candidato da PR #120 teve frontend publicado em homologação e consulta real
aprovada em computador e tela de celular, conforme a [evidência histórica da
entrega](evidencias/homologacao-2026-10-25.json). A rodada D6 corrige mensagens
do servidor e layout do pareamento. **D6 permanece parcialmente validado;
D7 continua condicionado.** Os gates locais terminaram com **3.155 testes
aprovados, 13 ignorados e nenhuma falha**, em 427 arquivos aprovados e dois
ignorados. Lint, arquitetura, TypeScript, build web e diff-check passaram;
as 1.420 fontes conferidas permaneceram estáveis durante a validação.

O commit `64c8b7b52b256e0d83847bbdf84cbe6dc9f13936` foi publicado na
[PR #121](https://github.com/hygorlp-dot/hygor/pull/121). O Edge de homologação
está na versão 9, ACTIVE, com os 12 arquivos remotos iguais byte a byte ao
payload revisado e autenticação preservada. O frontend está READY no deploy
`dpl_CF9poo7VUKPVManpcHJDK1nhxBtF`, no mesmo commit, acessível em
https://ponto-homologacao.vercel.app. Não houve promoção para produção.
O build do APK 10 foi concluído na segunda tentativa, para ensaio x86_64 e
instalação nova com outro certificado; o artefato não foi distribuído.
A instalação nova do app foi comprovada sobre uma cópia descartável do SO do
clone 9, após remover o APK 9 somente dessa cópia. A recusa real MARCELL foi
observada; **o layout com teclado foi reprovado**. O APK 11, fonte 832c440, teve gates/build e atualização interna confirmados. A recusa MARCELL foi observada e a largura das oito casas passou; o alcance integral de mensagem/botão com teclado ficou inconclusivo.

O CI remoto de `64c8b7b` não foi repetido (`[skip ci]`) em respeito à restrição
de custo, sem cota de artefatos confirmada. A aprovação registrada é a dos
gates locais de `64c8b7b`. O APK 11 tem resultados próprios em `832c440`: 401
testes aprovados, cinco ignorados, nenhuma falha; 42 arquivos aprovados e um
ignorado, com 1.421 fontes estáveis. Lint, arquitetura, TypeScript, regressão
mobile/ponto, build Vite e diff-check passaram. A suíte geral de 3.155 testes
não foi repetida para essa fonte. Não há novo resultado de scorecard mobile.

A [evidência D6 de 26/10/2026](evidencias/d6-fechamento-2026-10-26.json) reúne os
resultados atuais. APK 10, Edge e frontend publicado usam `64c8b7b`; o APK 11
usa `832c440`. Um commit documental posterior não é fonte de nenhum desses
APKs nem representa recompilação. A consulta pública da
API retornou HTTP 200 e houve smoke do login em desktop 1363 × 936, sem sessão
autenticada ou envio de formulário. O viewport mobile web não foi executado
nesta rodada. As consultas autenticadas em duas telas descritas abaixo são
as do ensaio histórico de 25/10.

## Fluxo de trabalho

1. **Cadastrar a pessoa.** Escolher para cada funcionário diária, com seu valor, ou CLT mensal, com seu salário. Informar jornada, obra e vigência. Diária e salário são campos independentes; informar um salário não muda automaticamente um cadastro diário. O vínculo contratual permanece separado da forma de remuneração.
2. **Completar a ficha.** Conferir dados pessoais, documentos, ASO, treinamentos e EPIs. Os arquivos ficam no prontuário privado.
3. **Receber e conferir o ponto.** O APK registra as marcações, mantém a fila local e envia ao servidor. O RH/engenharia resolve as pendências antes de importar para o ponto usado no cálculo.
4. **Preparar a quinzena.** Manter os cortes 06–20 e 21–05. Conferir diárias, novos adiantamentos efetivamente pagos e a preparação CLT pertinente. Adiantamentos antigos mantêm suas parcelas e datas, sem exigir baixa retroativa.
5. **Aprovar a obrigação.** A aprovação gera o título financeiro. Para CLT por diária, a apuração mensal exige valores e memória identificada; não existe salário mensal inventado por diária × 26.
6. **Registrar o pagamento.** A baixa financeira informa valor, data, origem e movimento bancário. É possível pagar em partes e acompanhar o saldo. Reenviar a mesma operação não cria outra baixa.
7. **Conferir o mês.** Revisar o fechamento, os comprovantes, o saldo a pagar e as reservas gerenciais. Pagamentos não repetem no custo da DRE o valor já apropriado pelo ponto.

O pagamento quinzenal organiza o caixa. Ele não elimina o fechamento mensal da folha CLT. O app registra o pagamento realizado; não faz uma transferência bancária por conta própria.

## Diária preservada e escolha por funcionário

**O sistema por diária continua em uso e será mantido íntegro.** Um funcionário pode receber por diária enquanto outro recebe CLT mensal, inclusive na mesma quinzena. Cadastros antigos sem vínculo informado não são convertidos em CLT. As mudanças de modalidade e de valores têm vigência e histórico; os pagamentos e fechamentos anteriores são preservados.

No cadastro mensal, o campo **Diária de referência para custeio** é usado no custo do ponto; o salário mensal define o holerite. Não há conversão automática da diária em salário. A combinação de vínculo CLT com remuneração diária continua disponível quando explicitamente definida, com sua memória de apuração própria; ela não é inferida para quem já recebe pela diária comum.

A regressão de [preservação da diária](PRESERVACAO_DIARIA.md) conferiu um líquido diário de R$ 900,00 e uma parcela CLT mensal de R$ 700,00 aprovados na mesma quinzena, sem mudar o histórico pago. Também conferiu os valores independentes no editor e a montagem das exportações PDF/Excel. O lote focal teve 59 testes aprovados em oito arquivos.

## Ficha individual do operário

Entrada pela **Equipe**, na ação da ficha do funcionário. A ficha reúne os dados canônicos existentes, sem criar outro cadastro, outro ponto ou outro razão financeiro.

| Seção | O que o operador encontra |
| --- | --- |
| Resumo e pendências | Itens do cadastro para conferir, documentos ausentes/vencidos, reserva ainda não apurada, adiantamentos a pagar e avisos de engenharia em aberto. |
| Dados | Cadastro pessoal e profissional, vínculo, remuneração, jornada, obra e contato de emergência. A edição reutiliza o cadastro existente. |
| Documentos e fotos | Foto do funcionário, identificação, endereço, contrato, CTPS/registro, dependentes, ASO, treinamentos, EPIs, atestados, férias, holerites e desligamento. |
| Ponto | Consulta por mês, situação do dia, horários, obra, origem e conferência das batidas recebidas. Períodos arquivados podem ser consultados sem restaurar a quinzena; antes de carregar, a tela informa que o dado está em arquivo. |
| Pagamentos | Títulos, valor aprovado, baixas, saldo e histórico financeiro; acesso à folha e às provisões. |
| Histórico | Alterações disponíveis do cadastro, vigências contratuais e salariais, documentos e referências aos avisos. |
| Engenharia | Orientações e ocorrências com obra, autor, data, situação e providências registradas. |

Os documentos aceitam PDF, JPEG e PNG, até 3 MB por arquivo, conforme a política do prontuário. A leitura usa acesso autenticado e URL temporária. Arquivar um documento preserva o histórico e o motivo.

Atestados e documentos pessoais ficam restritos ao RH e administrador. Engenharia recebe dados profissionais e registros operacionais dentro do escopo autorizado. Os avisos são internos ao app web; esta entrega não inclui disparo por WhatsApp, e-mail ou notificação push.

Um arquivo disponível ainda precisa ser conferido pelo RH. O checklist orienta a operação; ele não declara que todos os documentos possíveis de qualquer contrato foram validados. Anexar um PDF de ASO também não altera automaticamente a validade informada no cadastro.

Os 16 documentos sintéticos foram enviados ao prontuário remoto, oito por funcionário. O relatório `.tools/homologacao-seed-report.json` confirma upload e download verificados para os 16 arquivos, com conferência SHA256 após abertura autorizada. Isso comprova a presença e a recuperação dos anexos da simulação; não certifica o conteúdo de documentos reais de admissão. Além dos testes locais descritos em `FICHA_DO_OPERARIO.md`, a ficha passou na consulta real pelo navegador, com login, listagem privada, download do PDF e pagamentos visíveis em computador e tela de celular.

## Respostas às perguntas de aceite

| Pergunta | Resposta verificável e limite |
| --- | --- |
| O RH consegue organizar os pagamentos de CLT e de quem recebe por diária? | Sim, com escolha por funcionário e coexistência na mesma quinzena, preservando o caminho diário existente. O fluxo cobre cadastro, ponto, preparação, aprovação, título, pagamento parcial, saldo e histórico. CLT por diária explícito exige apuração identificada. A liberação para operação real depende dos dados e regras reais da empresa e dos critérios finais ainda pendentes. |
| É possível deixar o valor provisionado? | Há cálculo e registro de reserva gerencial, com pendência quando falta apuração. Para CLT por diária, base, incidências, responsável e memória precisam ser informados. Isso não separa dinheiro em conta bancária nem cria automaticamente uma provisão contábil. |
| Os pagamentos quinzenais ficam registrados? | Novos adiantamentos geram obrigação; a baixa efetiva altera o caixa e libera a compensação conforme as datas. O ensaio remoto de 25/10/2026 aprovou R$ 1.920,00 de adiantamentos fictícios, com baixas parciais, saldo final zero e reenvio sem duplicação. Os registros antigos mantêm o tratamento legado. |
| Web e APK usam o mesmo fluxo? | O web autenticado em duas telas pertence ao ensaio histórico de 25/10. Nesta rodada houve smoke público desktop e consulta de ambiente HTTP 200. O APK 10 foi instalado como app novo no SO clonado, sem reaproveitar a sessão do APK 9, e recebeu a recusa real MARCELL para um código sintético. Permaneceu não pareado. O layout com teclado foi reprovado. Esse resultado não prova percurso autenticado, captura/fila, ponte RH, upgrade ou Android virgem. APK 11, fonte 832c440, com atualização e recusa confirmadas, oito casas aprovadas e gate visual integral inconclusivo. |
| A DRE registra automaticamente? | O ponto alimenta o custeio operacional da obra. No ensaio de 25/10/2026, a API real de homologação confirmou R$ 270,00 de custo antes e depois de R$ 1.920,00 de saídas de caixa simuladas, sem duplicar o custo. Isso não representa automaticamente todos os encargos patronais, provisões contábeis e ajustes da folha oficial. |
| Toda a documentação pessoal pode ser registrada? | O prontuário oferece as categorias operacionais listadas acima, anexos privados e histórico. A completude real depende de o RH enviar e conferir os documentos aplicáveis a cada pessoa, função e contrato. |
| As pendências aparecem? | A ficha e o prontuário mostram cadastro incompleto, documentos a conferir, vencimento, emissão futura, ASO sem validade, avisos abertos e obrigações pendentes. Falha de consulta é apresentada como falha, sem transformar erro em prontuário vazio. |
| A construtora está organizada? | O fluxo de RH/ponto/financeiro foi organizado e tem ensaios reproduzíveis. Isso não comprova, por si, cadastro real completo, quitação bancária, cumprimento de obrigações ou organização de todos os outros setores. |
| Todo o código é útil? | Não há evidência para declarar 100%. A análise estática encontrou candidatos de limpeza e falsos positivos; a avaliação e os limites estão abaixo. |

## DRE, caixa e provisões: prova histórica de 25/10/2026

Não houve nova consulta financeira para reconfirmar estes saldos ou o estado da competência na rodada D6 de 26/10. Nenhum fechamento remoto foi executado nesta rodada.

O ensaio remoto concluído em 25/10/2026 persistiu adiantamentos fictícios de R$ 1.320,00 para Fulano e R$ 600,00 para Siclano. Cada título teve uma baixa parcial e outra pelo restante. Os reenvios não duplicaram os quatro movimentos, e o saldo desses títulos ficou zerado. A emissão/pagamento foi registrada em 20/10; outubro permaneceu aberto e o relógio não foi alterado.

| Medida no ambiente de teste | Valor e significado |
| --- | --- |
| Custo operacional da DRE | **R$ 270,00**, originados do ponto; não aumentou quando os adiantamentos foram baixados. |
| Saídas de caixa | **R$ 1.920,00**, registradas por quatro baixas sobre o extrato sintético. |
| Saldo de caixa | **−R$ 1.920,00**, pois o cenário não tem entradas. |
| Saldo a pagar desses adiantamentos | **R$ 0,00**, após as quatro baixas. Isso não declara a folha mensal paga ou encerrada. |
| Reserva gerencial | Estimativa/apuração identificada para planejamento. Não é dinheiro separado em banco nem lançamento contábil automático. |

As consultas reais de DRE da obra e da empresa retornaram esses valores, pela fonte `canonical_ledger`, sem questões reportadas. A evidência está em `.tools/homologacao-adiantamentos-report.json` e `.tools/homologacao-dre-report.json`; o segundo relatório informa `engineEnforced: false`. O aceite cobre os valores e a separação entre custo e caixa nessas consultas, sem declarar um motor fiscal obrigatório ou provisões contábeis completas. Nenhuma transferência bancária real foi feita.

## Histórico — consulta real pela gestão publicada em 25/10/2026

O ensaio remoto de leitura passou em **74,359 segundos**, entre **21:38:38 e 21:39:52 UTC de 25/10/2026**, no frontend do commit `012604ac698a8fcd14c2c0f65f5b2e9128661ea5`. Foram conferidos computador, 1440 × 1000, e tela de celular, 390 × 844, com login real e respostas reais da API.

Nas duas telas, Fulano e Siclano tiveram as sete abas conferidas. O cadastro mostrou salário mensal de R$ 3.300,00 e referência de custeio de R$ 150,00 para Fulano; diária de R$ 120,00 para Siclano, sem conversão em salário mensal. A massa fictícia mantém vínculo CLT explícito nos dois; a preservação do funcionário diário antigo continua coberta pela regressão própria. O editor foi somente consultado, sem salvar alterações.

O prontuário listou oito documentos por pessoa. Quatro downloads privados foram acionados pela tela, um PDF de cada pessoa em cada contexto, e tiveram seu SHA256 conferido; os arquivos temporários foram apagados. Os pagamentos mostraram R$ 1.320,00 e R$ 600,00 pagos, duas baixas por título e saldo zero. Os hashes de cadastro, ponto e financeiro ficaram iguais antes e depois, sem tentativa de mutação.

O relatório `.tools/homologacao-web-report.json` terminou aprovado, sem erros JavaScript, de console ou HTTP, e sem falhas inesperadas de requisição. Os quatro cancelamentos de navegação associados ao início dos downloads são esperados e estão identificados no relatório. As duas tentativas anteriores pararam antes do login por configuração de rede/CA do runner; a correção ficou restrita ao proxy e à confiança do processo temporário de testes, mantendo TLS ativo e sem alteração do app. Não foram gerados screenshots pessoais, vídeos ou traces. Essa prova é do web e não do APK instalado em Android.

## Uso do código e limpeza

Foi executada a ferramenta Knip com a configuração já existente no repositório. O levantamento inicial encontrou quatro arquivos e 108 exportações sem consumo detectado, além das dependências `motion` e `tailwindcss`.

- Os quatro arquivos são entradas reais do fluxo de homologação, acionadas por CLI e pelo empacotador. A configuração atual só declara `scripts/*.mjs` como entrada, por isso perde os scripts da subpasta.
- `tailwindcss` é usado nos imports de `src/index.css` e na configuração de CSS. Sua indicação é um falso positivo.
- `motion` não teve import encontrado no código web analisado; é candidato a remoção em uma limpeza isolada, com build e revisão do lockfile.
- As 108 indicações são exportações, não 108 funções comprovadamente mortas. Há usos internos, testes de integração fora do escopo, constantes públicas e arquivos compartilhados com o mobile.
- A análise atual não cobre integralmente o aplicativo Android. Não houve remoção em massa de código nem atualização de dependências nesta entrega.

O gerador de publicação passou a usar o manifesto do build atual. No checkpoint medido, isso retirou **54 arquivos compilados antigos** do pacote enviado, reduzindo-o de 169 para 115 arquivos e de 13.975.768 para 9.898.323 bytes. É limpeza do artefato de publicação; não significa exclusão de 54 arquivos-fonte úteis.

## Situação do aceite D6

| Critério | Evidência disponível neste checkpoint | Limite / próximo resultado necessário |
| --- | --- | --- |
| Mensagens MARCELL no servidor | Sete textos corrigidos, 33 testes focais aprovados e Edge v9 conferido. No APK 10, um envio sintético recebeu “Código inválido ou já usado. Gere outro no MARCELL.”. | A resposta negativa não comprova pareamento válido ou operação autenticada. |
| Layout de pareamento | UI do APK 10 reprovada: teclado cobre o botão; swipe não revela a ação; linha de oito células cortada nas extremidades. Erro sem teclado legível, com botão fora da área inicial; alcance por rolagem complementar não estabelecido. | APK 11 em 832c440: oito casas aprovadas e conteúdo deslocado com IME; alcance integral de mensagem/botão não demonstrado. Aceite visual inconclusivo, sem concluir corte persistente ou causa. |
| Controles gerais do código | Suíte geral em 64c8b7b: 3.155 aprovados/13 ignorados, 427 arquivos aprovados e dois ignorados, 1.420 fontes estáveis. Regressão mobile/ponto em 832c440: 401 aprovados/cinco ignorados, 42 arquivos aprovados e um ignorado, 1.421 fontes estáveis. Nenhuma falha; lint, arquitetura, TypeScript, build Vite e diff-check passaram em cada rodada. | A suíte geral não foi repetida para 832c440. Gates técnicos não atestam execução autenticada ou operação real; nenhuma nova nota de scorecard. |
| Publicação de homologação | PR #121, commit 64c8b7b; Edge v9 ACTIVE; Vercel dpl_CF9poo7VUKPVManpcHJDK1nhxBtF READY. Sonda pública HTTP 200/TLS padrão e recusa MARCELL observada no APK 10. | Sem promoção para produção. HTTP da chamada negativa do app não foi observado. Edge/frontend continuam em 64c8b7b; a nova fonte 832c440 tem gates/build e atualização/recusa do APK 11 próprios, com aceite visual inconclusivo. |
| Histórico de execução do APK 9 | Atualização 8→9, instalação preservada, abertura e recusa pública de código inexistente. | Não houve pareamento válido nem captura de ponto; fila pendente não foi comprovada por esse ensaio. |
| APK 10 | Build 2 aprovado e conferido; 61.200.534 bytes, x86_64, fonte 64c8b7b. Instalado às 15:25:27 UTC como app novo sobre cópia do SO do clone 9; ausência prévia do pacote comprovada, instalação sem -r, nova assinatura. Não distribuído. | Não é upgrade 9→10 nem Android virgem. Resposta negativa comprovada, UI com teclado reprovada; sem prova de fila, captura ou uso autenticado. |
| APK 11 | Fonte 832c440; gates/build verificados. Cliente de instalação teve timeout de 180 s, sem repetição; versão 11 e SHA instalado reconciliados às 16:30:15 UTC. firstInstallTime/dataDir preservados. Uma recusa MARCELL confirmada; largura das oito casas aprovada. | Instalação não pareada e sem fila. Alcance integral de mensagem/botão com IME não demonstrado; causa indeterminada. Segunda rodada parou na reconferência de integridade, sem nova UI ou outro envio. Não comprova migração 8/9, persistência de fila/sessão pareada ou uso físico. |
| Linhagem de assinatura Android | Chave original da instalação antiga não recuperada nesta sessão, após busca legítima. | Preservar APKs 8/9 e seus dados. A nova chave não permite atestar upgrade ou migração de pareamento/fila dessa linhagem. |
| Acesso operacional autenticado | access.json antigo não recuperado após busca legítima; o percurso autenticado está pendente por falta de acesso legítimo de operador para gerar o pareamento e realizar a conferência RH. | PIN autorizado nos fluxos pertinentes, como cadastro biométrico, sem exigência a cada marcação; contrato exigirVerificacao: false preservado. Nesta rodada não houve redefinição de credenciais, remoção de validação de autenticação ou edição direta dos dados de pareamento. |
| Vinte capturas nativas | Roteiro preparado para persistência e reenvio, separado da jornada de folha. | Executar após pareamento autorizado, preservando relógio e IDs reais. |
| Ponte nativa para conferência RH | Fluxo existente de apropriação e attendance-import-mobile identificado. | Executar com duas ou quatro batidas por pessoa/dia, sem ponto conflitante e com origem confiável. |
| Fechamento mensal | Ciclo local controlado existente; adiantamentos sintéticos documentados no ensaio histórico. Nenhum fechamento remoto executado nesta rodada. | Saldos e estado da competência não foram reconfirmados por nova consulta financeira neste relatório. Reconferir os registros antes de continuar, sem antecipar fechamento nem duplicar adiantamentos/baixas. |
| Uso da equipe e expansão | Roteiro operacional e responsáveis previstos no roadmap. A disponibilidade de Android físico não foi confirmada nesta sessão. | Confirmar o aparelho, executar testes físicos e acompanhar duas quinzenas e um fechamento mensal reais. |

A chave original não foi recuperada nesta sessão. O APK 10 foi instalado como app novo,
com outro certificado, em uma cópia descartável do SO do clone 9 offline.
O APK 9 foi removido somente dessa cópia, sem preservar seus dados de app;
a ausência do pacote foi conferida antes da instalação sem `-r`. O ensaio
não comprova upgrade, migração de fila/sessão ou Android virgem. O histórico
8→9 mantém seu escopo próprio.

A tentativa anterior em AVD virgem terminou sem sistema utilizável; sua
limpeza às 15:06:55 UTC registrou zero erros e 28 hashes originais iguais.
A limpeza do clone usado no APK 10 terminou às 15:42:23 UTC, sem erros,
com proxy restaurado exatamente, reverse/CA removidos, AVD/relay parados
e 28 hashes protegidos iguais. Cópia e assinatura do ensaio foram preservadas
offline. O ANR inicial observado era do System UI; “Aguardar” foi acionado
uma vez. Essa ocorrência não é avaliação de desempenho do app.

Um código sintético `00000000` foi enviado uma vez às 15:33:25 UTC e recebeu
a recusa MARCELL, sem pareamento. As consultas SQL de 15:30:15 e 15:35:06 UTC
confirmaram um dispositivo, um pareamento usado e código ausente antes/depois.
Não houve captura de ponto. O botão `[30,600][450,699]` ficou sob o teclado
iniciado em y=473; o swipe não o revelou. O APK 11 foi compilado e conferido
a partir de `832c440`, com gates locais próprios aprovados. A atualização
10→11 foi reconciliada após timeout do cliente, por versão e SHA instalado,
preservando firstInstallTime/dataDir. Isso não prova fila ou sessão pareada.
A reprovação do APK 10 permanece histórica.

No APK 11, uma tentativa inválida iniciada às 16:45:08.773 UTC exibiu a recusa
MARCELL às 16:45:34.882 UTC. SQL antes/depois manteve um dispositivo, um
pareamento usado e código ausente; essa comparação cobre somente as contagens
indicadas. A sonda Java HTTP 200 é separada da chamada do app, cujo status HTTP
não foi observado.

As oito casas do código estão aprovadas em largura. A rolagem com IME moveu
o conteúdo, mas o alcance integral de mensagem/botão não foi demonstrado.
No estado 03, ficaram fora do viewport inicial e não houve gesto adicional.
A causa não foi determinada; não há conclusão de corte persistente ou de
aprovação visual completa. A limpeza de 16:47:58 UTC terminou sem erros,
com AVD/relay parados e 28 hashes protegidos iguais.

Uma segunda rodada na mesma cópia do APK 11, sem build ou reinstalação,
iniciou às 16:58:17.142 UTC e concluiu o boot às 17:01:32.263 UTC. O
PackageManager confirmou a versão 11, mas a reconferência do binário teve
timeout de 40 segundos no `sha256sum` Android e de 60 segundos na leitura
integral via ADB, registrados às 17:03:01.125 e 17:06:11.918 UTC,
respectivamente. A causa da lentidão não foi determinada. Sem novo marcador
de integridade, o ensaio parou antes de configurar rede ou interagir com a UI.
Não houve nova captura nem segunda tentativa sintética; o total do APK 11
permanece em um envio. A primeira rodada conserva suas provas, inclusive o
SHA instalado, e o gate visual permanece inconclusivo. A limpeza final da
segunda rodada terminou às 17:08:27.645 UTC, com código zero, nenhum erro,
cópia/monitor parados e 28 hashes protegidos iguais. O relay nunca foi
iniciado; nenhuma configuração de proxy, CA ou reverse precisou ser restaurada
nessa rodada, e a limpeza anterior permaneceu preservada.

O acesso legítimo de operador é necessário para gerar o pareamento e realizar
a conferência RH. O PIN autorizado é exigido nos fluxos pertinentes, como o
cadastro biométrico, e não em cada marcação. O contrato
`exigirVerificacao: false` foi preservado. O percurso autenticado permanece
pendente por falta de acesso legítimo. Nesta rodada, nenhuma credencial foi
redefinida, nenhuma validação de autenticação foi removida e nenhum dado de
pareamento foi editado diretamente. Os testes públicos de UI/erro e as
validações técnicas não comprovam esse percurso autenticado.

O roteiro do lote de 20 batidas busca verificar captura, persistência e reenvio. Ele não constitui
jornada automaticamente importável. A ponte para RH exige duas ou quatro
batidas completas por pessoa/dia e lê todas as capturas daquele dia. Usar
participantes separados quando necessário, sempre sintéticos e cadastrados
pelos comandos oficiais. Não falsificar relógio nem excluir eventos para
aparentar uma jornada válida. Nenhum desses novos cadastros ou ensaios foi
declarado realizado neste checkpoint.

A classificação de presença, extras e atraso continua sendo conferência
explícita. Capturas feitas em um ensaio curto não comprovam jornada integral.
Origem não confiável, batida sem par, dia em várias obras ou período protegido
devem permanecer como pendência identificada. A prova nativa e o ciclo mensal
local controlado têm escopos de evidência distintos.

No ensaio histórico, outubro estava aberto e os adiantamentos sintéticos de
R$ 1.320,00 e R$ 600,00 estavam registrados. Esses valores e o estado da
competência não foram reconfirmados por nova consulta financeira nesta rodada.
Nenhum fechamento remoto foi executado. Uma continuidade autorizada deverá
reconferir e reaproveitar os registros pelos mesmos IDs, sem criar novo
pagamento para repetir a evidência. A apuração mensal completa pode ser
reproduzida localmente com relógio controlado e fontes identificadas; não será
apresentada como fechamento remoto ou como histórico de operação real.

## Evidências e próximos critérios

As provas têm escopos diferentes e devem continuar identificadas:

- [D6 — fechamento técnico e limites](evidencias/d6-fechamento-2026-10-26.json): gates locais, PR121, implantações, verificações públicas e build do APK 10; instalação nova do app e recusa real MARCELL comprovadas, UI com teclado reprovada e APK 11, fonte 832c440, com atualização e recusa confirmadas, oito casas aprovadas e gate visual integral inconclusivo.

- `SIMULACAO_COMPLETA_FULANO_SICLANO.md`: ciclo local completo com API real e Postgres local, marcações, folha, pagamentos, DRE e auditoria; relógio e captura física controlados no teste.
- `FICHA_DO_OPERARIO.md`: sete seções, privacidade, avisos auditados, consulta ao ponto arquivado e provas locais de API e navegador.
- `PRESERVACAO_DIARIA.md`: convivência diária/CLT mensal, valores independentes, vigências, adiantamentos antigos, histórico e relatórios.
- `REVISAO_PROVISOES_PRONTUARIO.md`: falhas reproduzidas, correções e limites das reservas/documentos/indicadores.
- `ENSAIO_REMOTO_ADIANTAMENTOS.md`: roteiro e resultado do ensaio financeiro isolado, sem transferência real.
- `HOMOLOGACAO-VERCEL-SUPABASE.md`: ambiente, isolamento, implantação e verificações de acesso.
- `apps/ponto-obra/docs/BUILD-LOCAL-HOMOLOGACAO.md`: compilação, assinatura, identidade das fontes e verificação do APK.
- `RH-PONTO-STATUS.md`: situação final da execução, testes e pendências reais de aceite.

Na rodada final, encerrada às 21:15:55 UTC de 25/10/2026, foram **3.113 testes aprovados, nenhuma falha e 13 ignorados, de 3.126 testes; 423 arquivos aprovados e dois ignorados, em 433,47 segundos**, com `success: true` e saída zero em `.tools/validation-delivery/tests-exit.json` e `tests.json`. Os lotes de NTP e das rotas auxiliares tiveram 58 e 32 testes aprovados, respectivamente; seus resultados estão descritos em `HOMOLOGACAO-VERCEL-SUPABASE.md`. Os registros `lint.log`, `architecture.log` e `typecheck.log` confirmam os demais gates. **O build Vite final passou em 3,00 segundos**, com saída zero em `build-exit.json`. Os 16 documentos remotos e a consulta real da gestão também têm os relatórios de aprovação descritos acima.

As verificações do APK 7, a publicação anterior do frontend e o ensaio autenticado de navegador acima pertencem ao checkpoint histórico de 25/10. O ensaio posterior do APK 9 comprovou atualização 8→9 e abertura, com limites próprios. Para o candidato D6 atual, os gates locais e as implantações de homologação estão identificados no commit 64c8b7b. O APK 10 foi instalado como app novo x86_64 sobre cópia do SO do clone 9, com assinatura diferente, e não foi distribuído. A recusa MARCELL foi observada, mas a UI com teclado foi reprovada. Não há prova de upgrade da linhagem anterior, Android virgem ou conclusão de pareamento válido/captura. O APK 11, fonte 832c440, teve gates/build e atualização interna confirmados. A recusa MARCELL foi observada e a largura das oito casas passou; o alcance integral de mensagem/botão com teclado ficou inconclusivo. O CI remoto de `64c8b7b` não foi repetido.

**PR #121 permanece aberta, sem merge enquanto o gate visual não estiver demonstrado; PR #120 permanece draft.** A nota automática 9,7 pertence a baseline histórico, sem nova nota deste ensaio.

**D6 não está integralmente fechado neste checkpoint.** O percurso autenticado completo, a conferência RH e o ensaio em Android físico com dados reais conferidos pelo responsável continuam necessários. A disponibilidade do aparelho precisa ser confirmada. D7 permanece condicionado. A simulação permanece no ambiente isolado. Operação ampliada depende de duas quinzenas consecutivas e um fechamento mensal reais acompanhados; testes automatizados e emulador não atestam esse histórico. A situação formal do registrador permanece a declarada no código e no checklist do projeto.
