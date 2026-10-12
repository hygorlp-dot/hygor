# Ponto de Obra — Migration 019: integridade fiscal da ARP

Situação: **PRELIMINAR — não aplicada em nenhum banco real e fora do deploy
automático.** Data: 11/10/2026. Arquivos: `migrations/019_ponto_integridade_fiscal.up.sql`
e `.down.sql`. Origem: revisão independente de banco da Fase 01
(`docs/PONTO-OBRA-FASE-01-ESTABILIZACAO.md`, itens 20-24).

> A 019 **não está** em `scripts/apply-ponto-eletronico.mjs` (há um teste que
> falha se ela for incluída). O `prebuild` do deploy de produção roda esse
> script; a função `api/data.js` empacota `migrations/*.up.sql`, mas só
> executa em tempo de execução as migrations 001-003 do financeiro. Mesclar
> esta PR, portanto, **não aplica a 019**. Aplicar exige autorização expressa
> e o procedimento da seção 9.

## 1. Situação dos dados reais (somente leitura, 11/10/2026)

Consulta pelo PostgREST (GET/HEAD) e recálculo da cadeia em JavaScript, sem
imprimir CPF, inscrição, hash ou dado biométrico.

| Item | Resultado |
|---|---|
| Estabelecimentos | 1, ativo, fuso America/Recife, **sem inscrição** (nem CNPJ/CPF nem CNO/CAEPF/CEI), 1 obra vinculada, nunca alterado |
| Contador | `ultimo_nsr = 2` |
| Registros fiscais | NSR 1 e 2, versão de hash 1, mesmo `gravado_em` (21:52:40,550 UTC, 01/10/2026) |
| Cadeia fiscal recalculada | **íntegra**; contador aponta para o último registro |
| Eventos formato 2 | 2, do mesmo aparelho, sequência local 1 e 2 contínua, topo do aparelho confere; 1 batida pelo encarregado e 1 facial |
| Marcações legadas (formato 1) | **0** → a bifurcação (A) não ocorreu |
| Hora | `gravado_em` não decresce; marcação antes da gravação; `gravado_em` **66 ms antes** do `recebido_em` do banco (a hora é lida no host antes da transação: causa raiz B em ação, sem dano aqui); evidência de hora `nao_verificada` (o NTP ainda não tinha medição) |
| Aparelhos | 2 ativos: 1 com os 2 eventos (estabelecimento fixado); 1 pareado 5 h antes, sem nenhum evento nem estabelecimento |

**Impacto de cadastrar a inscrição depois:** o hash fiscal cobre o
identificador do estabelecimento, não a inscrição. Preencher o CNPJ não quebra
a cadeia nem muda os registros. Mas, na Fase 02 (AFD), os NSR 1 e 2 sairão sob
um CNPJ que não existia no cadastro quando foram emitidos. Por isso a 019
registra o preenchimento como evento auditado (`inscricao_preenchida_apos_nsr`,
com `nsr_emitidos = 2`) e a linha de base do estado atual (`linha_de_base`).

## 2. A. Integridade das sequências legada e atual

**Causa raiz.** `ponto_registrar_marcacoes` (016) só confere a semente legada
(`ultimo_nsr`/`ultimo_hash` do aparelho). Ela não sabe que o aparelho já tem
eventos formato 2. Se um legado chegar depois de um evento formato 2, os dois
caminhos aceitam um registro "3" apontando para o mesmo hash, e a cadeia
local bifurca. Há um agravante: `ponto_arp_registrar` (017) grava o topo da
cadeia local mesmo quando o lote não insere nada (ex.: todo
`aguardando_estabelecimento`), e a semente fica velha.

**Mudança.**
- `ponto_registrar_marcacoes`: com evento formato 2 do aparelho
  (`exists ponto_eventos`), recusa legado **novo**, mantendo o reenvio do já
  aceito idempotente (o app confirma pelo topo). Nada é apagado: o legado
  recusado fica no aparelho, pendente, para resolução manual.
- `ponto_arp_registrar`: só grava `ultima_sequencia_local`/`ultimo_hash_local`
  se algum evento entrou.
- As duas travam o aparelho com `FOR UPDATE` primeiro, então legado e formato
  2 do mesmo aparelho ficam serializados (teste em Postgres real).

## 3. B. Tempo fiscal e NSR

