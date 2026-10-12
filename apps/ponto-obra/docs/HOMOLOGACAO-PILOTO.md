# Ponto de Obra — matriz de homologação do APK piloto

Versão do documento: 12/10/2026. **Nenhum cenário abaixo foi executado em
aparelho físico.** Todos estão PENDENTES até alguém executar e registrar a
evidência. Testes automáticos (Node, CI) provam a lógica, não o aparelho:
SQLCipher, câmera, TFLite, relógio Kotlin, permissões e voz/vibração só se
provam no APK instalado.

## Pré-requisitos (antes do primeiro cenário)

| Item | Como conferir |
|---|---|
| APK do perfil `piloto` (`eas build --profile piloto --platform android`) gerado com autorização | link do build no EAS, versão e **commit** anotados |
| Diagnóstico do app mostra a mesma versão, build e commit | modo Encarregado → Diagnóstico |
| Aparelho Android 10+ dedicado ao piloto, sem dados pessoais de terceiros | modelo e versão do Android anotados |
| Servidor definido pela direção. **Hoje só existe a produção do ARCD**: o perfil `piloto` aponta para ela e cada batida de um aparelho pareado vira NSR fiscal real e permanente. Alternativa: backend de homologação + `PONTO_API_URL` no perfil | Diagnóstico → "Servidor do ARCD" (em atenção quando piloto aponta para produção) |
| Pessoas de teste com consentimento LGPD para cadastro facial | termo assinado (fora do repositório) |
| Encarregado de teste com PIN | criado no ARCD de homologação |

## Como registrar

Para cada cenário: data, quem executou, aparelho, versão/commit, resultado
(APROVADO / REPROVADO / BLOQUEADO), evidência (foto da tela ou vídeo sem
rosto de terceiros; captura do Diagnóstico) e, se reprovado, o defeito aberto.
Nunca fotografar CPF completo, PIN ou token.

## Cenários

| # | Cenário | Passos | Resultado esperado | Cobertura automática (só lógica) | Resultado |
|---|---|---|---|---|---|
| 1 | Instalação limpa | instalar o APK; abrir; **antes de digitar o código**, ler o servidor mostrado; parear só com autorização | abre sem erro; a tela de pareamento mostra o servidor (build de piloto ligado à produção mostra aviso em destaque); banco cifrado criado; tela de ponto após o pareamento | `regressao.test.js`, `ponta-a-ponta.test.js` | PENDENTE |
| 2 | Atualização sobre a versão anterior | instalar a versão anterior, bater 3 vezes offline, instalar o piloto por cima | app abre; as 3 batidas continuam; sequência local continua (4, 5…); nada reenumerado | `atualizacao-formato1.test.js`, `armazem-sqlite.test.js` | PENDENTE |
| 3 | Banco SQLCipher | após 1 e 2, abrir o Diagnóstico; reiniciar o app | banco abre (chave no SecureStore); "Cadeia local: ok" | prebuild confere `useSQLCipher`; `armazem-sqlite.test.js` (SQL) | PENDENTE |
| 4 | Cadastro facial | encarregado cadastra uma pessoa de teste (3 fotos) | cadastro concluído; foto e vetor só no servidor de homologação | `rosto.test.js`, `escala-reconhecimento.test.js` | PENDENTE |
| 5 | Reconhecimento facial | a pessoa cadastrada bate; uma não cadastrada tenta | reconhece a cadastrada; recusa a outra com mensagem clara, sem registrar | `diagnostico-calibracao.test.js` | PENDENTE |
| 6 | Batida offline | modo avião; bater 2 vezes | comprovante na tela ("guardada no aparelho"); voz/vibração; Diagnóstico mostra 2 a enviar | `ponta-a-ponta.test.js`, `apresentacao.test.js` | PENDENTE |
| 7 | Sincronização ao voltar a conexão | tirar do modo avião | envio sozinho em até 1 min; NSR recebido da ARP; "a enviar: 0"; reenviar não duplica | `rep-p-ponta-a-ponta.test.js`, `regressao.test.js` (idempotência) | PENDENTE |
| 8 | Aparelho reiniciado | bater offline; reiniciar o aparelho; abrir | batida continua guardada; hora marcada como não verificada até sincronizar | `ponta-a-ponta.test.js`, `regressao.test.js` | PENDENTE |
| 9 | Horário alterado à mão | adiantar/atrasar o relógio do Android 2 h; bater | batida registrada com "hora não verificada"; o servidor (ARP) decide a hora fiscal pela regra da 019 | `regressao.test.js`, `arp-019-concorrencia.pg.test.js` (servidor) | PENDENTE |
| 10 | Câmera negada | negar a câmera; depois "não perguntar de novo" | tela explica e leva às configurações; encarregado pode registrar pelo modo Encarregado | `apresentacao.test.js`, `regressao.test.js` | PENDENTE |
| 11 | GPS indisponível | desligar a localização; bater | batida registrada sem GPS (a Portaria veda bloquear); Diagnóstico mostra o estado do GPS | `rep-p-ponta-a-ponta.test.js`, `regressao.test.js` | PENDENTE |
| 12 | Armazenamento insuficiente | encher o armazenamento do aparelho; bater | "A batida NÃO foi registrada…"; nada gravado pela metade; ao liberar espaço, a próxima batida segue a sequência | `armazem-sqlite.test.js` (SQLITE_FULL) | PENDENTE |
| 13 | Eventos pendentes | 20 batidas offline; voltar a conexão | todas enviadas em ordem; fotos enviadas depois; nenhuma perdida | `regressao.test.js` | PENDENTE |
| 14 | Conflito fiscal | servidor de homologação devolve NSR/hash diferente do guardado (cenário preparado pelo suporte) | Diagnóstico: "Registro fiscal" em atenção, pedindo suporte; nada sobrescrito no aparelho | `armazem-sqlite.test.js` (escrita única), `apresentacao.test.js` | PENDENTE |
| 15 | Confirmação ao trabalhador | bater online e offline | comprovante legível a 1 m, com hora, CPF mascarado e "registrada"/"guardada"; voz e vibração | `apresentacao.test.js`, `feedback.test.js` | PENDENTE |
| 16 | Câmera recém-ligada | bater logo depois do comprovante e logo ao sair do Encarregado | botão mostra "Preparando câmera" até a câmera ligar; nunca fica em "Aguarde" para sempre; sem câmera em 10 s, aviso e caminho do encarregado | `prazo.test.js`, `codigo-fonte.test.js` | PENDENTE |
| 17 | Terceirizado | registrar o acesso de um terceirizado | comprovante "Acesso registrado", sem NSR e sem CPF; voz "Acesso registrado" | `apresentacao.test.js` | PENDENTE |
| 18 | Recuperação após falha | matar o app durante a batida e durante o envio | ao reabrir, a batida existe uma vez só ou não existe (nunca pela metade); envio retomado sem duplicar | `armazem-sqlite.test.js` (transação), `regressao.test.js` | PENDENTE |

## Critério de aprovação do piloto

Todos os 18 cenários APROVADOS no mesmo APK (mesmo commit), sem REPROVADO
aberto de severidade P0/P1. Homologação aprovada **não** é conformidade
REP-P nem autorização para uso oficial com funcionários: isso exige decisão
da direção e os requisitos formais da Fase 03.
