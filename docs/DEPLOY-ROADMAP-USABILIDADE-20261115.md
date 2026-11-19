# Publicação da primeira etapa de usabilidade — 15/11/2026

**Publicado e conferido:** https://erp.marcelleng.com.br/.

- Deployment: `dpl_Dkh3utSTR1P71kU59BZskqgdvtvf`, READY, sem erro de alias.
- Versão: `e297fbe5c62c532af71ffa53eadf15af8aa0a29e`.
- Endereço imutável: https://mrc-b2f1s2drl-hygor-s-projects1.vercel.app.
- Projeto `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`; equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Autorização explícita do usuário: “deploy”, após a implementação local da primeira etapa.

## Conteúdo e preservação

A publicação parte exatamente de `c6fccb0de467533efee5d40042dfe5583265a7be`, que estava em produção antes desta entrega. O pacote foi preparado no checkout isolado `C:/dev/releases/usability-roadmap-20261115`, na branch `codex/usability-roadmap-20261115`. Dez arquivos foram acrescentados ou atualizados: implementação, ajuda/manual, regressões e documentação desta etapa. As cópias de entrada foram conferidas por hash com os arquivos validados do workspace principal.

Inclui:

- Remoção da sobrescrita antiga de hover que tornava o fundo de botões transparente.
- Estabilidade do cabeçalho comercial para devolver o foco ao cancelar o cadastro de lead.
- Orientação em português dos bloqueios do fechamento, consulta da origem e diagnóstico recolhido.
- Ajuda e manual atualizados.

API, servidor, permissões, integrações de OneDrive e regras financeiras não foram modificados. Os demais arquivos e alterações locais do workspace foram preservados. A consulta de origem reutiliza identificadores existentes; diferenças de diagnóstico não viram lançamentos. Esta publicação não corrige os dados financeiros apontados pelo motor nem homologa competências.

## Build e custo de publicação

O comando remoto foi explicitamente `node scripts/audit-import-cycles.mjs && npx vite build && node scripts/bundle-metrics.mjs`. Não foi executado `npm run build` com o prebuild de migrações. O push teve marcadores de pulo de CI/publicação automática; a Vercel registrou uma tentativa automática (`dpl_GHau1fzZpp5mAdXBUizuDxKEQsoL`), cancelada porque o Ignored Build Step retornou zero para a branch sem PR. Não houve compilação do app nessa tentativa.

Foi solicitado e concluído **um único build de produção**, pelo plugin conectado da Vercel. Os logs confirmam orçamento aprovado: **1.776,65 KiB gzip**, abaixo do teto vigente de 1.891.328 bytes, sem aumento de limites. Os aliases de produção apontam para o deployment novo, incluindo o ERP, marcellapp, pontosarcd e os demais domínios do projeto.

## Validação

Antes da publicação: 41 testes pertinentes aprovados novamente; grafo com 918 arquivos e 3.202 dependências, sem ciclos estáticos ou dinâmicos. A implementação também havia aprovado 20 cenários de navegador entre DEV e build, quatro temas, celular/desktop, lint, design, tipos e manual.

Depois da publicação:

| Conferência | Resultado |
|---|---|
| Entrada real, sem autenticação, 390 e 1440 px | HTTP 200, login visível, nenhuma exceção JavaScript ou JS/CSS ausente e sem overflow da página |
| API real sem autenticação, `action: load` | HTTP 401 |
| Frontend publicado com APIs interceptadas e dados fictícios, 390 e 1440 px | Novo lead mantém fundo azul em hover e recupera o foco ao cancelar |
| Frontend publicado com APIs interceptadas e dados fictícios, 390 e 1440 px | Bloqueio explicado, origem consultada e fechamento desabilitado diante da inconsistência; zero comandos de gravação, erros de página ou assets ausentes |

As verificações operacionais posteriores usaram o JavaScript/CSS efetivamente publicado, mas respostas de API fictícias interceptadas no navegador. Elas não representam uma nova transação autenticada com dados reais. Nenhum cadastro, documento, recebimento, pagamento, aprovação ou fechamento real foi gravado por esses testes.

O primeiro roteiro sintético teve uma falha de navegação do próprio teste ao recarregar a seção e ao localizar o disclosure desktop por um papel inadequado. O roteiro foi corrigido para usar a navegação existente e repetido com sucesso; o timeout não foi atribuído ao app.

Evidências: `artifacts/roadmap-usabilidade-etapa1/production-closing-verification.json`, `verify-published-closing.mjs`, screenshots `production-login-*`, `production-synthetic-leads-*` e `production-synthetic-closing-*`. Os relatórios posteriores à publicação permanecem locais; não provocam outro build.

A nota da auditoria anterior não foi aumentada automaticamente. As demais etapas do roadmap continuam pendentes.