**Causa raiz.** `gravado_em` vem de `p_hora.serverTime`, lido no host
(Vercel) **antes** da RPC. Dois aparelhos disputando o contador podem
inverter a ordem: quem leu a hora depois pega o contador antes. Instâncias
com relógios diferentes produzem o mesmo efeito. Além disso, qualquer texto
convertível em data era aceito e entrava no hash. Em produção, o NSR 1 ficou
com `gravado_em` 66 ms antes do `recebido_em` do próprio banco.

**Primeira versão rejeitada (auditoria de 11/10).** `greatest(hora do host, NSR anterior)`
resolvia a inversão, mas tinha **efeito catraca**: uma única gravação com o
host adiantado (+1 dia) prendia todos os NSR seguintes nessa hora futura até
o relógio alcançá-la. Era uma substituição silenciosa e em cascata da hora
fiscal.

**Regra adotada.** Tudo sob a trava do contador. Tudo registrado em
`evidencia_hora.arp`, fora do hash, ao lado da evidência original da fonte
de hora, que é preservada inteira.

| Passo | Regra | Marca na evidência |
|---|---|---|
| Árbitro | relógio do banco (`clock_timestamp()`), lido dentro da transação | `relogioBanco` |
| Tolerância | `toleranciaMs` da política da fonte de hora (30 s), limitada a 1 s..5 min; inválida → 30 s | `toleranciaMs` |
| Fonte | hora do host, se ISO 8601 UTC **e** a no máximo uma tolerância do banco | `fonteGravacao: host` |
| | host fora da tolerância (adiantado ou atrasado) | `fonteGravacao: banco:host_divergente` + `horaHost` + `diferencaHostBancoMs` |
| | `serverTime` ausente ou fora do formato | `fonteGravacao: banco:hora_do_host_invalida` |
| Monotonia | fonte atrás do NSR anterior por **até** uma tolerância → hora do anterior | `ajuste: monotonia` + `gravadoAnterior` |
| | atrás por **mais** que uma tolerância (o anterior está no futuro, ex.: gravado antes da 019) → hora verdadeira, sem catraca | `ajuste: regressao_registro_anterior_anomalo` + `gravadoAnterior` |

**Efeitos e limites:**
- A hora gravada fica sempre a no máximo duas tolerâncias (60 s) do relógio
  do banco.
- Ela não decresce com o NSR, exceto quando o registro anterior já era
  anômalo, e isso fica marcado.
- O estado da fonte (`verificada`, `dentro_da_tolerancia`,
  `fora_da_tolerancia`, `verificacao_vencida`, `nao_verificada`) **não
  bloqueia** a gravação: ele é evidência, e a Portaria veda restringir a
  marcação.
- O texto canônico do hash fiscal não muda (versão 1).
- Os registros anteriores não são tocados.

**Premissa nova (decisão da direção, seção 11).** O relógio do banco
(Supabase) passa a ser o árbitro de plausibilidade. Ele não é medido contra a
HLB por nós; a proposta é estender o cron `ponto-tempo-verificar` para
registrar também `now()` do banco contra o NTP.br. Com o host e o banco
corretos, a fonte da hora fiscal continua sendo o host verificado.

**Auditoria (testes):**

| Caso | Onde | Resultado |
|---|---|---|
| Host normal | PGlite | hora do host, formato ISO do JS, evidência completa |
| Host atrasado além da tolerância (−10 min) | PGlite | relógio do banco, `banco:host_divergente` |
| Host adiantado / hora no futuro (+1 dia) | PGlite e Postgres real (4 aparelhos concorrentes) | não vira hora fiscal; os NSR seguintes não são arrastados |
| Instâncias com relógios diferentes (+4 s × 0 s) | PGlite e Postgres real (transação aberta + espera no contador) | NSR seguinte com a hora do anterior, `ajuste: monotonia` |
| 6 aparelhos com relógios espalhados ±5 s | Postgres real | hora nunca decresce com o NSR; cadeia íntegra |
| NSR anterior anômalo (+2 h) | PGlite | próximo grava a hora verdadeira, `regressao_registro_anterior_anomalo` |
| `serverTime` inválido ou ausente | PGlite | relógio do banco, `banco:hora_do_host_invalida` |
| Referência vencida / fora da tolerância HLB / NTP sem medição | PGlite | gravação não bloqueada; `status` preservado na evidência |
| Limites da tolerância (1 s, 5 min, inválida) | PGlite | 1000 / 300000 / 30000 ms |

