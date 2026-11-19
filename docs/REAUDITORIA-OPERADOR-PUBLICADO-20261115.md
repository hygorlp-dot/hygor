# Reauditoria da jornada do operador — produção — 15/11/2026

**Veredito: a experiência observada ainda não atingiu 9,5. Nota geral de usabilidade: 7,1/10.**

Avaliação heurística rigorosa, baseada na navegação real autenticada de um administrador na versão publicada. Não é pesquisa com usuários, certificação contábil ou homologação transacional. A cobertura das entradas dos setores foi ampla; a execução de todas as operações, permissões e integrações de ponta a ponta não foi concluída nem pode ser inferida desta consulta.

## Ambiente e proteção dos dados

- Endereço: https://erp.marcelleng.com.br/.
- Versão usada nas notas: `c6fccb0de467533efee5d40042dfe5583265a7be`, deploy `dpl_CTfMWabiAPG7VaRLhibp6j9euPMv`, reconfirmado ao final da navegação.
- Microsoft Edge controlado por Playwright, viewport 390 × 844, toque emulado, português do Brasil, horário de Brasília. Não foi teste em um aparelho físico.
- A conta foi autenticada pelo próprio usuário. Não foram usadas credenciais de outros operadores nem alteradas permissões.
- Interceptação preventiva das APIs: consultas conhecidas permitidas; ações desconhecidas ou de gravação bloqueadas antes de chegar ao servidor. Autenticação e presença técnica da sessão foram permitidas.
- Não foram confirmados cadastros, medições, pagamentos, aprovações, recebimentos, exclusões ou mensagens. Não houve publicação ou alteração do código do app nesta auditoria.
- `daily-brief`, `sync-workspaces` e a telemetria `client-error` foram bloqueados preventivamente. Consultas `references/list` também foram bloqueadas; a consulta de dispositivos foi identificada posteriormente como leitura. Mensagens e indisponibilidades provocadas por esses bloqueios não foram classificadas como defeitos do ERP.
- O controle do navegador foi interrompido por timeout da ferramenta durante a última consulta de arquivos. Não há evidência de falha do app nessa interrupção. Não foi concluída a rodada desktop, a abertura dos documentos externos, nem a revisão de todos os controles internos.

## Critério das notas

Cada setor recebeu notas para clareza (25%), uso no celular (25%), próxima ação (20%), consistência/contexto (20%) e orientação/recuperação (10%). A nota geral é a média simples dos oito setores, calculada antes do arredondamento. São julgamentos profissionais sobre a experiência observada; não representam uma taxa medida de sucesso.

| Setor | Clareza | Celular | Próxima ação | Consistência | Orientação | Nota ponderada |
|---|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 7,0 | 7,0 | 7,5 | 6,0 | 7,5 | **7,0** |
| Comercial e contratos | 6,5 | 6,0 | 6,5 | 5,5 | 7,0 | **6,2** |
| Obras e projetos | 7,5 | 7,0 | 7,5 | 6,5 | 8,0 | **7,2** |
| Compras e estoque | 8,0 | 7,0 | 8,0 | 7,0 | 8,0 | **7,6** |
| Financeiro | 7,5 | 6,5 | 6,5 | 6,0 | 7,5 | **6,8** |
| Equipamentos e locações | 7,5 | 7,0 | 7,5 | 7,0 | 7,5 | **7,3** |
| Pessoas e terceiros | 8,0 | 7,0 | 8,0 | 7,0 | 8,0 | **7,6** |
| Administração | 7,5 | 6,5 | 7,0 | 6,5 | 7,5 | **7,0** |

Para chegar a 9,5, as tarefas críticas precisam ter contexto inequívoco, controles legíveis, próximos passos claros e tratamento compreensível dos impedimentos. Também será necessário comprovar as transações e os perfis de acesso em ambiente autorizado para testes. Abrir as telas sem erro é insuficiente.

A nota anterior de 6,3 usou um recorte menor. Não é correto interpretar a diferença para 7,1 como uma melhora quantitativa medida com a mesma amostra.

## Cobertura real

Foram abertas 49 entradas de navegação nos oito setores, além de detalhes e subáreas. Isso não equivale a testar cada botão ou cada regra.

