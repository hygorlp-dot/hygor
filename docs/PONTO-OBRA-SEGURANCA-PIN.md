# Ponto de Obra — segurança do PIN do encarregado e dos limites de tentativas

Auditoria de 13/10/2026 sobre a integração #74 + #76 + #75 (branch
`integ/ponto-hardening-piloto`). Descreve o que o código faz hoje, com o
teste que prova cada ponto. Riscos aqui estão **registrados, não aceitos**:
aceitar é decisão da direção.

## 1. Fluxo atual

| Etapa | Onde | O que acontece |
|---|---|---|
| Cadastro do PIN | ARCD (`ponto-responsavel-pin`, papéis admin/rh/engenheiro) | 4–8 dígitos; PBKDF2-SHA256 com 60 000 iterações e sal aleatório de 16 bytes; guarda só hash, sal e iterações em `ponto_responsaveis` |
| Distribuição | `ponto-sincronizar` | o aparelho recebe `pinHash`, `pinSalt`, `pinIteracoes` **só dos responsáveis com acesso à obra dele** (ou sem restrição de obra) |
| Guarda no aparelho | banco local SQLCipher (chave no Keystore via SecureStore) | junto do cadastro da obra |
| Entrada no modo Encarregado | app, **offline** (`verificarPinResponsavel`) | confere só contra o responsável escolhido na lista; trava persistente: 4 erros livres, depois 30 s, 60 s… até 15 min (`trava-pin.js`) |
| PIN depois de conferido | `abrirSessaoResponsavel` | só em memória (closure), fora de JSON/estado/log; descartado ao sair, por inatividade (3 min) e ao desmontar a tela |
| Cadastro facial | servidor, **exige internet** | com `PONTO_EXIGIR_PIN_NO_SERVIDOR=1`, o servidor confere o PIN do responsável indicado (tempo constante) **antes** de qualquer foto ou gravação; limite de 5 tentativas por aparelho em 15 min, contado antes do PBKDF2 |
| Batida pelo encarregado (sem rosto) | app, offline | autorizada só pela conferência local; vai à ARP com `metodo encarregado` e `encarregadoId` |
| Aparelho revogado ou desconhecido no ARCD | app | sessão sai; **hashes de PIN e vetores faciais são apagados do banco local**; batidas, fotos de batida e cadeia ficam (registro legal) |

## 2. Achados