## 4. C. Identificação fiscal do estabelecimento

**Causa raiz.** O hash fiscal cobre o `id` do estabelecimento, não a
inscrição. A API (`ponto-estabelecimento-salvar`, papel fiscal) faz `UPDATE`
livre, e não há trilha além de `atualizado_por`/`atualizado_em`.

**Mudança.**
- Trigger `ponto_estabelecimentos_protegido`, com NSR já emitido:
  - inscrição (tipo + número), CNO, CAEPF e CEI só podem passar de **vazio
    para valor, uma vez**; nunca trocadas nem apagadas;
  - o fuso não muda;
  - o preenchimento depois do NSR exige `atualizado_por`;
  - o estabelecimento não é apagado.
- `ponto_estabelecimentos_auditoria`: append-only (sem UPDATE, DELETE nem
  TRUNCATE; INSERT só pelo trigger). Guarda ação, campos, antes, depois,
  `nsr_emitidos` e responsável. É preenchida automaticamente em toda criação e
  alteração, e recebe uma `linha_de_base` por estabelecimento quando a 019 é
  aplicada.
- Concorrência: a ARP lê o estabelecimento com `FOR SHARE` (ordem de travas
  aparelho → estabelecimento → contador). A troca de inscrição e a emissão de
  NSR ficam serializadas. Teste em Postgres real, nas duas ordens.
- API: a recusa do banco vira **409 com a mensagem** (antes seria 500).

## 5. D. Fortalecimento complementar

| Item | Mudança | Por quê |
|---|---|---|
| `ponto_estabelecimentos_auditoria` | RLS habilitado; `service_role` só com SELECT (sem INSERT nem na sequência); INSERT só pelo trigger (dono) | sem isso, os privilégios padrão do Supabase permitiriam linha forjada com a marca de sessão (revisão, P2-1) |
| `ponto_marcacoes` | trigger contra TRUNCATE | TRUNCATE ignora os triggers de linha da 016 |
| `ponto_dispositivos` | semente legada só pela função legada e sem voltar; `obra_id`/`token_hash`/`id` imutáveis; revogado não volta a ativo | a 017 só protegia as colunas novas; a API nunca altera essas colunas |
| `service_role` | sem TRUNCATE em todas as tabelas do ponto; sem DELETE em `ponto_marcacoes`/`ponto_dispositivos`; sem escrita direta em `ponto_marcacoes` | a 016 não revogava os privilégios padrão do Supabase; a API não usa nenhum deles |
| Marcas de sessão | `ponto.arp_ingresso`/`ponto.legado_ingresso` desligadas ao fim das funções | na mesma transação, depois da RPC, ninguém insere direto |
| `search_path` | `pg_catalog, public, pg_temp` nas funções security definer, incluindo as da 018 (por `ALTER FUNCTION`, sem recriar o corpo) | endurecimento padrão |
| `ponto_arp_texto_fiscal` | sem EXECUTE para public/anon/authenticated | higiene: só a ARP usa |
| Comparações | `is distinct from` onde havia `<>` | NULL deixava de virar `cadeia_quebrada` e virava exceção do lote inteiro |

**Não incluído (P3, motivo):**
- trava NULL em `ponto_apropriacao_salvar`: a API já valida, e corrigir
  exigiria recriar o corpo da 018;
- FK composta `ponto_arp_registros` × `ponto_eventos`: só a ARP escreve;
- corrida no vínculo obra → estabelecimento: baixo volume, tratada no
  servidor;
- guarda no `016.down`: só se aplica a reversão manual;
- bypass pelo dono do banco (`session_replication_role`, `DISABLE TRIGGER`):
  inerente ao papel. A mitigação é verificar a cadeia periodicamente e ancorar
  o último hash fora do banco (proposta para a Fase 02).

## 6. Compatibilidade com 016-018

- Mesmas assinaturas e retornos de `ponto_arp_registrar` e
  `ponto_registrar_marcacoes`, os mesmos status e o mesmo texto do hash
  fiscal. Nenhum `ALTER TABLE` em tabela existente, nenhuma linha reescrita.
