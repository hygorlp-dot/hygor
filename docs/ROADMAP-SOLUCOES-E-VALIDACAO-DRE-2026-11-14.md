# Roadmap de soluções e validação do ERP com conferência do DRE

**Continuação de 16/11 — retomada validada localmente:** [financeiro continua vazio e novo ciclo ensaiado](RETOMADA-FINANCEIRA-2026-11-16.md). Captura atual confirmou zero lançamentos antigos para recriar. Onze etapas em PostgreSQL descartável, com DRE e caixa conferidos; 116 testes aprovados. Mantidas as alterações posteriores em pontos/cadastros, sem restaurar snapshot antigo. Próxima prioridade: composição da ALPHAVILLE e datas K1-04; cinco alertas de cadastro e cinco diferenças matemáticas exigem conferência, não correção automática. W1-22/CA1-13/R1-16 documentais. Nenhuma escrita ou publicação nova em produção.

**Novo ponto de partida após solicitação do usuário — 15/11:** [limpeza financeira concluída](ZERAGEM-FINANCEIRA-2026-11-15.md). Lançamentos anteriores de obras, empresa e extratos removidos com backup e transação auditada. Funcionários, pontos, orçamento, planejamento, contratos de terceirizados e locações/manutenções preservados; custos e cálculos dessas fontes permanecem no DRE. As 793 pendências desapareceram pela remoção dos movimentos, sem classificação/homologação. Próximo passo: revisar parâmetros contratuais preservados antes de gerar nova movimentação e usar a base limpa. Não importar snapshots/correções antigas automaticamente. Nenhuma nova publicação; as etapas abaixo passam a ser histórico anterior à limpeza.

**Publicação de 15/11 concluída por autorização posterior:** [correções validadas em produção](PUBLICACAO-CORRECOES-2026-11-15.md), versão `c6fccb0`, Vercel READY. 5.256 testes aprovados/15 pulos e gates locais aprovados; abertura remota desktop/celular conferida. O roadmap financeiro documental continua aberto, sem migrações nem importação das cópias locais. Ver parecer específico CA1-13/R1-16; manter W1-22 documental.

**Última rodada — centavos CA1-13 e entrada R1-16, 15/11:** [conferência documental concluída](CA1-13-E-ENTRADA-R1-16-2026-11-15.md). Minutas localizadas, sem assinaturas; valor de parcela CA1-13 corroborado com resíduo de R$ 0,06 e cronologia a esclarecer. Entrada R1-16: dois créditos de R$ 52.000 corroborados no CSV já estão no caixa do app com outra distribuição; as medições somam R$ 364.000 para contrato de R$ 360.000. Não corrigir automaticamente parcelas, datas ou novos recebimentos. DRE/caixa iguais em quatro etapas; W1-22 documental. Autorização posterior permite publicar somente o software validado.

**Última rodada — seis recebimentos e PC-0003, 15/11:** [pareceres e evidências atualizados](RECEBIMENTOS-LEGADOS-E-PC0003-2026-11-15.md). Seis recebimentos de R$ 63.510 já compõem o caixa; sete hipóteses têm avisos bancários compatíveis, sem prova de parcela/obra. Não normalizar IDs derivados nem cadastrar novamente. Aviso Pix do PC-0003 encontrado; conferir obrigação e razão das duas mudanças para caixa da obra antes de corrigir origem ou vincular. Quatro etapas sem novo efeito no DRE/caixa; 80 testes e gates locais aprovados. Próximas pendências independentes: centavos CA1-13 e entrada R1-16. Manter W1-22, aportes e vínculos documentais; sem publicação.

**Última rodada — 27 arquivados e oito destinos, 15/11:** [análise concluída com parecer por ID](ARQUIVADOS-E-DESTINOS-CONCORRENTES-2026-11-15.md). Corrigida a identidade compartilhada pelo prestador sem unir contratos/obras ou aprovar pagamentos. Sete hipóteses exigem conferir seis recebimentos legados já existentes; uma parcela é disputada por duas linhas. Onze sugestões não têm suporte para o caixa do PC-0003. Próximas providências: documentos das obrigações arquivadas, abreviações JOSE SANTOS, parcelas legadas, PC-0003 e diferenças contratuais/centavos. DRE e caixa preservados; 772 testes, sete cenários e gates locais aprovados. W1-22 e aportes documentais, sem publicação.