| Setor | Entradas abertas na versão atual | Aprofundamento e limites |
|---|---|---|
| Gestão | Dashboard, DRE empresa, DRE obras, Relatórios, Modo TV, Comunicação, Minhas aprovações | Comparação de rótulos financeiros, competências e pendências. Sem geração de avaliação por IA ou exportação. |
| Comercial | Comando comercial, Venda de imóveis, Pipeline, Leads, Propostas, Relatórios comerciais | Ficha de lead/Contratos, central de contratos e formulário novo aberto e fechado sem salvar. Imóveis e propostas sem registros suficientes para acompanhar uma venda real. |
| Obras e projetos | Obras, Projetos, Arquivos, Orçamentos, Planejamento, Marcos/Curva A, Diário, Avanço físico, Conferência, Licenciamento | Obra K1-10 como referência; comparação dos vínculos e estados de orçamento/planejamento/medição. Sem aprovação de linha de base, boletim, vistoria ou licença. |
| Compras | Compras, Curva e preços, Estoque, Fornecedores | Fila de todas as obras, SC-0004, cinco pedidos e ficha do PC-0002, com origem, recebimento, documentos, pagamento e estoque. Sem movimentações. |
| Financeiro | Gestão financeira, Medições a faturar, Caixa da obra, Conciliação | Doze subáreas adicionais: Documentos, Pagamentos, Visão financeira, Custos por etapa, Previsões, Notas fiscais, Fechamento, Homologação, Administrativo, Caixa por conta, Relatórios e Modo IA. Alguns registros de tela capturaram carregamento; não foram tratados como sucesso funcional. |
| Pessoas | Equipes, Equipe nas Obras, Ponto por obra, Gestão do ponto, Ponto eletrônico, Folha, Rescisão, Terceirizados, Indicadores | Consulta de contrato real CA1-06, medição anterior e formulário de nova medição. Barra deslizante inspecionada, sem alterar percentual ou criar rascunho. Sem batida, fechamento de folha ou cálculo persistido de rescisão. |
| Equipamentos | Locação de equipamentos, Equipamentos | Disponibilidade, período, frota e ações de entrada. Sem reserva, locação, baixa, faturamento ou cadastro. |
| Administração | Central do administrador, Patrimônio, Cadastros, Ajustes, IA, Configurar Gemini, Telas antigas | Leitura de filtros, estados, controles de acesso disponíveis e orientações. Sem troca de tema, chave, usuário, permissão ou reativação. |

Também foi aberto e cancelado o diálogo de recebimento de uma cobrança: obra, valor e data estavam explícitos. O cancelamento não confirmou o recebimento.

## Achados prioritários

### U01 — P1 — “Novo lead” quase invisível em Leads

**Reprodução:** Comercial → Leads → observar o botão principal antes da busca.

O botão está habilitado, mas usa texto e borda brancos sobre fundo quase branco. A inspeção computada registrou texto `rgb(255,255,255)`, fundo transparente, borda branca e `disabled: false`. A captura confirma que parece indisponível. O mesmo propósito no Comando comercial aparece com botão azul legível.

**Impacto:** o operador pode concluir que não tem permissão ou que o cadastro está bloqueado.

**Aceite proposto:** aplicar a variante compartilhada correta; conferir contraste, foco e estado habilitado nos temas existentes, no celular e desktop. Não criar uma cor local específica para Leads.

**Evidência:** captura 19; painel comercial.

### U02 — P1 — Fechamento informa códigos, mas não ensina a resolver o bloqueio

**Reprodução:** Financeiro → Áreas do financeiro → Fechamento → novembro/2026.

A tela informa três impedimentos: `RECEIVABLE_OVERPAID` com diferenças de R$ 5.750,00 e R$ 12.000,00, e `RECEIVABLE_NON_NEGATIVE` com R$ 17.750,00. “Fechar competência” permanece desabilitado, coerentemente com os bloqueios. Entretanto, esses alertas não identificam de forma suficiente o registro, a causa em português e o responsável pela correção.

**Impacto:** o usuário sabe que não pode fechar, mas precisa de suporte técnico para entender a próxima ação. Não se comprovou nesta auditoria se a origem é dado legado, migração ou defeito do motor.

