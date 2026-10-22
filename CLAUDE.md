# Regras do ARCD para o Claude

Regras que valem em toda sessão. Cada uma veio de um erro real ou de um achado
de auditoria. Na dúvida entre seguir uma regra e terminar mais rápido, siga a regra.

## 1. Antes de mexer

- Leia o código do caminho inteiro (tela → `api/data.js` → `server/` → banco) antes de propor correção. Não corrija só o sintoma visível.
- Regra de negócio decidida pelo responsável não muda sem pedido explícito. As vigentes:
  - **Feriado** é pago pela obra do **último dia trabalhado (P/M) antes dele**, até 31 dias para trás, sem exceção para ponto lançado no próprio feriado. Sem dia trabalhado, vale a lotação histórica na data. Fonte única: `resolveHolidayObraId` (`src/domains/ponto/permissions.js`).
  - **Dia sem obra no ponto** segue o histórico de transferências do cadastro (`resolveHistoricalEmployeeObraId`), na folha e na DRE.
  - `exigirVerificacao` do app de ponto continua `false`.
- Não modificar a ARP do REP-P (`ponto_arp_*`, NSR, hashes, `ponto_dispositivo_protegido`) fora de uma rodada própria. Não declarar conformidade REP-P nem registrar INPI.
- Não armazenar nem logar vetor facial, CPF completo fora da ARP, PIN, token ou chave.

## 2. Folha × DRE (sempre iguais)

- Custo de mão de obra tem **uma** implementação: `src/domains/financeiro/labor-cost-engine.js`, usada pela tela e por `server/dre-projection.js`. Nunca duplique a regra em componente.
- Toda mudança de regra de custo exige: teste na folha (`FolhaView.test.jsx`), teste no motor e teste na DRE do servidor (`server/dre-labor-cost.test.js`) com o **mesmo cenário e o mesmo valor esperado**.
- Mudou o cálculo da DRE? Suba `DRE_PROJECTION_VERSION` em `api/data.js`. Sem isso, a DRE salva no banco continua com o valor antigo.
- Para mudança no financeiro, rode o agente `dre-integration-guardian` antes de abrir o PR.

## 3. Segurança e permissões

- O navegador fala só com `/api`. O servidor usa `service_role` ou a conexão postgres direta. **Nenhuma tabela, sequência ou função SECURITY DEFINER do schema `public` pode ficar acessível a `anon` ou `authenticated`.** A migration 019 roda por último em todo deploy e o build falha se sobrar algo aberto.
- Migration nova: idempotente (`if not exists` / `create or replace` / `drop ... if exists`), com `.down.sql`, com teste PGlite que executa o SQL de verdade, e aplicada pelo `prebuild` **antes** de `acesso-publico:migrate`. Função SECURITY DEFINER sempre com `set search_path` e `grant execute ... to service_role`.
- Esconder menu não é permissão. Toda ação da API que devolve dado sensível confere o perfil no servidor (`podeAcessarAba` em `src/domains/administracao/abas-acesso.js`, `PAPEIS_*` no ponto) e tem teste de 403.
- Ação que aceita código, PIN ou senha tem limite de tentativas (`rateLimitCentral`).

## 4. Banco de produção (Supabase)

- SQL pelo conector é **somente leitura** por padrão (`select`). Escrita, DDL ou correção de dado só com pedido explícito do responsável naquela conversa, e sempre por migration versionada no repositório, nunca por SQL solto.
- Conferir dado real antes de concluir um diagnóstico: o dado de produção desempata hipótese.
- Linhas gzip (`arcd-gzip-base64-v1`) não são inspecionáveis por SQL; diga isso em vez de supor o conteúdo.
- A base da empresa é dividida em linhas (`arced_ponto_v1` + `__ponto`, `__equipamentos`, `__config`, `__lookahead`, `__rdo`, `__orcamentos` e o ponto por obra). Quem lê direto uma linha só vê parte dos dados; use `lerLinha()` ou mescle com `mergeDomainRows`. Campo novo numa linha própria: `DOMAIN_FIELDS` em `server/domain-row-routing.js` e teste com Postgres real.
- jsonb gravado pelo driver `postgres` vai por `sql.json(...)`, nunca `JSON.stringify(...)::jsonb` (grava texto).

## 5. Git, PR e deploy

- `main` publica em produção pela Vercel. Merge = deploy.
- Nunca reutilize nem resete a branch de um PR aberto para outro trabalho: crie branch nova a partir de `origin/main`. Force push só com autorização explícita.
- Antes de abrir PR: `npm run lint`, `npm run architecture:check`, `npm run typecheck`, `npm test` e `npx vite build`, todos verdes. Teste novo precisa falhar sem a correção.
- Depois do merge: confirmar o status da Vercel no commit de merge e, quando houver dado envolvido, conferir no banco (leitura) que o efeito apareceu.
- Falhas pré-existentes na `main` (hoje: `npm audit` e `expo-doctor` do app) são explicadas uma vez no PR, nunca escondidas.

## 6. Relato

- Responder em português, com o que foi feito, o que foi verificado e o que ficou pendente. Não afirmar que algo funciona sem teste ou dado que mostre.
