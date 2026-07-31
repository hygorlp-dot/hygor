# Avaliação progressiva de ferramentas — ARCD

Data da linha de base: 2026-07-26. Esta iniciativa não altera regras de negócio,
persistência, autenticação, permissões ou cálculos financeiros. Toda adoção abaixo
tem POC, teste e reversão independentes.

## Linha de base

| Item | Resultado |
| --- | --- |
| Branch / SHA | `feat/integrated-production-platform` / `073de75` |
| Working tree | 471 entradas preexistentes; preservadas |
| Testes | 99 arquivos / 439 testes aprovados |
| Cobertura | statements 79,03%; branches 60,89%; functions 79,11%; lines 87,69% |
| Build | Aprovado |
| Bundle total | 1.111,77 kB gzip |
| Maior chunk | LegacyApp, 597,25 kB gzip (métrica interna; alerta do Vite) |
| CSS | Incluído na métrica agregada de JS/CSS |
| Vulnerabilidades | `npm audit --omit=dev`: 0 |
| Warnings | Chunk legado alto; nenhuma vulnerabilidade runtime |

## Matriz de decisão

| Ferramenta | Problema resolvido | Licença | Bundle | Compatibilidade | Risco | Decisão |
| --- | --- | --- | ---: | --- | --- | --- |
| Playwright 1.62.0 | E2E em navegadores reais | Apache-2.0 | Dev/artefatos | React/Vite por servidor web | browsers e fixtures / libs do host | Adiar |
| axe-core Playwright 4.12.1 | Regras WCAG automatizadas | MPL-2.0 | Dev | Acoplado ao Playwright | falso positivo / cobertura parcial | Adiar |
| size-limit 13.0.1 | Orçamento de bundle | MIT | Dev | Node 22+ | duplicar métrica existente | Substituir por solução interna |
| Knip 6.29.0 | Código/deps potencialmente mortos | ISC | Dev | Node 20.19+ | falsos positivos em imports dinâmicos | Adotar em piloto |
| dependency-cruiser 18.1.0 | Fronteiras de módulos | MIT | Dev | JS/JSX, Node 22+ | regra ampla demais bloquear CI | Adotar em piloto |
| Storybook 10.5.4 | Catálogo do Design System | MIT | Fora de produção | React 18 / Vite 8 | setup e manutenção | Adotar em piloto |
| TanStack Table 8.21.3 | Tabelas headless unificadas | MIT | Runtime, a medir | React 18 | duplicação do DataTable atual | Substituir por solução interna |
| React Hook Form 7.83.0 | Formulários com menos renderização | MIT | Runtime, a medir | React 18 | migração de formatos legados | Substituir por solução interna |
| Zod 4.4.3 | Schemas de borda | MIT | Runtime, a medir | JS/TS | coerção silenciosa de valores | Adiar |
| Dexie 4.4.4 | Offline em IndexedDB | Apache-2.0 | Runtime sob demanda | Browsers móveis | conflito/sincronização | Adotar em piloto |
| Workbox 7.4.1 | Cache de shell PWA | MIT | Dev/POC, sem runtime ativo | Vite manual | cache de dados sensíveis | Adotar somente como POC |
| Lighthouse CI 0.15.1 | Orçamento de UX/performance | Apache-2.0 | Dev/artefatos | CI com Chrome | dependência transitiva vulnerável | Reprovado nesta versão |
| Sentry React 10.68.0 | Erros e tracing | MIT | Runtime evitado | React 18/Vite | LGPD e PII | Adiar integração externa |
| Uppy React 5.2.0 | Upload retomável | MIT | Runtime evitado | React 18 | requer servidor Tus/URLs assinadas | Substituir por solução interna |
| TipTap 3.29.0 | Editor editorial estruturado | MIT core | Runtime, a medir | React 18 | extensões e sanitização | Adiar |
| Lexical 0.48.0 | Alternativa de editor estruturado | MIT | Runtime, a medir | React 18 | duplicar editor / POC comparativo | Adiar |
| Storybook Visual / Chromatic | Regressão visual | variável / SaaS | CI | depende de Storybook | screenshots externos | Adiar |
| TypeScript progressivo | Tipos em novas fronteiras | Apache-2.0 | Sem runtime | Vite | migração ampla indevida | Adotar em piloto estrito |

## Sequência aprovada

1. Guardas não funcionais: dependency-cruiser, depois Knip em modo de relatório.
2. Playwright e axe-core num fluxo público/isolado, sem banco de produção.
3. Lighthouse CI com artefatos locais e sem envio de dados reais.
4. UX, offline, upload e editor somente após as POCs anteriores.

## Gate da POC 1 — dependency-cruiser

**Aprovado em 2026-07-26.** A versão 18.1.0 foi instalada apenas como dependência
de desenvolvimento. O comando `npm run architecture:check` percorreu 399 módulos
e 793 dependências sem violação; ele também passa a ser executado no workflow de
qualidade. O teste `src/tooling-architecture.test.js` fixa as quatro regras
iniciais. Bundle, cobertura e regras de negócio permaneceram inalterados.

## Diagnóstico Knip

O Knip 6.29.0 foi executado sem `--fix`. O primeiro diagnóstico achou 555
arquivos por incluir `.agents/`; após a configuração de escopo, foram 30 arquivos
e 62 exports candidatos, sem dependência não usada. Foi adotado apenas como
relatório reproduzível (`npm run quality:knip`), nunca como remoção automática ou
gate bloqueante.

