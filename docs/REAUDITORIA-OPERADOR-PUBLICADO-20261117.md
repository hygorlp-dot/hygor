# Reavaliação publicada após as etapas 4, 5 e 6 — 17/11/2026

**Nota geral: 8,1/10. A versão observada não atingiu 9,5.**

Revisão heurística da experiência real, autenticada, em todos os oito setores. Foram percorridas as 49 entradas principais no celular e no desktop, com aprofundamento de consultas e vínculos entre áreas. A jornada termina antes de confirmar qualquer gravação. Não equivale à homologação de todas as transações, integrações ou permissões do ERP.

## Versão e método

- Produção: https://erp.marcelleng.com.br/.
- Deployment `dpl_4WhqJmC6HjAaTMedMvGT9NbLHroJ`, commit `c3f15b657749b3de070f3cae6104a77202a5a61b`, READY. Conferido durante a auditoria e reconfirmado após as duas rodadas principais.
- Navegador controlado por Playwright, autenticado pelo usuário como administrador. Conteúdo e APIs reais, sem substituir a base por fixtures.
- Celular: 390 × 844; desktop: 1440 × 1000. Conferência adicional de medição em 320 × 740 e ampliação de texto por CSS a 200%. Não é teste em aparelho físico nem zoom nativo do navegador.
- Impeccable, shadcn e auditoria de produto orientaram a análise de hierarquia, consistência, interação, acessibilidade e recuperação. Esta avaliação de jornada não executou o comando de crítica independente com dois avaliadores.
- 176 estados capturados, sendo 126 em larguras móveis e 50 em desktop. A contagem inclui repetições, estados intermediários e falhas provocadas; não representa 176 tarefas aprovadas. O índice identifica as capturas que não servem como prova de conclusão.
- Não houve publicação, build ou alteração do código do app nesta auditoria.

## Preservação e limites

As APIs foram interceptadas preventivamente: somente consultas conhecidas e presença técnica da sessão foram permitidas. Comandos de gravação, operações desconhecidas, sincronização de pastas e geração automática do resumo por IA foram bloqueados antes do servidor. Nenhuma aprovação, pagamento, recebimento, exclusão, cadastro, mensagem ou publicação do portal foi confirmada.

O registro instrumentado contém 366 requisições de API e 14 bloqueios. Houve também um bloqueio anterior à reinicialização do registro de instrumentação. As consultas de ponto e de acessos de clientes, inicialmente bloqueadas por cautela, foram revisadas no código, liberadas apenas para leitura e repetidas. Esses bloqueios não foram tratados como defeitos do produto. Autenticação e heartbeat são atividades técnicas, não lançamentos operacionais. Não foi realizada comparação byte a byte do banco de produção antes/depois.

Buscas, filtros, paginação e preferências de navegação mudaram somente a consulta desta sessão. Abrir Nova medição apresentou o rascunho local padrão, sem alterar percentuais, observações ou anexos e sem enviar a medição. Isso não comprova recuperação após editar ou enviar uma transação real.

Projetos, propostas, contratos comerciais, pedidos, recebimentos e notas fiscais tinham filas vazias nos recortes examinados, inclusive pedidos de todas as obras. Não foram criados dados para preencher essas lacunas. Os lançamentos antigos removidos pelo usuário não foram recriados.

## Notas por setor

Mesma régua da auditoria publicada anterior: clareza 25%, uso no celular 25%, próxima ação 20%, consistência/contexto 20%, orientação/recuperação 10%. Média simples dos oito resultados antes do arredondamento: **8,059375**, apresentada como **8,1**. São julgamentos profissionais sobre o recorte observado, não SUS, taxa de sucesso ou pesquisa com operadores.

| Setor | Clareza | Celular | Próxima ação | Contexto | Orientação | Nota |
|---|---:|---:|---:|---:|---:|---:|
| Gestão e relatórios | 8,5 | 8,0 | 8,5 | 8,0 | 8,5 | **8,3** |
| Comercial e contratos | 8,0 | 8,0 | 8,0 | 8,0 | 8,5 | **8,1** |
| Obras e projetos | 8,5 | 8,0 | 8,0 | 8,5 | 8,5 | **8,3** |
| Compras e estoque | 8,5 | 8,0 | 8,5 | 8,5 | 8,5 | **8,4** |
| Financeiro | 7,5 | 7,5 | 8,0 | 7,0 | 8,5 | **7,6** |
| Equipamentos e locações | 8,5 | 8,0 | 8,0 | 8,0 | 8,5 | **8,2** |
| Pessoas e terceiros | 8,5 | 7,5 | 8,5 | 7,5 | 8,5 | **8,1** |
| Administração | 8,0 | 7,5 | 7,5 | 7,5 | 8,0 | **7,7** |