**Aceite proposto:** explicar cada impedimento em português, apresentar origem, obra, valor esperado/encontrado e atalho de consulta/correção com permissão. Preservar o bloqueio financeiro enquanto a inconsistência não for resolvida.

**Evidência:** captura 80, com botão de fechamento desabilitado no snapshot completo.

### U03 — P2 — Painel gerencial mistura rótulos de caixa e competência

**Reprodução:** Gestão → Dashboard → novembro/2026; comparar com DRE empresa e Visão financeira.

O Dashboard mostra “Receitas do período” de R$ 0,00, “Faturado R$ 38.520,00”, despesas de R$ 39.188,91 e “102% da receita”. O percentual é compatível com o faturamento, mas não com a receita de zero destacada no cartão vizinho. “Saldo atual R$ 0,00 / Recebimentos menos custos” não explica a base usada. O DRE apresenta faturamento R$ 38.520,00 e EBITDA negativo de R$ 668,91, aritmeticamente compatíveis com aqueles custos.

**Impacto:** leituras distintas podem parecer erro ou induzir uma decisão sobre caixa usando resultado por competência.

**Aceite proposto:** nomear explicitamente recebido, faturado/reconhecido, pago e resultado; manter competência e fonte acessíveis. Não alterar cálculos financeiros apenas para fazer cartões visualmente coincidirem.

**Evidências:** 15/62, 63 e 76.

### U04 — P2 — Escopo global e obra selecionada nem sempre ficam inequívocos

**Reprodução:** selecionar K1-10 em “Obra em foco”; abrir Caixa da obra, Medições a faturar e Conferência técnica.

- Caixa da obra abriu P1-08 no seletor interno, embora o cabeçalho ainda mostrasse K1-10. O título do extrato identifica P1-08, mas exige que o usuário perceba a mudança antes de registrar uma operação.
- A fila “Cobranças próximas e vencidas” inclui outras obras mesmo com K1-10 selecionada; o diálogo de recebimento identifica corretamente a obra da cobrança.
- O ranking de qualidade apresenta outras obras e totais globais, enquanto o filtro da conferência está em K1-10.
- Projetos e cadastros corporativos também podem ter escopo próprio. Onde “Todas as obras” está explícito, isso é um comportamento de carteira, não prova de erro.

**Aceite proposto:** propagar a obra quando a tela opera por obra ou identificar claramente “carteira inteira”; sincronizar ou explicar seletores independentes. Antes de qualquer confirmação, repetir obra e registro.

**Evidências:** 13/14, 27, 34 e 42.

### U05 — P2 — Aba Contratos do lead permanece sem conteúdo ou orientação

**Reprodução:** Comercial → Leads → abrir um lead existente → Contratos.

O corpo da aba fica vazio; continuam visíveis apenas as navegações do formulário e os comandos gerais. A central de contratos atual existe, mas a aba não oferece orientação nem atalho para ela.

**Aceite proposto:** estado vazio específico e caminho para a central com vínculo explícito, sem assumir associação por nome ou semelhança. Rever também a orientação do seletor superior: dentro da central de contratos, o cabeçalho ainda mostrava “Comercial da empresa”.

**Evidências:** 23 e 24.

### U06 — P2 — Uso no celular exige rolagem excessiva

Na largura de 390 px, as alturas registradas incluem: Obras ~9.678 px, Fornecedores ~10.218 px, Equipes ~11.632 px, Ponto por obra ~11.926 px, DRE por obra ~12.620 px e Avanço físico ~5.728 px. Altura sozinha não prova dificuldade; aqui o problema é a repetição de cartões, filtros extensos e ações importantes depois de muitos registros.

O Pipeline empilha colunas, inclusive vazias, e orienta “Arraste os cards”/“Solte aqui”. Não foi executada mudança de etapa, pois ela grava dados. Não há evidência suficiente de que o arraste funcione bem por toque.

**Aceite proposto:** priorizar pendências e busca, paginação/agrupamento quando necessário, filtros recolhíveis e ações acessíveis sem percorrer a carteira inteira. Oferecer alternativa explícita ao arraste. Preservar os componentes e tokens comuns.

**Evidências:** 18, 26, 33, 39, 44, 46, 49 e 64.

### U07 — P2 — Unidade de compra e comparação de preço precisam de conferência