**Última rodada — conta e aporte, 15/11:** [conta documentada e aporte rastreado](CONTA-E-APORTE-B204-2026-11-15.md). Banco/agência/conta/CNPJ conferidos no contrato, com integridade criptográfica da assinatura verificada; proposta de cadastro permanece não aprovada. Duas linhas bancárias sem ID Pix/conta/lote nativos, zero originais recuperados nas tabelas consultadas. R$ 10.384,50 continuam documentais; R$ 220 já vinculados a medição não foram reutilizados. Próxima frente independente: 27 casos arquivados e oito destinos concorrentes. DRE e caixa preservados; 75 testes e gates aprovados. W1-22 e R$ 7.160 mantidos, sem publicação.

**Última rodada — origem e datas, 15/11:** [conferência concluída dos dois pagamentos](ORIGEM-E-DATAS-PAGAMENTOS-2026-11-15.md). R$ 4.100 e R$ 275 pagos pela conta da construtora; correções locais de origem e da data dos R$ 275, preservando pagamentos e comprovantes. Corrigida a omissão de liquidações de outra competência no seletor de caixa; DRE por competência preservado. Próximas pendências: comprovar conta/identificador bancário, composição do aporte B2-04 e aplicação financeira auditável; manter R$ 7.160 e W1-22 documentais. 756 testes, quatro cenários de navegador e gates locais aprovados; gzip 1.815.601, abaixo do limite inalterado. Sem publicação.

**Última rodada — revisão de hipóteses, 15/11:** [parecer dos 69 casos e sete grupos](REVISAO-HIPOTESES-E-REPETICOES-2026-11-15.md). Revisão individual concluída, sem homologar vínculos ou excluir movimentos. Oito destinos concorrem entre 65 hipóteses; dois comprovantes lidos e pendências específicas registradas. Próximas ações: origem do PC-0002, comprovante completo do PC-0001, distribuição por destino e documentos dos 15 movimentos repetidos. DRE preservado em cada etapa; W1-22 e aporte de R$ 7.160 mantidos. 190 testes, lint, tipos, design e manual aprovados; tudo local.

**Última rodada — triagem bancária, 15/11:** [793 casos individualizados](TRIAGEM-BANCARIA-2026-11-15.md): 766 ativos e 27 de extrato arquivado, todos com próxima providência; 69 hipóteses financeiras para revisão, zero conciliações automáticas autorizadas/executadas nos dados reais. Sete grupos de conteúdo repetido preservados para conferência. Corrigido o uso de REFNUM como TXID em novas importações OFX; históricos mantidos. W1-22 continua documental. DRE igual em 36 competências/648 combinações; 760 testes e cinco cenários de navegador aprovados. Sem publicação.

**Última rodada — W1-22 e lint, 15/11:** [relatório atualizado](W1-22-E-LINT-2026-11-15.md). O lint está aprovado, com design e manual verificados; os três textos já estavam corrigidos no checkout e foram validados. A busca documental identificou proposta de R$ 177.640 para a W1-22, que não confirma o contrato cadastrado nem a composição dos recebimentos. Os R$ 12.000 ficam em pendência documental, sem alteração de valores. DRE local igual em 36 competências/648 combinações de obra; 556 testes e dois cenários de navegador aprovados. Sem publicação ou gravação financeira remota.

**Última continuação — recebimentos e obras arquivadas, 15/11:** [evidências e DRE por etapa](RECEBIMENTOS-E-OBRAS-ARQUIVADAS-2026-11-15.md). Na cópia local, a cobrança X1-25 foi corrigida com base no contrato: receita/resultado de março +R$ 5.750, sem mudar caixa ou custos. As cinco referências têm origem exata em três obras arquivadas da projeção canônica, preservadas sem reativação. Resta o caso W1-22, R$ 12.000, com inconsistências de contrato e datas. 591 testes aprovados; 36 competências e 648 comparações por obra. O gate geral de design continua reprovado por três textos no módulo Arquivos. Nenhuma aplicação remota ou publicação.

**Última rodada — saneamento e conciliação, 15/11:** [relatório com origem real e evidências](SANEAMENTO-E-CONCILIACAO-DRE-2026-11-15.md). Seis identificações corrigidas na cópia local, preservando 94 eventos; corrigida a inclusão de R$ 150 de manutenções canceladas no memorial, sem mudar o DRE. Conferidas 36 competências e 648 combinações de obra/mês. Permanecem dois recebimentos excedentes, R$ 17.750, e cinco referências a obras ausentes para conferência de origem. Zero fechamentos reais encontrados; prévias preservadas como bloqueadas. 582 testes e 32 cenários de navegador aprovados. Nenhuma escrita remota ou publicação na Vercel.

**Situação em 15/11/2026:** herança tipográfica e sincronização de planos antigos concluídas localmente, com DRE conferido em cada etapa. Planos ambíguos permanecem preservados e bloqueados para revisão de origem. [Relatório e próximos passos](TIPOGRAFIA-E-PLANOS-LEGADOS-2026-11-15.md): 1.258 testes selecionados, 133 cenários de navegador aprovados e um pulo condicional; gzip com 80.143 bytes de margem. Sem publicação na Vercel. Pendências seguintes: saneamento histórico e homologações de fechamentos, serviços externos e dispositivos reais.

