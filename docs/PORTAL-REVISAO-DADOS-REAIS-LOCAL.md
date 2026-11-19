# Conferência local do portal com dados reais

Revisão: 14/11/2026.

Execute `node scripts/client-portal-real-server.mjs --work=ID_EXATO_DA_OBRA` e abra `http://127.0.0.1:4199/cliente`. O identificador deve vir do cadastro; não há associação por semelhança de nomes. O terminal informa o acesso exclusivo da revisão.

O servidor captura as fontes existentes com consultas remotas de leitura e reconstrói a origem usando o mesmo leitor do portal. Dados e acesso de revisão ficam em PostgreSQL em memória. As permissões de publicação são ampliadas somente nessa cópia, com aviso na tela; diários em preparação continuam privados. Reiniciar descarta a cópia anterior.

Arquivos usam leitura do OneDrive, com credencial renovada somente em memória, sem persistir a sessão remota. A rota de auditoria permite conferir a foto de um diário em preparação como administrador, sem publicá-la no portal. Ausência de nota fiscal não é substituída por comprovante de pagamento.

Se a chave local não abrir a sessão central, inicie o servidor com `--onedrive-local-login`. Abra `http://localhost:4192/api/local-onedrive/connect` e entre na conta Microsoft que já acessa a obra. O retorno registrado usa `http://localhost:4192/api/local-onedrive/callback` e volta ao portal em 4199. A sessão independente solicita somente `Files.Read`, permanece na memória e tem prioridade sobre a sessão central na revisão. Reiniciar o processo exige nova entrada. O endereço 4192 atende apenas à autenticação; não é outro ERP.

Não substitua a chave da produção para viabilizar a revisão. O transporte bloqueia gravações no banco e no Graph; permite POST apenas no endpoint Microsoft de troca de código e renovação da autenticação. A consulta do arquivo não conclui o diário, não altera permissões de publicação e não grava tokens na conexão central. Essas instruções pertencem à revisão técnica local; os controles do portal do cliente permanecem iguais.

`node scripts/client-portal-real-audit.mjs` confere a API, as abas em 1440 e 390 pixels, os filtros do extrato, a foto original e a integridade da cópia após a navegação. Acrescente `--require-originals` para exigir que todas as imagens cadastradas sejam lidas com HTTP 200 e decodificadas com dimensões válidas. Evidências e imagens reais ficam fora do repositório, em `C:/dev/marcell-local-review/portal-real`. Consulte `verification.json` para limitações do acesso aos arquivos; sucesso das telas não comprova acesso ao anexo.

Foi corrigida a fase apresentada: o vínculo `obra.faseId` consulta `fases.id` e apresenta `nome`. Status técnico da obra não é fase. Vínculo ausente permanece sem informação, sem inferência.

## Efeito no DRE

Nenhum lançamento de resultado é criado. A conferência reutiliza custos reconhecidos, pagamentos, compras, contrato e caixa das origens existentes. Pagamento não reconhece novamente um custo; compra não vira custo por aparecer no portal; previsão por etapa ausente permanece indisponível. Alterações desta revisão limitam-se à apresentação da fase e ao ambiente local de leitura.

Não execute `npm run build` para esta conferência: o projeto possui etapas prévias de migração remota. Para compilar sem essas etapas, use `npx vite build`. Não há push, publicação ou migração nesta rotina.
