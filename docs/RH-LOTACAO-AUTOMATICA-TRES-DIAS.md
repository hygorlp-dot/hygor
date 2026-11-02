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

## Preparação autorizada para publicação

Usuário autorizou o deploy após a implementação local. Base confirmada: produção dpl_BrY6aQ4dD4MG4kgi7nUeJciEi61u, correspondente às revisões de atalhos de RH até1097fa22. A revisão de telas41c373b2 permanece local e não foi incorporada. Preservadas as demais entregas publicadas: tolerância/almoço, Arquivos, temas e navegação, folha e provisões.

Validação ampliada:139 testes em15 arquivos, incluindo PGlite para bloqueios financeiros e períodos fechados;18 cenários de navegador sobre build compilado, desktop/celular, cobrindo a transferência pela sincronização, proteção do ponto, folha, provisões, atalhos e permissões. A lotação aparece atualizada em Equipes; os dados de teste são interceptados localmente, sem gravações no servidor real.

Teste de biometria atualizado para a grade vigente: marcador visual legado já não existia na base publicada. Verifica tentativa de sobrescrita recusada pelo comando real e preservação do ponto/pagamento. A tentativa usa teclado, pois a coluna fixa existente intercepta o clique ao rolar horizontalmente no emulador móvel; esse comportamento de layout preexistente não foi modificado nesta entrega.

Lint, tipos, arquitetura e auditoria de imports sem ciclos aprovados. A ajuda foi encurtada e o cliente reutiliza o controle de versão para evitar deduplicação redundante. Prefixos internos de chunks passaram de6 para3 caracteres, com hashes e nomes de workers/LegacyApp/vendor/planilhas preservados, para manter margem no limite existente. JS/CSS:1747,55KiB gzip, sem elevar o teto nem retirar arquivos da medição.

Preflight Supabase: somente SELECT em information_schema confirmou as colunas de company_app_data/audit_events. A variável de conexão transacional está configurada em produção; nenhum valor de credencial foi exposto. Sem migrações ou escritas de negócio. Logs de entrega: C:/Users/hygor/rh-lotacao-release-*.
