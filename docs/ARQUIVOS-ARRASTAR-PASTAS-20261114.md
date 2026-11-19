# Arquivos: arrastar documentos e subpastas padrão

Revisão local de 14/11/2026. Sem publicação, migração ou alteração de documentos reais.

## Origem e fluxo

O relato foi esclarecido pelo usuário: a tentativa era arrastar um arquivo para a pasta. A tela não possuía tratamento de arraste; o envio pelo formulário já existia. O fluxo reaproveita o arquivo nativo, a obra, a pasta selecionada, o título e a revisão existentes, sem novo cadastro ou armazenamento.

Soltar um arquivo na área Documentos da obra abre o formulário com arquivo, título e pasta preenchidos. O arquivo só é enviado ao OneDrive ao usar Salvar documento. No formulário, é possível arrastar outro arquivo ou usar Selecionar arquivo/Trocar arquivo. O título digitado pelo usuário é preservado ao trocar o arquivo. No celular, o seletor continua disponível e o título recebe foco em área visível.

São aceitos um arquivo por vez, até 3 MB, com os formatos já autorizados pelo domínio. Diretórios, múltiplos arquivos, extensão inválida e tamanho excedido geram orientação. Soltar em pasta sem escrita ou em vínculos dos módulos não grava dados. Arrastar fora da área não abre o arquivo no lugar do aplicativo. Uma edição aberta não é descartada por um novo arraste na área externa ao formulário. Cancelar não envia o arquivo.

## Estrutura padrão

O modelo existente agora inclui Projetos → Projetos de Arquitetura / Projetos de Engenharia. Criar pastas padrão também fica disponível para completar obras que já possuem pastas. Não há gravação automática ao consultar a tela.

A aplicação reutiliza IDs de pastas com o mesmo nome no mesmo pai, ignorando apenas diferenças de caixa e espaços externos. Não associa nomes por semelhança nem move documentos. Duplicidade ambígua exige conferência; permissões de escrita em Projetos são verificadas no comando. Reaplicar o modelo não duplica as pastas existentes e preserva arquivos, revisões e permissões.

## DRE e integrações

Não há efeito no resultado realizado. O envio retorna uma referência do OneDrive, registrada pelo comando de arquivos na central da obra. A aplicação do modelo altera somente a organização documental e o recibo de auditoria do comando. Nenhuma ação cria previsão financeira, compromisso, entrada/saída de estoque, custo reconhecido ou pagamento. O teste do comando compara o restante dos dados antes e depois, incluindo despesas e estoque, e verifica que permanecem iguais. Anexar um contrato não reconhece seu custo nem cria pagamento.

## Validação

- Regressão inicial: os quatro testes de arraste falharam antes da implementação.
- Rodada final: 35 testes em seis arquivos aprovados, incluindo pasta atual, confirmação explícita, cancelamento, permissões, tamanho/formato, diretórios, padrão idempotente e preservação financeira.
- Três cenários de navegador aprovados no build: arrastar/salvar/recarregar em 1440 e 390 pixels e subpastas padrão persistentes sem duplicatas. Conferência visual em desktop e celular, sem overflow horizontal ou erros JavaScript nesses cenários.
- Build final aprovado; lint, tipos, design:check e sincronização do manual aprovados. Detector Impeccable sem achados. Nenhuma baseline foi ampliada.
- Ajuda e manual atualizados: 141 guias, 65 abas.

Os cenários usam uma prévia local e arquivos sintéticos; o adaptador de armazenamento local substitui o OneDrive, sem transferências reais. Não certificam a conexão Microsoft de produção. A suíte antiga de revisões apresentou falha na consulta de conteúdo na prévia anterior; esta entrega valida os cenários específicos de arraste e pastas e não declara toda a suíte histórica aprovada. Uma tentativa intermediária de build falhou por ausência transitória do export da entrada LegacyApp; o build repetido passou sem alterações nessa entrada por esta tarefa.

Evidências: artifacts/files-drag-tests.log, files-drag-build.log, files-drag-lint.log, files-drag-types.log, files-drop-browser.log, files-drop-impeccable.json e capturas files-drop-form-390.png / files-drop-form-1440.png / files-drop-default-folders.png.
