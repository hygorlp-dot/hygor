# Validação real da lixeira OneDrive — 15/11/2026

Executada na produção publicada, pela sessão autenticada do administrador, com autorização explícita do usuário. Nenhum código foi alterado e nenhum deploy foi criado.

Documento sintético exclusivo: MARCELL TESTE LIXEIRA 20261115, id 53371a08-c3bb-45f9-935f-9efdc7beee40. Obra K1-10; pasta CONTRATO. Duas revisões TXT, R01 e R02, criadas pela própria central às 17:09:46 e 17:10:39 (Bahia). Ambas apareceram como arquivos físicos distintos em App/K1-10/03 - Documentos/Central de arquivos.

A exclusão foi solicitada pelo botão Excluir documento e confirmada no diálogo que informa as duas revisões. Concluiu às 17:11:52. A lixeira do OneDrive mostrou os dois nomes físicos correspondentes e o caminho original correto. Não houve exclusão permanente, restauração nem manipulação dos demais itens da lixeira.

Conferência do banco exclusivamente por SELECT e comparação local dos estados anterior, anterior à exclusão e posterior:
- Documento marcado como excluído; conclusão e responsável registrados.
- As duas revisões persistidas permaneceram integralmente iguais após a exclusão.
- Histórico anterior integralmente preservado; quatro novos eventos: criação, revisão R02, solicitação e conclusão da exclusão, sem duplicação.
- Pastas e respectivas permissões integralmente iguais. Interface confirmou Herdar acesso da obra e das pastas superiores antes e depois; nenhum Salvar permissões foi acionado.
- Todos os documentos anteriores e demais centrais permaneceram iguais.
- Fora de workFileCabinets e operationalCommandReceipts, todo o núcleo permaneceu igual, incluindo os dados de origem dos 25 vínculos existentes.
- Perfis de acesso e configuração conservaram hashes e carimbos de atualização anteriores ao teste (evidência em validation.json). Não se alterou papel ou permissão de usuário para o teste; a matriz de negação por papéis não foi reexecutada em contas reais.

Sem efeito no DRE realizado, previsão, compromisso, estoque, custo reconhecido ou pagamento; os campos de negócio externos ao fluxo documental permaneceram iguais na comparação. Ajuda e manual foram revisados: este teste confirma o fluxo já documentado e não requer novas instruções.

Evidências: artifacts/onedrive-trash-real-20261115/validation.json, onedrive-before.png, onedrive-trash-confirmed.png e central-history.png. As cópias temporárias completas do núcleo usadas na comparação foram removidas localmente após gerar a evidência resumida.
