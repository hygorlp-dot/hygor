# Roadmap MARCELL para experiência 9,5 de 10

Data: 31/10/2026. Meta: concluir as rotinas de obra, Compras e Financeiro com continuidade, clareza e recuperação de falhas, sustentadas por um padrão visual comum. Marca MARCELL, logo e Source Sans 3 local permanecem. Execução e validação locais, sem push, PR, deploy ou migrações automáticas.

**Posição em 31/10: WF09 concluída na validação técnica local; WF10 preparada para aplicação posterior, conforme escolha do usuário.** São 8 de 10 entregas concluídas (WF02–WF09) e 2 parciais (WF01 e WF10, pela medição acompanhada). A onda 5 permanece aberta até a aplicação do piloto. Nota heurística provisória: 9,4/10 nas superfícies verificadas; a meta de 9,5 ainda depende da validação acompanhada. Consulte os relatórios da [onda 1](ROADMAP-SAAS-95-ONDA-1-2026-10-31.md), [onda 2](ROADMAP-SAAS-95-ONDA-2-2026-10-31.md), [início da onda 3](ROADMAP-SAAS-95-ONDA-3-2026-10-31.md), [conclusão da WF06](ROADMAP-SAAS-95-WF06-CONCLUSAO-2026-10-31.md), [onda 4](ROADMAP-SAAS-95-ONDA-4-2026-10-31.md) e [onda 5](ROADMAP-SAAS-95-ONDA-5-2026-10-31.md). As quatro ondas anteriores permanecem concluídas no escopo do piloto, com seus limites registrados. Este ciclo trata a consolidação do produto e a qualidade das jornadas, sem reconstruir as funções existentes.

## Como avaliar a meta

A revisão anterior atribuiu 8,8/10 às superfícies verificadas, com cinco critérios de mesmo peso. A avaliação abaixo dá mais peso ao fluxo; a nota inicial precisa ser recalculada com esta mesma matriz antes de comparar resultados. Não se considera 9,5 alcançado apenas por terminar a lista de entregas.

| Dimensão | Peso | Evidência esperada |
|---|---:|---|
| Conclusão do fluxo de ponta a ponta | 35% | Jornadas completas, transições corretas e resultado confirmado |
| Pendência e próxima ação | 20% | Operador entende o que falta, quem pode resolver e onde agir |
| Continuidade e recuperação | 15% | Contexto preservado; falha não exige refazer trabalho nem duplica operação |
| Consistência de layout, controles e textos | 15% | Mesma tarefa usa o mesmo padrão em todos os módulos prioritários |
| Desktop, celular e acessibilidade | 10% | Tarefa executável por toque e teclado, com foco e conteúdo legíveis |
| Resposta da interface | 5% | Medições locais de espera e retorno das ações, com volume representativo |

Nota final = soma das notas de cada dimensão multiplicadas pelos pesos. Meta: **pelo menos 9,5/10**, com fluxo, próxima ação e recuperação individualmente em pelo menos 9,5; nenhuma dimensão abaixo de 9,0. Cada dimensão precisa combinar evidência de tarefa, inspeção e avaliação do operador; o checklist visual isolado não determina a nota.

Um defeito que impeça uma tarefa essencial, perca trabalho, exponha dados fora do acesso ou duplique operação impede concluir o ciclo, independentemente da média.

## Jornadas de referência

As rotinas usam os módulos e comandos existentes. A sequência é uma referência de navegação; entregas, notas e pagamentos podem ocorrer em ordens diferentes conforme a operação.

