# Publicação da central Arquivos — 31/10/2026

Autorização do usuário: publicar a aba Arquivos com visualizador nativo e anexos de prefeitura/cartório, mantendo o armazenamento existente.

- Produção: https://marcellapp.vercel.app/
- Vercel: projeto `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`.
- Deployment: `dpl_CeWcSiZeiRwtikCNuGv5x12f9zMs`, estado READY.
- URL imutável: https://mrc-9bfuhsbtg-hygor-s-projects1.vercel.app/
- Base preservada: `5b82a081a676c0bcb7ba79eb98eb8cd147486031`, versão de produção anterior com sincronização de RH.
- Cópia isolada: `C:/dev/releases/arquivos-native-20261031`, branch local `codex/arquivos-native-release-20261031`.

Foram aplicadas somente as alterações de Arquivos e suas integrações à navegação, projeção e comandos. O handler de RH e o restante do código da produção foram preservados; não houve substituição integral de LegacyApp.jsx ou api/data.js pelas versões antigas da pasta de trabalho.

Validação na cópia de publicação: 290 testes em 12 arquivos, sete cenários Playwright (desktop/celular, PDF, revisões, acesso negado, recuperação e referência externa), lint, typecheck e build aprovados. A publicação usou um único build de produção, preparado sem mudar o domínio principal e promovido após confirmar os assets.

Verificação pública: página principal HTTP 200 com `index-B87VCS40.js`; módulos `ArquivosView-CHbReIL-.js` e `PdfDocumentPreview-Bajx94jX.js` HTTP 200. Requisição sem sessão à API devolveu 401. Não foram feitas gravações de documentos reais para testar produção.

Artefatos, credenciais, testes, servidores de demonstração e uploads fictícios foram excluídos do envio. Os exemplos continuam no ambiente local 4203. A pesquisa e o backlog estão em REFERENCIAS-ARQUIVOS-NATIVOS.md.

A publicação foi feita diretamente pela CLI, sem push nem preview intermediário. Para uma publicação posterior preservar Arquivos, utilizar a branch/cópia desta entrega ou integrar suas alterações à base que será publicada; a branch remota main não foi alterada por esta operação.
