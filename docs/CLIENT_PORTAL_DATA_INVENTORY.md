# Portal do Cliente ARCD — inventário e fronteira de dados

Status: fundação segura. Nenhum conteúdo é publicado por esta documentação ou pelas projeções; somente registros com `status=published`/`publicado`, vínculo de obra e visibilidade compatível podem chegar ao portal.

| Domínio | Campos permitidos | Classificação | Perfil autorizado | Regra de publicação |
| --- | --- | --- | --- | --- |
| Obra | nome público, capa, fase, progresso, previsão, atualização | Publicável | Usuários vinculados | Portal ativo e vínculo com a obra |
| Atualização semanal | período, resumo, realizados, próximos passos, riscos publicados | Publicável | `viewWeeklyUpdates` | Publicado e visível ao perfil |
| Cronograma | fase, datas, progresso, variação e justificativa publicada | Publicável | `viewProgress` | Publicado e visível ao perfil |
| Mídia | URL temporária do cliente, miniatura e metadados editoriais | Publicável | `viewMedia` | Publicado, visível e URL de cliente |
| Decisão | opções, recomendação, impacto contratado e prazo | Restrito | `viewDecisions` / `approveDecisions` | Publicado, versionado e visível |
| Alteração | descrição, impacto e histórico público | Restrito | `viewChanges` / `approveChanges` | Publicado, versionado e visível |
| Financeiro | resumo contratual, medições e pagamentos publicados | Restrito | `viewFinancial` | Publicado; nunca derivado do razão interno |
| Documento | metadados e URL temporária | Restrito | `downloadDocuments` | Publicado, visível e URL temporária |
| Mensagem | assunto, contexto e anexos publicados | Restrito | `sendMessages` | Publicado e visível; sem notas internas |
| Equipe | nome, função, foto e canal autorizado | Publicável | `viewTeam` | Publicado e visível |
| Assistência | protocolo, estado e SLA da solicitação própria | Restrito | `openAssistance` | Vínculo do solicitante e obra |

## Bloqueado permanentemente

Folha, salários, CPF, PIX, dados bancários, extratos, conciliação, margem, DRE administrativa, custos internos, notas de auditoria, comentários internos, tokens, chaves, backups e dados de outras obras nunca integram o contrato do portal.

## Risco encontrado na linha de base

Existe um link público legado em `api/data.js` (`action: client-portal`) e um componente antigo no `LegacyApp`. Eles não compõem o novo Portal do Cliente: não possuem sessão individual, perfis, publicação editorial versionada ou auditoria por usuário. O novo portal permanece isolado em `/cliente` e não recebe o blob operacional completo.

## Persistência nova, sem interferência no ERP

A migration `005_client_portal_foundation.up.sql` cria tabelas próprias para
usuários do portal, vínculos por obra, sessões revogáveis, auditoria e
publicações editoriais. Ela **não foi executada**. Até a sua homologação, o
novo portal segue sem sessão ativa e não publica qualquer dado do ERP.
