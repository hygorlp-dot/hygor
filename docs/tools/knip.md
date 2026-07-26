# Knip

## Problema

Identificar arquivos, exports, dependências e scripts possivelmente inativos.

## Alternativas

Busca manual com `rg`; não entende exports e pontos de entrada.

## Versão analisada, licença e compatibilidade

`6.29.0`, ISC, Node `^20.19 || >=22.12`. O projeto usa JS/JSX e imports
dinâmicos, portanto a configuração precisa declarar entrypoints.

## Bundle e segurança

Dev-only e sem efeito no bundle. O maior risco são falsos positivos para rotas
Vercel, imports dinâmicos e arquivos de configuração.

## POC

Executar apenas em modo relatório, com entrypoints de Vite, API, testes e scripts.
Nenhum resultado poderá ser removido automaticamente.

O diagnóstico bruto (`knip 6.29.0 --no-exit-code`) encontrou 555 arquivos, mas
incluiu a árvore de ferramentas e fixtures em `.agents/`. A configuração
`knip.json` limita entradas, projeto e exclusões ao ARCD: o segundo diagnóstico
encontrou 30 arquivos e 62 exports candidatos, sem dependência não usada.

## Testes

Comparar cada candidato com build, testes, rotas Vercel e imports dinâmicos.

## Riscos, decisão e rollback

**Adotado em piloto, somente relatório.** O comando `npm run quality:knip` não
possui `--fix`, não bloqueia CI e nenhum candidato foi removido. Cada remoção
precisa provar uso estático/dinâmico, build, teste, rota Vercel e script. O
rollback remove a dependência, `knip.json`, o script e o teste de escopo.
