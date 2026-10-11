# Ponto de Obra — roadmap e estado das fases

Atualizado em 11/10/2026. Este documento resume e aponta para os detalhes; ele
não declara conformidade REP-P nem homologação em aparelho.

| Fase | Estado | Onde |
|---|---|---|
| Fase 01 — estabilização, segurança e regressão | **Tecnicamente concluída.** Integração à `main` pendente (merge exige autorização) | PR [#69](https://github.com/hygorlp-dot/hygor/pull/69), `docs/PONTO-OBRA-FASE-01-ESTABILIZACAO.md` |
| Etapa intermediária — segurança fiscal da ARP | **Em preparação.** Migration 019 escrita, revisada e testada; livro de migrations, gate de deploy e backup do ponto prontos e ensaiados só com dados sintéticos; nada aplicado em produção | PR [#70](https://github.com/hygorlp-dot/hygor/pull/70) (019, rascunho), PR [#71](https://github.com/hygorlp-dot/hygor/pull/71) (livro e backup, rascunho), `docs/PONTO-OBRA-MIGRATION-019.md`, `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`, `docs/PONTO-OBRA-BACKUP-RESTAURACAO.md` |
| Fase 02 — AFD, comprovante, espelho, quiosque | **Aguardando** o gate de produção abaixo e a consolidação da PR [#62](https://github.com/hygorlp-dot/hygor/pull/62) | — |
| Fase 03 — ICP-Brasil, INPI, AEJ, substituir folha | Não iniciada | — |

## Etapa intermediária: o que já existe e o que falta

**Pronto e testado:**
- 019, que cobre:
  - legado só antes do formato 2;
  - relógio fiscal com o banco como árbitro e sem efeito catraca;
  - inscrição congelada depois do NSR, com auditoria;
  - endurecimento de permissões e travas.
- Revisão independente: APROVAR COM CORREÇÕES, com as correções aplicadas.
- Livro de migrations (cada arquivo uma vez, SHA-256, deriva detectada, trava
  com prazo compartilhada entre deploy e CLI).
- Gate de deploy com três resultados (GO, NO-GO, INTERVENÇÃO HUMANA) que
  confere a integridade fiscal da versão ativa (triggers, privilégios, funções
  e SHA-256) e recusa deriva sem corrigir nada.
- Backup cifrado do ponto com consistência banco × Storage classificada e
  restauração com estados explícitos (`completa`, `apenas_banco`,
  `parcial`, `falha`); só `completa` conta para o gate.
- Ensaio integrado de 18 passos (016 → 019 → backup → restauração → nova
  batida) em PGlite e em Postgres real na CI, com cenários negativos.

**Falta (cada item 🔐):**
1. confirmar e ensaiar o backup da plataforma Supabase;
2. backup real do ponto (`consistente`) restaurado com estado `completa`;
3. merges #69 → #70 → #71;
4. implantar o livro;
5. aplicar a 019 na janela;
6. cadastrar o CNPJ;
7. decisão formal da direção sobre os riscos residuais (registrados, não
   aceitos).

Sequência e critérios: `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`.

## PR #62 (redesenho "ARCD Precision") — consolidação

Aberta desde 01/10. Os checks verdes dela são **de 01/10, anteriores** à
deriva do Expo SDK 57 e dos advisories do npm (06/10). Ela não recebeu as
correções da #69. Para consolidar:
1. depois do merge da #69, reempilhar a #62 sobre a `main`; espera-se
   conflito em `apps/ponto-obra/package-lock.json`, a resolver com
   `npx expo install --fix`;
2. CI verde nos 5 jobs, incluindo o portão de auditoria;
3. revisão de UI/UX própria (fora do escopo das fases de estabilização).

Não foi alterada em nenhuma das fases.

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
7. #62 consolidada (ou decisão formal de descartá-la ou adiá-la).
8. APK da versão estabilizada validado em aparelho real: SQLCipher abre
   depois da atualização, batida offline, câmera negada, reboot, diagnóstico.
9. Decisão formal da direção sobre os riscos residuais (Fase 01, seção 15;
   019, seção 11; backup, seção 7).
