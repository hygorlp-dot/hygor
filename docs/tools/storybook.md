# Storybook

## Problema

Catalogar componentes e temas sem navegar o ERP inteiro.

## Alternativas

Página interna de laboratório e testes Vitest existentes.

## Versão analisada, licença e compatibilidade

`@storybook/react-vite` 10.5.4, MIT; documentação oficial declara suporte a
React >=16.8 e Vite >=5, portanto é compatível com React 18/Vite 8.

## Bundle e segurança

Build separado de produção. Custo está em manutenção de histórias e CI, não no
bundle do operador.

## POC e testes

O POC cria 11 histórias: Button, Input, Select, Badge, TabRow, Card, Dialog,
Drawer, PageHeader, DataTable e MobileRecordCard. A toolbar troca Carbon, claro,
escuro, alto contraste e densidade; DataTable e MobileRecordCard têm viewport
mobile. `npm run build-storybook` foi aprovado e gera saída isolada, fora do
bundle de produção. Acessibilidade automatizada fica pendente da POC Playwright.

## Riscos, decisão e rollback

**Adotar em piloto — gate aprovado.** Não entra no bundle de produção.
Rollback: remover `.storybook`, histórias, scripts e dependências de desenvolvimento.
