# Assinatura e entrega local — 05/11/2026

## Situação verificada

- WAHA: sessão `marcell-test`, `WORKING`, conta informada pelo titular conferida. O identificador do provedor omite o nono dígito brasileiro; a conferência admite apenas essa equivalência, nunca apenas o final do número.
- Contêiner com `restart=unless-stopped`; supervisor mantém o WSL ligado. Inicialização no login do usuário Windows, não antes dele.
- Assinatura privada em `127.0.0.1:3095`, com token exclusivo cifrado pelo DPAPI CurrentUser. A senha A1 também foi guardada cifrada pelo Windows, após conferência do certificado e titular.
- Worker instalado fora dos worktrees, em `%USERPROFILE%/.codex/private-config/ponto-whatsapp/runtime`. Certificado e credenciais não pertencem ao repositório.
- Worker respondeu à consulta autenticada do cofre; credencial incorreta recebeu HTTP 403. Reinício automático do worker conferido.
- Nenhum PDF oficial disponível no cofre, nenhuma tarefa emitida ou mensagem enviada nesta configuração. Quatro contatos confirmados já estavam preparados; há funcionário sem telefone confirmado.

## Recorte autorizado

No fuso `America/Bahia`, em 05/11/2026 somente saídas explicitamente identificadas no evento original. Registros legados sem tipo não são classificados por inferência. Desde 06/11, novas batidas do próprio dia são elegíveis. Em nenhum caso recuperar dias anteriores, inclusive após indisponibilidade ou virada da meia-noite.

`processador.py` exige arquivo de política explícito (`automacao.politicaEnvioArquivo`), empresa correspondente, envio habilitado, nenhum bloqueio, PDF PAdES validado e origem correspondente a evento, funcionário, NSR e instante. Confere também a sessão e o remetente antes do destinatário; reavalia a política após a consulta ao provedor. Mantém a reserva anterior ao envio e não repete resultados incertos.

A listagem autenticada da API agora inclui horário, funcionário e tipo original. O consumidor conserva essa origem em tabela própria, sem modificar a ARP. Histórico e entradas de 05/11 são excluídos antes da emissão; não apenas antes do envio. Sem política, não emite nem envia. Registros já recebidos por consumidor anterior sem metadados não são liberados automaticamente: exigem leitura novamente da origem e conferência, sem reiniciar envios já aceitos ou incertos.

## Pendências que impedem ativação

1. RH confirmou: GRU emitida, porém pagamento, declaração assinada, protocolo/certificado INPI e demais evidências fiscais continuam pendentes. A configuração fiscal local mantém `registroInpi` e `atestadoTecnico` nulos.
2. A ativação técnica depende da publicação consolidada e da verificação produção→túnel→worker descrita abaixo. Não executar o processador antigo sem filtro.

Portanto `envioHabilitado=false` permanece. A mudança de data, isoladamente, não remove bloqueios nem ativa envio amanhã. Não usar PDFs de teste/quarentena ou texto substituto para contornar a assinatura.

## Preparação HTTPS e liberação condicional

O usuário escolheu ngrok com o endereço fixo gratuito e instalou a versão da Microsoft Store, conferida como `3.39.11-msix-stable`. O authtoken fornecido pelo titular foi guardado com DPAPI. O supervisor HTTPS inicia no login e fixa o domínio da conta após a primeira conexão. Inspeção de conteúdo desativada; somente a porta do worker é encaminhada. Não foram feitas exclusões no antivírus.

Credenciais `PONTO_FISCAL_WORKER_TOKEN`, `PONTO_FISCAL_AUTOMACAO_TOKEN` e `PONTO_FISCAL_CONFIG_JSON` foram criadas como sensíveis, somente em produção. A leitura de metadados confirmou os três nomes e o escopo. A configuração fiscal mantém INPI/atestado ausentes. Nenhuma chave A1 ou senha foi enviada à Vercel. `PONTO_FISCAL_WORKER_URL` foi configurada com o domínio fixo da conta após teste HTTPS: TLS validado, credencial incorreta recebeu 403 e consulta autenticada recebeu 200. O teste não emitiu nem enviou comprovantes.

A configuração privada do consumidor identifica os dois estabelecimentos da empresa conferidos por leitura de IDs no Supabase e exige prontidão fiscal. O supervisor de entrega instalado no login aguarda `conexao-producao.json` com integração confirmada; nesse estado não inicia o consumidor nem acessa a produção. Acesso Windows→WAHA foi conferido, com a sessão existente funcionando. Chaves locais de automação/WAHA ficam cifradas com DPAPI.

O novo endpoint autenticado de prontidão conserva o escopo da empresa e confere disponibilidade real do cofre. Um teste explícito `verificarConexao=true` comprova a conexão sem liberar emissão fiscal. No processamento normal, só consultar o worker quando há candidatos do próprio dia e os requisitos fiscais estão informados, evitando consultas ociosas ao túnel gratuito.

O consumidor só libera a rodada quando os 11 requisitos fiscais retornam `evidencia_informada`, `podePrepararEmissao=true` e `workerConectado=true`. A liberação é mantida somente na memória da rodada, nunca gravada como aprovação definitiva. Queda da conexão ou pendência em rodada posterior bloqueia novamente. Ausência de requisitos, resposta inválida, fila vazia e histórico não liberam nada. Bloqueios locais continuam prevalecendo.

Procedimento de publicação e liberação:

1. Preservar agente instalado pela Store, túnel para `127.0.0.1:3095`, domínio fixo, inspeção desativada e reinício no login. Não expor WAHA ou portas de administração.
2. Repetir os testes de autenticação HTTPS quando mudar domínio/token. Provas locais ficam no diretório privado; não gravar credenciais no repositório.
3. Consolidar o código com a versão corrente e fazer uma única publicação autorizada, incluindo metadados originais e prontidão da automação. Não iniciar consumidor antigo.
4. Conferir produção→túnel→worker pelo teste explícito de conexão, sem emitir/enviar PDF. Só depois registrar `integracaoConfirmada=true`, remover bloqueios locais de infraestrutura e configurar `ativarQuandoPronto=true` mantendo `envioHabilitado=false`. Evidências fiscais são conferidas pelo servidor em cada rodada elegível; não inventar evidências nem zerar pendências fiscais.
5. Atualizar a configuração fiscal de produção com documentos verdadeiros quando forem concluídos. A emissão e a entrega do próprio dia tornam-se elegíveis automaticamente; assinatura, integridade, destinatário e remetente continuam sendo conferidos.

## Verificação

- 35 testes Python: assinatura, adulteração, titular/CA, DPAPI, cofre, destinatário, idempotência, resultado incerto, filtro temporal, meia-noite em Bahia, entradas e histórico excluídos, remetente diferente bloqueado, prontidão reavaliada e fila vazia sem consumo do túnel.
- 11 testes JavaScript dos endpoints: autorização, metadados originais sem inferir saída do legado, prontidão e comunicação HTTP privada.
- `git diff --check` sem erros.
- `npm run lint` passou, incluindo fronteiras financeiras, nomes, padrões de interface e sincronização do manual.
- Build local passou sobre `origin/main` em `dc3d0caf`, sem executar migrações remotas no ensaio local.
- Ajuda/manual revisados: já explicam confirmação individual, processamento, resultado incerto e bloqueios fiscais. Nenhum controle ou instrução de interface mudou; o recorte operacional temporário está documentado aqui.
- Sem push, preview ou deployment intermediário.
