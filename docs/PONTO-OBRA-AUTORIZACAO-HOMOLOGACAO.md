# Ponto de Obra — solicitação única de autorização da homologação

Data: 13/10/2026. Candidato: tag `ponto-homologacao-rc1` → commit `53a7272`
(PR #77, 5 jobs da CI verdes). **Nada abaixo foi executado.** Cada linha
precisa de um "autorizo" explícito da direção; sem ele, a homologação fica
bloqueada exatamente aqui.

## O que se pede

| # | Recurso | Finalidade | Custo estimado (a confirmar no painel de cobrança) | Segredos gerados | Quem opera |
|---|---|---|---|---|---|
| A1 | **Projeto Supabase NOVO** `ponto-homologacao` (região `sa-east-1`), na organização da empresa | banco e Storage isolados da homologação; nunca recebe dado real | US$ 0 se couber no plano gratuito da organização; numa organização paga, um projeto a mais costuma somar a cobrança de computação (ordem de US$ 10/mês) | `service_role key`, senha do banco (conexão direta) — guardados fora do repositório | a definir pela direção |
| A2 | **Projeto Vercel NOVO** (nome com "homolog", sem o prefixo `pontos`), no time `hygor-s-projects1` | API do ponto de homologação (mesmo repositório, branch do RC) | o time está no plano **Hobby** (gratuito); confirmar se o uso comercial exige o plano Pro, o que vale também para a produção atual | `CRON_SECRET` novo (gerado na hora) | a definir |
| A3 | **Variável do EAS** `PONTO_API_URL` no ambiente `preview` do projeto `@hygorf/ponto-obra` | embutir no APK o endereço do servidor isolado | sem custo | não é segredo | a definir |
| A4 | **Keystore EAS do pacote `br.com.arcd.pontoobra.homologacao`** (gerada no 1º build, interativo) | assinar os dois APKs de homologação com a mesma chave | sem custo | keystore gerenciada pelo EAS (separada da de produção) | a definir |
| A5 | **Dois builds Android** do perfil `homologacao` a partir da tag `ponto-homologacao-rc1` | cenário de atualização (versionCode N e N+1) | dentro da cota do plano EAS da conta `hygorf` (confirmar a cota mensal) | — | a definir |
| A6 | **PIN do encarregado de teste** (4–8 números) | semente sintética do provisionamento | — | PIN, entregue fora do repositório | a definir |
| A7 | **Pessoas de teste com consentimento LGPD** para o cadastro facial de homologação | cenários 4, 5, 15 e H1 | — | termo assinado fora do repositório | RH/jurídico |
| A8 | **Aparelho Android 10+ dedicado** (de preferência 2 modelos) | cenários físicos e tempo de reconhecimento | compra/empréstimo | — | operação |
| A9 | **Consulta somente leitura na produção** antes e depois do piloto (contagem de aparelhos, eventos e NSR) | provar que nada da homologação chegou à produção | — | — | a definir |

## Operações previstas depois da autorização (na ordem)

1. **A1:** criar o projeto; no SQL editor **do projeto novo**:
   `comment on database postgres is 'arcd-ponto-homologacao';`
2. Provisionar (do computador do operador, sem variável da produção carregada):
   `node scripts/homologacao/cli.mjs provisionar --confirmo-homologacao=<usuario@host:porta/banco>`
   → esquema, livro 016–019, marcador, semente sintética, bucket privado, gate **GO 019**.
3. **A2:** montar `.env.homologacao` só com `PONTO_AMBIENTE=homologacao`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`,
   `CRON_SECRET`, e conferir: `node scripts/homologacao/cli.mjs validar-env --arquivo .env.homologacao`
   (deve dar OK; contra o arquivo da produção dá NO-GO). Cadastrar no projeto
   Vercel novo e fazer o deploy **dele**. O 1º passo do `prebuild`
   (`guarda-prebuild.mjs`) recusa o deploy se qualquer variável ou o banco não
   forem da homologação, antes de qualquer migration.
4. Conferir: `node scripts/homologacao/cli.mjs conferir --api https://<homologacao>/api/data`
   → marcador `homologacao`, GO 019, só dados sintéticos, bucket privado,
   hash do projeto ≠ produção, API `ambiente homologacao`.
   **Qualquer divergência = NO-GO; nenhum pareamento antes disto.**
5. **A3–A5:** `eas env:create --environment preview --name PONTO_API_URL --value https://<homologacao>/api/data --visibility plaintext`;
   em `apps/ponto-obra`, a partir da tag: `eas build --profile homologacao --platform android` duas vezes.
6. Conferir os dois APKs:
   `node scripts/verificar-apk.mjs <apk-N> --build-tools <pasta> --esperado homologacao` e
   `node scripts/verificar-apk.mjs <apk-N+1> --build-tools <pasta> --esperado homologacao --atualiza <apk-N>`
   → `APROVADO PARA HOMOLOGACAO` nos dois.
7. Código de pareamento só no banco isolado (`cli.mjs codigo`) e execução da
   matriz (`apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md`), registrando em
   `apps/ponto-obra/docs/homologacao-registro.csv`.

## O que continua proibido mesmo com esta autorização

Merge na `main`, deploy, migration, backup ou restauração no projeto de
produção; a migration 019 na produção; uso dos APKs `e4f41447` e `4f8b84c1`
(apontam para a produção); dado pessoal real no ambiente isolado; distribuir
o APK de homologação para uso oficial.

## Estado já comprovado (sem recurso externo)

- RC1 `53a7272`: CI 5/5 (run 38407094318), limitador em Postgres real 8/8.
- O app recusa build de homologação com URL da produção, preview `pontos-*` ou vazia.
- O EAS não tem nenhuma variável cadastrada (preview, production, development):
  nada contamina o build.
- Contas prontas: Vercel `hygor-s-projects1` (Hobby), EAS `hygorf` (owner).
  Não há CLI do Supabase instalada (o passo 1 usa o painel).
