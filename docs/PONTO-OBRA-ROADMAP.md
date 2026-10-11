# Ponto de Obra — roadmap e estado das fases

Atualizado em 11/10/2026. Este documento resume e aponta para os detalhes; ele
não declara conformidade REP-P nem homologação em aparelho.

| Fase | Estado | Onde |
|---|---|---|
| Fase 01 — estabilização, segurança e regressão | **Tecnicamente concluída.** Integração à `main` pendente (merge exige autorização) | PR [#69](https://github.com/hygorlp-dot/hygor/pull/69), `docs/PONTO-OBRA-FASE-01-ESTABILIZACAO.md` |
| Etapa intermediária — segurança fiscal da ARP | **Em preparação.** Migration 019 escrita, revisada e testada; livro de migrations e backup do ponto prontos; nada aplicado em produção | PR [#70](https://github.com/hygorlp-dot/hygor/pull/70) (019, rascunho), PR do livro (rascunho), `docs/PONTO-OBRA-MIGRATION-019.md`, `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`, `docs/PONTO-OBRA-BACKUP-RESTAURACAO.md` |
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
- Livro de migrations (cada arquivo uma vez, SHA-256, deriva detectada,
  guarda no script antigo).
- Backup cifrado do ponto e ensaio de restauração em bancos descartáveis.

**Falta (cada item 🔐):**
1. confirmar e ensaiar o backup da plataforma Supabase;
2. backup real do ponto, com ensaio de restauração;
3. merges #69 → #70 → livro;
4. implantar o livro;
5. aplicar a 019 na janela;
6. cadastrar o CNPJ;
7. aceitar formalmente os riscos residuais.

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
1. #69, #70 e o livro mesclados na `main`, com CI verde nos 5 jobs no HEAD.
2. Livro implantado: `ponto_migracoes_aplicadas` com 016-019, e o plano da
   CLI mostrando só `ja_aplicada`.
3. 019 aplicada, com as verificações da seção 8 antes e depois guardadas e a
   cadeia fiscal íntegra.
4. Backup do ponto e backup da plataforma **restaurados com sucesso** em
   ambiente descartável, com evidência.
5. CNPJ do estabelecimento cadastrado (auditado depois do NSR 2).
6. #62 consolidada (ou decisão formal de descartá-la ou adiá-la).
7. APK da versão estabilizada validado em aparelho real: SQLCipher abre
   depois da atualização, batida offline, câmera negada, reboot, diagnóstico.
8. Riscos residuais aceitos formalmente pela direção (Fase 01, seção 15;
   019, seção 11).