A nota de 7,1 de 15/11 é histórica, de outra versão e de dados que mudaram. A nota local de 8,4 da etapa 6 usou cenários controlados. A nota atual usa produção real; as diferenças não medem isoladamente o efeito das mudanças de código e não demonstram uma regressão quantitativa.

## Jornada, em ordem de operação

| Passo | Consulta realizada | Saúde e limite observado |
|---|---|---|
| 1. Gestão | Dashboard → DRE empresa → DRE obras → Relatórios → Modo TV → Comunicação → Minhas aprovações | Boa distinção de caixa e competência; prioridade e escopo explícitos. Indicadores percentuais extremos e muitos recortes ainda exigem conhecimento. Não foi gerado parecer por IA. |
| 2. Comercial | Comando → imóveis → Pipeline → lead → Contratos → central → retorno; propostas e gestão comercial | Lista móvel, busca e alternativa ao arraste estão claras. Ficha do lead tem muitas abas; contratos/propostas vazios impedem acompanhar uma venda completa. Emissão de PDF/DOCX é externa ao ERP. |
| 3. Obra | Diretório → busca K1-10 → ficha → orçamento/planejamento/avanço → segurança/qualidade → arquivos/licenciamento/portal | Busca e paginação funcionam; avanço oficial é distinguido do informado. Há muita leitura antes da tarefa móvel; sem baseline, comparações ficam indisponíveis de forma explicada. Não foram criados boletins, APR ou inspeções. |
| 4. Compras | Fila → SC-0004 → análise; cotações/aprovação/pedidos/recebimento/pagamentos → estoque/preços/fornecedores | Obra, responsável, prazo e próxima ação explícitos. Analisar abre a lista inteira e mostra SC-0005 antes da origem SC-0004. Não havia pedidos para acompanhar até recebimento/nota/pagamento. |
| 5. Financeiro | Hoje, documentos, pagamentos, caixa, visão, custos por etapa, previsões, fiscal, fechamento/origem, homologação e conciliação/comparação | Origem consultável e pendências separadas do bloqueio financeiro. Duas falhas importantes de interpretação estão detalhadas abaixo. Nenhuma baixa ou fechamento executado. |
| 6. Equipamentos | Locação → disponibilidade/mapa → frota; consulta de patrimônio na Administração | Unidades, período e ações estão visíveis; filtros e resumos atrasam a lista no celular. Reserva, manutenção, faturamento e baixa não foram confirmados. |
| 7. Pessoas | Equipes → distribuição por obra → ponto → folha/rescisão → contrato terceiro → Medições → Nova medição | Nomes legíveis, busca/paginação e slider de 44 px. Grade quinzenal tem botões de 38 px de altura e o ponto eletrônico manteve obra local diferente do foco geral. Nenhum apontamento ou fechamento confirmado. |
| 8. Administração | Auditoria → usuários/permissões → clientes → aprovações → bases/núcleo/motor; cadastros/ajustes/IA/legado | Papéis e finalidades descritos, porém linguagem técnica e muita rolagem. Os controles foram consultados como administrador; não houve troca de perfil, chave, senha ou permissão. |

As 49 entradas são: 7 de Gestão, 6 de Comercial, 10 de Obras, 4 de Compras, 4 de Financeiro, 2 de Equipamentos, 9 de Pessoas e 7 de Administração. As 13 áreas internas financeiras, 14 áreas adicionais de Compras e 7 áreas administrativas foram também visitadas no celular; a rodada desktop cobriu as 49 entradas, preservando a área interna selecionada, sem repetir todos os controles internos.

## Achados prioritários

### A01 · P1 — Homologação não explica suas próprias divergências

**Reprodução:** Financeiro → Gestão financeira → Homologação, aguardar o relatório terminar.

A tela apresenta simultaneamente “Motor permanece em sombra”, “FINANCIAL_ENGINE_ENFORCE está ativo”, 678 divergências e “Todos os totais homologados coincidem”. Não oferece a lista dessas 678 divergências ao operador. O fechamento, em outra consulta, informa zero bloqueios financeiros; isso não é a mesma conferência e não deve ser confundido com homologação concluída.