| Jornada | Resultado a verificar |
|---|---|
| J01 — Planejamento → solicitação | Origem, obra, etapa e unidades corretas; quantidades de compra revisadas explicitamente |
| J02 — Solicitação → cotação → decisão → pedido | Comparação e decisão preservadas; compras parciais e propostas pendentes compreensíveis |
| J03 — Pedido → recebimento parcial → saldo de entrega | Recebimento físico registrado uma única vez; saldo e próxima providência visíveis |
| J04 — Documento → conferência → obrigação | Pedido, recebido, faturado e vencimento distinguíveis; divergência ou vínculo ausente explicado |
| J05 — Obrigação → pagamento parcial → saldo | Registro existente respeitado; pagamento com confirmação, resultado e saldo residual claros |
| J06 — Extrato → revisão → conciliação | Conta, documento e saldo corretos; vínculo parcial e confirmação sem segunda despesa |
| J07 — Pendência → correção na origem → fechamento | Correção retorna ao mesmo recorte; alertas operacionais distintos dos bloqueios do motor |
| J08 — Falha → retomada | Rejeição, conflito, sessão expirada e arquivo indisponível têm recuperação sem perda ou reenvio indevido |

Perfis de referência: Engenharia, Compras, Financeiro e Administração, conforme as permissões já configuradas. A passagem entre pessoas deve mostrar o estado confirmado e a providência seguinte; não ampliar acesso para facilitar um atalho.

## Sequência de execução

Porte S/M/L indica esforço relativo, não prazo. Cada onda inclui desktop, celular, textos, botões, foco, estados e testes das jornadas afetadas. A onda 5 aprofunda a validação; adaptação móvel e tratamento de erros começam na primeira entrega.

| Onda | Entrega | Mudança esperada na rotina | Dependência | Porte |
|---|---|---|---|---|
| 1 — Medir e consolidar a base | WF01 — Contrato das jornadas | Registrar passos, interrupções, redigitação e estados das oito jornadas | Evidências do piloto anterior | S |
| 1 — Medir e consolidar a base | WF02 — Padrões compartilhados | Uma linguagem para botões, títulos, campos, filtros e feedback | WF01 | M |
| 2 — Completar a rotina de Compras | WF03 — Solicitar, cotar e decidir | Pendência e decisão próximas do registro; passagem entre pessoas compreensível | WF02 | M |
| 2 — Completar a rotina de Compras | WF04 — Pedido, entrega e exceções | Resolver atraso, entrega parcial, cancelamento e falta de vínculo no contexto do pedido | WF03 | M |
| 3 — Completar a rotina financeira | WF05 — Documento até conciliação | Continuar entre evidência, obrigação, pagamento e extrato sem procurar novamente a origem | WF02 e WF04 | L |
| 3 — Completar a rotina financeira | WF06 — Fechamento e recuperação | Corrigir a origem, retomar a conferência e distinguir pendência de bloqueio | WF05 | M |
| 4 — Coordenar o trabalho entre módulos | WF07 — Necessidade e compromissos | Mostrar cobertura comprovada e o que ainda precisa de decisão, por obra e prazo | WF03 a WF06 | L |
| 4 — Coordenar o trabalho entre módulos | WF08 — Filas e revisão em volume | Priorizar e revisar sem perder o recorte, a elegibilidade ou o resultado individual | WF05 e WF06 | M/L |
| 5 — Validar a operação completa | WF09 — Uso móvel e condições adversas | Concluir tarefas com conteúdo longo, interrupção, teclado e conexão instável | Todas as ondas anteriores | M |
| 5 — Validar a operação completa | WF10 — Piloto acompanhado e nota final | Medir conclusão, tempo, esforço de navegação e clareza com operadores | WF09 | M |

### Onda 1 Medir e consolidar a base

**WF01.** Executar J01 a J08 com cenários fixos, incluindo parcial, divergência e falha. Medir tempo de tarefa, mudanças manuais de módulo, campos redigitados, perda de contexto e ajuda necessária. Registrar para cada jornada o perfil, dados iniciais, resultado esperado e evidência. Separar espera do sistema de tempo de decisão do operador.

**Aceite:** uma referência reproduzível por jornada, mais o mapa de estados e permissões. Medições e critérios registrados antes de estabelecer ganhos; não inventar tempos iniciais.

