# Ponto de Obra — roadmap e estado das fases

Atualizado em 12/10/2026 a partir de evidências verificadas (commit, teste,
CI). Este documento não declara conformidade REP-P, homologação em aparelho
nem risco aceito.

**Estados usados (nesta ordem, sem pular):** NÃO INICIADO → EM
DESENVOLVIMENTO → IMPLEMENTADO → TESTADO → HOMOLOGADO → INTEGRADO →
IMPLANTADO. *Testado* = testes automáticos e CI verdes; *homologado* =
validado em aparelho físico ou ambiente real autorizado; *integrado* =
mesclado na `main`; *implantado* = em produção (migration aplicada, APK em
uso). Merge não é deploy; build Android não é validação física; CI verde não
é conformidade REP-P; risco documentado não é risco aceito.

**Nomenclatura.** Os documentos internos usam **fases** (Fase 0–1 da
REP-P, Fase 01 de estabilização, etapa intermediária de segurança fiscal,
Fase 02, Fase 03) e o runbook tem uma **sequência de 12 etapas** de
implantação. Um "roadmap de dez etapas" não está registrado no repositório;
a correspondência com ele precisa ser informada pela direção e não foi
presumida aqui.

| Fase | Estado | Onde |
|---|---|---|
| Fase 0–1 REP-P — ARP, NSR por estabelecimento, app de batida | **INTEGRADO** (na `main` desde 01/10) | `docs/REP-P-ARQUITETURA.md` |
| Fase 01 — estabilização, segurança e regressão | **Tecnicamente concluída — TESTADO** (CI verde nos 5 jobs). Integração à `main` pendente de autorização | PR [#69](https://github.com/hygorlp-dot/hygor/pull/69) `7293b3d`, `docs/PONTO-OBRA-FASE-01-ESTABILIZACAO.md` |
| Proteção fiscal (etapa intermediária: 019, livro, gate, backup) | **IMPLEMENTADO e TESTADO** com dados sintéticos (PGlite e Postgres real). **Implantação pendente** (nada aplicado em produção) | PR [#70](https://github.com/hygorlp-dot/hygor/pull/70) `058a71a` (019), PR [#71](https://github.com/hygorlp-dot/hygor/pull/71) (livro, gate, backup) |
| ARCD Precision (UI do app) e trava de ambiente | **IMPLEMENTADO e TESTADO**, reconciliado sobre a Fase 01; revisões Impeccable e independente aplicadas; **não homologado** em aparelho | PR [#72](https://github.com/hygorlp-dot/hygor/pull/72) (substitui a [#62](https://github.com/hygorlp-dot/hygor/pull/62)) |
| Ambiente de homologação isolado | Ferramentas **TESTADAS** (provisionar, conferir, código, reset, guardas contra produção); **o ambiente não existe** - criar projeto Supabase e deploy Vercel de homologação exige autorização | PR dependente das #71 e #72, `docs/PONTO-OBRA-HOMOLOGACAO.md` |
| Fase 02 — AFD, comprovante, espelho, quiosque | **EM DESENVOLVIMENTO** só na parte Android (ARCD Precision, comprovante na tela, quiosque); **sem homologação final**. AFD, espelho e comprovante formal não iniciados | — |
| Fase 03 — ICP-Brasil, INPI, AEJ, documentação REP-P, PTRP, integração com a folha | **NÃO INICIADO** (entregas futuras; nenhuma conformidade REP-P declarada) | — |

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
| Homologação física | `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` (18 cenários) | lógica coberta por testes automáticos (não substituem o aparelho) | — | nenhum cenário executado: sem backend isolado e sem aparelho | NÃO INICIADO |
| Conformidade REP-P formal | — | — | — | exige requisitos fiscais, jurídicos e formais (Fase 03) | NÃO INICIADO |

## Efeito de cada merge no deploy da Vercel

O `prebuild` da `main` termina em `npm run ponto-eletronico:migrate`.

| Merge | Efeito em produção |
|---|---|
| #69 | `prebuild` igual; 016–018 sem mudança de conteúdo (reaplicadas como hoje). Servidor: logs sanitizados e correções da Fase 01 no handler do ponto |
| #70 | só acrescenta os arquivos da 019; **não aplica** (o script de deploy aplica só 016–018) |
| #71 | o script de deploy ganha trava e gate; hoje GO/seguir → reaplica 016–018 como antes (provado executando o script em Postgres real) |
| #72 | app; no servidor, só o campo `ambiente` nas respostas do aparelho e a recusa (409) de app que declara outro ambiente. Sem `PONTO_AMBIENTE` na produção, comportamento igual |
| PR da homologação | `scripts/homologacao/` e documentação: nada roda no deploy de produção |

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
8. APK piloto validado em aparelho real conforme a matriz de homologação
   (`apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` na #72).
9. Decisão formal da direção sobre os riscos residuais (Fase 01, seção 15;
   019, seção 11; backup, seção 7).
