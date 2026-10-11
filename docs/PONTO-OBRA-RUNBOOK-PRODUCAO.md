# Ponto de Obra — runbook de produção (Fase 01, livro de migrations e 019)

Data: 11/10/2026. **Nada aqui foi executado em produção.** Cada etapa marcada
🔐 exige autorização expressa da direção, registrada (PR, ata ou mensagem com
data). O executor nunca aceita risco em nome da direção.

PRs envolvidas (empilhadas, todas abertas):
- [#69](https://github.com/hygorlp-dot/hygor/pull/69) — Fase 01 (base `main`).
- [#70](https://github.com/hygorlp-dot/hygor/pull/70) — migration 019 preliminar (rascunho; base `#69`).
- [#71](https://github.com/hygorlp-dot/hygor/pull/71) — livro de migrations, backup do ponto e este runbook (rascunho; base `#70`).

**Regra que governa a ordem:** a 019 só pode ser aplicada **depois** que o
livro de migrations estiver implantado. Sem ele, o deploy seguinte reaplica
016/017 por cima e reverte a 019 em silêncio (revisão independente, P1-1;
demonstrado em `scripts/migracoes-ponto/livro.test.js`).

## 1. Pré-requisitos de backup (🔐)

- [ ] Backup da plataforma Supabase confirmado no painel (plano, PITR ou
      diário, retenção, data da última cópia) **e** ensaio de restauração dele
      num projeto ou branch temporário
      (`docs/PONTO-OBRA-BACKUP-RESTAURACAO.md`, seção 3).
- [ ] `PONTO_BACKUP_KEY` gerada e no cofre, com 2 guardiões.
- [ ] Pacote do ponto gerado (`scripts/backup-ponto.mjs --com-fotos`), copiado
      para fora do Supabase e **restaurado com sucesso** num banco descartável.
      Log "Restaurado e conferido" guardado.
- [ ] `backup-verify` do OneDrive executado no mesmo dia (company_app_data).

**NO-GO** se qualquer item faltar.

## 2. Verificações antes do deploy

- [ ] CI verde nos 5 jobs no HEAD de cada PR (push e pull_request).
- [ ] Consultas da seção 8 de `docs/PONTO-OBRA-MIGRATION-019.md` (somente
      leitura) registradas. Esperado hoje: 2 registros, cadeia íntegra, 0
      legados, consulta 4b vazia.
- [ ] Nenhum outro PR na fila de merge para `main` durante a janela.
- [ ] Janela fora do horário de batida. As batidas não se perdem (ficam no
      aparelho e são reenviadas), mas o envio atrasa.

## 3. Sequência exata

| # | Ação | Quem | Efeito em produção | Conferir |
|---|---|---|---|---|
| 1 | Merge da **#69** 🔐 | direção | deploy: mesmo `prebuild` de hoje (reaplica 016-018); log sem dado pessoal | deploy Vercel "Ready"; um aparelho sincroniza; seção 8 igual |
| 2 | Trocar a base da #70 para `main`, CI verde, merge 🔐 | direção | 019 só como arquivo (não aplicada); API devolve 409 se a 019 estiver ativa (inofensivo sem ela) | deploy "Ready"; seção 8 igual |
| 3 | Trocar a base do PR do livro para `main`, CI verde, merge 🔐 | direção | o script antigo ganha a guarda: hoje "seguir" (comportamento igual) | log do build: `ponto-eletronico: migration aplicada.` |
| 4 | **Implantar o livro** 🔐 (seção 5) | executor + testemunha | cria `ponto_migracoes_aplicadas` e registra 016-018 **sem reexecutar** | 3 linhas `registrada_existente`; funções idênticas |
| 5 | Deploy de conferência (redeploy) | executor | o script antigo vê o livro e **não reaplica nada** | log: `livro de migrations ativo … não reaplica` |
| 6 | Backup do ponto imediatamente antes da janela | executor | só leitura | pacote e manifesto guardados |
| 7 | **Aplicar a 019** pelo livro 🔐 (seção 6) | executor + testemunha | triggers e funções da 019; linha de base da auditoria | seção 8 (antes e depois), testes da seção 7 |
| 8 | PR: `manifesto-com-019.json` vira `manifesto.json` 🔐 | executor | nenhum (só o padrão da CLI) | CLI planejar: 4 `ja_aplicada` |
| 9 | Cadastro do CNPJ pelo responsável fiscal 🔐 | RH/admin | auditado como `inscricao_preenchida_apos_nsr` (`nsr_emitidos = 2`) | auditoria; NSR 1-2 intactos |
| 10 | Ligar o livro ao `prebuild` (PR própria) 🔐 | direção | migrations futuras passam a ser aplicadas pelo livro no deploy | opcional; até lá, migration nova só pela CLI |

## 4. Evitar deploys concorrentes

- Durante a janela, **não mesclar nada** no `main` e avisar a equipe.
- Na Vercel, pausar os deploys automáticos de produção, por exemplo com um
  Ignored Build Step temporário (`exit 0`) ou desligando o auto-deploy do
  branch de produção, e reverter no fim. Os crons (`backup-create`,
  `ponto-tempo-verificar`) não aplicam migration.
- O livro usa `pg_advisory_lock` de sessão: duas execuções do livro se
  serializam (testado em Postgres real). O script antigo **não** tem trava;
  por isso não se faz deploy durante as etapas 4 e 7.

## 5. Implantação do livro de migrations (etapa 4)

```bash
node scripts/aplicar-migracoes-ponto.mjs
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --aplicar --confirmo-banco=<host>
```

O primeiro comando só **planeja** e deve listar 3× `registrar_existente`. O
segundo aplica e exige o host da URL.

- **GO:** o plano lista exatamente 3× `registrar_existente`. Qualquer
  `aplicar`, recusa ou estado parcial é **NO-GO**: parar e analisar.
- **Depois:** `select arquivo, modo from ponto_migracoes_aplicadas`, com 3
  linhas `registrada_existente`, e o md5 das funções do ponto igual ao de
  antes.

## 6. Implantação controlada da 019 (etapa 7)

```bash
node scripts/aplicar-migracoes-ponto.mjs --manifesto scripts/migracoes-ponto/manifesto-com-019.json
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --manifesto scripts/migracoes-ponto/manifesto-com-019.json --aplicar --confirmo-banco=<host>
```

- O plano deve mostrar 3× `ja_aplicada` e 1× `aplicar`. O livro aplica a 019
  numa transação com `lock_timeout` 5 s e `statement_timeout` 120 s. Se
  qualquer comando falhar, nada fica aplicado.
- **NO-GO:** plano diferente, recusa do livro, verificação prévia 4b não
  vazia, ou travas esperando mais de 5 s (há uma transação longa: esperar e
  repetir).

## 7. Testes depois da implantação

- [ ] Seção 8 de `PONTO-OBRA-MIGRATION-019.md` (depois). Os triggers e a
      auditoria existem, a `service_role` tem só SELECT na auditoria, não há
      TRUNCATE para a `service_role` e o RLS está ligado.
- [ ] md5 das tabelas do ponto **igual ao de antes** (nenhuma linha reescrita),
      exceto `ultimo_contato_em` de `ponto_dispositivos`.
- [ ] Um aparelho sincroniza e bate. O NSR seguinte sai com
      `evidencia_hora.arp.versao = 19` e `fonteGravacao = host`, e a cadeia
      recalculada continua íntegra.
- [ ] Livro planejado de novo: 4× `ja_aplicada` (sem deriva).
- [ ] Redeploy: o log do script antigo diz "livro ativo" e nada é reaplicado.

## 8. Critérios de GO/NO-GO

| Momento | GO | NO-GO |
|---|---|---|
| Antes de tudo | seção 1 completa; CI verde | sem ensaio de restauração; CI vermelha |
| Etapa 4 | plano = 3 registros | qualquer outra coisa |
| Etapa 7 | plano = 3 já + 1 aplicar; 4b vazia; backup do dia restaurado | qualquer recusa; backup não conferido |
| Encerramento | seção 7 inteira OK | qualquer divergência de md5 em tabela fiscal; cadeia quebrada |

## 9. Contingência (sem destruir registros)

- **Deploy com falha (build):** a Vercel mantém a versão anterior no ar. A
  guarda faz o build **falhar** se encontrar a 019 sem livro, o que é
  proposital. Corrigir a causa e repetir.
- **Aplicação da 019 falhou:** transação única, nada ficou. Ler o erro e
  repetir na próxima janela.
- **Problema depois da 019 aplicada:**
  - Preferência: **correção para frente** (migration 020 pelo livro).
  - Último recurso: `PGOPTIONS='-c lock_timeout=5s' psql -1 -v ON_ERROR_STOP=1 -f migrations/019_ponto_integridade_fiscal.down.sql`.
    O `down` devolve as 3 funções da 016/017 e **não apaga nenhum registro**;
    a auditoria fica. Depois disso, o livro acusa **deriva** e recusa seguir
    até uma decisão: registrar a reversão numa migration 020.
- **Dano em dado (não esperado: nada da 019 reescreve linha):** restaurar o
  backup num ambiente **separado**, comparar e decidir. Nunca restaurar por
  cima de produção que tenha registros fiscais mais novos.
- **Jamais:** apagar, renumerar ou editar registro fiscal; `TRUNCATE`;
  desligar trigger em produção.

## 10. Evidências de encerramento (guardar)

- Links dos merges e dos deploys (IDs da Vercel) de cada etapa.
- Saída da CLI do livro (planejar e aplicar) nas etapas 4 e 7, sem a URL.
- Resultado das consultas da seção 8, antes e depois, com o md5 das tabelas.
- Manifestos dos backups do ponto e log da restauração conferida.
- `select * from ponto_migracoes_aplicadas` ao final.
- Registro da autorização de cada etapa 🔐 e da aceitação dos riscos
  residuais (Fase 01, seção 15).