**WF02.** Consolidar as três famílias atuais de botão em um contrato semântico compartilhado, com adaptadores para chamadas legadas e migração em trechos pequenos. Definir também cabeçalho de página e de seção, barra de filtros, linha de registro, ação contextual, formulário, diálogo, aviso e estado de resultado. Corrigir títulos de nível principal repetidos, começando por Financeiro e Compras. Não substituir componentes apenas por aparência semelhante sem preservar seu comportamento.

| Elemento | Contrato visual e de uso |
|---|---|
| Títulos | Um H1 por tela; H2 para áreas; H3 para grupos, sem escolher a semântica pelo tamanho desejado |
| Escala tipográfica | Página 24 px, seção 18 px, grupo 16 px, corpo 15 px, rótulo 14 px e auxiliar 13 px, expressos em tokens/rem; edição móvel com pelo menos 16 px |
| Botões | Principal, secundário, discreto e destrutivo, com estados de foco, carregamento, desabilitado e resultado iguais entre módulos |
| Dimensões | Padrão operacional de 40 px no desktop e alvo mínimo de 44 px no celular; densidade compacta restrita a consultas de desktop |
| Espaçamento | Escala 4/8/12/16/24/32 px, com regra comum para campo, grupo, seção e página; não somar invólucros com padding repetido |
| Textos | Verbo e objeto; mesma ação com mesmo nome; distinguir receber material, receber documento, registrar pagamento e conciliar |
| Estrutura | Identidade e ação → contexto e filtros → registros e resolução → análises complementares |
| Estados | Diferenciar vazio, sem resultado no filtro, sem permissão, carregando, erro recuperável e operação confirmada |

**Aceite:** catálogo local dos padrões e seus estados; ausência de variantes conflitantes nas superfícies migradas; mesmos formulários, comandos e permissões funcionando. A migração amplia sua cobertura nas ondas seguintes, sem deixar uma quarta família de componentes.

### Onda 2 Completar a rotina de Compras

**WF03.** Refinar Solicitar → Cotar → Decidir com a mesma identidade de origem, prazo, situação e próxima providência. Indicar o responsável existente na solicitação ou aprovação; ausência aparece como informação pendente, sem atribuir pessoas por inferência. Diferenciar contagem de pendências de total de registros. A passagem para outro perfil precisa explicar se o documento foi salvo, enviado, aprovado ou apenas consultado.

**Aceite:** J01 e J02 completas sem redigitar identidades já vinculadas, inclusive solicitação parcialmente atendida, fornecedor sem resposta e decisão com itens remanescentes. Voltar conserva obra, registro, filtros e comparação. Aprovação continua explícita e usa a política existente.

**WF04.** Consolidar no registro do pedido saldo a entregar, recebimentos, previsão, documentos e exceções. Cobrança de atraso, ajuste, recebimento parcial e consulta da nota devem abrir o destino específico. Exibir situação atual, motivo da pendência e ação permitida, sem depender só de cor ou de um menu para explicar o problema.

**Aceite:** J03 e a passagem para J04 preservam pedido e obra. Repetir consulta não repete recebimento; item já recebido não volta como pendência adicional. Cancelamentos e mudanças confirmadas conservam histórico e saldos coerentes com os motores existentes.

### Onda 3 Completar a rotina financeira

**WF05.** Tornar contínua a consulta de documento → obrigação → pagamento → conciliação, reutilizando leitor, memorial e revisão bancária. Cada origem deve mostrar vínculos comprovados e a próxima ação autorizada. Distinguir recebimento físico, aprovação, vencimento, pagamento e conciliação. Em dados incompletos, mostrar exatamente o que precisa ser conferido.

**Aceite:** J04, J05 e J06 completas com nota parcial, pagamento parcial, vencimento ausente, conta não informada e saldo bancário desconhecido. Nenhum valor desconhecido vira zero; consulta não cria obrigação nem pagamento; confirmação e prevenção de duplicidade permanecem nos comandos existentes.

