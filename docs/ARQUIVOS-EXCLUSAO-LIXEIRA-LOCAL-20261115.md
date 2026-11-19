# Exclusão de documentos pela central — validação local

15/11/2026. Implementação no checkout existente, preservando as demais alterações locais. Sem push, PR, deploy, migração ou operação em dados/arquivos de produção nesta etapa.

## Fluxo aprovado

O usuário confirmou que excluir um documento inclui **todas as suas revisões**. Nos detalhes, Excluir documento abre uma confirmação com nome, obra, pasta, quantidade de revisões e efeito sobre arquivos e links. Cancelar antes da primeira confirmação não grava nem chama o OneDrive. O diálogo usa os componentes compartilhados MARCELL, com tela inteira no celular, foco contido e retorno ao acionador. Ações móveis verificadas com pelo menos 44 px.

Arquivos são enviados à lixeira pelo DELETE de DriveItem; não se usa permanentDelete, não se esvazia a lixeira e não se excluem pastas. A referência oficial é [Microsoft Graph — Delete a DriveItem](https://learn.microsoft.com/en-us/graph/api/driveitem-delete?view=graph-rest-1.0). Links externos são removidos somente da central, sem apagar o destino externo. Recuperação pelo OneDrive não restaura automaticamente o cadastro da central.

## Origem, autorização e proteção dos documentos existentes

- Obra, pasta, documento, IDs de arquivo e revisão vêm dos registros existentes. Não se associam documentos por nome ou semelhança. A rota ignora IDs de arquivo e listas de referências enviados pelo navegador e monta a operação a partir das revisões persistidas.
- São reutilizados FILE_ROLES, acesso à aba Arquivos, escopo da obra e permissões de edição herdadas das pastas. A autorização é repetida nas gravações, na rota do OneDrive e na conclusão.
- Documentos dos módulos continuam somente leitura. Referências físicas compartilhadas com outro documento/módulo bloqueiam a solicitação antes de iniciar; a rota repete a conferência. Contratos comerciais atuais e revisões preservadas protegem seus anexos por documentId/revisionId. Não é possível criar um novo vínculo contratual para documento excluído ou em exclusão.
- Revisão de arquivo sem IDs seguros, pasta física, outro drive, item fora da pasta da obra e conflito de eTag são recusados. URLs externas não são interpretadas como autorização para apagar arquivos. Referências antigas da rota relativa protegida são reconhecidas; ambiguidades exigem conferência.
- Todas as revisões passam pela conferência física antes do primeiro DELETE da tentativa. If-Match protege contra mudança do item entre a leitura e a exclusão. Somente HTTP 204 confirma a operação; respostas inesperadas e falhas não autorizam concluir a central.

## Persistência, retomada e histórico

A solicitação usa comando versionado/idempotente ARQUIVOS_EXCLUSAO_SOLICITADA e registra uma operação pendente. Esse estado bloqueia mover, revisar e visualizar o documento enquanto a exclusão está em andamento. Há duas etapas porque a central e o OneDrive não compartilham uma transação.

Falha parcial ou resposta perdida pode deixar arquivos na lixeira com o documento ainda pendente. Concluir exclusão retoma a mesma operação, inclusive depois de recarregar; arquivos ausentes retornam como já processados, sem criar cópias ou repetir uploads. Cancelar a confirmação de uma pendência fecha somente a janela, sem desfazer o que já foi reciclado. As tentativas não são reenviadas automaticamente em segundo plano.

A rota emite um comprovante cifrado/autenticado, limitado a documento, obra, operação, usuário, referências e validade. Um objeto fileTrashProof fornecido pelo navegador é descartado. A conclusão ARQUIVOS_EXCLUSAO_CONCLUIDA exige esse comprovante e a versão da central; conflito conserva a pendência para nova tentativa.

Após concluir, o documento sai da lista, mas suas revisões e metadados ficam preservados com data e autor da exclusão. Histórico anterior, permissões e outros documentos permanecem. Solicitação e conclusão acrescentam eventos com autor e horário. A retenção impede que uma URL assinada antiga passe a contornar o acesso da central após a exclusão; a leitura de documentos pendentes ou excluídos é recusada.

## DRE e integrações

Sem efeito no resultado realizado. A ação altera somente a organização documental, sua versão, histórico e recibos operacionais. Não cria nem cancela previsão financeira, compromisso, estoque físico, custo reconhecido, contrato, faturamento ou pagamento. Os testes comparam todos os demais campos de negócio antes/depois. Nenhum custo é reconhecido outra vez ou estornado por excluir o documento.

## Validação

- **158 testes / 15 arquivos aprovados:** comandos, versões, idempotência, permissões, projeção, revisão antiga, acesso autenticado, proteção de contratos e vínculos, falsificação/validade do comprovante, falha parcial, resposta perdida, eTag e resposta inesperada do Graph.
- **Dois cenários completos de navegador aprovados:** 390 px com toque e 1440 px desktop. Confirmam cancelar sem efeitos, excluir as duas revisões, perder a resposta da rota após reciclar, recarregar, retomar, finalizar uma única vez e conservar o documento anterior. No desktop, Escape fecha e devolve o foco; no celular, botões têm pelo menos 44 px. Sem overflow horizontal ou pageerror. Capturas finais revisadas visualmente.
- O adaptador local executa os mesmos comandos, política, comprovante e serviço de exclusão, com arquivos PDF sintéticos e Graph substituído por armazenamento local. Arquivos são movidos de uploads para trash. Não comprova uma chamada nova ao OneDrive real nem sua disponibilidade; não houve conexão operacional com Microsoft ou Supabase de produção nesta etapa.
- DEV: importações de ArquivosView, DeleteDocumentDialog e referências de exclusão verificadas em sessão nova, sem pageerror. O teste auxiliar inicial de HTML não concluiu; a verificação final usou o index real do app com holdUntilCrawlEnd desativado apenas no processo de diagnóstico. A configuração do projeto não foi alterada por isso. Fluxos completos foram exercitados no build local.
- Lint, tipos, design:check, manual:check e auditoria de importações aprovados. Zero ciclos em 913 arquivos. Detector Impeccable sem ocorrências. Ajuda contextual de exclusão e manual sincronizados: 143 guias / 65 abas. Nenhuma baseline foi ampliada.
- Build final: **1.813.018 bytes JS/CSS gzip**, teto vigente no checkout **1.891.328 bytes**, sem violações individuais. Nenhum limite foi aumentado.

Evidências em artifacts/: files-trash-tests-final.log, files-trash-browser.log, files-trash-lint.log, files-trash-types.log, files-trash-cycles.log, files-trash-dev-check.json, files-trash-design.json, files-trash-build.log e files-trash-bundle.json. Capturas: files-trash-confirm-390.png, files-trash-confirm-1440.png, files-trash-done-390.png e files-trash-done-1440.png.