**Causa de apresentação conferida no código:** o contador soma `divergencias` e `divergenciasDRE`; a lista e o texto de coincidência verificam apenas `divergencias`. O estado em sombra também é derivado da prontidão do relatório, enquanto o texto seguinte informa a ativação do motor. Evidência complementar: `src/LegacyApp.jsx`, componente de homologação, linhas 4202–4213 do checkout consultado.

**Impacto:** o administrador não consegue saber o que está efetivamente ativo, qual conferência passou nem onde resolver o restante. Não se concluiu que existam 678 cobranças erradas ou perda de dados.

**Aceite:** identificar os grupos de divergência, competência, origem e valores; separar estado de ativação do resultado da comparação; oferecer consulta dos registros sem sincronizar ou corrigir automaticamente a base.

Evidência: captura `99-homologacao-estavel-mobile`; comparação com `100-fechamento-estavel-mobile`.

![Homologação publicada com mensagens contraditórias](C:/dev/repositorio-mrc/artifacts/reauditoria-publicada-20261117/99-homologacao-estavel-mobile-viewport.png)

### A02 · P1 — Identificador do extrato aparece como Chave PIX

**Reprodução:** Conciliação → movimento pendente de R$ 980,00 → Comparar e buscar.

A evidência “Chave PIX” compara um valor `fit:…` do banco com o telefone PIX do cadastro e o classifica como divergente. `fit:` é a chave de deduplicação por FITID do extrato, conforme `chaveTransacao`; o componente de evidência usa `transaction.chave` como alternativa a `chavePix`/`pixKey`. A identificação e o matching também usam essa alternativa, o que merece revisão própria.

**Impacto:** a interface acusa uma incompatibilidade de PIX sem demonstrar uma chave PIX bancária real. Neste caso também falta um lançamento financeiro compatível; não se comprovou que o identificador seja a única causa do bloqueio. Não foi conciliado o movimento.

**Aceite:** separar identificador bancário/deduplicação de chave PIX, mostrar “Não informado” quando não houver chave e revalidar as sugestões sem criar uma obrigação apenas por semelhança de nome.

Evidência: `154-conciliacao-comparar-mobile`; apoio em `src/features/conciliacao/ReconciliationEvidence.jsx:13`, `src/domains/conciliacao/calculations.js:97` e `src/domains/conciliacao/identity.js:88`.

### A03 · P2 — Falha de rede menciona uma edição que o operador não fez

**Reprodução:** Dashboard já carregado → simular rede offline → Atualizar.

Os valores permanecem e o app não quebra, mas a mensagem é “Não foi possível atualizar. A edição protegida foi mantida.” Nesta jornada não foi feita edição operacional nem apareceu uma edição protegida pendente no cabeçalho. A primeira tela offline também manteve o indicador de salvo e o horário da consulta, sem aviso imediato de falta de rede visível no primeiro viewport.

**Aceite:** explicar a indisponibilidade da atualização, a data dos dados preservados e a próxima tentativa; mencionar edição protegida apenas quando ela existir. Não apagar journal ou rascunhos para remover o aviso.

Evidência: `172-dashboard-offline-mobile`, `174-dashboard-atualizar-offline-mobile`, `175-dashboard-online-mobile`. A conexão foi restaurada.

### A04 · P2 — Contexto da obra ainda varia entre áreas

O Ponto eletrônico consultou CA1-06 enquanto Obra em foco mostrava K1-10. Ponto por obra e Folha mostraram Todas as obras com aquele foco. Na Folha há resumo de escopo; o ponto eletrônico ainda exige perceber dois seletores separados. Isso não comprova leitura indevida: ambos os filtros estão visíveis e a conta é administradora.

Comunicação → pendência abriu corretamente W1-22 e somente o achado de origem. Voltar a Comunicação preservou a visão de tarefas, mas o foco geral continuou W1-22, em vez de voltar a K1-10.

**Aceite:** definir e explicar quando um contexto local prevalece; explicitar o comportamento do retorno e reduzir a possibilidade de trabalhar na obra errada.

Evidência: `70-pessoas-reconsulta-1-mobile`, `46-pessoas-2-mobile`, `49-pessoas-5-mobile`, `176-comunicacao-origem-mobile`, `177-comunicacao-retorno-mobile`.

### A05 · P2 — A operação móvel ainda exige muita rolagem e memória

Filtros e indicadores precedem o conteúdo em Projetos, Diário, Terceirizados, equipamentos e Administração. A ficha do lead mantém 12 abas em uma faixa horizontal; a seleção nativa do cabeçalho corta nomes extensos. Em 320 px, parte dos rótulos inferiores fica abreviada. Com texto a 200%, os controles permanecem acessíveis pela rolagem, porém a primeira tela fica quase toda ocupada pelo contexto.

