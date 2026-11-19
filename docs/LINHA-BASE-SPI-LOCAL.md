# Linha de base aprovada e SPI — implementação local

Revisão: 02/11/2026. Sem publicação, push ou migração de banco.

## Fluxo e persistência

Planejamento → Linha de base aprovada e SPI. Engenharia/planejamento, administrador e diretoria podem preparar proposta; somente administrador e diretoria aprovam. O acesso à aba e a obra são conferidos no servidor. A proposta captura as fontes atuais no servidor, exige justificativa com 10 caracteres, identificação nova e versão concorrente correta. Não recebe valores aprovados montados pelo navegador. Aprovação confere a assinatura exata das fontes novamente, registra autor autenticado e horário do servidor. Aprovação ou fonte concorrente deixa a operação pendente de nova conferência. O dia de aprovação segue America/Sao_Paulo.

Usa `scheduleBaselines`, seção já prevista na arquitetura, com schemaVersion 2 e comandos BASE_PLANEJAMENTO_PROPOSTA / BASE_PLANEJAMENTO_APROVADA. Não precisa de tabela ou migração nova. O fluxo não altera registros aprovados anteriores. Nova proposta guarda revisionOf apontando para a última aprovação; não pode ser aprovada após uma revisão concorrente. Não há edição ou exclusão de versões por este fluxo. O guard de snapshots impede forjar ou apagar registros versionados por save/save-sections; dados legados permanecem regidos pela política anterior, sem serem tratados como base do SPI. A repetição do mesmo comando é idempotente.

## Modelo conferível

O orçamento de controle deve estar aprovado e bloqueado. Cada item com valor se vincula a uma única atividade executiva na etapa ou ancestral mais próximo. Não soma atividades-título e não presume rateio. Identificações duplicadas, datas inválidas, intervalo maior que 3660 dias, preço/quantidade inválidos, calendário vazio, atividade sem dia trabalhado ou item sem atividade bloqueiam a proposta. O snapshot congela orçamento e sua versão, itens, quantidade e unidade, valor em centavos, atividades e calendário. Custo real não substitui peso orçamentário. Atividades sem valor ficam congeladas mas não influenciam o SPI.

PV = soma do valor orçado por item multiplicado pela fração de dias trabalhados decorridos até a referência. Distribuição linear é uma premissa expressa na proposta e na aprovação, não produtividade presumida. Os dias inicial/final são inclusivos; dias da semana e feriados do plano ficam congelados. A distribuição em centavos usa divisão inteira acumulada por item e conserva o orçamento integral no fim. Não depende do calendário atual depois da aprovação.

EV = soma do valor orçado congelado por item multiplicado pelo último avanço acumulado compatível em diário concluído e tecnicamente revisado até a referência. Confere obra, item, atividade, orçamento, unidade e quantidade de referência. Registros futuros, rascunhos e cancelados não substituem medição válida. Duplicidade ou incompatibilidade em medição posterior revisada invalida a evidência do item até nova medição válida. Ausência não é zero. Cobertura é valor do orçamento com medição / orçamento congelado; EV e SPI integrais exigem todos os itens com valor medidos.