Solicitação de 14/11/2026: organizar as soluções da auditoria, testar os fluxos do início ao fim e conferir o DRE a cada etapa. Origem: [relatório da auditoria integral](RELATORIO-AUDITORIA-INTEGRAL-2026-11-14.md).

**Atualização — gzip resolvido:** após a separação de quinze telas e o alinhamento do `DESIGN.md`, o reaproveitamento das fontes eliminou o excesso de 25.630 bytes. O total está em **1.809.052 bytes**, com limite inalterado de 1.891.328 e redução adicional na abertura, inclusive contando fontes. O DRE foi preservado e os documentos finais continuam com fontes incorporadas. Resultados e pendências seguintes no [relatório de gzip e relatórios](GZIP-E-RELATORIOS-2026-11-14.md); a etapa anterior permanece no [histórico de desempenho e design](PERFORMANCE-E-DESIGN-2026-11-14.md).

O trabalho deve começar pela integridade dos vínculos e dos documentos financeiros. Depois, validar as jornadas operacionais completas; por último, ampliar melhorias e automações. Uma etapa só termina quando sua operação, persistência, permissões e efeito no DRE forem conferidos.

Este documento define a sequência e os critérios de aceite. Após autorização para iniciar automaticamente cada etapa, as correções e validações locais avançaram conforme o [registro de execução](EXECUCAO-ROADMAP-2026-11-14.md). A situação inicial abaixo foi preservada como referência. Teste que reproduz uma falha não equivale a correção aprovada; testes locais também não equivalem à homologação dos serviços externos.

## Situação inicial e evidências novas

Diretório: `artifacts/roadmap-solucoes-20261114/`.

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Jornada pelo navegador no build novo | Obra nova → recarga → orçamento → etapa/item → baseline → planejamento, com seis conferências do motor do DRE sobre o estado de teste | `extended.json`, `browser-current-build.log` |
| Conferência dos seis pontos da criação | Receita, custo realizado e resultado da nova obra permaneceram em zero, como esperado nessa fase | Campo `dre` de cada passo de `extended.json` |
| Projeção financeira encadeada | 20 passos com valores esperados definidos previamente; comparação de DRE, obrigações, compromissos, caixa, outra obra e outra competência | `dre-walkthrough.json`, `dre-walkthrough.log` |
| Revalidação das falhas na API | Seis casos novamente reproduzidos no handler real com banco simulado | `api-probes-evidence.json`, `api-baseline.log` |
| Regressões financeiras existentes | 138 testes aprovados em 11 arquivos, sem pulados; não substituem a suíte geral da auditoria | `financial-regression.json` |
| Compilação do checkout atual | Aprovada na reexecução, depois que o arquivo do portal em elaboração ficou disponível | `build-recheck.log` |

A jornada de navegador usa uma compilação local nova e a interface real com APIs isoladas. Os seis checkpoints consultam o motor canônico sobre os dados dessa sessão, sem operar separadamente as telas do DRE. O roteiro de 20 passos é um teste da projeção canônica com fatos controlados; ele não opera todos esses passos pelos formulários nem confirma persistência PostgreSQL remota. As etapas de implementação abaixo exigem completar essas camadas.

**Ocorrências da etapa 0:** a primeira compilação encontrou uma referência ainda incompleta de `ClientPortalRouter.jsx` para `ClientAdministrationTeamPage.jsx`, em trabalho concorrente. O arquivo ficou disponível e o build foi repetido com sucesso, sem sobrescrever essa entrega. A primeira tentativa sem build válido não chegou ao login (`build.log`, `current-build-browser-attempt.json`). Também foi necessário aguardar a conclusão da gravação antes de recarregar após aprovar o orçamento; uma tentativa anterior encontrou o estado de edição protegida (`planning-recovery-attempt.json`). A jornada final de seis passos passou com essa espera, sem descartar a proteção nem reenviar automaticamente a edição. Esta ocorrência reforça a exigência de confirmar persistência antes de avançar.

## Regra de aprovação para todas as etapas

Antes da operação, registrar obra, competência, usuário, IDs de origem e uma fotografia dos valores. Executar a ação, consultar novamente o servidor, recarregar a tela e conferir os mesmos valores. Repetir com falha de rede, resposta perdida, versão concorrente e usuário sem permissão quando aplicável.

O registro mínimo de conferência é:

| Grupo | Valores a guardar | Regra |
| --- | --- | --- |
| DRE da obra | Receita, custo por origem/categoria, resultado e memorial | Resultado = receita − custo; cada fato reconhecido aparece uma vez |
| DRE da empresa | Obras, despesas corporativas e valores sem apropriação | Conciliar os componentes do consolidado; não ocultar valores sem obra |
| Competência | Mês alterado e mês anterior fechado | Efeito apenas na competência prevista pela regra; histórico fechado preservado |
| Outras obras | Ao menos uma obra de controle | A ação na obra A não altera documento nem valor da obra B |
| Compromissos | Pedido/contrato e saldo ainda não reconhecido | Não somar novamente ao custo já reconhecido |
| Estoque | Quantidade, unidade, conversão e origem | Movimento físico não registra pagamento; custo depende da regra de reconhecimento existente |
| Obrigações | Contas a pagar/receber, baixas e garantias | Saldo antes − baixa válida + estorno = saldo depois |
| Caixa | Entradas/saídas e vínculo bancário | Pagamento/recebimento não cria outra receita ou outro custo já reconhecido |
| Auditoria | Operação, chave idempotente, versão e origem | Reenvio da mesma operação não duplica registro, custo ou pagamento |

Usar centavos inteiros. Eventual arredondamento deve ter regra explícita; não usar tolerância genérica para esconder divergências. Não presumir que dois registros representam o mesmo fato por nome, valor ou descrição.

Para ações rejeitadas: nenhuma gravação operacional, nenhum novo evento financeiro e nenhuma alteração do DRE/caixa. Para consultas e ajustes visuais: diferença monetária esperada igual a zero. Sincronizações operacionais existentes, como a criação de tarefas a partir do orçamento, precisam ser identificadas separadamente de lançamentos financeiros.

**Bloqueio de avanço:** diferença monetária sem explicação, perda de origem, alteração de outra obra, teste pulado que seja necessário ao aceite ou incompatibilidade entre o memorial e o total. A etapa permanece aberta até resolver ou registrar uma dependência concreta. A aprovação é baseada em evidência, não só em quantidade de testes verdes.

## Sequência das soluções

| Etapa | Entrega | Dependência | Situação nesta entrega |
| --- | --- | --- | --- |
| 0 | Base reproduzível e fotografias do DRE | Auditoria | Executada; falhas conhecidas reconfirmadas |
| 1 | Isolamento entre obras — SEC-01 | 0 | Implementada; domínio e API validados localmente |
| 2 | Identidade e duplicidade de nota — DUP-01 | 1 | Implementada; identidade forte e DRE testados |
| 3 | Cancelamento de medição e documento fiscal — FIN-01 | 1–2 | Implementada; bloqueio e legado testados |
| 4 | Exclusão/encerramento de obra e lotações históricas — OBR-01/02 | 1–3 | Implementada; dependências e rejeição na API testadas |
| 5 | Datas válidas e preservação da simulação — VAL-01/UX-01 | 1–4 | Implementada; calendário e oito casos de navegador aprovados |
| 6 | Jornada completa de obra, orçamento e planejamento | 1–5 | Reaproveitamento implementado; 30 casos de navegador aprovados; alcance descrito no registro |
| 7 | Compras, estoque, notas, pagamentos e conciliação | 6 | 88 casos de navegador aprovados; serviços externos isolados |
| 8 | Terceiros, folha, equipamentos, faturamento e fechamento | 7 | 62 casos de navegador aprovados e regressões financeiras locais; não homologa hardware/produção |
| 9 | Interface, ajuda, portal e contratos dos testes | 1–8 | 21 elementos restantes corrigidos; nova varredura das 130 combinações sem violações nas regras axe executadas. Evidências no relatório complementar |
| 10 | Automação assistida e regressão geral | 1–9 | 15 testes PostgreSQL aprovados em cluster local descartável; DRE preservado e cluster removido. Serviços externos ainda exigem homologação própria |

As correções que compartilham `ledger.js`, comandos financeiros e `api/data.js` devem ser integradas em sequência. Cada conjunto deve ter uma validação local identificável. Não criar pushes ou previews intermediários para testar.

### Etapa 0 — Congelar a referência da execução

1. Registrar HEAD, alterações locais, hash dos arquivos relevantes, horário, build, fixture e versões das ferramentas.
2. Usar empresa fictícia com obras A/B, períodos atual/anterior e documentos com IDs conhecidos. Preservar as alterações de outros trabalhos no checkout.
3. Executar os seis casos da auditoria e guardar o comportamento atual, sem tratá-los como testes de aceitação das correções.
4. Operar a criação pelo navegador, conferindo o DRE após cada confirmação.
5. Executar o roteiro financeiro numérico abaixo e registrar suas limitações de camada.