- Idempotente (aplicada duas vezes, sem efeito extra) e reversível: o `down`
  devolve as **três funções recriadas** (`ponto_arp_registrar`,
  `ponto_registrar_marcacoes`, `ponto_dispositivo_protegido`) idênticas às da
  016/017, conferido por md5 do `pg_get_functiondef`. Não revertidos, de
  propósito: os REVOKE e o `search_path` endurecido de `ponto_arp_texto_fiscal`
  e das funções da 018. Com linhas, a auditoria fica; vazia, sai, e a
  reversão completa 019 → 018 → 017 funciona num banco limpo.
- O app não muda. Mudança de comportamento visível: a sincronização pode
  receber o erro novo do legado (só em aparelho com legado pendente depois do
  formato 2 — hoje nenhum) e a tela do estabelecimento recebe 409.

## 7. Testes

- `server/ponto-eletronico/arp/arp-migration-019.pglite.test.js` (21, PGlite):
  A, B, C, D, aplicação sobre dados existentes sem reescrever nenhuma linha
  (md5 de todas as tabelas antes e depois), linha de base única, `down` e
  reaplicação, e a trava "019 fora do deploy".
- `server/ponto-eletronico/arp/arp-019-concorrencia.pg.test.js` (6, Postgres
  16 real, job `rep-p-arp-postgres`, com trava de ≥ 6 aprovados): cada caso
  segura uma transação aberta numa conexão e tenta a concorrente com
  `lock_timeout`:
  - hora invertida entre aparelhos;
  - 6 aparelhos com relógios desencontrados;
  - CNPJ × NSR nas duas ordens;
  - legado × formato 2.
- **Regressão dos contratos da ARP:** a suíte inteira do ponto (app, regras e
  servidor) roda **também** com o banco na 019 (`PONTO_MIGRACOES_ATE=019`,
  passo novo do job `migration-contracts`). Inclui idempotência, timeout
  depois do commit, NSR por estabelecimento, funcionário global e
  apropriação.
- `handler-arp.pglite.test.js`: 409 ao trocar o CNPJ depois do NSR (roda só
  com a 019).

## 8. Verificações antes e depois (somente leitura)

Rodar como `postgres` (SQL Editor do Supabase ou `psql`), antes e logo depois,
e comparar.

```sql
-- 1. Contagens
select 'eventos' t, count(*) from ponto_eventos union all
select 'registros', count(*) from ponto_arp_registros union all
select 'marcacoes', count(*) from ponto_marcacoes union all
select 'estabelecimentos', count(*) from ponto_estabelecimentos;
-- 2. Topo de cada cadeia fiscal (o hash não precisa ser exibido: compare o md5)
select estabelecimento_id, ultimo_nsr, md5(ultimo_hash_fiscal) from ponto_arp_contadores order by 1;
select estabelecimento_id, count(*), max(nsr), md5(string_agg(fiscal_hash, '' order by nsr)) from ponto_arp_registros group by 1 order by 1;
-- 3. Bifurcação legado × formato 2 (deve vir vazia)
select m.dispositivo_id, m.nsr from ponto_marcacoes m
  join ponto_eventos e on e.company_id = m.company_id and e.dispositivo_id = m.dispositivo_id and e.local_sequence = m.nsr;
-- 4. Hora fiscal em ordem (vazia; depois da 019 pode trazer linha cuja
--    evidencia_hora->'arp'->>'ajuste' = 'regressao_registro_anterior_anomalo')
select * from (select estabelecimento_id, nsr, gravado_em, lag(gravado_em) over (partition by estabelecimento_id order by nsr) ant
  from ponto_arp_registros) x where gravado_em < ant;
-- 4b. Semente local da 017 sem evento (deve vir vazia; se vier, a 019 trata
--     o aparelho como já no formato 2 e recusa legado novo)
select id from ponto_dispositivos d where ultima_sequencia_local > 0
  and not exists (select 1 from ponto_eventos e where e.company_id = d.company_id and e.dispositivo_id = d.id);
-- 5. Estado da inscrição (sem exibir o número)
select id, tipo_inscricao, numero_inscricao is not null tem_numero, timezone from ponto_estabelecimentos;
-- 6. md5 de cada tabela do ponto (deve ser IGUAL antes e depois)
select 'ponto_eventos', md5(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text)) from ponto_eventos x
union all select 'ponto_arp_registros', md5(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text)) from ponto_arp_registros x
union all select 'ponto_dispositivos', md5(string_agg(to_jsonb(x)::text, '|' order by to_jsonb(x)::text)) from ponto_dispositivos x;
```

Só depois:

