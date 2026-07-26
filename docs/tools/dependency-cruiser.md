# dependency-cruiser

## Problema

O projeto não possuía uma guarda para impedir que portal, API e design system
atravessem fronteiras arquiteturais proibidas.

## Alternativas

Revisão manual e ESLint customizado; ambos não cobrem o grafo de imports.

## Versão analisada, licença e compatibilidade

`18.1.0`, MIT, Node `^22 || ^24 || >=26`; compatível com o Node e os arquivos
JS/JSX do ARCD. Fonte: repositório e documentação oficial do projeto.

## Bundle e segurança

Ferramenta exclusiva de desenvolvimento: não entra no bundle Vite. Não acessa
dados da aplicação; o risco é regra excessiva bloquear desenvolvimento.

## POC

Configurar somente as fronteiras inequívocas: portal não importa LegacyApp,
design-system não importa domínios, API não importa componentes React e `src`
não importa `postgres`.

## Testes

O comando percorreu 399 módulos e 793 dependências sem violação. `npm test`
aprovou 424 testes, build, lint, métrica de bundle, sintaxe da API e diff check
também passaram. A configuração é coberta por `src/tooling-architecture.test.js`.

## Riscos, decisão e rollback

**Adotado no piloto — gate aprovado.** Regras ficam em arquivo removível e script
isolado. O rollback remove a dependência, o script, a configuração e a etapa de
CI, sem efeito runtime.
