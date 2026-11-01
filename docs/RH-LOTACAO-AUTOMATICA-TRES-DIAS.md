# Lotação automática pelo ponto — implementação local

Solicitação: para qualquer funcionário, após três dias trabalhando na mesma obra diferente da lotação anterior, trocar a lotação para a obra atual. Sem autorização de push/deploy nesta etapa.

Interpretação utilizada: três datas distintas de trabalho consecutivas no histórico de presença, com P ou M e obra explicitamente registrada. Folgas, faltas e dias sem registro não contam. Presença em outra obra interrompe a sequência; presença legada sem obra explícita impede a decisão. Não compara função, diária, salário ou modalidade.

Integração ocorre somente ao salvar ponto validado pelo servidor, na transação já existente de company_app_data. Abrange lançamentos manuais, lote, conferência RH e sincronização biométrica. Batidas brutas do aparelho ainda não sincronizadas/conferidas não são evidência suficiente. Nenhuma mudança no APK, migrações ou cron.

Somente funcionários ativos que já possuem lotação em obra conhecida. Não reativa desligados, não interfere com desligamento agendado, não vincula quem está sem obra e não move para obra inativa/concluída. Precisa tocar a data trabalhada mais recente; editar um ponto histórico não faz transferência retroativa. Os três dias devem ser posteriores à última transferência registrada, respeitando decisões manuais mais recentes.

A vigência da nova lotação é a data atual da aplicação (America/Bahia). Evidências dos três dias ficam em obraHistory e changeLog. Não desloca pontos históricos nem recalcula custos ou pagamentos existentes. O histórico anterior continua resolvido pelo mecanismo compartilhado com folha/DRE. Cadastro preservado com incremento de versão, registro da regra, operador e data. O RH recebe conflito de versão em edições abertas antes da transferência.

Cadastro (CORE), ponto, histórico e recibo idempotente são persistidos sob os locks da transação existente: não há segunda requisição de cadastro e não se usa snapshot anterior ao lock. Só obra/versão/histórico operacionais são devolvidos no delta do ponto, sem CPF, salário, conta ou PIX. Cliente mescla o delta mantendo seus demais campos e ignora respostas com versão antiga/igual. Repetir a operação não duplica a mudança.

A autorização do ponto continua a mesma, incluindo escopo de Engenharia e bloqueio de registros biométricos pelo RH. Não concede à Engenharia um comando de edição de cadastro. A lotação decorre da regra no servidor após os registros autorizados. Fechamentos financeiros e ponto bloqueado continuam impedindo a operação inteira.

O caminho legado sem conexão SQL transacional mantém seu comportamento anterior, sem aplicar lotação em uma gravação não atômica. A publicação dessa regra exige o caminho transacional usado em produção. Nenhum dado real foi modificado na validação local.

Base local: 1097fa22 (revisão recente das telas internas). A produção evoluiu após a publicação da tolerância; antes de qualquer publicação futura, consolidar com a versão então vigente. Não substituir a produção a partir de uma base antiga.

Validação:96 testes em9 arquivos aprovados, incluindo regras por função, gravação de CORE+ponto, idempotência, escopo da Engenharia, bloqueio do ponto, sincronização biométrica, histórico, cadastro e atualização do cliente. Lint (incluindo design e manual), tipos, arquitetura, sintaxe da API, diff e build passaram. Nenhum arquivo de APK alterado. Evidências locais em C:/Users/hygor/rh-lotacao-*.log. Testes de persistência usam infraestrutura isolada e mocks da API; não houve consulta autenticada ou escrita de negócio em produção.
