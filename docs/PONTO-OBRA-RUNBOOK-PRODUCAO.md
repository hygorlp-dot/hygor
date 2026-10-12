# Ponto de Obra — runbook de produção (Fase 01, livro de migrations e 019)

Data: 11/10/2026. **Nada aqui foi executado em produção.** Cada etapa marcada
🔐 exige autorização expressa da direção, registrada (PR, ata ou mensagem com
data). O executor nunca aceita risco em nome da direção. Este runbook não
declara conformidade REP-P nem recuperação de produção demonstrada.

PRs envolvidas (empilhadas, todas abertas):
- [#69](https://github.com/hygorlp-dot/hygor/pull/69): Fase 01 (base `main`).
- [#70](https://github.com/hygorlp-dot/hygor/pull/70): migration 019 preliminar (rascunho; base `#69`).
- [#71](https://github.com/hygorlp-dot/hygor/pull/71): livro de migrations, gate de deploy, backup do ponto e este runbook (rascunho; base `#70`).

**Regra que governa a ordem:** a 019 só pode ser aplicada **depois** que o
livro de migrations estiver implantado. Sem ele, o deploy seguinte reaplica
016/017 por cima e reverte a 019 em silêncio (revisão independente, P1-1).
Desde a #71, o próprio deploy recusa esse caso (seção 3), mas a ordem
continua obrigatória.

## 1. Estratégia do livro de migrations

- Tabela `public.ponto_migracoes_aplicadas`: cada arquivo do manifesto é
  aplicado **uma vez**, com o SHA-256 do conteúdo (LF normalizado), quem
  aplicou, quando, a duração e a validação dos objetos.
- 016–018, que já estão em produção, são **registradas sem reexecução**
  (`registrada_existente`), depois de validar que os objetos existem por
  inteiro. Um estado parcial é recusado.
- **Implantação atômica:** o plano é feito antes de qualquer escrita. A
  criação do livro e o registro de 016–018 acontecem numa **única
  transação**, que termina conferindo a integridade fiscal da versão 018. Uma
  recusa, uma queda no meio ou um desvio de permissão em produção desfazem
  tudo: o livro não nasce vazio ou pela metade, e o deploy continua como hoje
  (GO/seguir).
- Cada migration roda numa transação própria, com `lock_timeout` 5 s e
  `statement_timeout` 120 s. A **integridade fiscal da versão nova é conferida
  dentro da mesma transação** (seção 4); se não fechar, tudo é desfeito.
- **Deriva:** arquivo aplicado com SHA-256 diferente, objeto registrado que
  sumiu ou foi trocado, ou migration presente sem registro: o livro recusa e
  **não corrige nada**.
- **Trava com prazo:** `pg_try_advisory_lock` em laço, até o prazo (60 s na
  CLI, 120 s no deploy), e depois erro explícito `TRAVA_EXPIROU` sem alterar
  nada. A trava é de sessão: se a conexão cair, o Postgres a solta; a
  liberação nunca lança erro. O deploy e a CLI usam a **mesma** trava.
  A trava é reentrante na mesma sessão e `liberarTrava` solta **todas** as
  camadas: quem ligar o livro ao deploy (etapa 12) não pode chamar `aplicar`
  de dentro de um trecho que já segura a trava, ou a perderia no meio.
- **Observabilidade sem dado sensível:** eventos `trava_obtida`,
  `trava_expirou`, `migration`, `trava_liberada` com arquivo, ação, duração e
  tentativas; nunca URL, chave, CPF ou hash fiscal.

## 2. Requisitos da 019

1. Livro implantado e o gate dando **GO** com versão fiscal **018**.
2. Backup do ponto do dia com qualidade `consistente`, restaurado num banco
   descartável com estado **`completa`**
   (`docs/PONTO-OBRA-BACKUP-RESTAURACAO.md`).
3. Backup da plataforma Supabase confirmado e ensaiado.
4. Verificação prévia 4b de `docs/PONTO-OBRA-MIGRATION-019.md` vazia e as
   consultas da seção 8 registradas.
5. CI verde nos 5 jobs no HEAD de cada PR.
6. Janela sem deploy concorrente (seção 6).

## 3. Gate de deploy (o que o deploy faz sozinho)

A cada deploy de produção, `scripts/apply-ponto-eletronico.mjs`, numa conexão
reservada, registra no log que está aguardando a trava (até 120 s), obtém-na e
chama o gate (`verificarGate`, somente leitura):

| Resultado | Situação | O deploy |
|---|---|---|
| **GO** (`seguir`) | sem livro e sem 019: comportamento anterior | reaplica 016–018, como hoje |
| **GO** (`pular`) | livro íntegro; versão fiscal conferida (objetos, triggers, permissões, funções) | não reaplica nada |
| **NO-GO** (`bloquear`) | deriva comprovada: SHA-256 do arquivo mudou, objeto registrado ausente, trigger ausente ou desabilitado, privilégio ampliado, função da 019 substituída | **o build falha**; a versão anterior segue no ar; nada é alterado |
| **INTERVENÇÃO HUMANA** (`bloquear`) | histórico com lacuna, migration desconhecida no livro, migration presente sem registro, 019 sem livro, arquivo de migration ausente | **o build falha**; exige análise de uma pessoa |

O mesmo gate pode ser consultado à mão, sem alterar nada:

```bash
node scripts/aplicar-migracoes-ponto.mjs --verificar
```

Códigos de saída: 0 = GO, 2 = NO-GO, 3 = INTERVENÇÃO HUMANA, 1 = erro de
execução.

## 4. Verificações de integridade (o que o gate confere)

Para a versão fiscal registrada (`verificarIntegridadeFiscal`):

- RLS ligado nas tabelas do ponto.
- Triggers de imutabilidade e de exclusividade da ARP **presentes e
  habilitados**.
- **Impressão digital da versão** (`scripts/migracoes-ponto/impressoes.json`,
  gerada aplicando as próprias migrations num banco limpo e conferida por
  teste): MD5 do corpo, `SECURITY DEFINER` e configuração de **toda** função
  `ponto_*`, incluindo as de trigger; tabela, função e eventos de **todo**
  trigger das tabelas `ponto_*`; trigger a mais é violação. Isso pega, por
  exemplo, a função de imutabilidade reescrita para deixar passar o UPDATE,
  mesmo com o nome e o trigger intactos, ou o trigger religado numa função
  homônima de outro schema. Consequência: **não criar** webhook de banco,
  auditoria ou qualquer outro trigger nas tabelas `ponto_*` fora das
  migrations; o gate dá NO-GO e, como ele está no `prebuild`, trava o deploy
  de todo o ERP.
- `service_role` **sem** escrita em eventos, registros e contadores (017+),
  sem `UPDATE`/`DELETE`/`TRUNCATE` em verificações de tempo, sem escrita em
  apropriações (018+), sem `TRUNCATE` em nenhuma tabela do ponto, sem escrita
  em marcações, sem `DELETE` de aparelhos e sem escrita na auditoria de
  estabelecimentos (019).
- `anon` e `authenticated` sem nenhum privilégio nas tabelas do ponto e sem
  `EXECUTE` nas funções protegidas.
- Funções protegidas `SECURITY DEFINER` e, na 019, com
  `search_path = pg_catalog, public, pg_temp`.
- As consultas de privilégio são agregadas (duas idas ao banco), para o gate
  não atrasar o build com o banco noutra região.
- SHA-256 de cada arquivo registrado igual ao arquivo deste deploy.

## 5. Sequência exata

**Antes da etapa 3** (somente leitura, autorizado): `show timezone` e
`select rolname, rolconfig from pg_roles where rolname in ('authenticator','service_role')`.
Esperado: UTC. A #71 normaliza o caminho das fotos para a data UTC; se o
banco ou o PostgREST estiverem noutro fuso, fotos antigas gravadas perto da
meia-noite ficariam noutro caminho (o link da foto daria 404). Fuso diferente
de UTC é **NO-GO** para a etapa 3 até decisão.

| # | Ação | Quem | Efeito em produção | Conferir |
|---|---|---|---|---|
| 1 | Merge da **#69** 🔐 | direção | deploy: mesmo `prebuild` de hoje (reaplica 016–018) | deploy "Ready"; um aparelho sincroniza; seção 8 da 019 igual |
| 2 | Trocar a base da #70 para `main`, CI verde, merge 🔐 | direção | 019 só como arquivo (não aplicada) | deploy "Ready"; seção 8 igual |
| 3 | Trocar a base da #71 para `main`, CI verde, merge 🔐 | direção | o deploy ganha trava e gate: hoje **GO / seguir** (comportamento igual) | log do build: `gate GO` e `migration aplicada.` |
| 4 | Backup do ponto + restauração `completa` em descartável 🔐 | executor | só leitura | manifesto `consistente`; log `RECUPERAÇÃO COMPLETA` |
| 5 | **Implantar o livro** 🔐 (seção 7) | executor + testemunha | cria o livro e registra 016–018 **sem reexecutar** | 3 × `registrada_existente`; `--verificar` = GO 018 |
| 6 | Deploy de conferência (redeploy) | executor | o deploy vê o livro e **não reaplica nada** | log: `gate GO (versão fiscal 018)` |
| 7 | Backup do ponto imediatamente antes da janela | executor | só leitura | saída 0; pacote e manifesto guardados |
| 8 | **Aplicar a 019** pelo livro 🔐 (seção 8) | executor + testemunha | triggers e funções da 019; linha de base da auditoria | `--verificar` = GO 019; seção 9 |
| 9 | PR: `manifesto-com-019.json` vira `manifesto.json` 🔐 | executor | nenhum (só o padrão da CLI) | plano: 4 × `ja_aplicada` |
| 10 | Redeploy de conferência | executor | nada reaplicado | log: `gate GO (versão fiscal 019)`; md5 das funções igual |
| 11 | Cadastro do CNPJ pelo responsável fiscal 🔐 | RH/admin | auditado como `inscricao_preenchida_apos_nsr` | auditoria; NSR anteriores intactos |
| 12 | Ligar o livro ao `prebuild` (PR própria) 🔐 | direção | migrations futuras pelo livro no deploy | opcional; até lá, migration nova só pela CLI |

## 6. Deploys concorrentes

- Deploy e CLI disputam a **mesma trava**: um espera o outro até o prazo e,
  passado o prazo, falha sem alterar nada (testado em Postgres real com duas
  conexões e com o detentor derrubado por `pg_terminate_backend`).
- Mesmo assim, durante as etapas 5 e 8: **não mesclar nada** no `main`, avisar
  a equipe e pausar o auto-deploy de produção na Vercel (Ignored Build Step
  temporário com `exit 0`, revertido no fim). Os crons (`backup-create`,
  `ponto-tempo-verificar`) não aplicam migration.

## 7. Implantação do livro (etapa 5)

```bash
node scripts/aplicar-migracoes-ponto.mjs
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --aplicar --confirmo-banco=<usuário@host:porta/banco>
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --verificar
```

- **GO:** o plano lista exatamente 3 × `registrar_existente`, a aplicação
  termina e `--verificar` dá GO com versão fiscal 018.
- **NO-GO:** qualquer `aplicar`, recusa, estado parcial, `TRAVA_EXPIROU`
  repetido ou gate diferente de GO. Parar e analisar.
- **Depois:** `select arquivo, modo from ponto_migracoes_aplicadas` com 3
  linhas `registrada_existente` e o md5 das funções do ponto igual ao de antes.

## 8. Implantação controlada da 019 (etapa 8)

```bash
node scripts/aplicar-migracoes-ponto.mjs --manifesto scripts/migracoes-ponto/manifesto-com-019.json
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --manifesto scripts/migracoes-ponto/manifesto-com-019.json --aplicar --confirmo-banco=<usuário@host:porta/banco>
```
```bash
node scripts/aplicar-migracoes-ponto.mjs --verificar
```

- Durante a transação da 019 (alguns segundos), as batidas que chegarem
  **esperam** o fim dela: os aparelhos guardam e reenviam, mas a janela deve
  ser fora do horário de batida.
- O plano deve mostrar 3 × `ja_aplicada` e 1 × `aplicar`. A 019 roda numa
  transação com `lock_timeout` 5 s e `statement_timeout` 120 s e só é gravada
  se a validação de objetos **e** a integridade fiscal da versão 019 fecharem.
  Se qualquer coisa falhar, nada fica aplicado.
- **NO-GO:** plano diferente, recusa do livro, verificação prévia 4b não
  vazia, travas esperando mais de 5 s (há uma transação longa: esperar e
  repetir), ou `--verificar` diferente de GO 019.

## 9. Testes depois da implantação

- [ ] `--verificar`: GO, versão fiscal 019.
- [ ] Seção 8 de `PONTO-OBRA-MIGRATION-019.md` (depois): triggers e auditoria
      presentes, `service_role` só com SELECT na auditoria, sem `TRUNCATE`,
      RLS ligado.
- [ ] md5 das tabelas do ponto **igual ao de antes** (nenhuma linha
      reescrita), exceto `ultimo_contato_em` de `ponto_dispositivos`.
- [ ] Um aparelho sincroniza e bate. O NSR seguinte sai com
      `evidencia_hora.arp.versao = 19`, e a cadeia recalculada continua íntegra.
- [ ] Redeploy: log `gate GO (versão fiscal 019)`, nada reaplicado.

## 10. Critérios de GO/NO-GO

| Momento | GO | NO-GO |
|---|---|---|
| Antes de tudo | seção 2 completa; CI verde | sem restauração `completa`; backup não `consistente`; CI vermelha |
| Etapa 3 (merge #71) | log do build com `gate GO` | build falhou no gate: analisar antes de repetir |
| Etapa 5 (livro) | plano = 3 registros; `--verificar` GO 018 | qualquer outra coisa |
| Etapa 8 (019) | plano = 3 já + 1 aplicar; 4b vazia; backup do dia restaurado `completa`; `--verificar` GO 019 | qualquer recusa; backup não conferido; gate ≠ GO |
| Encerramento | seção 9 inteira OK | divergência de md5 em tabela fiscal; cadeia quebrada; gate ≠ GO |

`INTERVENÇÃO HUMANA` em qualquer momento é tratado como NO-GO até que uma
pessoa analise e a direção decida por escrito.

## 11. Contingência (sem destruir registros)

- **Build falhou no gate:** a Vercel mantém a versão anterior no ar. Ler os
  motivos no log (`gate NO-GO …` ou `INTERVENCAO_HUMANA …`) e rodar
  `--verificar` para o diagnóstico completo. **Não** desligar o gate para
  passar o deploy.
- **`TRAVA_EXPIROU`:** outra execução (deploy ou CLI) está em andamento.
  Nada foi alterado; esperar e repetir. Se persistir, consultar `pg_locks`
  (`locktype = 'advisory'`) e identificar a sessão, sem derrubá-la às cegas.
- **Aplicação da 019 falhou:** transação única, nada ficou. Ler o erro e
  repetir na próxima janela.
- **Proibido depois da etapa 8:** `git revert` do merge da #71 (ou de
  qualquer commit anterior a ela) e "Redeploy" na Vercel de um build anterior
  à #71. O build antigo reaplicaria 016/017 **sem gate**, sobrescrevendo em
  silêncio as funções da 019. Para voltar uma versão do app, usar o **Instant
  Rollback** da Vercel, que não refaz o build nem roda o `prebuild`.
- **Problema depois da 019 aplicada:**
  - preferência: **correção para frente** (migration 020 pelo livro);
  - último recurso: `PGOPTIONS='-c lock_timeout=5s' psql -1 -v ON_ERROR_STOP=1 -f migrations/019_ponto_integridade_fiscal.down.sql`.
    O `down` devolve as funções da 016/017 e **não apaga nenhum registro**; a
    auditoria fica. Depois disso, o gate dá **NO-GO** (019 registrada, objetos
    diferentes) e **todo deploy do ERP fica bloqueado** (o gate está no
    `prebuild` comum), assim como a CLI do livro. A saída hoje é reaplicar a
    019 (`up`), que volta ao estado registrado. Não existe modo "revertida"
    no livro nem bypass do gate: isso é decisão pendente da direção (seção 13).
- **Dano em dado (não esperado: nada da 019 reescreve linha):** restaurar o
  backup num ambiente **separado**, comparar e decidir. Nunca restaurar por
  cima de produção que tenha registros fiscais mais novos.
- **Jamais:** apagar, renumerar ou editar registro fiscal; `TRUNCATE`;
  desligar trigger em produção; editar o livro à mão para "passar" o gate.

## 12. Evidências de encerramento (guardar)

- Links dos merges e dos deploys (IDs da Vercel) de cada etapa, com a linha
  `gate …` do log.
- Saída da CLI do livro (planejar, aplicar e `--verificar`) nas etapas 5 e 8,
  sem a URL.
- Resultado das consultas da seção 8 da 019, antes e depois, com o md5 das
  tabelas.
- Manifestos dos backups do ponto e logs das restaurações `completa`.
- `select * from ponto_migracoes_aplicadas` ao final.
- Registro da autorização de cada etapa 🔐 e da decisão da direção sobre os
  riscos residuais (Fase 01, seção 15; 019, seção 11; backup, seção 7).

## 13. Decisões da direção

1. Autorizar cada merge (#69, #70, #71) e cada janela (livro, 019).
2. Autorizar a exportação de dados reais para o backup e o ensaio de
   restauração (`docs/PONTO-OBRA-BACKUP-RESTAURACAO.md`, seção 11).
3. Decidir sobre os riscos residuais registrados. Eles **não estão aceitos**
   enquanto a direção não decidir por escrito.
4. Decidir quando ligar o livro ao `prebuild` (etapa 12).
5. Decidir a saída de contingência depois de um `down` da 019 (seção 11): um
   modo "revertida" no livro, um bypass auditado do gate, ou aceitar que o ERP
   fica sem deploy até reaplicar a 019. O gate do ponto está no caminho de
   deploy de todo o ERP.
6. Definir metas de RPO/RTO, a frequência do backup do ponto e o ensaio
   periódico de restauração.
