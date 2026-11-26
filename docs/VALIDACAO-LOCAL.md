# Validação local do MARCELL

Revisão: 24/11/2026. Este roteiro é para desenvolvimento no checkout local.
Não publica código, não autoriza acesso de escrita à produção e não substitui
a validação de implantação. As regras compartilhadas estão em [AGENTS.md](../AGENTS.md).

## Preparação

1. Confira `git status --short` e o diff dos arquivos envolvidos. Preserve as
   mudanças de outras tarefas; não limpe nem reverta o checkout para validar.
2. Leia os scripts de `package.json`, a configuração e os testes selecionados.
   Confira destinos externos pelo nome/configuração, sem imprimir credenciais.
3. Reutilize as dependências instaladas. Instalação ou atualização deve ter
   motivo próprio; `npm install` e `npm ci` podem executar o `prepare`, que
   configura os hooks Git. Não são passos obrigatórios de toda validação.
4. Use um processo por recurso compartilhado: build em `dist`, servidor/porta,
   arquivo de relatório ou banco descartável. Não encerre processos de outras tarefas.

## Verificações sem o prebuild de produção

```powershell
npm run validate:local
```

Executa, nesta ordem, `lint`, `architecture:check`, `typecheck` e `build:local`.
Interrompe na primeira falha. Não executa a suíte de testes: selecione os testes
necessários abaixo e registre o resultado separadamente. Não há hooks
`prevalidate:local`, `postvalidate:local`, `prebuild:local` ou `postbuild:local`
na configuração revisada; confira essa condição ao modificar esses comandos.

| Comando | O que verifica | Limite e efeito local |
| --- | --- | --- |
| `npm run lint` | Fronteiras financeiras, nomes não declarados, armadilhas de UI, regras de UX, design e manual | Verificações específicas, não um ESLint geral. Não atualizar baselines para liberar desvios. |
| `npm run architecture:check` | As fronteiras de imports aprovadas em `.dependency-cruiser.cjs` | Não comprova toda a arquitetura ou todos os vínculos de negócio. |
| `npm run typecheck` | Os módulos do piloto em `tsconfig.quality.json` | A checagem de JavaScript é habilitada por arquivo com `@ts-check`. |
| `npm run build:local` | Compilação Vite com dependências locais | Executa o Vite diretamente, sem chamar `npm run build`/`prebuild`; gera ou substitui `dist`. Não valida APIs ou migrations. |
| `npm run manual:check` | Cobertura de abas e sincronização entre ajuda e manual | Já incluído no lint; não substitui revisão humana do texto. |

Para compilar isoladamente:

```powershell
npm run build:local
```

O equivalente direto é `node node_modules/vite/bin/vite.js build`. Não há
download implícito de um Vite ausente: se não estiver instalado, o comando falha.

## Testes conforme a alteração

Antes de executar testes, confira se usam mocks, PGlite ou banco descartável.
Testes que recebem `PONTO_PG_URL` podem gravar SQL real: nunca apontar essa
variável para a produção. Um nome terminado em `.test.js` não comprova isolamento.
Não carregar `.env` de produção para completar uma suíte.

```powershell
node node_modules/vitest/vitest.mjs run caminho/do/arquivo.test.js
```

Troque o caminho pelo teste real afetado. Para a suíte completa, depois de
conferir ambiente e destinos: `npm test`. Testes pulados por falta de PostgreSQL
não comprovam integração com banco; registre o que ficou sem executar.

| Mudança | Validação adicional necessária |
| --- | --- |
| Documentação e comandos de desenvolvimento | Conferir links, comandos, preservação das regras e diff; validar os comandos introduzidos. |
| Regra ou integração financeira | Cenário comum na tela, motor e DRE do servidor; rastrear origem, consumidores, unidades e status; revisão conforme `dre-integration-guardian`. Distinguir previsão, compromisso, estoque, custo e pagamento. |
| API, autenticação ou permissões | Testes do handler e consumidores, incluindo negação/403 e isolamento por empresa/obra quando aplicável. |
| Migration ou concorrência SQL | PGlite executando SQL; PostgreSQL real descartável quando locks, driver ou concorrência exigirem. Preservar `.down.sql` e ordem de implantação. |
| Interface, navegação ou ajuda | Skills obrigatórias, design/manual e navegação real nos temas Preciso e Noite, desktop 1440 px e celular 390 px; foco, teclado e estados. |
| Ponto de Obra | Seguir `apps/ponto-obra/AGENTS.md` e o escopo do release check; não executar EAS, publicação ou mudanças REP-P fora da autorização. |

Para navegador, inspecione o spec e o `playwright.*.config.*` escolhido antes
de executar: confirme `baseURL`, backend de teste e ausência de escrita remota.
Use o binário instalado, por exemplo
`node node_modules/@playwright/test/cli.js test --config playwright.config.js --project queue-views-desktop`.
Playwright pode iniciar servidor e gravar evidências locais; um servidor já
ativo na porta não é automaticamente o backend correto.

## Comandos que exigem outro contexto

- `npm run build` mantém o `prebuild` vigente, incluindo rotinas de banco,
  prontidão financeira, catálogo e fechamento de acesso público. Não trocar
  pelo build local numa implantação autorizada.
- `financial:*`, `*:migrate*`, scripts de seed/backfill e rotinas de storage
  precisam de inspeção e destino explicitamente autorizado. Não são verificações
  inofensivas por conterem palavras como shadow, check ou status.
- O hook `.githooks/pre-push` continua executando `npm run build`; não usá-lo
  como atalho de validação local. Ele não inclui `typecheck`; a CI inclui.
  Push e deploy dependem de autorização própria e não foram habilitados aqui.
- `npm run quality:bundle` grava um relatório e depende do build correspondente;
  `quality:knip` é diagnóstico sem remoção automática. `manual:generate` grava o
  manual. Esses efeitos devem ser registrados quando usados.

## Evidência e conclusão

Registre data, checkout, arquivos, comando exato, código de saída, escopo e
resultado. Diferencie falha, aprovado, pulado e não executado. Uma falha
preexistente não pode ser escondida ou atribuída automaticamente a esta mudança;
investigue sem descartar alterações locais. Nenhum comando isolado comprova o
funcionamento integral do ERP. Use [o roteiro de retomada](RETOMADA-DE-TAREFAS.md)
quando houver trabalho pendente.