Na lista de pedidos, PC-0002 mostra 5.000 UN; na ficha de recebimento, as mesmas quantidades aparecem com “Unidade não informada”. PC-0004 compara R$ 41,00 com referência R$ 0,88/UN e anuncia 4.559,09% acima. PC-0005 usa referência em KG. A interface não demonstra a conversão que permitiria comparar essas bases com segurança.

**Impacto:** um alerta de preço pode parecer conclusivo mesmo quando a unidade de origem é incompleta. Não foi inferida conversão por semelhança de material.

**Aceite proposto:** manter a unidade original e a unidade normalizada, mostrar fator e fonte de conversão; quando não houver vínculo confiável, pedir conferência e não apresentar a comparação como conclusiva.

**Evidência:** navegação de Pedidos e ficha 73; snapshot completo do PC-0002.

### U08 — P2 — Comunicação mostra a pendência, mas nem sempre entrega a tarefa

Comunicação informa responsáveis e quantidades de conferências em aberto, porém a listagem observada não oferece uma ação direta por pendência com registro, prazo e retorno de resolução. O chat é anunciado como balão no canto, enquanto o acesso visível no celular está no cabeçalho. Mensagens não foram enviadas.

Compras já fornece um exemplo melhor: SC-0004 identifica responsável, prazo e “Analisar solicitação”; a ficha do pedido distingue responsáveis por recebimento, fiscal, pagamento e estoque.

**Aceite proposto:** transformar avisos em tarefas vinculadas à origem, com responsável, prazo, próxima ação e histórico de conclusão. Separar conversa de aprovação formal.

**Evidências:** 67, 72 e 73.

### U09 — P2 — Texto técnico e precisão excessiva prejudicam a compreensão

Indicadores de RH expõe o caminho `src/domains/financeiro/labor-cost-engine.js` e a frase “fica para uma próxima rodada”. É uma limitação real, mas a orientação ao operador deve apontar onde consultar custos hoje.

No formulário de medição, percentuais anteriores de 34,4826% e 17,2414% aparecem em campos e texto. A explicação do acumulado é boa; a precisão visual e o uso simultâneo de ponto/vírgula tornam a leitura mais difícil. Não se propõe reduzir a precisão financeira persistida.

**Aceite proposto:** linguagem operacional e apresentação numérica consistente, preservando a precisão de cálculo.

**Evidências:** 52 e 71.

### U10 — P2 — Troca de publicação causou uma falha de arquivo antigo

Durante a auditoria, o alias de produção mudou do deploy de usabilidade `dpl_Fa9KeT3gKrCEbd9XmzwtsmqsWM8w` para o deploy atual. A sessão ainda carregada tentou obter `/assets/DgWKFzAR.js` e recebeu HTTP 404. O app recarregou e retomou a tela de faturamento.

**Conclusão limitada:** houve recuperação neste percurso de consulta. Não foram preenchidos formulários para comprovar preservação de trabalho durante a atualização. Isso não demonstra que a versão atual falhe sempre, nem que o erro anterior de inicialização circular reapareceu.

**Aceite proposto:** testar uma sessão da versão anterior atravessando uma publicação, incluindo rascunho e navegação lazy, com recuperação sem loop e aviso claro quando necessário.

**Evidência:** evento de versão e erro de asset em `evidence.json`; captura 13 após recuperação.

## Divergências que exigem investigação, sem diagnóstico precipitado

| Observação | O que foi confirmado | O que falta verificar |
|---|---|---|
| Dashboard: 8 obras em situação crítica; quadro abaixo: 4 críticas, 6 em atenção e 4 em dia | Os números e rótulos diferem na mesma visita | Critérios de classificação e filtros; não assumir que uma contagem está errada. |
| Compras: SC-0005 aguardando aprovação, com o usuário entre os nomes; Minhas aprovações vazio | Diferença entre as filas observadas | Se a aprovação antiga possui instância compatível com a central e se o usuário é elegível na etapa atual. |
| Comercial: etapas com reuniões/assinatura; atalhos do painel com zero | Estados visíveis usam palavras semelhantes com contagens diferentes | Data de competência, definição de atividade e filtro dos atalhos. |
| Dashboard: 793 movimentos sem conciliação; Conciliação: 766 pendentes | As telas apresentam números diferentes | Universo, estados ignorados, período e origem. Não comparar totais sem alinhar as bases. |
| Homologação: 1.507 divergências e “Todos os totais homologados coincidem” | Ambos os textos apareceram no resultado final da consulta | Diferenças por fato versus totais agregados, critérios e materialidade. O resultado final foi lido após as capturas 81/86/87, que ainda mostram carregamento. |
| Alertas de ponto/RDO no domingo, 15/11 | A data e as pendências aparecem | Escalas, dias úteis e calendário das obras. “Sem registro” não comprova falta. |
| Terceirizado: R$ 2.300,00 “devido por medições”, medição aguardando aprovação | Os dois estados aparecem no contrato consultado | Se o rótulo deveria dizer “medido, aguardando aprovação”; não foi comprovado lançamento indevido no DRE. |