**Aceite:** priorizar tarefa/pendência, reduzir filtros iniciais, preservar os ativos ao recolher e deixar a área atual identificável sem depender de nomes cortados. Não reduzir fonte ou alvo de toque para acomodar a tela.

Evidências: `15-obras-1-mobile`, `20-obras-6-mobile`, `53-equipamentos-0-mobile`, `62-admin-area-usuarios-mobile`, `76-lead-ficha-mobile`, `169-medicao-320`, `170-medicao-texto200`.

### A06 · P2 — Alguns alvos móveis continuam pequenos

Botões da grade de Gestão do ponto mediram 55 × 38 px; acionadores de detalhes de fornecedores, 30 × 44 px. Isso dificulta uso com um dedo. Inputs de checkbox de 16–18 px não foram automaticamente classificados como falha: a área do rótulo também precisa ser considerada.

Os sliders da medição mediram 340 × 44 px; o diálogo ocupou 390 × 844, com saída por Escape. Não houve teste com leitor de tela real ou câmera/teclado físico.

**Aceite:** garantir alvo de pelo menos 44 × 44 no toque, espaçamento e foco, sem fazer a tabela perder seus títulos/rolagem interna.

Evidências: métricas `smallTargets` de `47-pessoas-3-mobile` e `27-compras-3-mobile`; inspeção do diálogo em `75-terceiro-nova-medicao-mobile`.

### A07 · P2 — O atalho de análise não leva diretamente ao registro escolhido

Consultar SC-0004 abre o detalhe correto. Analisar solicitação leva à lista completa, com SC-0005 acima e canceladas abaixo. O retorno identifica a origem, mas o operador precisa localizar SC-0004 novamente.

**Aceite:** manter a origem em destaque ou foco no registro escolhido, com opção clara de ampliar a lista; preservar o retorno existente.

Evidências: `82-compras-solicitacao-mobile`, `83-compras-analisar-mobile`.

### A08 · Limite funcional — Continuidade comercial ainda depende de trabalho externo

A central de contratos explica que não gera PDF/DOCX e requer documento preparado fora do ERP. A transparência evita uma promessa falsa, mas o processo não é inteiramente automatizado. A base estava sem propostas e contratos comerciais; não foi possível comprovar uma passagem real completa de oportunidade a contrato e obra.

Evidências: `77-lead-contratos-mobile` a `80-contratos-todos-mobile`. Não tratar a ausência de contratos como bug nem criar vínculos por nomes iguais.

### A09 · P2 — Texto de privacidade do portal merece precisão

A abertura diz que folha permanece protegida, enquanto a opção “Administração e equipe” inclui “folha por funcionário, reservas e ponto da obra”. A seção explica seleção de informações, mas a promessa geral precisa refletir exatamente as opções e os perfis.

Não foi ativado nem publicado o portal. Nenhum vazamento ou acesso de cliente foi demonstrado. O achado é de clareza antes da decisão de compartilhar.

Evidências: `166-portal-consulta-mobile` e seu snapshot. Aceite: descrever o que permanece sempre privado e o que pode ser liberado mediante seleção/perfil, conforme a regra efetiva.

## Automação e comunicação entre setores

| Passagem | Comprovação desta rodada | O que continua sem comprovação |
|---|---|---|
| Comercial → contratos → obra | Vínculo por lead/proposta explicitado; recorte vazio e consulta de toda a central distinguíveis | Emissão, assinatura, conversão e criação de obra com dados reais |
| Engenharia → Compras | SC-0004 identifica origem, responsável e próxima ação; separa entrega de pagamento | Cotação, aprovação, pedido e recebimento completos; não havia pedidos |
| Aprovações → Compras | “Nenhuma decisão formal” não é confundida com “todas aprovadas”; SC-0005 aparece no diagnóstico de fluxo incompatível | Decisão por aprovador elegível e rejeição por perfis restritos |
| Qualidade → Comunicação → correção | Achado abre a conferência/obra e pendência exata; responsável e validador visíveis; retorno disponível | Enviar evidência, validar correção, notificar e concluir; mensagens não foram enviadas |
| Ponto → RH → Folha → DRE | Batidas, conferência formal e folha têm telas distintas; alertas não declaram ausência como falta automaticamente | Batida física, sincronização, fechamento, obrigação, pagamento e unicidade do custo após gravar |
| Terceiro → medição → Financeiro | Contrato/etapas/percentual/valor claros; texto distingue confirmação, aprovação, custo e pagamento | Aprovar medição real, preservar rascunho editado e repetir após resposta perdida sem duplicar |
| Equipamentos → cobrança → DRE | Receita de locações de R$ 180 aparece no DRE da empresa; período e origem identificáveis | Nova reserva/locação, manutenção e cobrança reais, rateio e reconhecimento após gravar |
| Documentos → OneDrive | Arquivo de licenciamento existente abriu no visualizador, duas páginas, `read-file` HTTP 200, histórico consultável | Upload em lote, exclusão/revisões/lixeira, restrições de pasta e fotos antigas de todas as obras |

