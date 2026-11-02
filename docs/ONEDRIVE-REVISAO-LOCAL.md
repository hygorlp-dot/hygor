# OneDrive na revisão local do financeiro

O servidor `node scripts/finance-real-data-preview.mjs` atende o MARCELL em
`http://127.0.0.1:4192/`, com login habitual e dados reais em modo de leitura.
O adaptador `scripts/local-onedrive-review.mjs` substitui exclusivamente neste
processo a rota OneDrive de produção. Não usa a sessão central nem a atualiza.

## Configuração

1. Manter `MICROSOFT_CLIENT_ID` e `MICROSOFT_CLIENT_SECRET` no `.env.local`,
   ignorado pelo Git. Reiniciar o servidor após mudar essas variáveis.
2. No Microsoft Entra, abrir o registro do aplicativo → Autenticação →
   adicionar uma URI de redirecionamento da plataforma **Web**:
   `http://localhost:4192/api/local-onedrive/callback`.
   Preservar os endereços, segredos e permissões existentes de produção.
3. Abrir `http://localhost:4192/api/local-onedrive/connect` no navegador e
   autenticar a conta Microsoft com acesso aos documentos das obras.
4. Após o retorno automático ao MARCELL, entrar com o login habitual da empresa.
   A sessão Microsoft é mantida somente na memória deste servidor. Reiniciar o
   processo exige conectar novamente. Não há persistência de tokens no banco,
   nos arquivos do repositório, em URLs ou no armazenamento do navegador.

O login solicita `Files.Read` e `offline_access`. Usa PKCE, estado aleatório
válido por dez minutos, cookie HttpOnly e validação de callback de uso único.
Os segredos ficam exclusivamente no servidor.

## Leitura dos originais

As ações `status`, `file-link` e `list-folder` exigem a autenticação existente
do ERP. Arquivos e pastas são validados contra as pastas das obras permitidas
ao usuário. A listagem percorre as páginas existentes e não cria pastas.
O leitor recebe links assinados válidos por dez minutos e o download não
encaminha o token Microsoft ao servidor de armazenamento. Reabra a ficha para
solicitar um link novo quando o anterior expirar.

Uma referência somente ao ID do documento precisa também do ID do drive e de
uma obra previamente vinculada. A conexão não associa arquivos automaticamente
a lançamentos, não corrige vínculos ausentes e não cria notas fiscais. Links
externos já existentes continuam sujeitos ao login do provedor no navegador.

Uploads, criação ou movimentação de pastas, sincronização e alterações em
documentos permanecem bloqueados. O servidor também bloqueia chamadas de
escrita ao Graph e ao banco financeiro, mantendo somente os contadores de
segurança necessários ao login habitual do ERP.

## Validação

`npx vitest run scripts/local-onedrive-review.test.mjs scripts/local-finance-review-policy.test.mjs --maxWorkers=2`

Os testes usam dados e credenciais fictícios. Cobrem callback, PKCE, leitura
por obra, bloqueio de gravações, links adulterados/expirados, paginação,
renovação concorrente em memória e ausência de credenciais nos erros.
O funcionamento com documentos reais depende de concluir o login Microsoft;
os testes automatizados não substituem essa confirmação.

## Revisão com a conexão autorizada — 31/10/2026

Conexão confirmada pelas chamadas normais do ERP no navegador autenticado,
sem copiar credenciais. O instrumento temporário foi retirado da entrada do
aplicativo ao concluir as consultas; o coletor de resultados foi encerrado.
O servidor 4192 continua ativo, preservando a sessão Microsoft em memória.

- 17 obras com pastas vinculadas; leitura das pastas financeiras de seis obras
  concluída sem erros. Nenhum arquivo encontrado nessas seis pastas.
- 249 registros no recorte completo da central; nenhuma nota fiscal cadastrada.
- Duas referências protegidas anexadas aos registros consultados retornaram
  HTTP 404 na consulta ao OneDrive. A autorização não corrige referências a
  arquivos ausentes ou indisponíveis para a conta autorizada. Nenhum arquivo
  alternativo foi associado e nenhum vínculo existente foi modificado.
- Memorial e central agora solicitam um link protegido novo ao abrir o original.
  A interface informa quando o OneDrive retorna 404 e mantém a ficha aberta.
  A conferência também renova URLs relativas já assinadas ao preparar a prévia.

Resultados sem dados pessoais: `artifacts/financeiro/onedrive-live-review.json`.
As verificações de abertura de originais, prévia de PDF/imagem/XML e continuidade
dos filtros usam documentos fictícios; os dois originais reais vinculados não
puderam ser abertos devido ao retorno 404. Nenhuma gravação de dados da empresa
ou chamada de escrita ao OneDrive fez parte desses testes.

## Investigação posterior dos dois retornos 404 — 31/10/2026

A hipótese de originais ausentes foi descartada. Os dois arquivos foram
localizados pela listagem autenticada do OneDrive: drive, ID, nome e tamanho
coincidem com os vínculos cadastrados. Foram lidas 20 pastas e nove arquivos
da obra. Nenhum vínculo precisa ser substituído.

O 404 observado é emitido pelo leitor local quando a resposta projetada de
metadados não inclui as facetas esperadas. Foi preparada a leitura pelo endpoint
canônico `/content`, com validação do redirecionamento e sem enviar o bearer
ao armazenamento. Testes: 17 aprovados em três arquivos.

O processo 4192 permanece com a implementação anterior para preservar a sessão
Microsoft em memória durante a revisão. Ativar a correção exige reiniciar esse
processo e autenticar novamente o OneDrive local. A leitura binária real pelo
leitor corrigido ainda precisa ser validada após essa ativação.

Relatório de revisão e referências completas ficam somente fora do repositório,
em `C:/dev/marcell-local-review/REVISAO-DOS-ANEXOS.md` e
`C:/dev/marcell-local-review/onedrive-link-review.json`. Nenhuma alteração nos
dados, arquivos ou sessão Microsoft de produção foi realizada.

## Correção ativada e validação real concluída — 31/10/2026

O estado pendente da seção anterior foi superado: o processo local foi
reiniciado e a autorização Microsoft renovada. O leitor usa `/content` e
acompanha os redirecionamentos validados dos endpoints de armazenamento pessoal
Microsoft. O bearer não é enviado ao armazenamento.

Os dois JPEGs reais retornaram HTTP 200, com tamanhos iguais aos cadastrados,
e foram decodificados no navegador. Os componentes do memorial e da central
foram renderizados em árvore isolada com os dados reais da sessão habitual,
confirmando os dois vínculos em ambas as superfícies. As interações de abrir
nova aba e continuidade dos filtros passaram separadamente com documentos
fictícios, em computador e celular.

Evidência sem conteúdo ou credenciais:
`artifacts/financeiro/onedrive-activation-verified.json`. Resultado: dois
originais lidos, duas imagens decodificadas, duas referências verificadas em
cada superfície e zero erros. Validação complementar: 31 testes automatizados,
26 verificações de interface, lint e typecheck aprovados.

O verificador temporário foi retirado da entrada do aplicativo e o coletor
encerrado. O servidor 4192 e a sessão Microsoft permanecem ativos. Nenhum vínculo,
pedido ou arquivo foi alterado; nenhuma publicação foi realizada.
