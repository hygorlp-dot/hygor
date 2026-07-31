# TanStack Table

## Problema

Tabelas precisam de modelo comum com desktop em tabela e mobile em cards.

## Alternativas

DataTable ARCD existente, já tematizado e com menor custo imediato.

## Versão analisada, licença e compatibilidade

`@tanstack/react-table` 8.21.3, MIT, React >=16.8; é headless e compatível com
React 18, sem TypeScript obrigatório.

## Bundle e segurança

Runtime adicional a medir no piloto; não manipula dados por si só.

## POC e testes

O DataTable ARCD já foi conferido com teste de filtro, ordenação, paginação,
colunas visíveis, carregamento, ações e cartões mobile. Portanto o piloto de
Fornecedores/Equipamentos apenas repetiria funcionalidades existentes.

## Riscos, decisão e rollback

**Substituir por solução interna.** Novos requisitos entram primeiro no DataTable
ARCD e só justificam reavaliação se precisarem de virtualização ou estado externo
que não possa ser adicionado com teste. Rollback não se aplica: nada foi instalado.