Essas passagens não receberam uma nota global de automação inventada: distinguir acesso ao próximo passo de transação concluída é essencial. A facilidade foi refletida nas colunas de próxima ação e contexto; os limites transacionais permanecem explícitos.

## O que funcionou

- Novo lead tem ação legível; Pipeline móvel oferece lista, busca, paginação e comando Mover lead. Nenhuma oportunidade foi movida.
- Obra, caixa, DRE e ranking explicam mais claramente seus escopos e as bases de cálculo.
- Busca de obra e de serviço filtrou os registros; paginação avançou a lista sem alterar os demais serviços.
- Nova medição abriu sem exigir planejamento daquele contrato, com percentuais acumulados, slider, anterior/atual e orientação de aprovação. Nenhum percentual foi alterado.
- Documento real do OneDrive foi aberto sem upload, alteração ou exclusão. Origem e revisão permanecem identificadas.
- Ajuda contextual abriu, fechou por Escape e preservou o filtro MUROS. `npm run manual:check` passou: 144 guias, 65 abas. Nenhuma alteração de instruções operacionais foi feita nesta auditoria documental.
- Nenhum erro JavaScript não tratado foi capturado durante a instrumentação. Os 16 erros de console consultados foram 15 respostas 403 da proteção da auditoria e uma falha de rede provocada. Não são 16 crashes do app.
- Nenhum transbordamento horizontal do documento foi medido nos estados registrados; tabelas/faixas internas ainda podem rolar e nomes podem ser cortados. Isso não certifica WCAG.

## Prioridades para sustentar 9,5

1. Resolver A01 e A02: estado da homologação, detalhes das divergências e evidências bancárias com identificadores corretamente tipados. Conferir as origens e o efeito no DRE antes de qualquer correção de dados.
2. Corrigir a mensagem de atualização offline e fechar as ambiguidades de contexto/retorno.
3. Reduzir escolhas e rolagem antes das tarefas móveis, corrigir os alvos pequenos e a navegação das fichas extensas.
4. Definir a continuidade comercial e a linguagem de compartilhamento do portal conforme as funções efetivas.
5. Homologar as transações e perfis restritos em base isolada autorizada, incluindo concorrência, resposta perdida, fotos, OneDrive e reconhecimento único do custo. Depois repetir com operadores e aparelho físico.

Não é possível elevar legitimamente a nota só porque as telas abriram. Testes de gravação em produção contrariariam o limite desta solicitação.

## Efeito no DRE

Esta auditoria não criou previsão, compromisso, estoque físico, custo reconhecido ou pagamento. Abrir consultas, ajuda, detalhe, histórico ou rascunho não confirmou fato financeiro. Não se atestou a ausência de duplicação de custo em todas as integrações reais, pois nenhuma transação foi concluída. Os problemas de homologação e de tipagem do identificador devem ser investigados a partir de suas origens; não autorizam recriar os lançamentos removidos.

## Evidências locais

- [Galeria e índice das 176 capturas](C:/dev/repositorio-mrc/artifacts/reauditoria-publicada-20261117/index.html).
- [Snapshots, métricas e requisições sem credenciais](C:/dev/repositorio-mrc/artifacts/reauditoria-publicada-20261117/audit.json).
- Pasta: `C:/dev/repositorio-mrc/artifacts/reauditoria-publicada-20261117/`.

Capturas intermediárias que não sustentam uma conclusão de sucesso: 45/48 (consultas inicialmente bloqueadas; substituídas por 69/70), 63/165 (consulta de clientes bloqueada; repetida em 166), 68 e 98 (carregamento), 104 (transição de largura), 156 (carregamento do PDF; substituída por 157). Os toasts de proteção em outras imagens também não são falhas espontâneas do ERP. A galeria preserva essas evidências com aviso, em vez de apagá-las ou usá-las como prova de fluxo concluído.
