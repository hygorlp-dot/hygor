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
convertível em data era aceito (ex.: `01/02/2026 10:00`, interpretado pelo
`DateStyle` da sessão) e entrava no hash.

**Mudança (sem trocar a fonte de hora).** O relógio do host continua sendo a
fonte, porque é ele que o cron verifica contra o NTP.br. Sob a trava do
contador:
`gravado_em = greatest(hora do host, gravado_em do NSR anterior do estabelecimento)`,
truncado em milissegundos, e o texto assinado vem do próprio valor
(`YYYY-MM-DDTHH:MM:SS.sssZ`, igual ao `toISOString` do JS). `serverTime`
fora do ISO 8601 UTC é ignorado e a hora do banco é usada. A evidência
(`evidencia_hora`, fora do hash) ganha `arp.horaHostAceita`,
`arp.relogioBanco` e `arp.ajustadaPeloNsrAnterior`. O texto canônico do hash
não muda (versão 1).

**Por que não usar o relógio do banco direto:** mudaria a fonte de hora
documentada em `docs/REP-P-TEMPO-CONFIAVEL.md` sem medição dela contra a HLB.
Isso fica como decisão (seção 11).

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
- Idempotente (aplicada duas vezes, sem efeito extra) e reversível (o `down`
  devolve as funções **idênticas** às da 016/017, conferido por md5 do
  `pg_get_functiondef`). Com linhas, a auditoria fica; vazia, sai, e a
  reversão completa 019 → 018 → 017 funciona num banco limpo.
- O app não muda. Mudança de comportamento visível: a sincronização pode
  receber o erro novo do legado (só em aparelho com legado pendente depois do
  formato 2 — hoje nenhum) e a tela do estabelecimento recebe 409.

## 7. Testes

- `server/ponto-eletronico/arp/arp-migration-019.pglite.test.js` (16, PGlite):
  A, B, C, D, aplicação sobre dados existentes sem reescrever nenhuma linha
  (md5 de todas as tabelas antes e depois), linha de base única, `down` e
  reaplicação, e a trava "019 fora do deploy".
- `server/ponto-eletronico/arp/arp-019-concorrencia.pg.test.js` (5, Postgres
  16 real, job `rep-p-arp-postgres`, com trava de ≥ 5 aprovados): cada caso
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
-- 4. Hora fiscal em ordem (deve vir vazia)
select * from (select estabelecimento_id, nsr, gravado_em, lag(gravado_em) over (partition by estabelecimento_id order by nsr) ant
  from ponto_arp_registros) x where gravado_em < ant;
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
- **Opção 1 (recomendada): aplicação manual numa janela.** `psql -1 -v ON_ERROR_STOP=1 -f migrations/019_ponto_integridade_fiscal.up.sql`
  com `set lock_timeout = '5s'` antes. Fora do horário de batida, porque os
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
4. Manter a hora do host como fonte do `gravado_em` (proposto) ou adotar o
   relógio do banco, medindo-o contra a HLB.
5. CNPJ/CPF do estabelecimento (quem informa e quando: depois da 019).
6. Classificar os 2 registros existentes e o destino do aparelho sem eventos.
7. Aceitar formalmente os riscos residuais (Fase 01, seção 15).