**Gate aprovado em 2026-07-26.** O teste de configuração protege o escopo e a
bateria completa passou com 425 testes, cobertura preservada, build e auditoria
sem vulnerabilidade. A ferramenta não foi colocada como gate de CI porque seus
resultados ainda requerem triagem humana.

## Gate do orçamento interno de bundle

**Aprovado em 2026-07-26.** O medidor interno agora registra limites e violações
no `bundle-metrics.json`: 1,2 MB gzip total, 600 kB para LegacyApp, 275 kB para
planilhas (exceção temporária), 125 kB para gráficos, 100 kB para vendor, 50 kB
para portal e 200 kB para qualquer novo chunk JS. Dois testes cobrem aprovação
da linha de base e rejeição de chunk novo acima do limite.

## POC Playwright + axe-core

**Reprovada por pré-requisito de ambiente e revertida.** A POC de login local
parou antes de renderizar: Chromium informou ausência de `libnspr4.so`, e WebKit
informou outras bibliotecas do host. Não foi instalado `--with-deps`, pois isso
alteraria a máquina fora do escopo do repositório. As duas dependências, o script,
o teste e a configuração foram removidos. A retomada deve usar a imagem oficial
Playwright no CI ou uma estação homologada.

## Gate do Storybook

**Aprovado em 2026-07-26.** Storybook 10.5.4, React Vite e TypeScript 5.9.3
(somente suporte de desenvolvimento) foram adicionados. O catálogo tem 11 histórias
e controles de tema/densidade; `npm run build-storybook` passou e gera 320,55 kB
gzip apenas em `storybook-static/`, ignorado pelo Git e ausente do bundle Vite do
operador. A migração progressiva para TypeScript continua adiada.

## Avaliação DataTable e formulários

**Decisão de não instalar nesta etapa.** `DataTable` já tem filtro, ordenação,
paginação, escolha de colunas, ações de linha e renderização mobile em cartões,
com testes. O editor de fornecedor já mantém dirty state, erro por campo, retorno
de erro do servidor e adaptador que preserva campos legados. TanStack Table e
React Hook Form duplicariam esses comportamentos sem ganho comprovado. Zod fica
adiado até um contrato compartilhado de borda, fora de dados financeiros.

## Gate Dexie — operações de campo offline

**Aprovado em 2026-07-26.** `dexie@4.4.4` foi incluído como dependência de
runtime, sem ser conectado a nenhuma tela ainda. A POC persiste apenas comandos
de campo permitidos, reaplica a chave idempotente após reabrir o banco e mantém
conflitos explícitos. Os testes em IndexedDB simulado também comprovam que um
comando financeiro é recusado. `dexie-react-hooks` segue adiado; não houve cache
de dados financeiros, API, autenticação ou servidor.

## Gate Workbox — shell PWA

**Aprovado somente como POC de build em 2026-07-26.** `workbox-build@7.4.1`
gera um worker não registrado com sete ativos públicos de bootstrap (476.932
bytes no build de referência). O teste impede precache de módulos legados,
planilhas, gráficos e imagens pesadas e o worker não possui rota de API, cache
dinâmico, `clientsClaim` ou `skipWaiting` automático. Ele não será ativado no
app até existir E2E homologado e uma experiência explícita de atualização.

## Gate Lighthouse CI

**Reprovado em 2026-07-26.** A tentativa de instalar `@lhci/cli@0.15.1` abriu
quatro alertas de auditoria, entre eles um alto em `tmp` transitivo, sem correção
compatível indicada. A dependência foi removida e `npm audit --audit-level=high`
voltou a zero. Esta estação também não possui Chrome/Chromium; não foi criado
workflow, script ou relatório que pudesse falhar silenciosamente.

## Gate Uppy — evidências móveis

**Aprovado como solução interna em 2026-07-26.** Uppy/Tus foi avaliado, mas o
backend atual só aceita uma imagem comprimida em uma requisição; não há endpoint
resumível nem URLs assinadas. O pacote não foi instalado. O fluxo de
conferências agora repete falhas transitórias de rede/serviço mantendo o mesmo
nome de arquivo, e bloqueia repetições de permissão ou tamanho inválido.

## Gate TypeScript progressivo

**Aprovado em 2026-07-26.** O primeiro módulo novo não financeiro foi convertido
para TypeScript estrito. `npm run typecheck` verifica somente essa fronteira sem
emitir arquivos e é executado no CI. Nenhum arquivo legado, componente React ou
domínio financeiro entrou no escopo.

## Gate Sentry — diagnóstico local

**Aprovado somente no modo local em 2026-07-26.** O SDK não foi instalado e não
há telemetria externa. A tela de erro agora apresenta uma referência estável e
redige token, senha, PIN, CPF e e-mail antes de mostrar ou copiar o diagnóstico.
Ela também deixou de afirmar que uma ação foi salva: orienta o operador a
confirmar o resultado após recarregar. A integração com Sentry continua bloqueada
até decisão de DPA, região, retenção, responsável e teste de sanitização em
`beforeSend`.

Nenhuma das decisões `Adiar` autoriza instalação. A documentação individual em
[`docs/tools`](./tools/) registra pesquisa, risco, POC e rollback.
