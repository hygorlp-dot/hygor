# Publicação web de homologação pelo Git

Esta pasta é uma entrada de publicação do app existente. Ela não contém outro cadastro, outro motor financeiro ou outro backend.

O projeto isolado `ponto-homologacao` usa:

| Configuração | Valor |
| --- | --- |
| Root Directory | `apps/homologacao` |
| Incluir arquivos fora da raiz | `true` (`sourceFilesOutsideRootDirectory`) |
| Framework | Other / `null` |
| Node | `24.x` |
| Instalação remota | `cd ../.. && npm ci --ignore-scripts --include=dev` |
| Build | `node build.mjs` |
| Output Directory | `public` |

`rootDirectory` e `sourceFilesOutsideRootDirectory` são configurações do projeto/deployment, não chaves deste `vercel.json`. O acesso aos arquivos fora da raiz é necessário para reutilizar `src`, `public`, a configuração Vite, o lockfile e a função NTP do repositório.

## Como funciona

O build chama o Vite diretamente com a configuração canônica e uma pasta de saída própria. Não executa o `prebuild` do pacote principal, que contém migrações. A instalação remota usa o lockfile já existente, ignora scripts de instalação e inclui as dependências de desenvolvimento necessárias ao Vite.

A saída pública contém apenas os arquivos do manifesto atual, `index.html` e os arquivos públicos originais. Mapas de código e o manifesto de conferência não são servidos. Os relatórios locais `build-report.json` e `build-manifest.json` também ficam fora da saída e são ignorados pelo Git.

`/api/data`, `/api/upload`, `/api/presence` e `/api/ai-agent` usam as mesmas rewrites do gerador de homologação. A rota de IA permite somente `daily-brief`, que usa fontes públicas; ações de provedor externo são explicitamente desativadas no roteador isolado. A única função Node local é `/api/homologacao-time`, que reexporta a ponte NTP existente. Não há credencial do banco, cron ou configuração de recurso pago nesta entrada.

Com dependências já instaladas, a conferência local é:

```bash
node apps/homologacao/build.mjs
```

Esse comando limpa somente `apps/homologacao/public`. Não altera `dist`, `node_modules` ou a configuração da publicação principal.

## Deploy pelo conector

Depois de o commit candidato existir no GitHub, usar `create_deployment` no projeto `prj_W7s5zALWmMuV4Wt5WePSz8ABAefp` e time `team_poBZ5I1rwStzhvD73ar22b7v`, com `gitSource.type: "github"`, `repoId: 1238768573`, `ref` da branch candidata e `sha` do commit exato.

Informar `projectSettings.rootDirectory: "apps/homologacao"`, `sourceFilesOutsideRootDirectory: true` e as configurações acima. O alvo `production` nesse projeto significa o endereço estável **isolado** `ponto-homologacao.vercel.app`; não é o projeto operacional da construtora. Não alterar o vínculo Git ou a branch principal do projeto de produção.

O deploy ainda depende de a conexão Vercel–GitHub ter acesso ao repositório. A configuração local e o build aprovado não comprovam que um deployment remoto ficou `READY`. Conferir estado, commit, tela inicial, login, documentos e ponte NTP após a publicação.

## Conferência local de 25/10/2026

O build terminou em 2,30 segundos, com 114 arquivos e 9.924.981 bytes. Foram verificadas 243 referências entre arquivos JavaScript, todas presentes. A saída não contém mapas de código nem arquivos ocultos. A entrada da função NTP importou exatamente a implementação existente e empacotou com sucesso para Node 24.

O build local usou as dependências já instaladas. Não houve instalação de pacotes, alteração de `dist`, acesso ao banco ou publicação por esse comando. Os avisos de chunks grandes continuam presentes no Vite e não foram ocultados.

Referências oficiais consultadas em 25/10/2026: [configuração de build](https://vercel.com/docs/builds/configure-a-build), [arquivos compartilhados em monorepo](https://vercel.com/docs/monorepos/monorepo-faq) e [contrato GitSource do SDK](https://github.com/vercel/sdk/blob/main/docs/models/createdeploymentgitsource1.md).
