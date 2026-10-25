# Ponto de Obra — matriz de homologação do APK (ambiente isolado)

Versão do documento: 13/10/2026 (com o hardening #74, #75 e #76). **Nenhum cenário abaixo foi executado em
aparelho físico.** Todos estão PENDENTES até alguém executar e registrar a
evidência. Testes automáticos (Node, CI) provam a lógica, não o aparelho:
SQLCipher, câmera, TFLite, relógio Kotlin, permissões e voz/vibração só se
provam no APK instalado.

## APKs que NÃO podem ser usados na homologação

Gerados antes da trava de ambiente. Apontam para a **PRODUÇÃO** do ARCD
(`pontosarcd.vercel.app`): pareados, cada batida vira NSR fiscal real e
permanente. Ficam preservados como histórico, com esta identificação, e
**não se instalam** em aparelho de homologação.

| Build EAS | versionCode | Commit | SHA-256 do APK | Ambiente embutido | Situação |
|---|---|---|---|---|---|
| `e4f41447` | 2 | `199d07b` | (não baixado) | `piloto` → produção | **NÃO INSTALAR** |
| `4f8b84c1` | 3 | `7a5b73c` | `1750d70980524ab6681302c7054c8e9ef92f4e85f9f2337cd63f725916585438` | `piloto` → produção | **NÃO INSTALAR** (auditado: assinatura v2 ok, certificado SHA-256 `3afb511b…5915`, permissões a mais `READ_PHONE_STATE`, `USE_BIOMETRIC`, `USE_FINGERPRINT`) |

## Pré-requisitos (antes do primeiro cenário)

| Item | Como conferir |
|---|---|
| Backend de homologação ISOLADO provisionado (projeto Supabase e deploy próprios, marcador no banco) | `docs/PONTO-OBRA-HOMOLOGACAO.md`; `node scripts/homologacao/cli.mjs conferir --api <URL>` responde `ambiente homologacao` |
| APK do perfil `homologacao`: cadastrar a URL do backend isolado como variável do EAS (`eas env:create --environment preview --name PONTO_API_URL --value https://<homologacao>/api/data --visibility plaintext`) e rodar `eas build --profile homologacao --platform android`, com autorização; o build **falha** sem a URL ou com a produção | link do build no EAS, versionCode e **commit** anotados |
| APK conferido ANTES de instalar | `node scripts/verificar-apk.mjs <apk> --build-tools <pasta> --esperado homologacao` → `APROVADO PARA HOMOLOGACAO` (pacote `br.com.arcd.pontoobra.homologacao`, servidor isolado, permissões só da lista, assinatura ok) |
| No aparelho: nome "Ponto de Obra (HOMOLOGAÇÃO)", etiqueta "HOMOLOGAÇÃO — NÃO OFICIAL" na tela de ponto, Diagnóstico com o servidor isolado | modo Encarregado → Diagnóstico |
| Código de pareamento gerado SÓ no banco de homologação (`cli.mjs codigo`); **nunca** no ARCD de produção | registro de quem gerou |
| Aparelho Android 10+ dedicado, sem dados pessoais de terceiros | modelo e versão do Android anotados |
| Pessoas de teste com consentimento LGPD específico para o cadastro facial de homologação (nada da biometria de produção) | termo assinado (fora do repositório) |
| Encarregado de homologação com PIN (semente do provisionamento) | PIN entregue fora do repositório |
| Backend de homologação com `PONTO_EXIGIR_PIN_NO_SERVIDOR=1` (variável de ambiente do deploy isolado): o cadastro facial só é aceito com o PIN do responsável conferido no servidor. Padrão desligado só para não quebrar apps antigos de produção; na homologação fica **LIGADO** | modo Encarregado → Cadastrar rosto com o PIN atual = salvo; sem o app novo (sem PIN) o servidor responde 403 `PIN_RESPONSAVEL_AUSENTE` |

## Como registrar

Para cada cenário: data, quem executou, aparelho, versão/commit, resultado
(APROVADO / REPROVADO / BLOQUEADO), evidência (foto da tela ou vídeo sem
rosto de terceiros; captura do Diagnóstico) e, se reprovado, o defeito aberto.
Nunca fotografar CPF completo, PIN ou token.

Planilha pronta para o executor: `apps/ponto-obra/docs/homologacao-registro.csv` (uma linha por cenário, 18 + H1–H6, com aparelho, Android, build EAS, versionCode, commit e SHA-256 do APK, resultado, evidência e issue).

## Cenários

| # | Cenário | Passos | Resultado esperado | Cobertura automática (só lógica) | Ensaio em emulador | Resultado |
|---|---|---|---|---|---|---|
| 1 | Instalação limpa | instalar o APK; abrir; **antes de digitar o código**, ler o servidor mostrado; parear só com autorização | abre sem erro; a tela de pareamento mostra o servidor isolado e o aviso HOMOLOGAÇÃO — NÃO OFICIAL; banco cifrado criado; tela de ponto após o pareamento; app de outro ambiente é recusado sem vincular | `regressao.test.js`, `ponta-a-ponta.test.js` | sim | PENDENTE |
| 2 | Atualização sobre a versão anterior | instalar a versão anterior DE HOMOLOGAÇÃO (mesmo pacote .homologacao), bater 3 vezes offline, instalar a nova por cima | app abre; as 3 batidas continuam; sequência local continua (4, 5…); nada reenumerado | `atualizacao-formato1.test.js`, `armazem-sqlite.test.js` | sim | PENDENTE |
| 3 | Banco SQLCipher | após 1 e 2, abrir o Diagnóstico; reiniciar o app | banco abre (chave no SecureStore); "Cadeia local: ok" | prebuild confere `useSQLCipher`; `armazem-sqlite.test.js` (SQL) | sim | PENDENTE |
| 4 | Cadastro facial | encarregado cadastra uma pessoa de teste (3 fotos) | cadastro concluído; foto e vetor só no servidor de homologação | `rosto.test.js`, `escala-reconhecimento.test.js` | não (câmera e rosto reais) | PENDENTE |
| 5 | Reconhecimento facial | a pessoa cadastrada bate; uma não cadastrada tenta | reconhece a cadastrada; recusa a outra com mensagem clara, sem registrar | `diagnostico-calibracao.test.js` | não (câmera e rosto reais) | PENDENTE |
| 6 | Batida offline | modo avião; bater 2 vezes | comprovante na tela ("guardada no aparelho"); voz/vibração; Diagnóstico mostra 2 a enviar | `ponta-a-ponta.test.js`, `apresentacao.test.js` | sim | PENDENTE |
| 7 | Sincronização ao voltar a conexão | tirar do modo avião | envio sozinho em até 1 min; NSR recebido da ARP; "a enviar: 0"; reenviar não duplica | `rep-p-ponta-a-ponta.test.js`, `regressao.test.js` (idempotência) | sim | PENDENTE |
| 8 | Aparelho reiniciado | bater offline; reiniciar o aparelho; abrir | batida continua guardada; hora marcada como não verificada até sincronizar | `ponta-a-ponta.test.js`, `regressao.test.js` | sim | PENDENTE |
| 9 | Horário alterado à mão | adiantar/atrasar o relógio do Android 2 h; bater | batida registrada com "hora não verificada"; o servidor (ARP) decide a hora fiscal pela regra da 019 | `regressao.test.js`, `arp-019-concorrencia.pg.test.js` (servidor) | sim | PENDENTE |
| 10 | Câmera negada | negar a câmera; depois "não perguntar de novo" | tela explica e leva às configurações; encarregado pode registrar pelo modo Encarregado | `apresentacao.test.js`, `regressao.test.js` | sim | PENDENTE |
| 11 | GPS indisponível | desligar a localização; bater | batida registrada sem GPS (a Portaria veda bloquear); Diagnóstico mostra o estado do GPS | `rep-p-ponta-a-ponta.test.js`, `regressao.test.js` | sim | PENDENTE |
| 12 | Armazenamento insuficiente | encher o armazenamento do aparelho; bater | "A batida NÃO foi registrada…"; nada gravado pela metade; ao liberar espaço, a próxima batida segue a sequência | `armazem-sqlite.test.js` (SQLITE_FULL) | sim | PENDENTE |
| 13 | Eventos pendentes | 20 batidas offline; voltar a conexão | todas enviadas em ordem; fotos enviadas depois; nenhuma perdida | `regressao.test.js` | sim | PENDENTE |
| 14 | Conflito fiscal | servidor de homologação devolve NSR/hash diferente do guardado (cenário preparado pelo suporte) | Diagnóstico: "Registro fiscal" em atenção, pedindo suporte; nada sobrescrito no aparelho | `armazem-sqlite.test.js` (escrita única), `apresentacao.test.js` | sim | PENDENTE |
| 15 | Confirmação ao trabalhador | bater online e offline | comprovante legível a 1 m, com hora, CPF mascarado e "registrada"/"guardada"; voz e vibração | `apresentacao.test.js`, `feedback.test.js` | não (legibilidade a 1 m, voz, vibração) | PENDENTE |
| 16 | Câmera recém-ligada | bater logo depois do comprovante e logo ao sair do Encarregado | botão mostra "Preparando câmera" até a câmera ligar; nunca fica em "Aguarde" para sempre; sem câmera em 10 s, aviso e caminho do encarregado | `prazo.test.js`, `codigo-fonte.test.js` | não (tempo da câmera real) | PENDENTE |
| 17 | Terceirizado | registrar o acesso de um terceirizado | comprovante "Acesso registrado", sem NSR e sem CPF; voz "Acesso registrado" | `apresentacao.test.js` | sim | PENDENTE |
| 18 | Recuperação após falha | matar o app durante a batida e durante o envio | ao reabrir, a batida existe uma vez só ou não existe (nunca pela metade); envio retomado sem duplicar | `armazem-sqlite.test.js` (transação), `regressao.test.js` | sim | PENDENTE |

**Emulador** serve só para ensaiar o roteiro e achar defeito cedo. Nenhum
cenário é APROVADO em emulador: a aprovação exige o APK instalado em aparelho
físico (SQLCipher com a chave no Keystore do aparelho, câmera, TFLite,
relógio Kotlin, permissões, voz e vibração).

### Complementares do hardening (não substituem os 18)

| # | Cenário | Passos | Resultado esperado | Cobertura automática | Resultado |
|---|---|---|---|---|---|
| H1 | PIN conferido no servidor | backend com `PONTO_EXIGIR_PIN_NO_SERVIDOR=1`; entrar no Encarregado com o PIN; cadastrar um rosto de teste | cadastro salvo; o PIN não aparece em nenhuma tela, log ou Diagnóstico | `integracao-hardening.test.js`, `handler.test.js`, `pin.test.js` | PENDENTE |
| H2 | Trava do PIN no aparelho persiste | errar o PIN 5 vezes; fechar o app (tirar da lista de recentes) e abrir | a espera continua (30 s, depois 60 s…), não zera ao reabrir | `pin.test.js` (reinício simulado), `integracao-hardening.test.js` | PENDENTE |
| H3 | Pareamento com código errado | 5 códigos errados seguidos na tela de pareamento | 6ª tentativa: "Muitas tentativas… bloqueado por N min"; um código certo também espera; aparelhos já pareados seguem batendo | `limite-pareamento.test.js`, `limite-pareamento.pg.test.js` (Postgres real) | PENDENTE |
| H4 | Aparelho revogado | revogar o aparelho no ARCD de homologação; esperar a sincronização | tela "Aparelho desativado"; batidas não enviadas continuam contadas; o modo Encarregado não abre | `rep-p-ponta-a-ponta.test.js`, `integracao-hardening.test.js` (hashes de PIN e vetores apagados do banco local) | PENDENTE |
| H5 | Tempo do reconhecimento | 10 batidas pelo rosto; abrir o Diagnóstico | seção "Desempenho" com p50/p95/máximo por etapa; anotar os números por modelo de aparelho (insumo do protocolo 4A) | `desempenho.test.js` | PENDENTE |
| H6 | Fila parada visível no ARCD | sincronizar uma vez; anotar último contato; modo avião; bater 3 vezes; esperar 20 min; consultar o ARCD mantendo o aparelho offline | ARCD mostra último contato e idade da informação; quantidade é a última recebida, nunca as 3 batidas ainda offline. Após reconectar, conferir atualização das métricas e confirmação individual dos eventos | `painel.test.js`, `metricas-fila.test.js`, `handler.test.js` | PENDENTE |

O bloqueio do PIN **no servidor** (5 tentativas por aparelho) não se reproduz
pela tela: o app confere o PIN localmente antes de enviar. Ele é provado só
pelos testes automáticos (rajada simultânea em Postgres real na CI).

## Ferramenta e aparelho necessários

| Item | Para quê |
|---|---|
| 1 aparelho Android 10+ dedicado (de preferência 2 modelos: um de entrada, ~3 GB de RAM, e um intermediário) | os 18 cenários e H1–H6; o de entrada é a referência de tempo do reconhecimento |
| Cabo USB + `adb` (Android platform-tools) | instalar o APK (`adb install`), instalar a versão N+1 por cima (`adb install -r`) e, se preciso, `adb logcat` sem dados pessoais |
| build-tools 30.0.3 + Java 8 ou mais novo | `scripts/verificar-apk.mjs` (assinatura, permissões, ambiente embutido) antes de instalar |
| Conta EAS com acesso ao projeto @hygorf/ponto-obra | gerar os dois builds do perfil `homologacao` |
| Pessoas de teste com consentimento LGPD | cenários 4, 5, 15 e H1 |

## Critério de aprovação do piloto

Todos os 18 cenários APROVADOS no mesmo APK (mesmo commit), sem REPROVADO
aberto de severidade P0/P1. Homologação aprovada **não** é conformidade
REP-P nem autorização para uso oficial com funcionários: isso exige decisão
da direção e os requisitos formais da Fase 03.