SPI = EV/PV, com PV positivo; SV = EV − PV em reais orçamentários. Abaixo de 1 significa valor agregado inferior ao planejado; acima de 1, superior. As definições seguem a [NSF — EVM Gold Card](https://www.nsf.gov/od/ori/evm-gold-card). Não converter SPI em atraso em dias ou prazo estatístico de conclusão. Aprovações são selecionadas por referência e não retroagem; pode consultar explicitamente versão anterior no Planejamento. Diários são os atualmente carregados, sem reconstrução do conhecimento histórico. Nenhuma aprovação antiga é inferida da fotografia substituível `planos[].baseline`.

## Relatórios e ajuda

Mesmo cálculo em Indicadores da obra e Relatório para diretoria → Execução, com sinal de SPI por obra no Resumo do CEO. Memória por item com PV, EV, avanço, calendário e diário. CSV executivo passa de 23 para 25 seções: SPI e SPI itens; exportação dos indicadores e apresentação/PDF incluem a memória. Custo final e CPI mantêm seus próprios critérios; não usam SPI automaticamente para estimar custo final.

Guia contextual `plan_baseline` é selecionado com useHelpTopic ao expandir o fluxo; fechar retorna a ajuda do Planejamento. Guias de Indicadores da obra e Relatório para diretoria revisados na fonte única, com manual regenerado. Componentes e controles MARCELL, sem estilos locais ou alteração da baseline visual.

## Demonstração

MARCELL_SPI_DEMO=1 com o servidor local daily-production-preview. Todos os dados são fictícios em memória. V1 da Residencial Alameda aprovada em 01/10/2026: alvenaria de 01/10 a 05/12, calendário de sete dias, orçamento R$ 120.000. Em 02/11 são 33 de 66 dias, PV R$ 60.000, avanço revisado de 30%, EV R$ 36.000, SPI 0,6 e SV −R$ 24.000. É uma base fictícia para verificar aritmética, não um parâmetro recomendado de produtividade. Prepare e aprove V2 para testar o histórico; versões anteriores permanecem consultáveis. Financeiro/admin: piloto@local.test / piloto-local; engenharia: engenharia@local.test / piloto-local. Clima noturno continua opcional.

## Validação concluída

- 316 testes de domínio, relatórios, ajuda, autorização e projeção passaram; mais 3 testes do orçamento de bundle.
- Quatro cenários novos de navegador passaram: fluxo de proposta/aprovação e preservação de V1 em 1440, 390 e 768 px, consulta do SPI em nova sessão, CSV, PDF, ajuda e tentativa de aprovação indevida pela engenharia. Quatro regressões de prazo/diário passaram.
- Lint, TypeScript, audit de ciclos, design:check e manual:check passaram. Ajuda: 106 guias / 65 abas. Índice da ajuda é criado depois de todas as inclusões; plan_baseline pertence ao Planejamento no manual. A consulta não grava dados.
- Build direto Vite passou, sem prebuild de migrações. Bundle gzip: 1.867.483 bytes; +10.900 sobre a entrega anterior de prazo. Teto total local de 1814 para 1825 KiB. Limites individuais, entrada, mídia e baseline visual preservados.
- Revisão React: imports diretos, cálculo derivado memoizado, sem efeito para gravar/aprovar, comandos aguardam confirmação do servidor; controles e DataTable compartilhados, cartões no celular. Nenhum estilo local novo.
- Detector Impeccable não apontou achados nos novos componentes e blocos de relatório/ajuda. Encontrou 20 ocorrências no Planejamento legado, em cores/fontes/raios da impressão A2 preexistente, fora dos blocos alterados; não foram introduzidas ou liberadas por esta entrega.
- Desktop e celular conferidos visualmente. PDF com 13 páginas renderizadas pelo Poppler; página 9 conferida com PV R$ 60.000, EV R$ 36.000 e SPI 0,6. Sem sobreposição nas tabelas novas.
- Demonstração em http://127.0.0.1:4242/, deixada na Residencial Alameda, Linha de base aprovada e SPI, com V1 e referência 02/11/2026. Planejamento fictício pode ser ajustado para preparar revisões; somente planos/condominios podem passar pelo save-sections nessa demonstração, além dos comandos explícitos de proposta, aprovação e diário. Escritas financeiras bloqueadas. Reiniciar descarta alterações. Servidores anteriores preservados.
- Nenhum push, PR, deployment, alteração remota ou migração de banco. O caminho de servidor foi validado localmente por testes; não se exerceu persistência real em produção.

## Próximas evoluções

Distribuições não uniformes de PV por atividade, curva por quantidades planejadas e governança de mudanças contratuais; preservar sempre as revisões já aprovadas. Para previsões estatísticas, congelar também o conjunto de evidências conhecido na referência antes de testar erros e acurácia. O SPI atual é indicador descritivo, sem garantia probabilística.