```sql
select tgname from pg_trigger where tgname in ('ponto_estabelecimentos_protegido','ponto_estabelecimentos_auditar','ponto_marcacoes_no_truncate');
select acao, nsr_emitidos, responsavel from ponto_estabelecimentos_auditoria;   -- 1 linha_de_base por estabelecimento
select proname, proconfig from pg_proc where proname in ('ponto_arp_registrar','ponto_registrar_marcacoes');
select privilege_type, table_name from information_schema.role_table_grants
 where grantee = 'service_role' and table_name like 'ponto%' and privilege_type = 'TRUNCATE';   -- vazio
select privilege_type from information_schema.role_table_grants
 where grantee = 'service_role' and table_name = 'ponto_estabelecimentos_auditoria';            -- só SELECT
select relrowsecurity from pg_class where relname = 'ponto_estabelecimentos_auditoria';           -- true
```

O md5 de `ponto_dispositivos` muda se algum aparelho sincronizar durante a
janela (`ultimo_contato_em`). Compare excluindo essa coluna, ou faça a janela
com os aparelhos sem rede.

## 9. Backup, implantação e contingência

**Backup (pré-requisito).**
1. Confirmar no painel do Supabase backup diário ou PITR ativo e a data da
   última cópia. O backup do ARCD no OneDrive **não cobre** as tabelas do
   ponto (só `company_app_data`).
2. Exportação lógica imediatamente antes:
   `pg_dump --data-only --table='public.ponto_*'` mais o esquema
   (`--schema-only`), guardada cifrada fora do Supabase. Dado sensível: CPF e
   vetor facial.
3. Registrar o resultado das consultas da seção 8.

**Implantação (escolher uma e autorizar):**
- **Opção 1 (recomendada): pelo livro de migrations, numa janela.**
  `node scripts/aplicar-migracoes-ponto.mjs --manifesto scripts/migracoes-ponto/manifesto-com-019.json --aplicar --confirmo-banco=<host>`.
  Ele aplica a 019 numa transação com `lock_timeout` 5 s e `statement_timeout`
  120 s e a registra. Sem o livro, o equivalente é
  `PGOPTIONS='-c lock_timeout=5s -c statement_timeout=120s' psql -1 -v ON_ERROR_STOP=1 -f migrations/019_ponto_integridade_fiscal.up.sql`.
  **Nunca sem o livro implantado antes:** o deploy seguinte reaplicaria a
  016/017 por cima (revisão independente, P1-1). Ver
  `docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`. Fora do horário de batida, porque os
  aparelhos guardam as batidas e reenviam. Seção 8 antes e depois. Só então
  incluir a 019 no script de deploy, **junto com** o livro de migrations
  abaixo.
- **Opção 2: pelo deploy.** Exige primeiro o livro de migrations. Sem ele,
  cada deploy reaplica a 017 (que recria a `ponto_arp_registrar` antiga) e
  depois a 019, em transações separadas. Fica uma janela com a função antiga
  em produção a cada deploy.

**Livro de migrations (pré-requisito da opção 2 e do uso contínuo).** Uma
tabela `ponto_migracoes_aplicadas(arquivo, sha256, aplicada_em)`.
`apply-ponto-eletronico.mjs`:
- aplica cada arquivo **uma vez**, numa transação, com `lock_timeout` e
  `statement_timeout`;
- recusa arquivo já aplicado cujo sha256 mudou;
- no primeiro uso, registra 016-018 como aplicadas, se a validação de objetos
  passar.

Isso também elimina o item 23 da Fase 01 (DDL reaplicada e travas a cada
deploy).

**Efeitos do deploy da Vercel:**
- Merge desta PR no `main` dispara o deploy. O `prebuild` reaplica 016-018
  como hoje e **não** a 019. A função passa a levar o arquivo 019 empacotado,
  sem executá-lo.
- O handler novo (409) é inofensivo sem a 019: o erro não ocorre.

**Contingência.**
- **Falha durante o `psql -1`:** nada é aplicado (transação única).
- **Problema depois de aplicada:** `psql -1 -f migrations/019_ponto_integridade_fiscal.down.sql`
  devolve as funções da 016/017 sem apagar nenhum dado. A auditoria fica, e
  as permissões retiradas não voltam, de propósito. Os aparelhos não precisam
  de nada: o contrato da ARP é o mesmo.
- **Dado corrompido (não esperado: a 019 não escreve em tabela existente):**
  restaurar o backup em **ambiente separado**, comparar e só então decidir.
  Nunca restaurar direto sobre produção com registros fiscais mais novos.