**WF06.** Ordenar o fechamento por providência: origem do problema, evidência, ação autorizada e retorno à conferência. Tornar visíveis o resultado do salvamento, conflito de versão, falha de upload e restrição de período. Preservar preenchimento quando a operação é rejeitada; reenvio exige revalidação e o contrato de idempotência apropriado ao comando.

**Aceite:** J07 e J08 completas; motor define os bloqueios financeiros. Corrigir na origem retorna à mesma competência e permite verificar o estado atualizado. Falha não aparece como sucesso e não dispara ciclo de tentativas automáticas sem controle.

### Onda 4 Coordenar o trabalho entre módulos

**WF07.** Evoluir a consulta temporal já existente com cobertura comprovada entre necessidade revisada, solicitação, pedido e obrigação. Separar o que é referência da etapa, material ainda não atendido, compromisso existente e vencimento financeiro. Reagendamento mostra conflitos de prazo e registros que precisam de revisão, preservando as datas originais até confirmação na origem.

**Aceite:** vínculo por identidade e obra, com unidade e quantidade verificáveis. Compras já comprometidas não reaparecem como necessidade adicional. Estoque compartilhado, cobertura parcial ou conversão sem evidência ficam pendentes de conferência. Quando faltar dado, a qualidade do fluxo depende de explicar e encaminhar a lacuna, sem inventar cobertura ou saída de caixa.

**WF08.** Melhorar consultas salvas, filtros e revisão em sequência existentes com volume representativo. Manter recorte, seleção coerente, elegibilidade e situação por registro após atualização da base. Erros de um registro devem permitir seguir a revisão dos demais sem parecer que todos foram concluídos.

**Aceite:** consultas isoladas por usuário/empresa; referência obsoleta explicada; item bloqueado excluído de uma operação executável. Paginação ou virtualização entram apenas se a medição demonstrar necessidade. Novas gravações em massa só entram após validar campos permitidos, autorização, prévia, confirmação, retorno por item e idempotência; não são requisito para aumentar a nota se a revisão individual resolver a tarefa com clareza.

### Onda 5 Validar a operação completa

**WF09.** Exercitar as jornadas autorizadas em 1440, 1024, 768, 390 e 320 px, incluindo zoom de 200%, nomes longos, ausência de documento, perda de conexão durante consulta, rejeição de comando, sessão expirada e retorno após interrupção. Proteger preenchimento pendente; não armazenar documentos, credenciais ou rascunhos sensíveis como preferências para simular retomada.

**Aceite:** nenhuma ação essencial coberta por painel, teclado ou atalho flutuante; foco e retorno previsíveis; controles alcançáveis por toque e teclado; nenhuma necessidade de comprimir a tabela inteira no celular. Comportamento de falha e recuperação confirmado também pela resposta simulada da API, não só pela aparência.

**WF10.** Realizar piloto acompanhado em prévia local com operadores de Engenharia, Compras e Financeiro, usando dados equivalentes e permissões atuais. Buscar ao menos dois participantes por área e vinte execuções de tarefas no total, cobrindo desktop e celular. A amostra serve para orientar correções, sem pretensão estatística sobre todos os usuários.

**Aceite:** recalcular a nota com a mesma matriz da WF01 e registrar por dimensão o resultado observado, os pontos de confusão e os limites. Sem participação de operadores, a entrega pode receber nota heurística provisória, mas a meta de experiência validada com usuários permanece pendente.

## Metas de melhoria da rotina

Comparar antes e depois com dados, perfil, dispositivo e definição de tarefa equivalentes. Os números abaixo são metas; não são resultados já obtidos.

