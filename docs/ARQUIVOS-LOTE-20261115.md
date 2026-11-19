# Envio de arquivos em lote — 15/11/2026

Implementação e validação locais, sem publicação ou envio de arquivos reais.

## Fluxo e vínculos

O lote reaproveita a obra e a pasta selecionadas, os tipos de arquivo, o limite de 3 MB por arquivo, a integração central do OneDrive e os registros de documentos/revisões existentes. Nenhum novo cadastro de fornecedor, obra, unidade ou valor foi criado.

Arrastar de 2 a 20 arquivos abre uma conferência única. Adicionar arquivos / Selecionar arquivos permite o mesmo fluxo no celular e pelo teclado. O destino fica visível; cada nome original se torna o título de um novo documento, com revisão R01. Um arquivo isolado continua usando o formulário já existente. Os arquivos só são enviados após Enviar arquivos.

Extensão, tamanho, nomes acima de 200 caracteres e quantidade são validados antes do envio; diretórios arrastados são recusados. Um nome igual ao de documento existente não cria associação por semelhança nem atualiza uma revisão: cria outro documento com ID próprio. Para revisar um documento existente, permanece disponível Nova revisão.

## Confirmação, falhas e permissões

O envio é sequencial para evitar ler todos os arquivos de até 60 MB simultaneamente em memória. A lista distingue aguardando, enviando, enviado ao OneDrive e falha. Após enviar os arquivos, o comando ARQUIVOS_LOTE_ADICIONADO registra o lote na central de uma só vez, com uma versão e uma entrada de histórico. A validação de cada documento reutiliza a regra existente, em uma cópia transitória; falha não grava parte do lote na central.

O comando fixa a mesma obra/pasta para todos os documentos, rejeita IDs repetidos ou já existentes e conserva os controles de acesso da API e da pasta. Não permite substituir documentos, mover anexos ou relaxar permissões. Um conflito de versão exige reconciliação, sem sobrescrever dados novos.

Reenvio conserva os IDs dos documentos/revisões e a chave do lote, inclusive após atualização da versão consultada. Envios confirmados são reaproveitados durante a mesma sessão da tela. O nome remoto aleatório também é conservado em uma nova tentativa de upload sem confirmação. A operação já confirmada é idempotente; não cria outro conjunto de documentos.

O OneDrive e a central não compartilham uma transação: falha pode deixar arquivos já enviados no OneDrive, aguardando registro. Tentar novamente reaproveita esses envios. Cancelar não apaga arquivos remotos. A fila não é persistida ao fechar, recarregar ou sair da tela; a ajuda informa essa limitação. Nenhuma migração ou limpeza automática foi executada.

## DRE

Sem efeito no resultado realizado. O lote altera somente a central de arquivos e o recibo de auditoria do comando. Não cria previsão financeira, compromisso, movimentação física de estoque, custo reconhecido ou pagamento. Os testes comparam os demais dados, incluindo despesas e estoque, antes/depois. Nenhum fato financeiro é reconhecido novamente por anexar um documento.

## Validação

- 45 testes aprovados em sete arquivos: lote atômico, versão, IDs, cancelamento, retomada, resposta perdida, permissões, pasta/obra, formatos, quantidade e limites.
- Cenários de navegador em 1440 e 390 pixels: arraste múltiplo no desktop, seleção múltipla no celular, falha simulada no segundo arquivo, retomada sem repetir o primeiro envio, um único comando e persistência após recarregar. Documentos anteriores preservados.
- Ajuda e manual revisados em conjunto; source única em help-content.js. Nenhuma baseline visual foi ampliada.
- Evidências: artifacts/files-batch-tests.log, files-batch-browser.log, files-batch-build.log, files-batch-lint.log, files-batch-types.log e capturas files-batch-390.png / files-batch-1440.png.

Os testes de rede usam arquivos sintéticos e o adaptador local de armazenamento. Não comprovam uma gravação real ou a capacidade disponível na conta OneDrive de produção. Nenhuma publicação foi realizada.