## 10. Regularização do cadastro fiscal (sem tocar nos registros)

1. Aplicar a 019 **antes** de cadastrar o CNPJ. Assim o preenchimento fica
   auditado (`inscricao_preenchida_apos_nsr`, `nsr_emitidos = 2`, responsável)
   e a inscrição nasce congelada.
2. Quem tem papel fiscal informa CNPJ/CPF (e CNO, se a obra tiver) pela tela
   do ARCD. O ARCD **não** preenche sozinho.
3. NSR 1 e 2 continuam exatamente como estão. O documento da Fase 02 (AFD)
   deverá informar que eles foram emitidos antes do cadastro da inscrição
   (dado já registrado na auditoria).
4. Se a inscrição informada estiver errada depois do NSR, a saída é
   **outro estabelecimento**, com novo pareamento dos aparelhos. Nunca a
   edição.
5. Classificação dos 2 registros (teste de homologação ou batida real):
   decisão sua. A sugestão é guardar essa classificação numa anotação
   append-only, a ser criada na Fase 02. Os registros nunca são apagados.
6. O aparelho pareado sem eventos pode ser revogado no ARCD. É decisão
   operacional, sem efeito fiscal.

## 11. Decisões que exigem autorização

1. Aplicar a 019 em produção, por qual opção da seção 9 e em qual janela.
2. Implementar o livro de migrations e trocar o comportamento do deploy.
3. Exportação lógica das tabelas do ponto antes da janela (contém CPF e vetor
   facial).
4. Regra de hora da seção 3: host como fonte, relógio do banco como árbitro
   (tolerância de 30 s). Aceitar a premissa do relógio do banco e autorizar a
   medição dele contra o NTP.br.
5. CNPJ/CPF do estabelecimento (quem informa e quando: depois da 019).
6. Classificar os 2 registros existentes e o destino do aparelho sem eventos.
7. Aceitar formalmente os riscos residuais (Fase 01, seção 15).

## 12. Revisão independente (11/10/2026)

Parecer: **APROVAR COM CORREÇÕES**. Revisão adversarial do SQL `up`/`down`
em PGlite, com os privilégios padrão do Supabase simulados e dados espelhando
produção.

| Achado | Sev. | Situação |
|---|---|---|
| Deploy reaplicando 016/017/018 depois da 019 reverte ARP, legado e trava do aparelho (revogado volta a ativo) e cria janela em que o legado falha | P1 | **Resolvido pelo livro de migrations e pela guarda do script antigo** (PR do livro). Condição de implantação: livro antes da 019 |
| `service_role` com INSERT na auditoria (linha forjada com a marca de sessão); anon com UPDATE na sequência | P2 | Corrigido (SELECT apenas; sequência revogada) + teste |
| `down` → cadastro alterado → `up`: trilha sem marca | P2 | Corrigido (`reaplicacao` quando o estado difere) + teste |
| Semente local da 017 em lote vazio permitia bifurcar depois da 019 | P3 | Corrigido + teste + verificação prévia 4b |
| Responsável herdado no preenchimento da inscrição | P3 | Corrigido (exige `atualizado_em` novo) + teste |
| `serverTime` no formato certo mas data impossível derrubava o lote | P3 | Corrigido (cai no relógio do banco) + teste |
| Relógio do banco lido antes das travas | P3 | Corrigido (`ponto_arp_fonte_hora` sob a trava do contador) |
| Furo em REPEATABLE READ no trigger da inscrição | P3 | Corrigido (`FOR SHARE` no contador) |
| Afirmação do `down` "funções idênticas" larga demais | P3 | Texto corrigido (seção 6) |
| `lock_timeout` ambíguo no `psql -f` | P3 | `PGOPTIONS` (seção 9) |
| MultiXact pelo `FOR SHARE`; REFERENCES/TRIGGER da 016 para a `service_role` | P3 | Registrados (volume irrelevante; higiene futura) |

**Sem problema (verificado):** nenhuma linha existente alterada; numeração,
idempotência e texto do hash iguais; idempotência e ida e volta do `down`;
nenhum ciclo de trava; corrida primeiro NSR × inscrição fechada em READ
COMMITTED; triggers security definer com `search_path` fixo; transação única;
reversão depois de NSR emitidos sob a 019 mantém a cadeia íntegra.

