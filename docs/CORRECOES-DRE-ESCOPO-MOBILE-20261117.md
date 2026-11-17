# Correção de recorte do DRE e ajustes no celular — 17/11/2026

- **DRE por obra.** Cada resposta fica vinculada à consulta que a iniciou, com obra e competência. Durante a troca, indicadores, detalhamento e avaliação ficam em espera, e a exportação fica indisponível. Se uma resposta antiga chegar depois, ela é descartada. O seletor permanece disponível. Em Por obra, Outras despesas mostra os lançamentos da obra selecionada. Em caso de falha, conserva-se a leitura local disponível para o recorte atual.
- **Menu.** A barra inferior usa Finanças abaixo de 360 px e conserva o nome acessível Abrir Financeiro. Em 320 px os rótulos cabem e o atalho abre o mesmo módulo.
- **Patrimônio.** O celular mostra 12 bens por página. A busca continua no recorte inteiro, e Relatório e importação reúne os comandos secundários. Indicadores ficam acessíveis em uma seção própria.
- **Ajustes.** As seções são recolhíveis no celular. O preenchimento continua na tela ao recolher e reabrir. Os comandos de confirmação conservam seu funcionamento.
- **Frota.** Nome, situação e ações ficam no cartão. Período e Detalhes do equipamento ficam disponíveis sob demanda, com propriedade, tarifas, valores e foto quando houver.

Não houve mudança no cálculo ou no reconhecimento de receitas e despesas. A seleção do recorte restringe a apresentação aos registros da obra. Patrimônio, Ajustes e Frota mantêm comandos e permissões. Nenhuma consulta do ensaio gerou compromisso, estoque, custo reconhecido ou pagamento real. Os testes substituíram as respostas da API e bloquearam conexões externas.

Validação em Edge, em 320, 390 e 1440 px. A reprodução inicial mostrou R$ 111.111,00 da obra A sob a seleção da obra B. No build final, o teste atrasou a resposta de B, voltou para A, liberou a resposta antiga e verificou que ela não substituiu A. A seleção seguinte de B apresentou R$ 222.222,00. Passaram 9 cenários no DEV, 35 no build local e 64 testes unitários. Lint, design, manual, tipos e ciclos de importação passaram. O bundle ficou abaixo do limite de 1.847 KiB. Capturas e logs estão em `artifacts/dre-mobile-escopo/`. Ajuda e manual atualizados. Validação sem migração ou publicação.
