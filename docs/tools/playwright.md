# Playwright

## Problema

Vitest/JSDOM não valida jornadas, foco e visual em navegadores reais.

## Alternativas

Somente testes unitários; insuficiente para login, mobile, portal e anexos.

## Versão analisada, licença e compatibilidade

`@playwright/test` 1.62.0, Apache-2.0, Node >=20. A documentação oficial suporta
Chromium, Firefox e WebKit, screenshots e trace em falhas.

## Bundle e segurança

Dev-only, sem bundle de produção. Browsers aumentam tempo/armazenamento de CI;
testes usarão base isolada e jamais produção.

## POC

Foi criada uma jornada de login local sem credenciais e executada em Chromium.
O browser não iniciou: falta `libnspr4.so` nesta máquina. A instalação de WebKit
também reportou bibliotecas gráficas/mídia ausentes. Não houve acesso a produção.

## Testes

O teste foi removido junto à POC para não deixar a suíte falhando. A retomada
exige imagem CI oficial do Playwright ou máquina homologada com `playwright
install --with-deps`; então deve cobrir Chromium e WebKit, com trace em falha.

## Riscos, decisão e rollback

**Adiar — gate reprovado por pré-requisito de ambiente.** O rollback removeu
configuração, teste e dependência; nada de runtime foi alterado.
