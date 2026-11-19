# Conexão local do financeiro

Revisão em 14/11/2026. Sem publicação, disparos, alterações no ERP real ou na automação fiscal dos funcionários.

## E-mail

Os MX do domínio marcelleng.com.br apontam para Lark Mail. A documentação oficial orienta SMTP `smtp.larksuite.com`, porta 465 com SSL/TLS e senha dedicada de cliente de e-mail: https://www.larksuite.com/hc/en-US/articles/378111206512-log-in-to-lark-mail-through-a-third-party-email-client.

O transporte usa exclusivamente financeiro@marcelleng.com.br, certificado TLS validado, TLS 1.2 ou superior, timeouts e logs de protocolo desativados. Anexos são buffers do PDF autorizado; não se leem caminhos ou URLs fornecidos pelo solicitante. Aceitação do destinatário pelo provedor é verificada; isso não equivale a entrega na caixa de entrada.

`verifyFinanceEmail` executa somente autenticação/verify e fecha a conexão; não chama sendMail. Após sucesso, a credencial é cifrada com DPAPI CurrentUser e finalidade própria do financeiro. O arquivo e metadados ficam em `%USERPROFILE%/.codex/private-config/client-billing`, fora do projeto. A senha não é incluída nos logs, argumentos do processo ou respostas HTTP.

A senha precisa ser gerada pelo titular no aplicativo Lark e informada apenas na tela local. Se o endereço for caixa compartilhada ou alias, confirmar a credencial própria e permissões com o administrador. Credenciais de contas pessoais conectadas ao Codex não substituem o acesso dessa caixa. Autenticação SMTP não garante autorização futura de remetente ou aceitação por todos os destinatários.

## Tela local

Iniciar: `node scripts/client-billing-connection-server.mjs`. Abrir http://127.0.0.1:4210. A tela utiliza os componentes e tokens compartilhados, tem ajuda contextual e guia no manual.

O servidor escuta somente loopback, valida Host, cookie HttpOnly/SameSite=Strict e Origin em pedidos de alteração, rejeita corpos grandes e não possui endpoint para envio real. Conexões simultâneas são recusadas enquanto outra verificação estiver em andamento. Somente após autenticação é gravada a configuração cifrada. A data mostrada é a última verificação bem-sucedida, não prova de disponibilidade contínua.

## WhatsApp e simulação

A verificação somente de leitura reaproveita a sessão WAHA marcell-test e confirma o remetente +55 (81) 98975-1300. O segredo existente é aberto apenas na memória do processo privado; não se copia a chave para o repositório nem se altera o worker, fila, política ou comprovantes de ponto.

Simular os dois canais usa exclusivamente a obra e o cliente fictícios da simulação. O e-mail MIME é composto em memória com streamTransport, sem conexão SMTP, e gravado localmente como `.eml`. O PDF dos dois canais tem o mesmo SHA-256. A reserva de execução usa arquivo exclusivo por chave, separada do modo real; uma repetição é bloqueada. Não se resolve o contato fictício no provedor WhatsApp nem se chama sendFile.

O transporte SMTP está implementado para futura conexão ao dispatcher, que exige ativação explícita e reserva persistente antes de qualquer envio real. Esta tela mantém automaticDelivery=false e não instala agendamento. A senha fica disponível ao processo local autorizado pelo helper de leitura, sem endpoint HTTP para expô-la. Não houve emissão de cobrança ou envio real para cliente nesta preparação.

## DRE e validação

Preparar conexão, autenticar e simular não modifica custo reconhecido, compromisso, estoque, caixa, cobranças emitidas ou resultado realizado no DRE. A origem permanece no razão e nos vínculos já existentes; não há novo lançamento financeiro.

Validações: TLS real do Lark acessível e certificado validado, WAHA funcionando com remetente correspondente, MIME com PDF, mesmo hash nos dois canais, repetição bloqueada, ausência de autenticação de sessão e origem externa recebendo 403, DPAPI com ida/volta e adulteração rejeitada, desktop/celular sem transbordamento e ajuda contextual acessível. A autenticação da caixa permanece pendente até o titular preencher a senha dedicada na tela; não foi substituída por credencial de teste.
