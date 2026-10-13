# Ponto de Obra — roadmap e estado das fases

Atualizado em 13/10/2026 a partir de evidências verificadas (commit, teste,
CI). Este documento não declara conformidade REP-P, homologação em aparelho
nem risco aceito.

**Estados usados (nesta ordem, sem pular):** NÃO INICIADO → EM
DESENVOLVIMENTO → IMPLEMENTADO → TESTADO → HOMOLOGADO → INTEGRADO →
IMPLANTADO. *Testado* = testes automáticos e CI verdes; *homologado* =
validado em aparelho físico ou ambiente real autorizado; *integrado* =
mesclado na `main`; *implantado* = em produção (migration aplicada, APK em
uso). Merge não é deploy; build Android não é validação física; CI verde não
é conformidade REP-P; risco documentado não é risco aceito.

## Roadmap em dez fases

**Origem da numeração.** O "roadmap de dez fases" citado pela direção não
está registrado no repositório. As dez fases abaixo são a **proposta** desta
revisão, montada a partir das fases reais (Fase 0–1 REP-P, Fase 01, etapa
intermediária, Fases 02 e 03) e das PRs; a direção pode remapear sem que o
estado de cada entrega mude.

**Nota de 0 a 10 (prontidão de engenharia, não conformidade).** Cada ponto
exige todos os anteriores:
0 nada feito · 1 especificado · 2 desenho/plano reproduzível pronto ·
3 parcialmente implementado · 4 implementado · 5 testes de unidade ·
6 CI verde nos 5 jobs, com testes de integração · 7 provado em Postgres real
e com revisão independente · 8 homologado (aparelho físico ou ambiente real
isolado) · 9 integrado na `main` · 10 implantado em produção com evidência
depois da implantação.

