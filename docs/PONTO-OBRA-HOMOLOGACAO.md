# Ponto de Obra — homologação ISOLADA (NÃO OFICIAL)

Data: 12/10/2026. **Situação real: o código e as ferramentas do ambiente
isolado estão prontos e testados com dados sintéticos (PGlite e Postgres
real na CI). O ambiente em si NÃO existe ainda:** criar o projeto Supabase e o
deploy na Vercel de homologação exige autorização (recurso externo, possível
custo e credenciais). Nenhum NSR de teste foi emitido fora dos bancos
descartáveis dos testes. Nenhum aparelho físico foi homologado.

## 1. Objetivo

Testar o APK em aparelho real — pareamento, cadastro facial autorizado,
batida online e offline, sincronização, NSR, falhas — **sem gerar nenhum
registro fiscal real**. Isso exige um backend inteiro separado: banco
PostgreSQL, projeto Supabase, Storage, credenciais, aparelhos,
estabelecimento e dados próprios. Uma URL de preview da Vercel **não** serve
se usar as credenciais ou o banco de produção.

## 2. Garantias de isolamento (camadas)

| Camada | Onde | O que impede | Teste |
|---|---|---|---|
| Build | `apps/ponto-obra/config/ambiente.js`, `app.config.js` | `PONTO_AMBIENTE` obrigatório; homologação sem `PONTO_API_URL` não compila; recusa a produção (`pontosarcd`/`pontos` e previews `pontos-*.vercel.app`), IP literal, host sem "homolog"; pacote próprio `br.com.arcd.pontoobra.homologacao` | `apps/ponto-obra/src/logica/ambiente.test.js` |
| APK | `apps/ponto-obra/scripts/verificar-apk.mjs` | APK conferido antes de instalar: ambiente e servidor embutidos, pacote, permissões efetivas, assinatura | rodado contra o APK `4f8b84c1` (classificado BLOQUEADO) |
| App em execução | `src/servicos/conexao.js`, `TelaPareamento.js`, `sincronizacao.js`, `App.js` | sem fallback para a produção; toda requisição declara `ambienteApp`; pareamento confere o ambiente do servidor ANTES do código; sessão presa ao ambiente e ao servidor; sincronização com servidor de outro ambiente não guarda cadastro nem envia batida | `ambiente.test.js` |
| Servidor | `server/ponto-eletronico/ambiente.js`, `handler.js` | `PONTO_AMBIENTE=homologacao` só opera com a tabela marcadora `arcd_ambiente` no banco e com um `SUPABASE_URL` que **não** é o projeto de produção (comparado pelo hash do project ref); app de outro ambiente recebe 409 antes de qualquer gravação | `server/ponto-eletronico/ambiente.test.js`; conferido com o `SUPABASE_URL` real de produção: bloqueado |
| Banco | `scripts/homologacao/` | só provisiona banco marcado (`comment on database ... 'arcd-ponto-homologacao'`), confirmado por `usuario@host:porta/banco`, que não seja a produção (identidade, projeto pelo pooler ou acesso direto, hash do ref) e sem registros do ponto ou dados de ERP reais | `scripts/homologacao/homologacao.test.js`, `homologacao.pg.test.js` |

## 3. O que o provisionamento cria (dados 100% sintéticos)

- Esquema do ERP (`schema.sql`) e do ponto pelo **livro de migrations**
  (016–019, origem `homologacao`); gate **GO 019** conferido no fim.
- Marcador `arcd_ambiente` (só aceita `homologacao`; RLS; service_role só lê).
- Empresa com 2 obras "OBRA FICTÍCIA n — HOMOLOGAÇÃO", 6 trabalhadores
  "Trabalhador Sintético nn" com CPF sintético (prefixo 000, dígito válido),
  1 terceirizado fictício, estabelecimento "ESTABELECIMENTO DE TESTE — NÃO
  OFICIAL" (sem inscrição) e encarregado de homologação com PIN informado
  pelo operador (`PONTO_HOMOLOGACAO_PIN`, nunca no repositório).
- **Sem biometria:** o cadastro facial é feito no aparelho, só com pessoas que
  autorizarem por escrito. Nada da biometria de produção é copiado.

## 4. Passo a passo (cada item 🔐 exige autorização)

1. 🔐 Criar um projeto Supabase NOVO de homologação (nome com "homolog").
   No SQL editor dele: `comment on database postgres is 'arcd-ponto-homologacao';`
2. 🔐 Criar um projeto Vercel NOVO de homologação a partir do mesmo repositório,
   com nome contendo "homolog" e **sem** o prefixo `pontos`. Variáveis: as do
   projeto de homologação (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `POSTGRES_URL_NON_POOLING`) e `PONTO_AMBIENTE=homologacao`. **Nunca copiar
   variáveis da produção** (inclusive OneDrive e chaves de backup).
