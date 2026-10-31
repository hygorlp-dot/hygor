# Publicação de Arquivos, dossiê e ajuda — 31/10/2026

Autorização: atualizar a ajuda contextual e o manual e publicar as melhorias locais aprovadas de Arquivos e do dossiê de licenciamento.

- Produção: https://marcellapp.vercel.app/
- Projeto: `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`.
- Deployment publicado: `dpl_E89RATuiYhxEmzP5v7syDeatKeZF`, READY, promovido sem rebuild.
- URL imutável: https://mrc-ikinf8a20-hygor-s-projects1.vercel.app/
- Código publicado: commit local `9945ae35`, branch `codex/arquivos-dossie-local-20261031`.
- Checkout: `C:/dev/releases/arquivos-dossie-local-20261031`.

Inclui aviso de revisão antiga, busca de texto extraível em PDF (sem OCR), comparação visual, permissões herdadas por pasta e leitura autenticada; cadastro do dossiê compartilhado com Licenciamento, nomes padronizados, revisões preservadas, ZIP final bloqueado por pendências e ZIP parcial INCOMPLETO com índice, manifesto e pendências. O ZIP é baixado para conferência e envio manual; não há protocolo automático nos órgãos.

Ajuda e manual compartilham `src/features/help/help-content.js`. Os guias `arquivos`, `arquivos_revisoes`, `arquivos_dossie` e `licenca` foram atualizados; o contexto acompanha o cadastro e o visualizador. `docs/MANUAL_DO_APP.md` foi regenerado: 88 guias cobrem 65 abas. Execute `npm run manual:generate` e `npm run manual:check` ao alterar a fonte.

## Preservação de produção e concorrência

A base de produção inicial era `dpl_5QCgtdk9aJ6omhunsuNnzuvfhs3v`, correspondente à atualização de almoço/escala de Ponto (`edf48315`), incorporada antes da publicação. Enquanto o primeiro build era validado, outro chat publicou a tolerância de Ponto (`4f03706c`, deployment `dpl_CfkmpED43eRhCpP2AKGCLCmj7Y1f`). A conferência do alias detectou a troca e impediu a promoção do build anterior.

A tolerância foi incorporada pelo merge `9945ae35`, seus três arquivos de execução foram comparados por SHA-1 com a fonte publicada, e a validação foi repetida. O build anterior `dpl_Abk3ERcS4Z1jsftVc5QZrrJYf9ZL` não foi promovido. O build final preserva ambas as atualizações de Ponto.

Nenhuma mudança experimental posterior de Compras, Recebimento, Fiscal, Pagamento ou Estoque da pasta compartilhada foi incluída. O subsistema de ajuda foi importado como snapshot antes desses experimentos e apenas os tópicos de Arquivos/licenciamento foram alterados para esta publicação.

## Validação

- 164 testes em 15 arquivos: ajuda, Arquivos, licenciamento, projeção/permissões, leitura autenticada e regressões de banco de horas/almoço/tolerância.
- 14 cenários Playwright, desktop 1440 px e celular 390 px: ajuda contextual/manual, anexos, revisões, busca, comparação, ZIP parcial, bloqueio do final, pastas e permissões, recuperação de falha e catálogo do condomínio.
- Lint, typecheck, build direto do Vite e sincronização do manual aprovados.
- Revisão independente da ajuda: `ship`, sem achado material no escopo; conferência documental confirmou sincronização e limites.
- Após promoção: página pública e chunks `ArquivosView-MbVFmVZg.js`, `HelpPanel-D-HrEd25.js`, `PdfReader-DHQ9GX-T.js` e dependências HTTP 200; POST sem sessão a `/api/data` e `/api/microsoft/onedrive` HTTP 401.
- Entrada pública conferida: `/assets/index-CQolWNYc.js`.

Relatórios e capturas locais em `artifacts/arquivos/`, incluindo `release-tests.log`, `release-e2e.log`, `public-verification.json` e `help-dossier-1440.png`/`390.png`. Não foram gravados documentos reais para testar produção.

O envio excluiu credenciais, testes, capturas, uploads fictícios e servidores de demonstração. A publicação foi feita pela CLI e promovida pelo conector Vercel; não houve push, PR ou alteração da branch remota main. Uma publicação posterior deve partir desta versão ou integrar seus commits, preservando também as atualizações já publicadas de Ponto. Não publicar a pasta compartilhada inteira com experimentos locais.
