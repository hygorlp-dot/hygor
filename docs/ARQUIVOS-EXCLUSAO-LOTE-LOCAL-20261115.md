# Exclusão em lote e clareza das ações — validação local em 15/11/2026

Escopo autorizado: seleção e exclusão de vários documentos, confirmação única, todas as revisões para a lixeira OneDrive, permissões e histórico preservados, prioridade no celular e revisão Impeccable. O usuário confirmou que a confusão principal era seleção e ações. Sem publicação, push, PR, migração ou alterações em documentos reais.

## Fluxo e apresentação

- Caixas de seleção são independentes do nome, que continua abrindo detalhes. O botão de nome passou de aria-pressed para aria-expanded, distinguindo abertura de seleção.
- Selecionar disponíveis inclui somente os documentos exibidos e elegíveis. Limpar seleção permanece junto da contagem. Trocar pasta, busca ou origem limpa a seleção; mudar de obra remonta o contexto.
- Excluir selecionados abre uma confirmação com obra, nomes, pastas e total de revisões. Cancelar não dispara comandos. Execução bloqueia contexto, filtros e reenvio.
- Resultado por documento distingue concluídos e falhas. Tentar os não concluídos repete somente os restantes. Pendência é persistida pelo protocolo anterior e pode ser selecionada após recarregar.
- Documentos dos módulos continuam sem caixa de exclusão e com orientação para a origem. Restrições de edição, contratos e referências inválidas bloqueiam a seleção e continuam revalidadas pelo servidor.
- Adicionar arquivos recebeu prioridade visual; Adicionar documento permanece disponível como ação secundária. Não foram removidos uploads, links, revisões ou consulta de origem.
- No celular, metadados passam abaixo do nome para não comprimir o alvo de seleção. O Checkbox compartilhado ganhou largura mínima pelo token de toque já existente, completando o alvo 44 × 44 sem criar dimensão própria do módulo. Desktop mantém sua composição.

## Segurança, integração e DRE

O lote reutiliza sequencialmente os comandos individuais existentes, o serviço autenticado OneDrive e os comprovantes ligados ao documento, ator, operação e referências. Cada confirmação usa a versão devolvida pelo servidor. Não há endpoint novo, bypass de autorização, exclusão permanente ou conclusão otimista. Nome, pasta e revisões são comparados novamente com o que foi confirmado; alteração exige nova conferência. Falha parcial não desfaz nem repete os documentos já concluídos.

Histórico é acrescentado por documento. Revisões anteriores, permissões e documentos fora do lote permanecem íntegros; testes comparam esses dados e todos os demais fatos de negócio. Sem efeito em previsão, compromisso, estoque físico, custo reconhecido, pagamento ou DRE realizado; exclusão documental não estorna nem duplica custos.

## Evidências

- 131 testes em 15 arquivos: domínio, orquestração com serviço real de exclusão e Graph simulado, permissões, políticas operacionais, projeção, acesso OneDrive e ajuda.
- 22 testes dos primitivos compartilhados em 5 arquivos. O teste antigo de toque comparava a linha CSS inteira; foi atualizado para conferir o requisito nas duas dimensões. O navegador mede a área real de 44 × 44.
- Quatro fluxos de navegador aprovados: lote e individual, em 390px com toque e 1440px desktop. Incluem teclado, cancelamento/foco, selecionar disponíveis, limpar, busca, bloqueio contratual, resposta perdida após reciclagem local, resultado parcial, repetição no diálogo e retomada após recarga. Arquivos sintéticos são movidos do diretório local uploads para trash. Todos os outros documentos, pastas, histórico anterior e fatos de negócio são comparados.
- 82 chunks do build importados em sessões novas, todos aprovados. Zero ciclos entre 915 arquivos/3190 arestas.
- DEV: importações de ArquivosView, BatchDeleteDialog e orquestração aprovadas sem pageerror em página diagnóstica mínima servida pelo Vite. A primeira tentativa com inicialização completa do app ficou bloqueada e foi interrompida; os fluxos completos foram exercitados no build.
- Build aprovado: 1.815.497 bytes JS/CSS gzip; teto existente 1.891.328; nenhuma violação individual. Limites, dependências e configuração de build não foram alterados.
- Lint, tipos, design:check e manual:check aprovados, sem ampliar baseline. Ajuda contextual revisada e manual gerado com 143 guias/65 abas.
- Impeccable context, orientação Operate/distill/polish e inspeção visual desktop/celular aplicados em conjunto com shadcn. Detector final sem ocorrências nos arquivos revisados. Isso não constitui uma auditoria de todas as telas da ERP.

Capturas: artifacts/batch-trash-selection-390.png, batch-trash-selection-1440.png, batch-trash-confirm-390.png, batch-trash-confirm-1440.png e batch-trash-partial-390/1440.png. Logs e evidências estruturadas: artifacts/batch-trash-*.log/json. Diff incremental da tela contra a versão local preservada: artifacts/batch-trash-view.diff.

Não houve chamada operacional ao OneDrive ou Supabase de produção nesta implementação. O teste real da exclusão individual realizado anteriormente permanece separado em docs/ARQUIVOS-LIXEIRA-VALIDACAO-REAL-20261115.md. Esta revisão valida o lote localmente; não afirma ter excluído um lote na nuvem.