| # | Achado | Severidade | Situação |
|---|---|---|---|
| P1 | Quem tem o **token** de um aparelho (ou o banco local decifrado) obtém hash + sal e quebra um PIN de 4 dígitos **offline** em segundos (10 000 candidatos; nenhum número de iterações compensa isso) | Alta | **Registrado.** Inerente à conferência offline. Ver proposta 3 |
| P2 | Força bruta **online** do PIN pelo cadastro facial (e custo de CPU do PBKDF2) | Média | **Corrigido** (#76): 5 tentativas por aparelho em 15 min, contadas antes de conferir |
| P3 | Limite de pareamento não atômico: rajada paralela passava inteira pela leitura do estado | Média | **Corrigido** (#76): a tentativa é contada no banco antes de olhar o código |
| P4 | Aparelho perdido e revogado continuava com hashes de PIN e vetores faciais | Média | **Corrigido** (#76): apagados na resposta de revogação |
| P5 | Batida "pelo encarregado" offline só tem a autorização local: quem quebrou o PIN (P1) registra batidas em nome de outros | Média | **Registrado.** A batida é auditável (`encarregadoId`, aparelho, GPS, hora); o servidor não tem como reconferir o PIN offline |
| P6 | Trava local usa o relógio de parede: adiantar o Android 24 h zera o contador | Baixa | **Registrado** e travado em teste (`pin.test.js`). O monotônico zera a cada reinício; a proteção que não depende do aparelho é o limite no servidor |
| P7 | PIN de outro responsável | — | **Sem problema:** app confere só o escolhido; servidor confere o `responsavelId` indicado (teste "o PIN de OUTRO responsável não serve") |
| P8 | Atualização do app | — | **Sem problema:** banco, trava e cadastro sobrevivem (mesma chave do SQLCipher); a sessão em memória cai e pede o PIN de novo |
| P9 | App antigo com o flag ligado no servidor | — | **Esperado:** cadastro facial recusado com 403 `PIN_RESPONSAVEL_AUSENTE`; batidas não são afetadas |

## 3. Proposta (exige decisão da direção; nada disso foi implementado)

A batida offline **não depende do PIN** (o trabalhador bate pelo rosto). O
PIN offline serve ao modo Encarregado. Opções, da menor à maior mudança:

1. **PIN de 6 a 8 dígitos para PINs novos** (hoje 4–8). 10⁶ candidatos ainda
   são quebráveis offline com hardware dedicado, mas deixa de ser trivial no
   celular. Mudança funcional pequena: o ARCD passa a recusar PIN curto;
   PINs atuais continuam até serem trocados.
2. **Rotação do PIN depois de aparelho revogado**: o ARCD mostra, ao revogar,
   os responsáveis cujo hash estava naquele aparelho e pede a troca do PIN.
   Sem mudança no app.
3. **Relatório de batidas "pelo encarregado"** por aparelho/dia no ARCD, para
   detectar uso anormal (P5). Sem mudança no app.
4. **Parar de enviar o hash** (conferência só online): elimina P1, mas o
   modo Encarregado deixa de funcionar sem internet (cadastro facial já
   exige internet; a batida pelo encarregado offline pararia). **Não
   recomendado** sem avaliar a operação das obras com internet instável.

Recomendação técnica: 1 + 2 + 3 juntos, mantendo a conferência offline.
Nenhuma delas foi aplicada (mudança funcional exige autorização).
A seção 5 refina esta recomendação com uma quinta opção, que elimina a
exposição remota sem perder o modo offline.

## 5. Decisão técnica proposta (13/10/2026) — para a direção decidir

**O que cada medida faz de verdade.** Nenhum número de iterações ou
tamanho de PIN *elimina* um verificador offline: quem tem o verificador
testa todos os PINs fora do alcance de qualquer limite. As medidas se
dividem assim:

| Medida | Classe | Efeito sobre P1 (quebra offline) | Custo operacional |
|---|---|---|---|
| PIN de 6–8 dígitos | **aumenta o custo** | 10⁶–10⁸ candidatos × PBKDF2 60 000: de segundos para horas/dias com hardware dedicado; não impede | pequeno: ARCD recusa PIN curto novo |
| Mais iterações do PBKDF2 | **aumenta o custo** (linear) | idem; deixa a entrada no aparelho mais lenta (~1 s hoje) | pequeno, mas piora o aparelho de entrada |
| Rotação do PIN após revogação | **reduz a janela** | PIN vazado de aparelho revogado deixa de valer | ARCD orienta a troca ao revogar |
| Relatório de batidas "pelo encarregado" | **detecta** | não impede; torna o abuso visível (P5) | só ARCD |
| **Verificador vinculado ao aparelho** (abaixo) | **elimina a exposição REMOTA** | o token deixa de dar acesso ao verificador; resta só quem tem o aparelho desbloqueado com root | 1ª entrada de cada encarregado em cada aparelho (e após troca de PIN) precisa de internet |
| Conferência só online | **elimina** | elimina P1 por completo | modo Encarregado sem internet deixa de existir — **não recomendado** |

**Verificador vinculado ao aparelho (proposta nova, não implementada).**
O servidor deixa de mandar `pinHash`/`pinSalt` na sincronização. Na primeira
entrada de um encarregado num aparelho (online), o app manda o PIN ao
servidor, que o confere com o limite já existente (5 por aparelho em 15 min).
Aceito, o aparelho guarda um verificador próprio, derivado do PIN com uma
chave aleatória do aparelho protegida pelo Keystore do Android (via
SecureStore), junto da "versão do PIN" informada pelo servidor. Daí em
diante a entrada funciona **offline**, como hoje. Trocar o PIN no ARCD muda a
versão e exige uma nova entrada online. Efeitos:
- quem só tem o **token** (sincronização) não obtém mais nada para atacar;
- quem tem o **aparelho** com root ainda pode extrair a chave e testar
  PINs (combinar com PIN de 6+ dígitos);
- a batida offline e o modo Encarregado offline continuam, exceto a
  primeira entrada de cada encarregado em cada aparelho.

**Bloqueio global do pareamento (negação de serviço).**

| Mitigação | Classe | Efeito |
|---|---|---|
| Subir o teto (ex.: 100–300/15 min) | **aumenta o custo** do bloqueio | o atacante só precisa de mais requisições; o risco continua |
| **Código de 12 dígitos** (ou QR com segredo longo) **e retirar o teto global**, mantendo o limite por origem | **elimina** o bloqueio global | força bruta distribuída fica inviável: 10 000 IPs × 5 tentativas a cada 15 min, durante os 30 min de validade = 10⁵ palpites contra 10¹² códigos (≈ 1 em 10 milhões) |
| Pareamento só com sessão do responsável (QR gerado no ARCD logado) | **elimina** a exposição pública do endpoint | mudança de fluxo maior |

**Proposta de decisão, em ordem:**
1. **Homologação:** nada muda. Os dados são só sintéticos; com
   `PONTO_EXIGIR_PIN_NO_SERVIDOR=1`, servem para medir o fluxo atual.
2. **Antes do piloto em produção:**
   - verificador vinculado ao aparelho;
   - rotação do PIN após revogação;
   - relatório das batidas "pelo encarregado";
   - código de pareamento de 12 dígitos sem teto global;
   - PIN de 6+ dígitos para PINs novos.
3. Cada item é mudança funcional: exige autorização e PR própria com testes.
   Nada foi implementado.

Este documento **registra** os riscos e propõe a decisão. Nenhum risco
está aceito pela direção.

## 4. Limites de tentativas: onde falham abertos ou fechados

| Situação | Comportamento | Prova |
|---|---|---|
| Rajada simultânea da mesma origem | **fechado** depois de N (5) | `limite-pareamento.pg.test.js` (Postgres real, 60 em paralelo) |
| Origem trocada a cada tentativa / `x-forwarded-for` forjado | o limite por origem é contornado; o **teto global (30/15 min) fecha** | idem (80 origens em paralelo) |
| Código ou PIN certo durante o bloqueio | **fechado** (espera a janela); tentativa bloqueada não estende o bloqueio | idem; `handler.test.js` |
| Janela esgotada | **reabre** sozinho (bloqueio sempre temporário) | idem (janela curta) |
| RPC com erro / conexão com o banco caída | **ABERTO**: o limite deixa passar (mesma política do login do ARCD). O pareamento ainda exige o código de uso único de 8 dígitos (30 min); o cadastro facial ainda exige o PIN certo | idem (`8/9`) |
| Ataque automatizado ao PIN por um aparelho | **fechado** depois de 5 por aparelho | idem (100 em paralelo) |
| Reinício do aparelho (trava local) | mantém a espera | `pin.test.js` |
| Relógio local atrasado | a espera recomeça de agora | `pin.test.js` |
| Relógio local adiantado 24 h | **ABERTO** localmente (P6) | `pin.test.js` (limite conhecido) |

**Negação de serviço operacional.** Qualquer pessoa sem login que mande 31
códigos de pareamento em 15 min bloqueia **todo pareamento novo** da empresa
até a janela passar, e pode repetir. Não afeta aparelhos já pareados:
batidas, envio e NSR seguem (`integracao-hardening.test.js`). É a troca
entre proteger o cadastro da obra (CPFs, vetores, hashes) e a
disponibilidade do pareamento; ajustar o teto (ex.: 100/15 min) ou exigir
login no pareamento é decisão da direção.
