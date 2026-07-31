# React Hook Form

## Problema

Uniformizar estado de formulário, dirty state e mensagens junto aos campos.

## Alternativas

Estado local atual e adaptadores de formulário existentes.

## Versão analisada, licença e compatibilidade

`7.83.0`, MIT, compatível com React 18. Documentação oficial prioriza campos
não controlados e integrações por controller/resolvers.

## Bundle e segurança

Runtime a medir. Não substitui validação do servidor.

## POC e testes

O editor de fornecedor já faz exatamente este piloto via `useEntityEditor`:
preserva campos por adapter, tem dirty state, reset, erros de validação e erros do
servidor. A troca acrescentaria um segundo estado de formulário sem reduzir risco.

## Riscos, decisão e rollback

**Substituir por solução interna.** Evoluir o edit-engine apenas com requisito
ausente e teste correspondente. Nada foi instalado ou migrado.
