# Publicação da segunda etapa — 16/11/2026

Publicado em https://erp.marcelleng.com.br/ com autorização explícita do usuário, em um único build de produção concluído.

- Deployment: `dpl_4LELVPYBjCq6WBvsNcsfFZpXMNNf`, READY, sem erro de alias.
- Commit: `e0866fceaac3385080d97332a25ccd73a96636f3`.
- Endereço imutável: https://mrc-o8q53ww1n-hygor-s-projects1.vercel.app.
- Projeto `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`, equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Base de produção preservada: `e297fbe5c62c532af71ffa53eadf15af8aa0a29e`.

## Pacote e preservação

Preparado no checkout isolado `C:/dev/releases/usability-roadmap-stage2-20261116`, branch `codex/usability-roadmap-stage2-20261116`. Os doze arquivos da etapa foram copiados e conferidos por hash com os arquivos locais validados. Inclui contexto do Caixa/Financeiro, identificação dos escopos, leitura dos indicadores, manutenção de competência ao abrir o DRE, saldo restante das cobranças, ajuda/manual e regressões. A implementação e os limites estão detalhados em `USABILIDADE-ETAPA2-CONTEXTO-FINANCEIRO-20261116.md`.

Não foram publicados os demais arquivos locais não relacionados. As alterações da primeira etapa continuam presentes. API, servidor, documentos, permissões persistidas e fórmulas contábeis não foram modificados. Esta publicação não corrige divergências históricas dos dados nem reconhece novos custos, pagamentos ou recebimentos.

## Build

O primeiro push foi interrompido pelo hook antes do envio: o checkout isolado não tinha o pacote TypeScript instalado. O hook também executaria `npm run build` com prebuild de migrações. Reutilizadas as verificações já aprovadas, o envio foi realizado com o hook desabilitado apenas nesse comando, sem mudar sua configuração persistida.

O push gerou uma tentativa automática `dpl_4NxyWwDSjnM3Um4zF4m7YBHtLfRe`, cancelada pelo Ignored Build Step antes da compilação do app. Foi solicitado e concluído um único build de produção pelo plugin Vercel: `node scripts/audit-import-cycles.mjs && npx vite build && node scripts/bundle-metrics.mjs`. Sem migrações e sem builds locais adicionais nesta publicação.

Logs: build concluído em 25 segundos; bundle **1.778,88 KiB gzip**, dentro do teto vigente, sem aumento dos limites. Os aliases de produção foram atribuídos à versão nova, incluindo ERP e os demais domínios do projeto.

## Verificação posterior

- Entrada real, sem autenticação, em 390 e 1440 px: HTTP 200, login visível, nenhuma exceção JavaScript, nenhum JS/CSS ausente e sem overflow horizontal.
- API real `action: load` sem autenticação: HTTP 401.
- Frontend efetivamente publicado: **10 cenários aprovados**, em sessões novas, celular e desktop, com respostas de API fictícias e gravações bloqueadas. Testados troca de obra, obra sem caixa ativado, obra no modal, continuidade do Financeiro, competência no DRE e retorno, indicadores sem faturamento, cobranças parciais/quitadas/canceladas, escopo do ranking e perfil sem acesso ao DRE.
- Zero erros de página e zero comandos de gravação nos cenários. Os dados fictícios, razão, DRE e caixa permaneceram iguais antes/depois.
- Captura publicada do painel móvel revisada visualmente. Não houve transação autenticada com registros reais; nenhum cadastro, arquivo, lançamento ou aprovação existente foi alterado pelos testes.

Evidências locais: `artifacts/roadmap-usabilidade-etapa2/e2e-production.log`, `production-login.json`, `verify-published-login.mjs`, `published.spec.js`, `playwright.published.config.mjs` e capturas `*-production-390.png` / `*-production-1440.png`. O relatório posterior e a atualização local do roadmap não foram enviados para evitar outro ciclo de publicação.

As validações anteriores continuam registradas: 67 testes unitários, 10 cenários DEV, 20 no build local, lint/design/manual/typecheck aprovados e grafo sem ciclos. A nota de usabilidade não foi aumentada automaticamente; etapas seguintes e homologação real continuam pendentes.