| Indicador | Meta para concluir o ciclo |
|---|---|
| Conclusão das tarefas no piloto | Pelo menos 95%, com as jornadas críticas cobertas |
| Perda de contexto nas transições verificadas | Zero |
| Redigitação de identidades já vinculadas | Zero nos campos e jornadas definidos na WF01 |
| Mudanças manuais desnecessárias de módulo | Redução de pelo menos 30% onde existirem; manter zero nos percursos já contínuos |
| Tempo mediano nas três tarefas mais frequentes | Redução de pelo menos 20% onde a referência revelar atrito; se não houver ganho seguro, registrar a justificativa e avaliar a tarefa pelo resultado e clareza |
| Duplicação de operações, perda de trabalho ou acesso indevido | Zero nos cenários exercitados |
| Clareza da próxima ação | Pelo menos 90% das tentativas identificam a providência correta sem orientação externa |

Não reduzir tempo removendo conferência, confirmação ou permissão necessária. Um resultado mais rápido com erro financeiro reprova a jornada.

## Acompanhamento e critérios de conclusão

| Entrega | Situação em 31/10/2026 |
|---|---|
| WF01 | Parcial — referências e recuperação da WF06 verificadas; falta medição acompanhada com operadores |
| WF02 | Concluída — contrato compartilhado, adaptadores, hierarquia e catálogo local validados |
| WF03 | Concluída — vínculos e retorno com recorte preservado; decisão parcial e pedidos confirmados explícitos |
| WF04 | Concluída — saldo físico, consulta e ação no pedido; cancelamento e recebimento parcial verificados |
| WF05 | Concluída no recorte fiscal — documento, obrigação e revisão bancária com vínculos e retorno preservados |
| WF06 | Concluída — quatro origens não fiscais, conflito real, renovação de sessão e perda de resposta/conexão com recuperação e idempotência verificadas |
| WF07 | Concluída — cobertura por item, identidade, obra, unidade e quantidade; lacunas, prazo simulado e retorno à origem verificados |
| WF08 | Concluída — seleção estável, revalidação e resultado individual; consultas isoladas e obsoletas, paginação e ensaio com 1.000 documentos |
| WF09 | Concluída tecnicamente em prévia local — cinco larguras e reflow equivalente a 200%, área reduzida, foco, saída protegida, falhas e recuperação com Financeiro restrito; confirmação nativa no piloto |
| WF10 | Parcial/preparada — roteiro, 24 execuções planejadas, seis contas sintéticas e consolidador; aplicação posterior escolhida pelo usuário, sem observações humanas ainda |

A cada entrega, registrar o que mudou na tarefa, cenários aprovados, capturas desktop/celular, métricas comparáveis, nota e motivos, pendências e posição neste ciclo. Não atribuir ganho numérico de nota automaticamente a uma onda.

Uma entrega termina após verificar comportamento, leitura e operação das telas alteradas, com testes apropriados. Build local usa Vite diretamente, evitando o prebuild que executa migrações. O plano não autoriza mensagens externas, migrações, publicação ou alteração de políticas financeiras.

## Referências e skills

Base de reuso: [roadmap anterior](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md), [revisão geral](REVISAO-GERAL-UI-2026-10-31.md), [contexto entre módulos e planejamento](CONTEXTO-PLANEJAMENTO-COMPRAS.md), [consolidação financeira](CONSOLIDACAO-FINANCEIRO.md) e [limites da onda 4](ROADMAP-UX-ONDA-4-2026-10-31.md).

Impeccable e shadcn continuam a base de cada alteração. A pesquisa anterior identificou [Interface Design](https://github.com/Dammyjay93/interface-design) para hierarquia de interfaces operacionais e [Frontend UI Engineering](https://github.com/addyosmani/agent-skills/tree/main/skills/frontend-ui-engineering) para implementação consistente. [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) complementa semântica, foco e interação. Skills técnicas de React apoiam estrutura e desempenho. A pesquisa dessas fontes não equivale à instalação de novas skills nem substitui os critérios de aceite do produto.
