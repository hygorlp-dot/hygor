# Zod

## Problema

Schemas reutilizáveis para entradas não financeiras.

## Alternativas

Validadores e normalizadores atuais nas bordas.

## Versão analisada, licença e compatibilidade

`4.4.3`, MIT, funciona em JavaScript e TypeScript. `safeParse` permite retornar
erro estruturado sem exceção.

## Bundle e segurança

Runtime a medir. É proibida coerção implícita de dinheiro, arredondamento ou
descartar campos legados.

## POC e testes

Schema de fornecedor na UI e na borda, mensagens em português e testes válido /
inválido; valores monetários ficam fora da POC.

## Riscos, decisão e rollback

**Adiar.** Antes de schema compartilhado, é necessário definir contrato explícito
de API não financeiro e garantir preservação de campos legados. Depende de um
piloto que não duplique o edit-engine. Rollback remove um schema isolado.