**Aceite:** cenário reproduzível, valores iniciais conhecidos e falhas identificadas. A existência dos seis defeitos não impede registrar a base; impede declarar o ERP homologado.

### Etapa 1 — Bloquear vínculo e escrita entre obras diferentes

**Solução:** exigir identidade e autorização da medição e da nota no servidor. Ambas devem pertencer à mesma obra autorizada. Revalidar dentro da operação transacional, depois da releitura dos documentos.

**Passos de teste:**

1. Financeiro da obra A vincula nota e medição da própria obra: operação válida.
2. O mesmo perfil tenta usar o ID de uma nota da obra B: rejeição sem gravação.
3. Administrador tenta cruzar obra A/B: rejeição por incoerência do vínculo, mesmo com acesso às duas obras.
4. Engenharia, usuário inativo e perfil sem ação autorizada tentam o comando diretamente pela API.
5. Repetir com versão antiga, duas sessões e reenvio da mesma chave.

**DRE:** no caso válido, a nota e a medição do mesmo fato reconhecem R$ 1.000 uma vez. No caso cruzado com documentos de R$ 1.000 em cada obra, os R$ 2.000 previamente reconhecidos permanecem nas respectivas obras; a tentativa recusada não altera nada. Conferir também a versão do documento da obra B.

**Aceite:** regressão de `FIN-02-API` passa a esperar rejeição e invariância. Testar domínio, handler e transação local PostgreSQL; o filtro da interface sozinho não aprova esta etapa.

### Etapa 2 — Impedir duplicidade documental sem confundir pessoas ou documentos distintos

**Solução:** reaproveitar chave fiscal e identidades existentes de emissor, tipo, série e número. Documento sem identidade suficiente entra em conferência explícita. Não criar outro cadastro nem unir registros por semelhança. Antes de introduzir campo novo, verificar importação XML/IA, fornecedor e documento original.

**Passos de teste:**

1. Importar/salvar uma nota com chave e repetir com outro ID interno.
2. Salvar a mesma nota manual sem chave, repetir com outro ID e com outro usuário.
3. Repetir a tentativa após resposta perdida e em duas sessões concorrentes.
4. Cadastrar documentos diferentes com número igual e emissores/séries diferentes: não bloquear indevidamente.
5. Conferir acentos, pontuação de CPF/CNPJ, chave inválida, nota cancelada e documento dividido legitimamente entre obras.
6. Se houver exceção de negócio, exigir identificação documental e justificativa auditável; não aceitar a exceção só por igualdade de valores.

**DRE:** a nota fictícia de R$ 1.000 gera custo de R$ 1.000 e obrigação de R$ 1.000. Repetição não gera R$ 2.000 nem outra baixa. Rateio legítimo mantém o total consolidado em R$ 1.000, distribuído pelas obras corretas.

**Aceite:** `DUP-01-API` deixa de aceitar duas notas equivalentes. Verificar idempotência da operação e unicidade do documento como controles distintos. Não corrigir registros reais automaticamente nesta etapa.

### Etapa 3 — Preservar custo e obrigação ao regularizar medição e NF

**Solução proposta para o primeiro ajuste:** bloquear o cancelamento isolado de medição com NF reconhecida dependente. A regularização do documento e do vínculo deve ser explícita e auditável. Não cancelar, rejeitar ou desvincular automaticamente uma nota válida para fazer o DRE fechar. O razão deve sinalizar estados inconsistentes legados.

**Passos de teste:**

1. Contrato → medição em rascunho → envio → aprovação → vínculo fiscal.
2. Tentar cancelar a medição com NF reconhecida: rejeitar, preservando o estado coerente.
3. Exercitar a regularização autorizada do documento, sem pagamento, e só depois o cancelamento permitido.
4. Com pagamento, exigir o estorno previsto no fluxo antes de desfazer obrigação; preservar o banco e o histórico originais.
5. Repetir com garantia técnica, imposto retido, período fechado, medição rejeitada e vínculo legado já inconsistente.
6. Recarregar, trocar de perfil e abrir os memoriais das duas origens.

**DRE:** medição aprovada e NF do mesmo fato totalizam R$ 1.000. Cancelamento rejeitado mantém R$ 1.000; não pode produzir zero silenciosamente. Quando o fato for efetivamente anulado por operação válida, a retirada de custo e de obrigação deve ter a mesma origem e justificativa. Pagamento/garantia não vira novo custo.

**Aceite:** `FIN-01-API` passa a verificar a proteção, e o teste do razão cobre também inconsistências anteriores ao ajuste.

### Etapa 4 — Proteger obras com vínculos e lotações anteriores