## Integrações, automação e impacto no DRE

| Caminho | Evidência observada | Impacto e limite |
|---|---|---|
| Orçamento → Planejamento → Curva A → Compras | K1-10 possui duas versões em rascunho; Planejamento informa fonte provisória; Curva A exige aprovação da proposta antes de gerar planos | Previsão não é compromisso nem custo realizado. A automação de geração não foi executada. Não transformar rascunho em baseline implicitamente. |
| Recebimento → Estoque → Fiscal → Pagamento | PC-0002 recebido e pago; sem NF e sem entrada de estoque vinculada localizada pela ficha | A ficha alerta para conferir a origem antes de lançar outra entrada ou pagamento. Há lacuna de vínculo a resolver, sem prova de duplicidade contábil nesta consulta. |
| Medição terceirizada → Aprovação → Obrigação → Pagamento | Contrato real com R$ 6.600,00, medido R$ 2.300,00, saldo de etapas R$ 4.300,00; nova medição mostra anteriores e delta, galeria/câmera e envio para aprovação | A orientação declara reconhecimento da despesa após aprovação e pagamento como baixa. A regra foi lida, mas os lançamentos resultantes não foram executados nem reconciliados. |
| Medição física → Boletim → Curva S | Tela distingue avanço manual/diário e avanço oficial de boletim aprovado | Não inferir receita ou pagamento do percentual físico. Nenhum boletim confirmado. |
| Cobrança ao cliente → Recebimento | Medições a faturar distingue cobrança, físico e terceiros; diálogo mostra obra, valor e data | Recebimento é caixa; não deve duplicar faturamento por competência. Diálogo cancelado. |
| Ponto → Folha → DRE | Folha expõe ciclo 06–20; DRE explica que mês civil inclui partes de três ciclos | A comparação exige o mesmo período. Não foi fechado ponto, folha ou competência. |
| Equipamentos → Locações → DRE empresa | R$ 180,00 de locações em novembro aparece no módulo e na composição do faturamento empresarial | Coerência de apresentação observada. Não prova liquidação, faturamento transacional ou ausência de duplicação por fato. |
| Arquivos → OneDrive → Módulos | K1-10 mostra 25 vínculos e zero documentos cadastrados diretamente; vínculos dos módulos são identificados como consulta | Preserva uma referência visível aos legados. Download, upload, revisões, lixeira e permissões efetivas do OneDrive não foram retestados nesta rodada. Sem efeito realizado no DRE por simples consulta de arquivo. |
| Conciliação automática | Estado “automáticas ativas”, filas por divergência, 766 pendentes, 2 conciliados | Recursos e resultados históricos visíveis; não foi importado extrato nem executada conciliação. “Automação ativa” não equivale a eficácia comprovada. |
| Comercial → Contrato → Obra/Financeiro | Central nova vincula cliente, obra e proposta; aba Contratos do lead sem orientação; emissão PDF/DOCX explicitamente indisponível | Não há demonstração completa de conversão e reaproveitamento, nem deve nascer receita/custo somente da oportunidade. Sem proposta/contrato salvo nesta auditoria. |

**Automação e comunicação:** existem recursos úteis, mas não há base para atribuir 9,5 à integração ponta a ponta. Os melhores sinais são a ficha conectada da compra e a medição acumulada; as maiores lacunas são a resolução dos impedimentos, a passagem entre comercial/contratos e os vínculos legados. Uma nota numérica de eficácia de automação seria especulativa sem executar operações e conferir seus efeitos.

## Pontos positivos confirmados

