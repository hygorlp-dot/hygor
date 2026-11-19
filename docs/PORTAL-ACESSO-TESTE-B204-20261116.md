# Acesso de teste da B2-04 — 16/11/2026

O titular autorizou expressamente a criação do acesso `hygorlp@gmail.com`, restrito à B2-04, para conferir o portal publicado.

Foi confirmada a identidade da obra (`kep278px87cr`, nome B2-04), da empresa (`arcd`) e do administrador solicitante no cadastro existente. O e-mail não possuía conta no novo portal. A origem operacional foi apenas consultada e não foi modificada.

Conta ativa criada exclusivamente nas tabelas do portal, com um único vínculo ativo, à B2-04. Perfil de proprietário com revogação das capacidades de aprovação, envio de mensagens e abertura de assistência; a finalidade é consulta. A senha inicial aleatória usa o mesmo hash scrypt do app e não consta neste relatório nem em arquivos do repositório.

A B2-04 já estava habilitada, com liberações atualizadas pelo usuário em 16/11. Como não havia publicação inicial, foram gravadas as projeções produzidas pelo construtor existente, respeitando essas liberações: resumo da obra, política de publicação, 53 itens do cronograma, resumo financeiro e resumo de caixa. Nenhum diário ou foto foi publicado: o diário permanece em preparação. Não foram ativadas novas áreas nem alterados dados financeiros do ERP.

A função administrativa atômica `client_portal_manage` ainda não existe nesse banco. Não foi aplicada migração: conta, vínculo, publicação inicial e eventos de auditoria foram inseridos em uma única transação PostgreSQL, com bloqueio para o e-mail e guardas que abortariam se já existissem conta ou publicação. O cadastro não foi feito na autenticação interna do ERP.

Validação no backend publicado, por HTTPS com certificado validado e resolução explícita do hostname para o endereço retornado pelo DNS público, devido ao cache negativo da rede local:

- Login: 200.
- Sessão: 200, exatamente uma obra, B2-04.
- Dashboard B2-04: 200.
- Dashboard de outra obra real: 403.
- Diários e fotos publicados: zero, conforme a situação de preparação.
- Logout da sessão usada no teste: 204.
- Consulta final do banco: um único vínculo ativo e capacidades de ação revogadas.

Impacto no DRE: nenhum. Escritas restritas a conta, vínculo, projeções e auditoria do portal. Não foram criados custos, receitas, compras, compromissos, provisões, pagamentos ou cobranças. Nenhuma mensagem foi enviada.

Ajuda e manual revisados quanto ao impacto: operação de cadastro já prevista, sem alterações em interface, controles ou instruções de uso. Não houve alteração do conteúdo do app nem deployment.