**Solução:** levantar todas as referências à obra e usar uma verificação compartilhada de dependências. Orçamentos, baselines, planos, contratos, licenças, arquivos, estoque, RH e finanças precisam entrar nesse inventário. Examinar `obraId`, `obra`, `lastObra` e históricos como referências independentes. Para obra com histórico, usar encerramento/arquivamento conforme os estados existentes.

**Passos de teste:**

1. Criar uma obra vazia e testar a exclusão permitida.
2. Adicionar separadamente orçamento, plano, contrato, licença, movimento, arquivo e histórico de equipe; testar o bloqueio em cada origem.
3. Funcionário atualmente na obra A com lotação anterior B: impedir exclusão de B pela API.
4. Adicionar um vínculo em outra sessão entre a abertura da confirmação e o envio: revalidar antes de persistir.
5. Encerrar a obra com histórico e consultar registros arquivados, relatórios e exportações.

**DRE:** arquivar/encerrar não apaga custo, receita, baixa ou competência. Comparar o DRE por obra e empresa antes/depois, inclusive período fechado. Nenhum registro pode ficar com obra inexistente.

**Aceite:** `OBR-01-API` e `OBR-02-API` passam a esperar bloqueio, e a exclusão da obra realmente vazia continua disponível ao perfil autorizado.

### Etapa 5 — Validar calendário e conservar o contexto da consulta

**Solução:** validar a existência da data civil no servidor e nas importações. Restaurar obra, horizonte e deslocamento da simulação ao voltar do pedido, sem herdar premissas de outra obra.

**Passos de teste:** datas impossíveis, ano bissexto, fim de mês, virada de ano, importação manual/XML/IA, duas obras e competência fechada. Simular +7 dias → abrir pedido → fechar → voltar; repetir em desktop e celular e depois trocar de obra.

**DRE:** emissão/competência inválida não é gravada nem desloca custo. Alterar vencimento válido muda a previsão de caixa segundo a regra existente, sem reconhecer novamente a despesa. Simular datas não grava pagamento, custo ou cronograma real.

**Aceite:** `VAL-01-API` rejeita datas inexistentes e `WF07` conserva o deslocamento ao retornar. Conferir unidade de data/fuso em cada camada.

### Etapa 6 — Obra → orçamento → planejamento, operados do início

1. Administração cadastra cliente e obra, revisa contrato, parcelas, responsável e datas.
2. Engenharia cria orçamento vinculado, reaproveitando cliente/endereço/área confirmados na origem.
3. Incluir materiais e serviços, unidades, composição e seis níveis de hierarquia; importar e exportar uma planilha.
4. Aprovar baseline, criar revisão e comprovar que a versão aprovada não foi alterada.
5. Derivar planejamento, calendário, dependências e marcos; revisar cobertura e gerar impressão.
6. Registrar diário, avanço e conferência pelos perfis correspondentes, incluindo rejeição/correção e restrição de acesso.

**DRE a cada passo:** cadastro, orçamento e cronograma permanecem como referência, sem custo ou receita realizados por essas ações. Diário/avanço não deve criar faturamento ou despesa implícitos. Se uma ação tiver integração financeira explícita, identificar o documento gerado e testá-lo na etapa 8.

**Aceite:** mesma obra e mesmos IDs atravessam toda a jornada; desktop/celular, recarga e permissões conferidos. A prova parcial da etapa 0 não substitui essa ampliação.

### Etapa 7 — Planejamento → solicitação → cotação → pedido → estoque → NF → banco

1. Derivar uma necessidade com vínculo comprovado de plano/etapa/material.
2. Conferir estoque e unidade de compra; gerar solicitação sem duplicar cobertura.
3. Solicitar propostas, abrir portal do fornecedor, receber/revisar retornos e decidir a cotação.
4. Criar/enviar pedido, registrar aceite e receber parte; depois concluir a entrega.
5. Importar a NF e comparar pedido, recebimento e documento. Exercitar divergência e revisão autorizada.
6. Aprovar a obrigação; pagar parcialmente, conciliar, quitar, estornar e registrar nova baixa explícita.
7. Repetir com cliente direto, caixa da obra, rateio, compra fora do fluxo e devolução/cancelamento aplicáveis.

**DRE:** seguir os valores do roteiro de referência abaixo. Pedido é compromisso; recebimento é físico; nota reconhecida é custo; pagamento é caixa/baixa. A conciliação do pagamento existente não cria outra despesa. Cliente direto permanece separado do caixa da empresa.

**Aceite:** cada confirmação tem fotografia anterior/posterior, persistência após recarga e memorial. Reenvio, concorrência, saldo parcial, conversão e arredondamento não duplicam quantidade nem dinheiro.

### Etapa 8 — Terceiros, pessoas, equipamentos, faturamento e fechamento

Executar as subetapas separadamente, sempre pela origem e pelos perfis existentes:

| Subetapa | Caminho obrigatório | Conferência do DRE |
| --- | --- | --- |
| 8A — terceiros | Prestador → contrato → etapas → evidência → medição → aprovação → NF → retenções → pagamento → garantia → regularização | Contrato/previsão não vira custo; medição e NF reconhecem uma vez; pagamento e liberação de garantia não acrescentam outro custo |
| 8B — RH | Funcionário → escala/lotação → ponto bruto → conferência → quinzena → adiantamento → folha → fechamento → título → pagamento; rescisão em cenário separado | Apropriar a competência e obra corretas; não acumular estimativa de ponto, título e pagamento como custos diferentes; preservar histórico ao transferir/desligar |
| 8C — equipamentos | Cadastro → disponibilidade → locação → saída → uso → medição/cobrança → retorno parcial → manutenção → encerramento | Conferir o produtor operacional de custos/receitas usado pelo DRE do app, além do razão básico. Não tomar fatura, locação e pagamento como três reconhecimentos |
| 8D — faturamento | Avanço aprovado/contrato → medição a faturar → documento → recebimento parcial → conciliação → saldo | Receita conforme o evento autorizado; recebimento baixa o direito e movimenta caixa, sem reconhecer a receita novamente |
| 8E — fechamento | Conferência → resolução de pendências → fechamento mensal → consulta de memória → tentativa de alteração histórica | Fotografia fechada preservada; testar handler, transação e releitura, não apenas recusa no botão |

**Aceite:** conciliar DRE da obra, da empresa, relatórios e memoriais. Os produtores de custos de pessoal/equipamentos devem ser testados junto à projeção consumida pela API; alimentar eventos suplementares manualmente não basta para homologá-los.

### Etapa 9 — Interface, documentos, portal e confiabilidade dos testes

1. Corrigir nomes acessíveis, associação de rótulos, contraste, foco/rolagem e alvos de toque pela base compartilhada.
2. Rever manutenção de filtros, edição, mensagens, confirmação e retorno de foco.
3. Revalidar projetos, arquivos, licenciamento e dossiê; enviar duas revisões, provocar falha e conferir reenvio sem duplicar anexos.
4. Revalidar comercial, proposta/contrato, cliente, portal, publicação, troca de senha e isolamento de dados.
5. Resolver o contrato de `progressSource` e atualizar testes de seletores/fontes/fixtures conforme os padrões reais, preservando as asserções de negócio.
6. Executar todas as 65 abas, áreas internas e perfis; ampliar casos vazios, conteúdo longo, falha, rede lenta e teclado.
7. Rever ajuda em `src/features/help/help-content.js`, atualizar a revisão quando houver mudança de fluxo e gerar o manual na mesma alteração.

**DRE:** consulta, ajuda, aparência, anexos e publicação não alteram valores financeiros. Publicar só a projeção autorizada ao cliente; não confundir atualização de visibilidade com novo reconhecimento.

**Aceite:** Impeccable + shadcn e padrões MARCELL aplicados, sem aumento da baseline; validação visual em desktop/celular e axe reexecutados. Teste antigo removido/substituído deve ter motivo e cobertura equivalente documentados.

### Etapa 10 — Automatizar com proteção e homologar o conjunto

**Ordem das automações:** preencher dados já vinculados → indicar pendências/próxima ação → propor conferências → permitir confirmação assistida. Só depois avaliar execução automática de cenários estritamente identificados.

1. Selecionar uma automação por vez: cobertura de compra, conferência de NF, medição/título, ponto/folha, dossiê ou resumo executivo.
2. Definir origem, IDs, unidade, competência, responsável, condição de execução e mecanismo contra duplicidade.
3. Rodar primeiro em modo de proposta, com casos seguros e ambíguos misturados.
4. Validar repetição, concorrência, expiração de sessão, revogação e retorno de falha.
5. Operar novamente a jornada completa, desde obra vazia até fechamento e consulta do histórico.

**DRE:** proposta e alerta têm diferença zero. Confirmação aprovada tem apenas o efeito do fato novo previsto. Repetição tem diferença zero. Reversão válida recupera o saldo previsto sem apagar o original.

**Aceite final:** nenhuma falha de integridade aberta, suíte pertinente aprovada, casos obrigatórios não pulados, DRE conciliado em todas as etapas, ajuda/manual sincronizados e evidências de desktop/celular. Homologação de serviços externos deve ser registrada separadamente. Publicação exige solicitação explícita e deve consolidar as alterações para evitar builds intermediários.

## Roteiro financeiro numérico de referência

Valores em reais na tabela. A evidência guarda centavos. É um cenário fictício do motor atual, não uma definição tributária/contábil para todos os contratos. Campos não movimentados permanecem iguais ao passo anterior.

