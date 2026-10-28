# Equipe nas Obras

A aba integra o grupo de pessoas/RH ao cadastro de funcionários, obras e registros sincronizados do app Ponto de Obra. É uma projeção somente leitura, consultada a cada 20 segundos e ao recuperar conexão ou visibilidade. A data usa America/Recife, o mesmo fuso da tela de ponto existente.

## Uso com o APK atual

O painel funciona com o APK já instalado e não exige sua substituição. O formato atual envia instante, funcionário e obra da batida; esses registros continuam sendo recebidos sem alteração. Como não informa a natureza da marcação, o painel exibe o histórico para conferência, sem afirmar presença, intervalo ou saída. A disponibilização deste painel exige apenas a publicação do ERP/backend.

## Extensão opcional de eventos

O trabalhador ou encarregado escolhe entrada, início de intervalo, retorno ou saída. A escolha é opcional para não impedir a marcação. Sem escolha, a batida segue para conferência. O terminal inclui `versaoJornada: 1` e `tipoEvento` no evento local; essa extensão integra o hash local. Eventos anteriores preservam sua representação canônica original.

SQLite e ARP já armazenam o payload completo, portanto não há migration. A cadeia fiscal incorpora o hash local; não se alteram NSR, registros existentes, algoritmo fiscal nem eventos legados. A extensão de tipos no código do app é opcional e não será distribuída neste escopo, conforme a preferência de manter o APK atual. Se adotada futuramente, exige publicar primeiro o backend compatível: um servidor antigo não reconhece o hash da extensão.

`ponto-equipe-obras` autentica o usuário, verifica papel e permissão da aba, lê os dados da empresa configurada e filtra obras e pessoas antes de responder. Um perfil restrito não recebe eventos de outras obras. Fotos de cadastro são assinadas em lote por 120 segundos; vetores biométricos, CPF, salários e tokens não integram a resposta.

## Interpretação

- Entrada explícita inicia a jornada ou transfere a pessoa para a obra de captura.
- Intervalo exige atividade anterior; retorno exige intervalo anterior e usa a obra de seu evento.
- Saída encerra a presença no painel. Não altera a marcação ou a folha.
- Ordem é a hora efetiva, nunca a chegada ao servidor. `eventId` deduplica reenvios.
- Jornada atravessa a meia-noite; acima de 24h aberta segue para conferência (limite operacional do painel, não encerramento automático).
- Registros sem tipo, com hora insegura, obra desconhecida ou sequência incompatível aparecem fora das obras para conferência.
- Falta confirmada vem de `attendance[employeeId][dia].status === "F"`, incluindo as linhas de ponto por obra remontadas pelo backend. Divergência com batidas é explicitada.

## Limitações da base

O cadastro tem início previsto, mas não possui escala semanal, tolerância de entrada ou agenda de folgas, férias e afastamentos. Por isso o painel mostra “Sem registro hoje” e não presume atraso, folga ou falta; antes do início cadastrado mostra “Aguardando início da jornada”. Não existe tratamento de cancelamento/correção de batida na ARP atual; registros são append-only. A consulta considera sete dias e sinaliza essa janela na interface. Jornadas sem qualquer evento nessa janela não são reconstruídas como presenças.

As tabelas do ponto não possuem canal Realtime usado pelo app; foi reutilizada a consulta periódica existente, indicada na interface. Batidas ainda offline não são conhecidas pelo servidor.

## Validação

Testes de domínio cobrem estados, duplicatas, ordem atrasada, transferência, meia-noite, relógio inseguro, ambiguidade e filtros. Testes com PGlite passam pela lógica real do app, sincronização, handler e migrations existentes. Testes Playwright usam respostas isoladas para verificar a interface, filtros, detalhes e reconexão; não substituem homologação no aparelho físico.
Build web e exportação Android validados localmente. Expo Doctor: 20/21 verificações passaram; seis dependências Expo têm patches disponíveis (expo, expo-asset, expo-constants, expo-crypto, expo-location e expo-splash-screen). ERP e backend publicados em 28/10/2026, deployment dpl_5PyKLLZ3wzCjZEvE6j6xLaJQTV4n, sobre a versão de produção 01bbc8809e20aeb6ebea6271abaa7ea88e647040. Não houve distribuição de APK. A rotina de build existente da Vercel executou suas verificações e migrations habituais; esta funcionalidade não adicionou migrations.

Validação da publicação: 85 testes de domínio, navegação, acesso e integração, lint e 2 cenários Playwright (desktop/celular) aprovados. Endereços públicos responderam 200; endpoint do painel respondeu 401 sem sessão, como esperado. Homologação com credencial real de usuário não executada.
