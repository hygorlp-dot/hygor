# Ponto de Obra — Fase 01: estabilização, segurança e auditoria de regressão

Data: 10/10/2026 · Branch: `fix/ponto-obra-fase-01-estabilizacao` · PR: (preenchido na abertura)

Escopo: só estabilização da arquitetura existente. Sem AFD, AEJ,
comprovante, tratamento de jornada, mudança visual, upgrade de major ou
alteração de regra fiscal, facial ou de privacidade. A PR #62 (redesenho
"ARCD Precision") não foi tocada.

> Este relatório não declara conformidade REP-P nem homologação em aparelho
> real. Tudo aqui foi verificado por CI, testes automatizados e consultas de
> leitura; o APK desta versão não foi gerado nem testado em campo.

## 1. Estado inicial

- `main` remota em `8c5e52a` (mesmo commit da auditoria de 10/10). O
  checkout local estava em `bf3e8a7`, 42 commits atrás, sem alteração local
  rastreada (só um arquivo não rastreado do Impeccable, de outra sessão,
  preservado).
- Última CI do `main` ([run 37781103626](https://github.com/hygorlp-dot/hygor/actions/runs/37781103626)):
  3/5 jobs verdes. Vermelhos: `mobile-ponto-obra` (expo-doctor) e
  `financial-and-security` (só o passo `npm audit --audit-level=high`; lint,
  arquitetura, typecheck, testes, build e Storybook passaram). A CI do `main`
  está vermelha desde o run 37343216345 (05/10).
- O código do Ponto de Obra não mudou desde `bf3e8a7` (diff vazio em
  `apps/ponto-obra`, `src/domains/ponto-eletronico`, `server/ponto-eletronico`
  e `migrations`). As duas falhas vieram do tempo, não de código: alertas
  novos no banco de advisories do npm (03/09 e 18/09) e patches do Expo SDK 57
  publicados em 06/10.
- Worktrees e branches de outras sessões: 16 worktrees listadas, nenhuma
  tocada. PR aberta: só a #62.

## 2. HEAD utilizado

Base `8c5e52a308b55a849228a542cb0d67309ec699f7` (`origin/main`). Commits da
fase: ver a PR.

## 3. Problemas encontrados (matriz)

| # | Problema | Local | Sev. | Impacto | Causa raiz | Correção | Teste | Situação |
|---|---|---|---|---|---|---|---|---|
| 1 | expo-doctor reprova 5 pacotes | `apps/ponto-obra/package.json` | P1 | Job mobile vermelho; nenhum outro passo do app roda na CI | Patches do SDK 57 publicados em 06/10 | `npx expo install --fix` (só patch) | expo-doctor 21/21, export, prebuild | Corrigido |
| 2 | `source-map-js` <1.2.2 (GHSA-68fv-2mgg-jv7q, high) | raiz (postcss, jsdom, coverage) | P1 | Auditoria da CI vermelha | Advisory novo | `npm update` → 1.2.2 (patch) | suíte completa | Corrigido |
| 3 | `vitest`/`@vitest/mocker` <4.1.11 (GHSA-82fw-gwwq-j7x9, moderate) | raiz (dev) | P2 | Leitura de arquivo via mock em teste | Advisory novo | 4.1.11 (patch) | suíte completa | Corrigido |
| 4 | `smol-toml` ≤1.8.0 (GHSA-r4xh-jqrq-34v2, moderate) | raiz (knip) | P3 | DoS de parse em ferramenta dev | Advisory novo | 1.9.1 (minor, dentro de `^1.7.0`) | suíte completa | Corrigido |
| 5 | `uuid` <11.1.1 (GHSA-w5hq-g745-h8pq, moderate) | app (`xcode`, prebuild iOS) | P3 | Escrita parcial em buffer em v3/v5/v6 (o xcode usa v4) | Dependência antiga do xcode | `overrides.uuid ^11.1.1` (igual à raiz) | prebuild Android, `xcode` carrega | Corrigido |
| 6 | `braces` ≤3.0.3 (GHSA-vfj7-8cjw-p6xm, high) | raiz (Tailwind 3) e app (Metro) | P2 | DoS do processo de build com glob malicioso do próprio repo | **Sem versão corrigida publicada** | Exceção formal com prazo (seção 7) | portão + teste | Exceção (não é correção) |
| 7 | `node-forge` ≤1.4.0 (GHSA-86w9-cpqp-85rv, high) | app (`@expo/cli`) | P2 | Assinatura forjada em manifesto OTA assinado (não usado) | **Sem versão corrigida publicada** | Exceção formal com prazo (seção 7) | portão + teste | Exceção (não é correção) |
| 8 | `postcss-selector-parser` <7.1.6 (GHSA-rj75-hqrm-r3gf, moderate) | raiz (Tailwind 3) | P3 | CPU quadrática ao parsear CSS do próprio repo no build | Correção só no major 7; Tailwind 3 exige ^6 | Documentado; sai com Tailwind 4 | — | Residual (moderado não bloqueia) |
| 9 | Gate `npm audit` binário: sem correção publicada = CI vermelha para sempre | `.github/workflows/quality.yml` | P1 | Ou CI vermelha permanente, ou tentação de `\|\| true` | Ferramenta não distingue "não corrigido" de "não corrigível" | Portão com exceções que se revogam (seção 7) | 11 testes | Corrigido |
| 10 | App sem auditoria de dependências na CI | job `mobile-ponto-obra` | P2 | Alertas do app passavam sem bloqueio | Ausência de passo | Mesmo portão no job mobile | CI | Corrigido |
| 11 | Cópia local do registro fiscal podia ser sobrescrita | `armazem-sqlite-nucleo.js` `confirmarEvento` | P2 | Segunda confirmação trocaria NSR/hash guardados no aparelho (ARP intacta) | `UPDATE` sem `enviada = 0` | Escrita única no SQLite e no armazém em memória | 2 testes (falhou antes da correção) | Corrigido |
| 12 | Docs citavam só migrations 016/017 | `REP-P-ARQUITETURA.md`, `AGENTS.md` | P3 | Referência desatualizada | 018 entrou depois | Texto atualizado | — | Corrigido |
| 13 | Portão agrupava advisory só por URL: o mesmo GHSA em outro pacote (até critical) sumia atrás da exceção | `auditoria-dependencias-regras.mjs` | P1 (revisão) | Alerta crítico passaria calado | Chave de agrupamento incompleta | Chave url+pacote; advisory sem url, severidade desconhecida e pacote sem explicação bloqueiam | 6 testes | Corrigido |
| 14 | Exceção valia para qualquer caminho, inclusive produção | idem | P2 (revisão) | Dependência de runtime nova puxando `braces` seria coberta | Exceção só por GHSA+pacote | `atingidosPermitidos` por escopo (fechamento de `effects`) | teste | Corrigido |
| 15 | Autorrevogação olhava só a tag `latest`; sem timeout; teste quebraria com lista vazia | idem | P2/P3 (revisão) | Correção em outra tag não revogaria; job preso; CI vermelha quando o objetivo é atingido | — | `npm view versions`, timeout 180 s, teste tolera lista vazia | testes | Corrigido |
| 16 | Log do catch geral de `/api/data` gravava o erro cru do Postgres (`details` com a linha: CPF, vetor facial) | `api/data.js` | P2 (revisão) | Dado pessoal/biométrico no log da Vercel | `console.error(err)` | `sanitizeServerError` (nome, código, mensagem, pilha com `redact`) | 2 testes | Corrigido |
| 17 | Divergência da ARP para evento já confirmado seria engolida | `sincronizacao.js` | P2 (revisão) | NSR diferente para o mesmo `eventId` não apareceria | Retorno de `confirmarEvento` ignorado | Rodada para com `fiscal_divergente`; diagnóstico mostra | 2 testes | Corrigido |
| 18 | "Câmera/foto falhando não bloqueia a batida" sem teste (lógica inline no `App.js`) | `App.js` | P2 (revisão) | Regressão possível sem aviso | Código de tela não roda no Node | `fotoSemBloquear` em `terminal.js`, testado; trava de código-fonte | 2 testes | Corrigido |
| 19 | Sem teste de: confirmação fora de ordem por `eventId`, reboot durante a sincronização, monotônico regredindo, assinatura biométrica do lado do app | testes do app | P2 (revisão) | Contratos da fase sem prova | Lacuna de teste | Testes novos; teste da assinatura reforçado | 5 testes | Corrigido |
| 20 | Banco: legado formato 1 aceito depois do formato 2 (bifurcação possível da cadeia local) | `016`/`017` (`ponto_registrar_marcacoes`, `ponto_arp_registrar`) | P2 (revisão, anterior à fase) | Cadeia local não garantida pelo banco, só pela ordem do app | Função legada não olha `ultima_sequencia_local` | Migration 019 (proposta, seção 10) | — | **Pendente: exige autorização para migrar produção**. Produção: 0 marcações legadas, sem bifurcação |
| 21 | Banco: `gravado_em` vem da API, não sob a trava do contador (pode inverter com o NSR) | `017` / `arp.js` | P2 (revisão, anterior) | Hora fiscal fora de ordem entre aparelhos concorrentes | Hora lida antes da RPC | Migration 019 (proposta) | — | **Pendente (autorização)**. Produção: 2 registros em ordem |
| 22 | Banco: inscrição (CNPJ/CPF) do estabelecimento pode mudar depois de emitido NSR, sem trilha | `017` / `handler.js` | P2 (revisão, anterior) | Sequência fiscal "muda de dono" | Hash fiscal cobre o id, não a inscrição | Migration 019 (proposta) | — | **Pendente (autorização)**. Produção: estabelecimento com NSR 1-2 está **sem inscrição** |
| 23 | Script de deploy reaplica toda a DDL 016-018 a cada build, sem `lock_timeout` | `scripts/apply-ponto-eletronico.mjs` | P2 (revisão, anterior) | Travas pesadas a cada deploy; correção futura com janela de função antiga | Sem livro de migrations | Livro de migrations com checksum + `lock_timeout` (proposta) | — | Pendente (decisão de deploy) |
| 24 | `016.down` sem guarda (rodado comando a comando apaga tabelas antes de falhar) | `migrations/016_*.down.sql` | P2 (revisão, anterior) | Só em reversão manual | Down antigo | Guarda como na 017/018 | — | Pendente (fora de produção; documentado) |

Problemas exclusivos de outras branches: nenhum avaliado (a PR #62 está fora
do escopo e não foi aberta).

## 4. Causas raízes

1. **Deriva do ecossistema, não regressão de código.** O banco de advisories
   do npm e o calendário de patches do Expo mudam sem commit no repositório;
   uma CI que só roda em push revela isso tarde.
2. **Advisory sem correção publicada** não tem saída por atualização: o gate
   binário não tinha como representar "risco aceito, com prazo".
3. **Contrato de escrita única não estava travado no aparelho**, só na ARP
   (triggers). A sincronização nunca dispara a reescrita hoje, mas a garantia
   dependia do chamador.

## 5. Arquivos modificados

- Dependências: `package.json`/`package-lock.json` (raiz e `apps/ponto-obra`).
- Portão de auditoria: `scripts/auditoria-dependencias.mjs`,
  `scripts/auditoria-dependencias-regras.mjs` (+ teste),
  `scripts/auditoria-excecoes.json`, `package.json` (`audit:deps`),
  `vite.config.mjs` (inclui `scripts/**/*.test.js`), `.github/workflows/quality.yml`.
- App: `src/dados/armazem-sqlite-nucleo.js` e `src/logica/armazem-memoria.js`
  (escrita única), `src/logica/sincronizacao.js` (divergência fiscal),
  `src/logica/diagnostico.js` (campo "Registro fiscal"),
  `src/logica/terminal.js` + `App.js` (`fotoSemBloquear`),
  `src/dados/armazem-sqlite.js` (comentário), testes em `src/**/*.test.js`.
- Servidor: `server/client-error-report.js` (+ teste) e `api/data.js` (só a
  linha do log do catch geral).
- Documentação: `apps/ponto-obra/AGENTS.md`, `docs/REP-P-ARQUITETURA.md` e
  este relatório.

Nenhuma migration, regra fiscal, limiar facial, texto jurídico, tela ou
módulo financeiro do ERP foi alterado.

## 6. Dependências atualizadas

| Escopo | Pacote | Antes | Depois | Tipo |
|---|---|---|---|---|
| app | expo | 57.0.26 | 57.0.27 | patch SDK 57 |
| app | expo-asset | 57.0.18 | 57.0.19 | patch |
| app | expo-constants | 57.0.20 | 57.0.21 | patch |
| app | expo-image-manipulator | 57.0.20 | 57.0.21 | patch (correções só iOS) |
| app | expo-sqlite | 57.0.3 | 57.0.4 | patch (trava por statement; ver abaixo) |
| app | uuid (override) | 7.0.3 | 11.1.1 | override, igual ao da raiz |
| raiz | vitest, @vitest/* | 4.1.10 | 4.1.11 | patch |
| raiz | source-map-js | 1.2.1 | 1.2.2 | patch transitivo |
| raiz | smol-toml | 1.7.1 | 1.9.1 | minor transitivo |

Os patches do Expo puxaram outros patches transitivos (`@expo/cli` 57.0.28,
`expo-modules-core` 57.0.21, `expo-modules-autolinking` 57.0.14 etc.); a
lista completa saiu da comparação dos lockfiles e não tem nenhum major.
React 19.2.3, React Native 0.86.3, `react-native-fast-tflite` 3.0.1 e
`react-native-nitro-modules` 0.37.1 ficaram iguais.

**expo-sqlite 57.0.4 e o SQLCipher:** a correção é na leitura de prepared
statement executado de novo, mais uma trava por statement. O armazém não usa
prepared statement explícito e continua com a transação `BEGIN IMMEDIATE` na
mesma conexão que recebeu o `PRAGMA key` (`serializarBanco`, travado por
teste). O prebuild confirma `expo.sqlite.useSQLCipher=true`. A abertura do
banco cifrado num aparelho real **não** é testável na CI.

## 7. Auditoria de segurança

| Escopo | Antes (total / high) | Depois (total / high) | High restantes |
|---|---|---|---|
| raiz | 12 / 6 | 7 / 5 | todos de `braces` (1 advisory) |
| app | 24 / 16 | 15 / 15 | todos de `braces` e `node-forge` (2 advisories) |

Os números de "high" do npm contam pacotes, não advisories: um advisory em
`braces` marca `micromatch`, `chokidar`, `fast-glob` e `tailwindcss` também.

**Portão** (`npm run audit:deps`, raiz e `-- apps/ponto-obra`): todo
advisory high/critical bloqueia, salvo exceção registrada em
`scripts/auditoria-excecoes.json`. A exceção só vale com escopo,
severidade igual à registrada, prazo de revisão (≤45 dias) e **sem versão
corrigida publicada** (a última versão no registro ainda cai na faixa
vulnerável). Sai a correção, o portão volta a falhar e pede a atualização.
Relatório do npm com erro também bloqueia. Todos os advisories, inclusive
moderados, são impressos; cada exceção vira aviso no GitHub Actions.

**Exceções em vigor (risco residual, não correção):**

| Advisory | Pacote | Caminho | Exposição em produção | Mitigação | Saída |
|---|---|---|---|---|---|
| GHSA-vfj7-8cjw-p6xm (CVE-2026-93687) | braces 3.0.3 | raiz: tailwindcss 3 → chokidar/fast-glob/micromatch; app: expo → @expo/metro → metro-file-map → micromatch | Nenhuma: ferramenta de build; ausente do `dist/` web e do bundle Hermes (busca por strings) | Globs só da configuração do repositório | braces corrigido, Tailwind 4 ou Metro sem micromatch 4 |
| GHSA-86w9-cpqp-85rv (CVE-2026-85393) | node-forge 1.4.0 | app: expo → @expo/cli (direta) e @expo/cli → @expo/code-signing-certificates | Nenhuma: só CLI; o app não usa expo-updates/EAS Update; ausente do bundle Hermes | Não adotar OTA assinada enquanto houver exceção | node-forge corrigido ou @expo/cli sem ele |

Prazo das duas: revisar até 09/11/2026. Cada exceção lista também os pacotes
que o npm marca como atingidos (`atingidosPermitidos`); no app aparecem
`expo` e `react-native` porque dependem do Metro e da CLI de build. O pacote
vulnerável em si não entra no bundle Hermes (busca por strings no bundle
exportado: zero ocorrências de `node-forge`, `micromatch`, `braces`,
`fill-range`, `to-regex-range`; as strings de controle do app aparecem).
O `overrides.uuid` do app é um salto de major (7 → 11) num pacote usado só
pelo `xcode` do prebuild iOS, que chama apenas `uuid.v4()`.

Integridade: os 47 pacotes alterados nos dois lockfiles têm `integrity` e
`resolved` iguais aos do registro npm (conferido pela revisão de segurança).

## 8. Testes

Execução local no estado final da branch (Windows, Node 24, 10/10/2026):

| Verificação | Resultado |
|---|---|
| `npm run test:coverage` (suíte inteira do ERP + app + servidor) | **2.446 aprovados, 0 reprovados, 5 ignorados** (335 arquivos); limites de cobertura atendidos |
| Suíte do Ponto (`apps/ponto-obra src/domains/ponto-eletronico server/ponto-eletronico scripts`) | 238 aprovados, 5 ignorados |
| Ignorados | os 5 de `arp-concorrencia.pg.test.js`: exigem Postgres real (`PONTO_PG_URL`); rodam no job `rep-p-arp-postgres`, que falha se menos de 5 passarem |
| `npm run lint` / `architecture:check` (834 módulos) / `typecheck` | aprovados |
| `npx vite build` (sem `prebuild`) / `build-storybook` / `quality:bundle` | aprovados |
| Playwright (`npm run test:e2e`) | 38/38 na execução limpa. Uma execução anterior, rodada logo após o build do Storybook com a máquina carregada, teve 2 tempos esgotados ao carregar a página (`page.goto` 30 s); os mesmos testes passaram em 7,0 s e 2,3 s isolados e na suíte limpa |
| App: `npm ci`, `expo-doctor` | 21/21 |
| App: `expo export --platform android` | bundle Hermes com os 2 `.tflite` |
| App: `expo prebuild --clean` + `verificar-prebuild.mjs` | SQLCipher, `allowBackup=false`, permissões, autolinking de `relogio-confiavel`, `expo-sqlite`, `expo-camera`, `expo-secure-store`, `react-native-fast-tflite`, `react-native-nitro-modules` |
| `npm run audit:deps` (raiz e app) | aprovados, com as 2 exceções formais anunciadas |

Testes acrescentados nesta fase: 17 do portão de auditoria; 2 do log seguro;
no app, escrita única (SQLite e memória), `eventId` repetido, confirmação
fora de ordem, divergência fiscal, foto/câmera falhando, reboot durante a
sincronização, monotônico regredindo, trava de código-fonte do `App.js`,
diagnóstico do registro fiscal e o reforço da assinatura biométrica. Nenhum
teste foi removido nem teve expectativa afrouxada.

**Mapa dos contratos da Etapa E → testes** (conferido pela revisão de
qualidade; arquivos em `apps/ponto-obra/src` salvo indicação):
- Registro local: `dados/armazem-sqlite.test.js` (reabrir, sequência e
  simultâneas, transação aberta desfeita, `eventId` repetido, WAL/FULL).
- Sincronização: `logica/regressao.test.js` (sem internet, 503, revogado,
  confirmação pelo próprio `eventId`, nunca renumera, 450 eventos em lotes),
  `logica/rep-p-ponta-a-ponta.test.js` (timeout depois do commit, retry
  simultâneo, ordem intercalada de dois aparelhos, evento adulterado no lote).
- Fiscal: `server/ponto-eletronico/arp/arp-migration.pglite.test.js` (NSR por
  estabelecimento, dois aparelhos na mesma sequência, UPDATE/DELETE/TRUNCATE
  bloqueados, hash SQL = JS), `arp-concorrencia.pg.test.js` (CI).
- Biometria: `logica/funcionario-global.test.js`, `codigo-fonte.test.js`
  (nenhum `console.*`), `diagnostico-calibracao.test.js`.
- Foto: `logica/regressao.test.js` (bytes exatos, apagada só depois do OK,
  foto trocada recusada, câmera falhando), `ponta-a-ponta.test.js`.
- Relógio: `logica/regressao.test.js` (reboot, hora do celular mudada,
  validade, reboot durante a sincronização, monotônico regredindo).

## 9. Migrations

- PGlite (CI e local): 016 → 017 → 018 aplicam em ordem; contratos, caminhos
  de atualização e handler da ARP passam (`server/ponto-eletronico-migration.pglite.test.js`,
  `arp-migration.pglite.test.js`, `arp-migration-caminhos.pglite.test.js`,
  `handler-arp.pglite.test.js`).
- Postgres real (concorrência de verdade): só na CI, job `rep-p-arp-postgres`
  (não há Postgres/Docker nesta máquina).
- **Produção — verificação somente leitura (10/10/2026)**, pelo esquema
  exposto do PostgREST e contagens `HEAD` (nenhum dado lido, nada escrito):
  - objetos das três migrations presentes: `ponto_marcacoes`, `ponto_pareamentos`,
    `ponto_dispositivos`, `ponto_biometrias`, `ponto_responsaveis`,
    `rpc/ponto_registrar_marcacoes` (016); `ponto_eventos`,
    `ponto_arp_registros`, `ponto_arp_contadores`, `ponto_estabelecimentos`,
    `ponto_estabelecimento_obras`, `ponto_tempo_verificacoes`,
    `rpc/ponto_arp_registrar`, `rpc/ponto_arp_texto_fiscal` (017);
    `ponto_apropriacoes`, `ponto_apropriacoes_auditoria`,
    `rpc/ponto_apropriacao_salvar`, `rpc/ponto_apropriacao_cancelar` (018);
  - linhas: `ponto_eventos` 2, `ponto_arp_registros` 2,
    `ponto_estabelecimentos` 1, `ponto_estabelecimento_obras` 1,
    `ponto_dispositivos` 2, `ponto_tempo_verificacoes` 9, `ponto_biometrias` 0,
    `ponto_apropriacoes` 0, `ponto_marcacoes` 0;
  - triggers e grants **não** são visíveis por esse caminho: a imutabilidade em
    produção está comprovada só pelo código das migrations e pelos testes.
  - Último deploy Vercel do `main` (`8c5e52a`): sucesso em 08/10.
  - Nenhuma migration foi executada nesta fase.

## 10. Riscos residuais

| Risco | Severidade | Por que fica | Mitigação hoje | O que elimina |
|---|---|---|---|---|
| `braces` e `node-forge` sem correção publicada | P2 | Não há versão para instalar | Exceção que se revoga sozinha; não estão no bundle; app sem OTA assinada | Correção upstream ou Tailwind 4 / CLI sem node-forge |
| `postcss-selector-parser` (moderado) | P3 | Correção só no major 7 | Só build, CSS do próprio repo | Tailwind 4 |
| Bifurcação formato 1 × formato 2 no banco | P2 | Exige migration 019 | App envia legado antes dos novos; produção sem legado | Migration 019: `ponto_registrar_marcacoes` recusa se `ultima_sequencia_local > 0`; `ponto_arp_registrar` só grava a cadeia local se inseriu |
| `gravado_em` fora da trava do contador | P2 | Exige migration 019 | 1 aparelho por estabelecimento hoje | Migration 019: `gravado_em = greatest(clock_timestamp(), último do estabelecimento)` sob o `FOR UPDATE`; hora da API vira só evidência |
| Inscrição do estabelecimento mutável depois do NSR | P2 | Exige migration 019 | Só perfis fiscais alteram | Migration 019: inscrição só de NULL para valor, uma vez, havendo NSR; auditoria append-only do estabelecimento |
| DDL reaplicada a cada deploy, sem `lock_timeout` | P2 | Muda o processo de deploy | Volume baixo hoje | Livro de migrations com checksum, aplicada uma vez |
| `service_role` da 016 com permissões amplas (TRUNCATE em `ponto_marcacoes`, colunas-semente de `ponto_dispositivos`); dono do banco ignora triggers | P3 | Exige migration; o bypass do dono é inerente | Credencial só no servidor | Migration 019 (revogar/conceder mínimo, trigger de TRUNCATE) + verificação periódica da cadeia e ancoragem externa do último hash |
| Abertura do banco SQLCipher, câmera, TFLite e relógio Kotlin em aparelho real | P1 operacional | A CI não executa código nativo | Prebuild confere SQLCipher/autolinking; lógica testada no Node | Teste do APK em campo |
| CI não hermética: correção upstream ou vencimento da exceção (09/11) deixam qualquer PR vermelho | P3 | Proposital (autorrevogação) | Aviso anotado em toda execução | Agendar revisão; opcional: workflow diário rodando o portão |

**Migration 019 não foi escrita nesta fase de propósito:** o `prebuild` aplica
`scripts/apply-ponto-eletronico.mjs` no deploy do `main`, então incluir a 019
nesta PR significaria executá-la em produção no merge, o que exige
autorização expressa.

## 11. Evidências dos pipelines

(preenchido após a CI)

## 12. Critérios de aceite

| Critério | Situação | Evidência |
|---|---|---|
| `main` e ambiente auditados | ✅ | seção 1 |
| Alterações existentes preservadas | ✅ | nenhuma worktree/branch tocada; arquivo não rastreado do Impeccable intacto |
| Incompatibilidades do Expo resolvidas / `expo-doctor` | ✅ | 21/21 |
| Bundle Android / prebuild | ✅ | seção 8 |
| SQLCipher e TFLite preservados | ✅ | prebuild + testes de código-fonte |
| High/critical corrigidos ou formalmente tratados, sem mascaramento | ✅ com exceção formal | seção 7 (2 advisories sem correção publicada) |
| Auditoria exigida pela CI aprovada | ver seção 11 | portão `audit:deps` |
| Contratos das migrations | ✅ (PGlite) | seção 9 |
| Migrations de produção documentadas | ✅ | seção 9 (leitura; nada executado) |
| ARP e concorrência | ✅ PGlite local; Postgres real na CI | seções 8 e 11 |
| Sincronização e offline | ✅ | seção 8 |
| Lint, arquitetura, typecheck | ✅ | seção 8 |
| Testes do ERP | ✅ | 2.446/0/5 |
| Fluxos críticos do navegador | ✅ | 38/38 |
| Cinco jobs verdes | ver seção 11 | |
| Nenhum P0/P1 aberto | ✅ | P1 da revisão corrigido; P2 de banco pendentes de autorização (seção 10) |
| Documentação de encerramento | ✅ | este arquivo |
| PR pronta para merge | ver seção 11 | |

Não está demonstrado: funcionamento em aparelho real e conformidade REP-P.

## 13. Pendências fora do escopo

- Validação do APK em aparelho real (SQLCipher, câmera, TFLite, relógio
  Kotlin); APK desta versão não gerado.
- Decisões jurídicas listadas em `apps/ponto-obra/docs/privacidade-e-retencao.md`
  (termo × biometria global, retenção, exclusão de foto de cadastro).
- Tela do ARCD para apropriação; calibração FAR/FRR com a base global;
  tolerância oficial de hora (Portaria 1.486); UDP/NTP na Vercel;
  `exigirVerificacao`; destino das marcações legadas.
- Migração para Tailwind 4 (elimina `braces`/`postcss-selector-parser` da raiz).
- Bancos arquivados no aparelho sem rotina de limpeza.

## 14. Orientações para a Fase 02

1. **Antes de abrir a Fase 02**, decidir e autorizar a migration 019 (itens
   20-22 da matriz) e cadastrar a inscrição (CNPJ) do estabelecimento que já
   emitiu NSR — de preferência na mesma janela, para a inscrição nascer
   congelada.
2. Gerar um APK piloto desta versão e validar em aparelho: abertura do banco
   cifrado depois de atualizar o app, batida offline, reboot, câmera negada,
   foto em armazenamento cheio, diagnóstico (campo "Registro fiscal").
3. Decidir o livro de migrations (item 23) antes de qualquer nova migration
   do ponto.
4. Fase 02 (AFD, comprovante, espelho) deve partir da ARP como está:
   `ponto_arp_texto_fiscal` e os registros de `ponto_arp_registros` são a
   fonte; nada de NSR no aparelho.
5. Revisar as exceções do portão até 09/11/2026 (ou antes, se o portão
   anunciar correção publicada).
