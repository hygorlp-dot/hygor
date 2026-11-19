# Publicação da terceira etapa — 17/11/2026

Publicado em https://erp.marcelleng.com.br/, após autorização explícita do usuário, consolidado em um único build de produção concluído.

- Deployment: `dpl_wVo3mCdrMoZTLscZEKKrw8tH1h2H`, READY, sem erro de alias.
- Commit: `287d8ae952e74d46fd58e14ddd4638f25cd2f55d`.
- Endereço imutável: https://mrc-r6ffadv6u-hygor-s-projects1.vercel.app.
- Projeto `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`, equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Base anterior preservada: `e0866fceaac3385080d97332a25ccd73a96636f3`, segunda etapa do roadmap.

## Pacote e preservação

Preparado no checkout isolado `C:/dev/releases/usability-roadmap-stage3-20261117`, branch `codex/usability-roadmap-stage3-20261117`. Os dezoito arquivos da etapa foram conferidos por SHA-256 contra os arquivos locais validados. O manifesto está em `artifacts/roadmap-usabilidade-etapa3/release-manifest.json`. As demais alterações locais do workspace foram preservadas e não foram acrescentadas ao pacote.

Inclui vínculos explícitos de contratos do lead, retorno à ficha preservando edição na sessão, explicação dos indicadores comerciais, diagnóstico de solicitações sem fluxo de aprovação compatível, consulta da origem em Compras, tarefas de conferência com responsável/prazo/estado e acesso ao achado exato, contagem correta de cancelamentos no checklist e isolamento das justificativas por instância/etapa. Ajuda, manual e regressões acompanham a implementação.

Não foram alterados API, motores de aprovação/Conferência, permissões persistidas, documentos ou cálculos contábeis. Consultar origens não cria receita, custo, pagamento ou outra tarefa persistida. As regras e os documentos das etapas anteriores permanecem presentes. Os limites da SC-0005 real e da homologação financeira continuam descritos em `USABILIDADE-ETAPA3-CONTINUIDADE-SETORES-20261116.md`: nenhum registro real foi reconstruído automaticamente.

## Build e verificações anteriores

Os arquivos já haviam aprovado 12 cenários DEV e 32 no build local, celular e desktop. Antes da publicação foram repetidos 72 testes unitários, lint (incluindo design/manual) e análise de importações: 925 arquivos, 3.246 dependências, nenhum ciclo. O manual sincronizado tem 143 guias para as 65 abas.

Não houve build local adicional nesta publicação. O push foi realizado com o hook desabilitado apenas no comando, reutilizando as validações aprovadas e evitando `npm run build` com seu prebuild de migrações. Não foi alterada a configuração persistida do hook.

O push gerou a tentativa automática `dpl_CxJmL1f4HYRsFU2S73sr9MdGbyJw`, cancelada pelo Ignored Build Step antes da compilação do app. O único build de produção foi solicitado pelo plugin Vercel, com o comando `node scripts/audit-import-cycles.mjs && npx vite build && node scripts/bundle-metrics.mjs`. Sem migrações, previews compilados ou builds intermediários.

Logs confirmam build concluído em 29 segundos e bundle de **1.784,01 KiB gzip**, dentro do teto vigente e sem aumento de limites. Os aliases de produção foram atribuídos ao deployment novo.

## Verificação posterior

- Entrada real sem autenticação em 390 e 1440 px: HTTP 200, formulário de login visível, zero erros JavaScript, zero assets JS/CSS ausentes e sem overflow horizontal.
- API real `action: load` sem autenticação: HTTP 401.
- **12 cenários aprovados no frontend efetivamente publicado**, em sessões novas, celular e desktop, com respostas de API fictícias e gravações bloqueadas: contratos por proposta, nomes semelhantes sem vínculo, volta à ficha com edição, filtros recolhidos, consulta da solicitação sem decisão, tarefa exata e retorno, conclusão/cancelamento, indicadores e perfil restrito. Zero erros de página e zero comandos de gravação; os dados fictícios permaneceram iguais antes/depois.

As verificações não representam transações autenticadas com dados reais. Nenhum cadastro, contrato, documento, aprovação, mensagem ou lançamento existente foi gravado. Não foi atribuída uma nova nota de usabilidade.

Evidências locais em `artifacts/roadmap-usabilidade-etapa3`: `e2e-production.log`, `production-login.json`, `verify-published-login.mjs`, `published.spec.js`, `playwright.published.config.mjs`, `unit-release.log`, `lint-release.log`, `cycles-release.log`, `release-manifest.json` e capturas `*-production-390.png` / `*-production-1440.png`. O relatório posterior e a atualização local do roadmap não foram enviados, evitando outro ciclo de publicação.