3. Provisionar (do computador do operador, sem variáveis de produção carregadas):
   ```bash
   node scripts/homologacao/cli.mjs provisionar --confirmo-homologacao=<usuario@host:porta/banco>
   ```
   com `PONTO_HOMOLOGACAO_DB_URL` e `PONTO_HOMOLOGACAO_PIN` no ambiente. Esperado:
   `Homologação provisionada (NÃO OFICIAL): gate GO 019`.
4. Deploy do projeto Vercel de homologação. O `prebuild` aplica as migrations
   do ERP no banco de homologação; o gate do ponto vê o livro e não reaplica nada.
5. Conferir banco e API:
   ```bash
   node scripts/homologacao/cli.mjs conferir --api https://<homologacao>/api/data
   ```
   Esperado: marcador `homologacao`, gate GO 019, dados sintéticos, API `ambiente homologacao`.
6. 🔐 Gerar o APK. Variáveis do shell local NÃO chegam ao servidor do EAS: cadastrar a URL
   no ambiente "preview" do EAS (usado pelo perfil `homologacao`):
   ```bash
   eas env:create --environment preview --name PONTO_API_URL --value https://<homologacao>/api/data --visibility plaintext
   ```
   ```bash
   eas build --profile homologacao --platform android
   ```
   Sem a variável, ou com host de produção, o build falha. O primeiro build do pacote
   `.homologacao` pede a criação da keystore no EAS (interativo).
7. Conferir o APK: `node scripts/verificar-apk.mjs <apk> --build-tools <pasta> --esperado homologacao` → `APROVADO PARA HOMOLOGACAO`.
8. Código de pareamento só no banco isolado: `node scripts/homologacao/cli.mjs codigo`.
9. Executar a matriz `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` (18 cenários).
10. Reset controlado (só banco marcado): `cli.mjs resetar --confirmo-homologacao=...` e provisionar de novo.

## 5. Requisitos fiscais preservados (Missão 6)

| Requisito | Prova automatizada | Situação |
|---|---|---|
| NSR sequencial por estabelecimento, só pela ARP | `arp-concorrencia.pg.test.js` (5), `arp-019-concorrencia.pg.test.js` (6), `homologacao.test.js` (NSR 1–2 no banco isolado) | TESTADO |
| Evento local imutável; hash local | `armazem-sqlite.test.js` (escrita única, transação, SQLITE_FULL), `regressao.test.js` | TESTADO |
| Hash fiscal e cadeia | `registro-fiscal` (paridade JS/SQL), `pacote.test.js` (cadeia recalculada) | TESTADO |
| Sincronização idempotente | `regressao.test.js`, `rep-p-ponta-a-ponta.test.js`, `homologacao.test.js` (reenvio) | TESTADO |
| Recuperação após timeout | `rep-p-ponta-a-ponta.test.js` (timeout depois do commit) | TESTADO |
| Vários aparelhos no mesmo estabelecimento | `arp-concorrencia.pg.test.js` | TESTADO |
| Funcionário global entre obras | `funcionario-global.test.js` | TESTADO |
| Terceirizado sem NSR de jornada | `homologacao.test.js` (`acesso_registrado`, sem NSR), `regressao.test.js` | TESTADO |
| Evidência original preservada (foto/SHA) | `pacote.test.js`, `regressao.test.js` | TESTADO |
| Hora não confiável | `regressao.test.js`, `arp-019-concorrencia.pg.test.js` | TESTADO |
| Backup e recuperação do banco de teste | `scripts/backup-ponto` funciona em qualquer banco (`pacote.test.js`, `gate-integrado.pg.test.js`) | TESTADO (sintético) |
| **Nenhuma chamada do piloto atinge a produção** | as camadas da seção 2 (build, app, servidor, banco) | TESTADO; **prova no piloto real PENDENTE**: antes e depois da homologação física, contar (consulta somente leitura, 🔐) `ponto_dispositivos` e `ponto_arp_registros` da produção — devem ficar iguais |

## 6. Riscos residuais (registrados, não aceitos)

1. O ambiente de homologação não existe: sem ele, nenhum dos 18 cenários físicos roda.
2. A trava do servidor por hash cobre o projeto Supabase de produção atual; se
   a produção mudar de projeto, o hash precisa ser atualizado.
3. Domínio próprio da produção (fora da Vercel), se existir no futuro, entra
   na lista de hosts de produção do app.
4. O Storage do projeto de homologação não é limpo pelo `resetar` (fotos de
   teste ficam até limpar o bucket pelo painel).
5. Os dois APKs antigos (`e4f41447`, `4f8b84c1`) continuam baixáveis no EAS até expirarem
   (26/10/2026): só a identificação NÃO INSTALAR impede o uso. Expirar os links é decisão da direção.
6. Achados P2/P3 da revisão independente da #72 que não bloqueiam a
   homologação isolada: pareamento sem limite de tentativas; cadastro facial
   confia no `responsavelId` sem prova de PIN no servidor; prova de vida sem
   desafio aleatório; desempenho por batida a medir no aparelho; relógio de 1 s
   re-renderiza a tela de ponto.
