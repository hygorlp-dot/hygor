# Architecture Recovery Log

## 2026-08-13 — checkpoint 001

Base original: `ef5ad21681e76049e8f302eb3ed4fe18da86b705`

Correção de caracterização aplicada de forma determinística:

- smoke de Compras deixou de procurar o rótulo removido `CRIAR ITEM PRÓPRIO`;
- o fluxo passa a selecionar `Adicionar somente a esta solicitação`, que é o contrato visual presente no snapshot de falha do Playwright;
- nenhuma regra de negócio foi alterada nesta correção;
- o workflow descartável usado para editar o arquivo E2E grande se removeu no mesmo commit.

Próximo gate: executar `Qualidade` no HEAD produzido por este checkpoint e usar as falhas remanescentes como baseline para redução do bundle e auditoria de dependências.
