# Correção local de preload CSS — 31/10/2026

Diagnóstico recebido: ARCD-132JB2I, Unable to preload CSS for conferencia-batidas-BJTRqjMZ.css.
A URL de produção retornou HTTP 200 e text/css durante a investigação. Isso não permite determinar a causa da falha original de rede. O problema reproduzido é a rejeição definitiva do carregamento React.lazy após um único erro de transporte de CSS.

O runtime de preload do Vite marca as dependências como vistas antes de aguardar as folhas. Repetir somente import() pode abrir o módulo sem estilos. A correção aguarda uma nova requisição das folhas locais sem sheet, com URL nova, antes de repetir o import uma vez. Preserva CSP nonce; não repete erro de negócio/JS; limita a espera a 8 segundos. Falhas persistentes seguem para o ErrorBoundary existente. Não há recarga nem alteração de dados na recuperação bem-sucedida.

Aplicação: pontos de entrada App, OperationalApp e módulos lazy do LegacyApp. Outros carregamentos independentes não foram refatorados.

Validação: 20 testes em cinco arquivos passaram; lint, tipos e build Vite passaram. scripts/verify-css-recovery.mjs executou build real com a requisição CSS bloqueada: sem correção a tela falhou; com correção, 320/390/1280 px recuperaram estilos e preservaram input sem recarga; bloqueio persistente encerrou após duas requisições. Evidências: artifacts/css-recovery/results.json e recovered-*.png. O teste usa uma superfície isolada de reprodução, sem autenticação nem dados de produção.

Sem push ou deploy nesta etapa. Alterações anteriores do checkout preservadas.
