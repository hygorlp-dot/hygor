# Política de publicação — Portal do Cliente ARCD

## Princípio

O Portal do Cliente recebe uma projeção de leitura específica por obra. Ele nunca recebe o blob operacional, objetos completos da obra, nem coleções internas para filtragem no navegador.

## Inventário de dados

| Domínio | Campo publicado | Classificação | Regra |
| --- | --- | --- | --- |
| Obra | id, nome, capa, fase, progresso, previsão, última atualização | Público para o cliente | Obra autorizada ao usuário |
| Obra | endereço | Publicável após aprovação | Somente se marcado para o portal |
| Progresso | etapa, percentual, previsto, realizado, justificativa publicada | Público para o cliente | Registro estruturado e publicado |
| Cronograma | marcos autorizados, prazo contratual, previsão atual | Público para o cliente | Sem dependências ou recursos internos |
| Atualização semanal | período, resumo, próximos passos, mídia publicada | Publicável após aprovação | Status `published`/`publicado` |
| Mídia | URL autorizada, legenda, data, etapa, ambiente | Publicável após aprovação | Status publicado e obra autorizada |
| Decisão | opções, impactos contratuais, prazo, recomendação publicada | Publicável após aprovação | Sem comentários internos |
| Alteração de escopo | descrição aprovada, valor contratual, prazo, status | Publicável após aprovação | Nunca altera o ERP nesta fase |
| Medição | número, período, valor contratual, vencimento, status publicado | Publicável após aprovação | Nunca inclui recebimentos internos |
| Pagamento | valor contratual, vencimento, situação visível | Publicável após aprovação | Somente registro marcado ao cliente |
| Documento | título, categoria, versão, URL temporária, status | Publicável após aprovação | Somente documento publicado |
| Mensagem | assunto, contexto, texto, anexos autorizados | Publicável após aprovação | Participante e obra autorizados |
| Equipe | nome, função, foto e canal comercial autorizado | Publicável após aprovação | Sem contato pessoal por padrão |
| Cliente | nome de exibição e vínculos de obra | Público para o cliente | Somente o próprio usuário |
| Funcionário | CPF, salário, PIX, ponto, folha e rescisão | Proibido no portal | Dado trabalhista e pessoal |
| Financeiro interno | custos, margem, DRE, contas, extrato, conciliação | Proibido no portal | Informação administrativa reservada |
| Auditoria interna | histórico operacional, tokens, service role, backups | Sensível | Nunca enviado ao portal |

## Estados publicáveis

Atualizações, mídias, documentos e medições só atravessam a fronteira quando seu estado for explicitamente `published` ou `publicado`. Rascunho, em revisão, aprovado sem publicação, arquivado, cancelado e estados ausentes são bloqueados por padrão.

## Autorização

A projeção exige que o usuário de portal tenha vínculo explícito com a obra e a permissão da capacidade solicitada. A função de projeção não autentica sessões; a futura rota de portal deverá autenticar no servidor antes de chamá-la.

Perfis suportados pela política: proprietário, cônjuge, representante, financeiro, arquiteto externo e observador. As capacidades são avaliadas no servidor e aceitam somente concessões e revogações de uma lista fechada.

## Limite atual

A rota legada `client-portal` é mantida apenas para compatibilidade. Ela não é a base da autenticação individual do novo portal e não deve receber novas funcionalidades.