| # | Fase | Estado | Evidência (PR, HEAD, testes) | Nota | Bloqueio | Próxima dependência | Critério para passar à seguinte |
|---|---|---|---|---|---|---|---|
| 1 | ARP, NSR por estabelecimento e app de batida (Fase 0–1 REP-P) | **INTEGRADO** na `main` (01/10); servidor do ponto em produção; **pulou o HOMOLOGADO** (app sem homologação física) | `docs/REP-P-ARQUITETURA.md`; `arp-concorrencia.pg.test.js` (5 em Postgres real) | 6 | — | homologação física (fase 8) | já cumprido para o servidor; o app depende da fase 8 |
| 2 | Fase 01 — estabilização, segurança e regressão | **TESTADO** | [#69](https://github.com/hygorlp-dot/hygor/pull/69) `7293b3d`; CI 5/5 | 7 | merge exige autorização | merge #69 | CI verde no HEAD + autorização de merge |
| 3 | Segurança fiscal da ARP — migration 019 | **TESTADO** (sintético, PGlite e Postgres real); **nada aplicado em produção** | [#70](https://github.com/hygorlp-dot/hygor/pull/70) `058a71a`; `arp-019-concorrencia.pg.test.js` (6) | 7 | aplicar a 019 exige janela e autorização | livro implantado (fase 4) | 019 aplicada na janela com GO 019 e verificações guardadas |
| 4 | Livro de migrations, backup e gate de deploy | **TESTADO** (sintético); ensaio real de backup **não feito** | [#71](https://github.com/hygorlp-dot/hygor/pull/71) `554ab31`; `livro.pg.test.js`, `backup.pg.test.js`, `gate-integrado.pg.test.js` | 7 | fuso do banco, backup real restaurado `completa`, autorização | merges #69→#70→#71 | livro implantado com GO 018 e backup real restaurado |
| 5 | ARCD Precision (UI do app) e trava de ambiente | **TESTADO**; **não homologado** | [#72](https://github.com/hygorlp-dot/hygor/pull/72) `2c15bdc`; `ambiente.test.js`; expo-doctor; prebuild | 7 | aparelho físico | APK de homologação (fase 8) | cenários 1–18 aprovados no RC |
| 6 | Hardening de segurança: PIN no servidor, limites de tentativas, trava persistente, segredos apagados na revogação, métricas de fila e desempenho | **TESTADO** em cada PR e **integrado na branch de integração** (não na `main`); revisão independente feita e achados corrigidos | [#74](https://github.com/hygorlp-dot/hygor/pull/74) `14b323a`, [#76](https://github.com/hygorlp-dot/hygor/pull/76) `2021ab3`, [#75](https://github.com/hygorlp-dot/hygor/pull/75) `0a6eb92`; `integracao-hardening.test.js`; `limite-pareamento.pg.test.js` (Postgres real); `docs/PONTO-OBRA-SEGURANCA-PIN.md` | 7 | decisão sobre P1 (hash do PIN no aparelho) e sobre o teto global | homologação (H1–H6) | H1–H6 aprovados no RC; decisão registrada sobre P1 e o teto |
| 7 | Ambiente de homologação isolado | ferramentas **TESTADAS** (provisionar, conferir, código, reset, `validar-env`, guarda do `prebuild`); **o ambiente não existe** | [#73](https://github.com/hygorlp-dot/hygor/pull/73) `4c7e8b5`; `homologacao.test.js`, `homologacao.pg.test.js`, `guarda-prebuild.test.js`; `docs/PONTO-OBRA-HOMOLOGACAO.md` §4 | 2 | **autorização** para criar Supabase e Vercel (custo e credenciais) | autorização da direção | `conferir --api` = marcador, GO 019, bucket privado, hash ≠ produção, API `homologacao` |
| 8 | Homologação física (RC + 18 cenários + H1–H6) | **NÃO INICIADO**; matriz, verificador de APK (com `--atualiza`) e comandos prontos | `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md`; §4.5 | 1 | fase 7; aparelho físico; consentimento LGPD; keystore EAS do pacote `.homologacao` | ambiente isolado criado | 18 + H1–H6 APROVADOS no mesmo APK, sem P0/P1 aberto |
| 9 | Implantação em produção (merges, livro, 019, CNPJ, flag do PIN) | **NÃO INICIADO**; runbook pronto | `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md` | 2 | fases 2–8; autorização | homologação aprovada | sequência do runbook concluída com evidência e cadeia fiscal íntegra |
| 10 | Conformidade REP-P formal (Fases 02/03: AFD, comprovante, espelho, ICP-Brasil, INPI, AEJ, folha) | **NÃO INICIADO** (parte Android do comprovante na tela em desenvolvimento) | — | 0 | requisitos fiscais, jurídicos e formais | fase 9 | parecer formal; nenhuma conformidade é declarada antes |

Branch de integração `integ/ponto-hardening-piloto` (#73 + #76 com #74 +
#75): HEAD e CI na PR de integração. É dela que sai o APK candidato (§4.5).

## Matriz requisito → implementação → teste → evidência → risco → estado

| Requisito | Implementação | Teste | Evidência | Risco residual | Estado |
|---|---|---|---|---|---|
| NSR por estabelecimento, só a ARP atribui | `migrations/017`, `ponto_arp_registrar` | `server/ponto-eletronico/arp/*` (PGlite) e `arp-concorrencia.pg.test.js` | CI `rep-p-arp-postgres`: 5 aprovados | — | INTEGRADO |
| Hora fiscal com o banco como árbitro, sem efeito catraca | `migrations/019` (`ponto_arp_fonte_hora`) | `arp-019-concorrencia.pg.test.js` + suíte PGlite com `PONTO_MIGRACOES_ATE=019` | CI: 6 aprovados em Postgres real | premissa: relógio do banco correto | TESTADO |
| Legado bloqueado após formato 2; inscrição congelada após NSR, auditada | `migrations/019` | idem | idem | CNPJ ainda vazio em produção | TESTADO |
| 016/017 nunca reaplicadas por cima da 019 | livro (`scripts/migracoes-ponto/livro.mjs`) + gate no `apply-ponto-eletronico.mjs` | `livro.test.js` (27), `livro.pg.test.js` (4), `gate-integrado.pg.test.js` (script de deploy real) | CI `c45f9c2` verde | revert/redeploy anterior à #71 só barrado por procedimento | TESTADO |
| Gate GO / NO-GO / INTERVENÇÃO HUMANA com integridade fiscal (triggers, privilégios, impressão digital) | `validacao.mjs`, `impressoes.json` | `livro.test.js`, `gate-integrado*.test.js` | GO com privilégios padrão do Supabase (PGlite e PG 16) | gate no `prebuild` comum: NO-GO trava o ERP inteiro | TESTADO |
| Implantação atômica do livro; trava com prazo | `livro.mjs` (`aplicar`, `obterTrava`) | `livro.test.js`, `livro.pg.test.js` | CI | saída depois de `down` da 019 sem decisão | TESTADO |
| Backup cifrado das tabelas e fotos do ponto | `scripts/backup-ponto*` (formato v3) | `pacote.test.js` (24), `backup.pg.test.js` | CI; ensaio de 550 MB pela auditoria | volume real não medido; teto ~320 mil eventos por tabela | TESTADO |
| Recuperação integral (`completa`) com fotos e cadeia conferidas | `restaurar` / `restaurar-backup-ponto.mjs` | `pacote.test.js`, `gate-integrado.pg.test.js` | `RECUPERAÇÃO COMPLETA` sintética na CI | **ensaio real não feito**; Supabase (`session_replication_role`, `comment on database`) não verificado | TESTADO (sintético) |
| App Android: SQLCipher, TFLite, hora confiável, offline | `apps/ponto-obra` | `apps/ponto-obra/**/*.test.js` (268 com servidor e regras) | job `mobile-ponto-obra`; expo-doctor 21/21; prebuild conferido | **sem validação física** | TESTADO |
| UI ARCD Precision reconciliada, com as correções da revisão Impeccable (câmera com prazo e `onCameraReady`, comprovante de terceirizado, divergência fiscal visível) | PR #72 | `apresentacao.test.js`, `prazo.test.js`, `codigo-fonte.test.js`, `design-system.test.js` | 277 testes do ponto; expo-doctor 21/21; prebuild com lista permitida de permissões | estouros de altura em 360×640 só se conferem no aparelho | TESTADO |
| APK de homologação | perfil `homologacao` do `eas.json` (exige `PONTO_API_URL` isolada; pacote `.homologacao`), `scripts/verificar-apk.mjs` | `ambiente.test.js`; verificador rodado contra o APK antigo | APKs antigos `e4f41447` (vc 2) e `4f8b84c1` (vc 3, SHA-256 `1750d709…5438`, commit `7a5b73c` conferido) **auditados: apontam para a PRODUÇÃO — BLOQUEADOS PARA PAREAMENTO DE HOMOLOGAÇÃO, NÃO INSTALAR** | novo APK isolado depende do backend de homologação | IMPLEMENTADO (configuração); **APK isolado NÃO GERADO** |
| PIN do responsável conferido no servidor no cadastro facial (flag `PONTO_EXIGIR_PIN_NO_SERVIDOR`) | #74 | `handler.test.js`, `pin.test.js`, `integracao-hardening.test.js` | CI 5/5 na #74 | P1: hash do PIN no aparelho (quebra offline) - decisão da direção | TESTADO |
| Limites de tentativas (pareamento por origem e global; PIN por aparelho), contados antes de olhar o código/PIN | #76 `limite-pareamento.js` | `limite-pareamento.test.js`, `limite-pareamento.pg.test.js` (rajadas em Postgres real), `integracao-hardening.test.js` | pre-push 2570 testes; CI | falha ABERTA se a RPC cair; teto global = negação de serviço do pareamento | TESTADO |
| Trava persistente do PIN; segredos apagados na revogação | #76 `trava-pin.js`, `sincronizacao.js` | `pin.test.js`, `rep-p-ponta-a-ponta.test.js`, `integracao-hardening.test.js` | idem | relógio adiantado 24 h zera a trava local | TESTADO |
| Métricas de fila e tempo do reconhecimento | #75 `metricas-aparelho.js`, `desempenho.js`, `painel.js` | `desempenho.test.js`, `metricas-fila.test.js`, `painel.test.js`, `handler.test.js` | CI 5/5 na #75 | tempos só valem medidos em aparelho de referência | TESTADO |
| Deploy de homologação nunca no banco da produção | #73 `guarda-prebuild.mjs` (1º passo do `prebuild`) + `ambiente.js` (execução) | `guarda-prebuild.test.js` (produção sai 0 sem conectar; homologação recusa variáveis/banco errados; falha fechada) | — | o guarda só vale com `PONTO_AMBIENTE=homologacao` no projeto (conferido pelo `validar-env`) | TESTADO |
| Homologação física | `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` (18 cenários + H1–H6) | lógica coberta por testes automáticos (não substituem o aparelho) | — | nenhum cenário executado: sem backend isolado e sem aparelho | NÃO INICIADO |
| Conformidade REP-P formal | — | — | — | exige requisitos fiscais, jurídicos e formais (Fase 03) | NÃO INICIADO |

## Efeito de cada merge no deploy da Vercel

O `prebuild` da `main` termina em `npm run ponto-eletronico:migrate`.

| Merge | Efeito em produção |
|---|---|
| #69 | `prebuild` igual; 016–018 sem mudança de conteúdo (reaplicadas como hoje). Servidor: logs sanitizados e correções da Fase 01 no handler do ponto |
| #70 | só acrescenta os arquivos da 019; **não aplica** (o script de deploy aplica só 016–018) |
| #71 | o script de deploy ganha trava e gate; hoje GO/seguir → reaplica 016–018 como antes (provado executando o script em Postgres real) |
| #72 | app; no servidor, só o campo `ambiente` nas respostas do aparelho e a recusa (409) de app que declara outro ambiente. Sem `PONTO_AMBIENTE` na produção, comportamento igual |
| #73 | `scripts/homologacao/` e documentação; o `prebuild` ganha `guarda-prebuild.mjs` como 1º passo, que **na produção sai 0 na hora** (sem `PONTO_AMBIENTE=homologacao`, não importa nem conecta em nada; provado rodando o script) |
| #74 | cadastro facial ganha a conferência do PIN só com `PONTO_EXIGIR_PIN_NO_SERVIDOR=1`; **sem o flag, igual a hoje** |
| #76 | pareamento passa a ter limite de tentativas (tabela `auth_rate_limits` e RPCs já existentes na produção, sem migration nova); com o flag do PIN, limite do PIN por aparelho. App: revogação apaga hashes de PIN e vetores do aparelho |
| #75 | `ponto-sincronizar` aceita métricas numéricas dentro de `aparelho` (jsonb existente, sem migration); `ponto-dispositivos` devolve `fila` |

## Etapa intermediária: o que falta (cada item 🔐)

1. Confirmar o fuso UTC do banco (consulta somente leitura) antes do merge da #71.
2. Confirmar e ensaiar o backup da plataforma Supabase.
3. Backup real do ponto (`consistente`) restaurado com estado `completa`.
4. Merges #69 → #70 → #71.
5. Implantar o livro (`--verificar` = GO 018).
6. Aplicar a 019 na janela (`--verificar` = GO 019).
7. Cadastrar o CNPJ.
8. Decisão da direção sobre os riscos residuais (registrados, não aceitos).

Sequência e critérios: `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`.

## ARCD Precision (PR #72, substitui a #62)

A #62 estava 43 commits atrás da `main` e sem as correções da Fase 01. A #72
mescla os 2 commits originais dela sobre a #69 (sem reescrever histórico);
conflitos só nas dependências do app, resolvidos com as versões da Fase 01 e
conferidos com `expo install --fix` e `expo-doctor` (21/21). Correção de
reconciliação: o item "Registro fiscal" do diagnóstico passou a pedir
atenção na seção certa. Mesclar só depois da #69; a #62 pode ser fechada
quando a #72 for mesclada (decisão da direção).

## Condição objetiva para iniciar a Fase 02

Todas verdadeiras e registradas:
1. #69, #70 e #71 mesclados na `main`, com CI verde nos 5 jobs no HEAD.
2. Livro implantado: `ponto_migracoes_aplicadas` com 016-019, e o plano da
   CLI mostrando só `ja_aplicada`.
3. 019 aplicada, com as verificações da seção 8 antes e depois guardadas e a
   cadeia fiscal íntegra.
4. Backup do ponto restaurado com estado `completa` e backup da plataforma
   restaurado, ambos em ambiente descartável, com evidência.
5. Gate (`node scripts/aplicar-migracoes-ponto.mjs --verificar`) dando GO
   com versão fiscal 019, e o redeploy seguinte sem reaplicar nada.
6. CNPJ do estabelecimento cadastrado (auditado depois do NSR 2).
7. #72 mesclada (ARCD Precision reconciliado) ou decisão formal de adiá-la.
8. APK de homologação (perfil `homologacao`, RC da branch de integração)
   validado em aparelho real conforme a matriz de homologação
   (`apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md`: 18 cenários + H1–H6).
9. Decisão formal da direção sobre os riscos residuais (Fase 01, seção 15;
   019, seção 11; backup, seção 7).