Planilha de conferência: `artifacts/roadmap-solucoes-20261114/checkpoints-dre.csv`.

| Passo | Ação | Receita | Custo realizado | Resultado | A pagar | A receber | Compromisso | Entradas / saídas acumuladas |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Obra sem fatos financeiros | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| 2 | Orçamento, baseline e plano | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| 3 | Solicitação e cotação | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| 4 | Pedido enviado | 0 | 0 | 0 | 0 | 0 | 1.000 | 0 / 0 |
| 5 | Recebimento parcial | 0 | 0 | 0 | 0 | 0 | 1.000 | 0 / 0 |
| 6 | Entrega concluída | 0 | 0 | 0 | 0 | 0 | 1.000 | 0 / 0 |
| 7 | NF reconhecida, vinculada ao pedido | 0 | 1.000 | -1.000 | 1.000 | 0 | 0 | 0 / 0 |
| 8 | Pagamento parcial | 0 | 1.000 | -1.000 | 600 | 0 | 0 | 0 / 400 |
| 9 | Conciliação do mesmo pagamento | 0 | 1.000 | -1.000 | 600 | 0 | 0 | 0 / 400 |
| 10 | Quitação do saldo | 0 | 1.000 | -1.000 | 0 | 0 | 0 | 0 / 1.000 |
| 11 | Contrato de terceiro de R$ 5.000 | 0 | 1.000 | -1.000 | 0 | 0 | 0* | 0 / 1.000 |
| 12 | Medição de terceiro em rascunho | 0 | 1.000 | -1.000 | 0 | 0 | 0* | 0 / 1.000 |
| 13 | Medição aprovada | 0 | 3.000 | -3.000 | 2.000 | 0 | 0* | 0 / 1.000 |
| 14 | NF da mesma medição vinculada | 0 | 3.000 | -3.000 | 2.000 | 0 | 0* | 0 / 1.000 |
| 15 | Pagamento do terceiro | 0 | 3.000 | -3.000 | 0 | 0 | 0* | 0 / 3.000 |
| 16 | Faturamento ao cliente | 5.000 | 3.000 | 2.000 | 0 | 5.000 | 0* | 0 / 3.000 |
| 17 | Recebimento parcial | 5.000 | 3.000 | 2.000 | 0 | 2.000 | 0* | 3.000 / 3.000 |
| 18 | Reconsulta dos mesmos registros | 5.000 | 3.000 | 2.000 | 0 | 2.000 | 0* | 3.000 / 3.000 |
| 19 | Estorno do pagamento de R$ 400 | 5.000 | 3.000 | 2.000 | 400 | 2.000 | 0* | 3.000 / 2.600 |
| 20 | Nova baixa explícita de R$ 400 | 5.000 | 3.000 | 2.000 | 0 | 2.000 | 0* | 3.000 / 3.000 |

\* A coluna mostra o seletor de compromissos do razão básico exercitado pelo roteiro, que não materializa o contrato de terceiro inteiro. O saldo contratual a medir deve ser conferido adicionalmente em Compromissos por origem/previsões na etapa 8A. Não interpretar zero nessa coluna como inexistência de obrigação contratual futura.

As entradas e saídas são movimentos acumulados desse cenário, não o saldo bancário real da empresa. Outra obra e competência anterior foram usadas como controles. A comparação do consolidado nesta fixture não contém despesas corporativas; cenários de despesa administrativa e sem apropriação são obrigatórios nas etapas 8–10.

## Registro a preencher em cada correção

| Campo | Conteúdo obrigatório |
| --- | --- |
| Identificação | Etapa, falha, data, versão/arquivos e fixture |
| Origem | Registro, obra, unidade, valor, competência e IDs vinculados |
| Antes | DRE por obra/empresa, obrigações, compromissos, estoque e caixa |
| Ação | Operador, controle/comando e resultado esperado |
| Depois | Persistência confirmada, recarga e diferenças monetárias |
| Casos negativos | Acesso negado, duplicidade, conflito, resposta perdida e período fechado |
| Recuperação | Formulário/histórico preservados; nova tentativa explícita e idempotente |
| Evidências | Resultado dos testes, requisição sanitizada, memorial e capturas pertinentes |
| Ajuda/manual | Alteração feita ou justificativa para não mudar instruções |
| Conclusão | Aprovada, reprovada ou dependência concreta; nunca apenas “parece correto” |

Para validar localmente, usar os testes pertinentes, `npm run lint`, `npm run typecheck`, `npm run design:check`, `npm run manual:check` e `npx vite build`. Repetir a suíte geral e as jornadas amplas após integrar as correções. Não usar `npm run build` como verificação inofensiva: o prebuild do projeto executa migrações.