- Navegação inferior por grupos e seleção de telas permitem alcançar os oito setores no celular.
- Nos snapshots medidos da versão atual, não houve largura da página maior que 390 px. Isso não garante ausência de recortes internos: tabelas, seletores e valores truncados ainda exigem revisão visual.
- O formulário de medição usa modal adaptado ao celular, campo numérico e slider identificados, instrução de percentual acumulado e comandos fixos de confirmação/cancelamento.
- A escolha do terceirizado identifica prestador, especialidade e obra; o atalho do contrato levou à sua medição correspondente.
- Galeria e câmera aparecem como controles separados na medição.
- Compra distingue recebido, faturado, pago, conciliado e pendências; o histórico mostra ajustes de origem do pagamento sem preenchê-los com dados atuais.
- Financeiro/Hoje explica que saldo em aberto não é saldo de caixa; Visão financeira distingue competência de movimento financeiro.
- Arquivos identifica documentos vinculados como “Somente consulta · exclua no módulo de origem”.
- Alertas de orçamento provisório e ausência de baseline evitam apresentar a base em rascunho como aprovada.

## Evidências e exclusões

Diretório: `artifacts/reauditoria-operador-publicado-20261115/`.

- `evidence.json`: inventário, métricas, navegações, bloqueios preventivos e evento de publicação.
- 87 capturas brutas com snapshots textuais correspondentes; contagem de capturas não é contagem de testes aprovados.
- 01–12 pertencem à versão anterior e não sustentam as notas atuais. A observação anterior sobre formulário antigo de contrato não foi transportada para o novo módulo.
- 02 e 17 foram descartadas por captura antes da renderização; 45/69 representam carregamento de equipe, substituído por 70. A imagem 53 capturou carregamento, embora o DOM posterior exibisse conteúdo: não é evidência visual de tela vazia. As imagens de homologação 81/86/87 não mostram o resultado final. Ponto eletrônico e Modo IA não tiveram validação funcional concluída.
- Avisos de “Consulta protegida da auditoria” nas imagens foram produzidos pela proteção do teste e não são falhas do produto.
- Os painéis de contato apenas agrupam screenshots originais, sem redesenhar a interface. As capturas individuais são a referência.
- Nenhum documento com dados pessoais foi aberto ou reproduzido neste relatório. Artefatos locais de auditoria não devem ser publicados como conteúdo público.

![Comercial: painel, pipeline, botão Novo lead, imóveis e contratos](C:/dev/repositorio-mrc/artifacts/reauditoria-operador-publicado-20261115/painel-comercial-final.png)

![Medição: percentual acumulado, campos e barras deslizantes](C:/dev/repositorio-mrc/artifacts/reauditoria-operador-publicado-20261115/71-terceirizado-nova-medicao-mobile.png)

![Financeiro: documentos, pagamentos, resultado, previsão, fiscal e fechamento](C:/dev/repositorio-mrc/artifacts/reauditoria-operador-publicado-20261115/painel-financeiro-detalhe.png)

## Próxima rodada necessária para comprovar 9,5

1. Corrigir contraste, orientações dos bloqueios, escopo da obra e aba vazia; repetir os mesmos passos com evidência comparável.
2. Conferir as divergências de unidade, filas e migração na origem, sem ligar registros por nome e sem corrigir valores apenas para coincidir totais.
3. Em base de teste autorizada, executar comercial → contrato → obra, compra → entrega → fiscal → pagamento → conciliação, ponto → folha → DRE e terceirizado → aprovação → pagamento; conferir saldo, histórico e unicidade do custo.
4. Testar perfis restritos, negações de acesso no servidor, downloads legados e OneDrive com arquivos de teste, sem usar documentos reais para exclusão.
5. Concluir desktop, aparelho físico, teclado/foco, ampliação de texto, conexão lenta/offline e mudança de deploy com rascunho. A emulação mobile desta rodada não substitui esses testes.

Revisão de ajuda/manual: não houve alteração de fluxo ou interface, portanto não se alterou a fonte da ajuda nem se regenerou o manual. A revisão futura deve corrigir instruções que mencionam chat flutuante e explicar bloqueios e bases financeiras. Nenhum build, teste local de implementação ou deploy foi necessário para produzir este diagnóstico.
