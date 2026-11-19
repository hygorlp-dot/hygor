# Jornada de operador e notas de usabilidade — 15/11/2026

Revisão feita na versão publicada em https://pontosarcd.vercel.app/, pela sessão existente de administrador. Percurso de consulta executado no Edge em 1440 × 900 e 390 × 844: painel → K1-10 → planejamento → medição → financeiro da obra → documentos/PDF/ajuda → compras/solicitação → contas a receber/conferência/retorno → equipe/terceirizados/formulário de medição → retorno ao painel. Trata-se de uma inspeção simulada por um agente, não de teste com clientes recrutados, pesquisa SUS, homologação de todas as abas ou auditoria completa de permissões.

Não houve edição de código, deploy, confirmação de medição, aprovação, recebimento, pagamento, upload, exclusão ou cadastro. Formulários foram abertos e cancelados sem preencher. Filtros e navegação de consulta foram usados; a sessão permaneceu conectada e o tamanho temporário do navegador foi restaurado. Não foi feita comparação integral do banco antes/depois: a preservação operacional relatada se refere às ações executadas, que não incluíram comandos de gravação.

## Conclusão

A rotina é utilizável, com boa base de consultas e formulários, mas exige familiaridade com caminhos e conceitos. Há um bloqueio de navegação reproduzido e inconsistências de contexto/apresentação que impedem dizer que está tudo correto. A prioridade é corrigir a continuidade dos caminhos e a clareza das ações antes de ampliar a interface.

## Notas por área

Notas de 0 a 10, atribuídas nesta inspeção: 0–3 = tarefa bloqueada ou muito difícil; 4–6 = atritos relevantes; 7–8 = utilizável com poucos esclarecimentos; 9–10 = caminho claro e consistente nos cenários avaliados. As notas são julgamento de usabilidade dos percursos observados, não medida estatística. Média simples das dez áreas: **6,3/10**.

| Área observada | Nota | Evidência e implicação |
| --- | ---: | --- |
| Painel e orientação inicial | 6 | Pendências e obras acessíveis, porém muitos indicadores, ações e termos disputam atenção. |
| Navegação interna da obra | 5 | Obra preservada em vários caminhos, mas atalho de medição gera área vazia; seleção de grupo pode manter conteúdo do grupo anterior. |
| Planejamento | 6 | Dados, cronograma e aviso de orçamento preliminar visíveis; excesso de controles e conceitos técnicos antes da tarefa no celular. |
| Medição física da obra | 6 | Percentuais dos serviços acessíveis; lista de 53 serviços e avanço oficial 0% exigem distinguir sugestões e medição oficial. |
| Financeiro e conferência | 8 | Separa saldo em aberto de caixa, mantém recorte e oferece retorno à fila. Conferir cobrança abriu a evidência do registro certo. |
| Medições a faturar | 4 | Ação financeira aparece como “ok”; seletor de obra sem nome acessível na consulta observada; cobrança e edição estão distantes numa lista longa. |
| Central de arquivos | 7 | Busca, origem, histórico, prévia PDF e retorno funcionaram. Há duplicidade de experiências e escolha inicial de obra desalinhada da jornada. |
| Compras e solicitação | 7 | Fila com próxima ação, situação e prazos; formulário organizado em contexto, materiais e revisão. Menu de 16 destinos e múltiplos seletores ampliam a carga. |
| Equipes e consulta de ponto | 7 | Busca e lotação disponíveis; distingue sem registro de falta confirmada e informa sincronização. Listas vazias repetidas alongam a consulta móvel. |
| Terceirizados e nova medição | 7 | Seletor de contrato, percentual anterior/acumulado, slider, câmera/galeria e explicação do DRE são claros. Quadro de contratos e aprovações anteriores tornam a chegada à edição longa. |

## Achados prioritários

### U01 — P1: atalho de medição abre área sem conteúdo

**Reprodução:** Dashboard → K1-10 → Visão geral/Geral → expandir Medições → Abrir medicoes completo →. Resultado: permanecem cabeçalho e navegação da obra, mas nenhum conteúdo de medição nem aviso de indisponibilidade. Reproduzido em desktop e celular. Recuperação observada: Obra → Medição no desktop; Telas da obra → Medição no celular.

**Evidência:** 04-medicoes-atalho-vazio.png/.txt e 26-medicoes-atalho-mobile.txt. A captura PNG 26 está inadequada; usar a captura desktop e o estado textual para esta reprodução.

**Conferência técnica somente leitura:** no pacote publicado ecd2e959, src/LegacyApp.jsx usa atalho="medicoes" no resumo; abrirModuloDaObra copia o destino para abaConteudo. A tela embutida usa a chave med. O destino global medicoes não é renderizado como conteúdo interno da obra. Falta também uma saída explícita para destino interno desconhecido. Nenhuma correção foi aplicada nesta revisão.

**Melhoria:** resolver o atalho para o destino correto, sem inferir vínculos por nomes semelhantes, e apresentar estado recuperável quando o destino não existir. Usar rótulo visível com acentos e nome da tarefa.

### U02 — P1 de clareza: botão “ok” em uma ação financeira

**Reprodução:** Financeiro → Medições a faturar. Cada cobrança vencida traz botão “ok”, que não comunica seu efeito. Não foi acionado para evitar qualquer operação financeira.

**Evidência:** 20-medicoes-faturar-mobile.png/.txt. Conferência do código publicado, src/domains/medicoes/components/MedicoesView.jsx:537, mostra que o botão abre setPagarModal; não comprova baixa imediata e não deve ser descrito como tal.

**Melhoria:** nomear o efeito real, por exemplo “Registrar recebimento”, mantendo confirmação e regras financeiras existentes. Não misturar a consulta da cobrança com sua liquidação.

### U03 — P2: obra não acompanha a entrada global de Arquivos

**Reprodução:** consulta de K1-10 → menu global Arquivos. Obra dos arquivos abriu em BASE DE DADOS; foi necessário escolher K1-10 novamente. Isso é diferença de contexto observada, não evidência de arquivo no lugar errado.

**Melhoria:** retomar a obra em foco quando houver vínculo explícito ou solicitar escolha clara, sem selecionar silenciosamente a primeira obra. Contexto deve acompanhar consulta e cadastro.

### U04 — P2: duas experiências chamadas Arquivos

**Reprodução:** menu global Arquivos apresenta central por pasta/revisão e documentos dos módulos. Dentro de K1-10 → Telas da obra → Arquivos aparece outro navegador do OneDrive, com dez pastas administrativas, Carregar arquivo e Criar pasta. Ambas carregaram; finalidades e regras de cadastro diferem.

**Evidência:** 11-arquivos-mobile.txt e 16-arquivos-dentro-obra-mobile.png/.txt.

**Melhoria:** explicitar “Central de documentos” e “Pastas do OneDrive”, criar transição clara entre elas com a mesma obra e explicar onde o upload cria um cadastro com revisões. Não juntar estruturas nem migrar arquivos apenas por semelhança de pasta.

### U05 — P2: aba de grupo selecionada pode não corresponder ao conteúdo

**Reprodução desktop:** na medição da obra, clicar Financeiro destacou o grupo e exibiu DRE da obra na subnavegação, mas manteve a medição no corpo até clicar nessa subopção.

**Evidência:** 06-financeiro-mantem-medicao.png/.txt.

**Melhoria:** distinguir expansão de categoria de troca da tela ou abrir a primeira tela autorizada do grupo de forma consistente; manter título e estado selecionado coerentes.

### U06 — P2: avanço oficial e progresso de planejamento parecem contraditórios

**Observado:** K1-10 mostra avanço físico de 0% no resumo/medição; Planejamento mostra progresso de 11% e execução valorizada em orçamento preliminar. A medição explica ao final que o boletim aprovado alimenta o avanço oficial; o resumo registra ausência de orçamento de controle aprovado.

**Evidência:** 02-obra-desktop.txt, 03-planejamento-desktop.txt, 05-medicao-desktop.txt e 14-planejamento-mobile.png.

**Classificação:** ambiguidade de conceito/apresentação, não erro de cálculo comprovado. Não houve recomputação financeira nem validação contábil.

**Melhoria:** rotular “Avanço oficial aprovado” e “Evolução informada/preliminar” junto dos indicadores, informar fonte e data e permitir abrir a origem. Não substituir automaticamente uma medida pela outra.

### U07 — P2: jornada móvel longa e com escolhas excessivas

**Observado:** cabeçalho e vários seletores/ações precedem a lista em Arquivos; Planejamento oferece Materiais e compras, escalas de tempo, dias e colunas antes do cronograma; Compras oferece 16 destinos; Terceirizados abre quadro de todas as obras com colunas vazias repetidas. A lista de medição possui 53 serviços.

**Melhoria:** privilegiar uma próxima ação por etapa, busca/filtro por obra perto da lista, recolher análises e ferramentas secundárias, disponibilizar visão compacta de contratos no celular. Preservar todas as funções e o contexto de retorno.

### U08 — P2: linguagem técnica e ajuda extensa

**Observado:** SPI, RDOs, baseline, “Saldo cto.”, A:0/S:0 e identificadores como “art rrt execucao” exigem conhecimento prévio. A ajuda existe e conserva contexto, mas concentra cuidados em um parágrafo longo; na consulta normal de Arquivos, a instrução destacada explica exclusão individual e não torna a seleção em lote imediatamente ensinável.

**Melhoria:** termos simples junto dos números, explicação sob demanda e instruções curtas por tarefa. Incluir “Marque as caixas e use Excluir selecionados” no guia de chegada, mantendo o guia específico de exclusão.

### U09 — P2: dado contratual inconsistente está sinalizado, mas ainda dificulta decisão

**Observado num contrato de terceirizado:** valor do contrato R$ 0,00; etapas R$ 6.000,00; medido R$ 3.678,00; saldo a medir R$ 2.322,00. A tela avisa a diferença e orienta ajustar o cadastro. Não foi alterado nenhum valor e não se concluiu que o cálculo de medição esteja errado.

**Melhoria:** apresentar pendência de cadastro junto do seletor/ação de medição, deixando clara a base usada nos valores. Não preencher contrato automaticamente com a soma das etapas sem conferência de origem.

## Pontos positivos confirmados

- Painel abriu a obra correta e o planejamento embutido manteve K1-10.
- Busca de ART de execução retornou um documento existente; a prévia carregou um PDF de duas páginas com revisão, zoom e busca. Fechar visualização preservou a busca e o documento selecionado.
- Origem somente consulta foi informada e os documentos vinculados não ganharam caixa de exclusão.
- Abrir a ajuda manteve a obra e a busca; o fechamento próprio estava disponível.
- Formulário de lote informa destino, limites, revisão R01, preservação dos existentes e efeito de falhas. Foi cancelado sem selecionar arquivos.
- Compras distingue próxima ação, prazo e situação. Nova solicitação apresenta contexto, materiais e revisão antes de formalizar. Foi cancelada sem preencher.
- A receber apresentou valores, vencimento, obra e cliente. Conferir cobrança abriu o registro esperado; Voltar à fila financeira preservou o recorte A receber e seus 33 títulos.
- Equipe nas Obras carregou a data do servidor, informou atualização e sincronização e separou sem registro de falta confirmada.
- Nova medição de terceirizado mostrou percentual acumulado anterior, slider, diferença e valor da medição, câmera e galeria, além da aprovação financeira e efeito no DRE. Foi cancelada sem tocar no percentual ou anexar imagens.
- Não foi observado erro de console originado no app no conjunto capturado; avisos de extensões foram separados. Isso não elimina defeitos de fluxo, como a área vazia do atalho.
- Os estados registrados não tiveram overflow horizontal da página. Isso não verifica todas as regiões roláveis, aparelhos físicos, ampliação de fonte ou contraste WCAG.

## Limites e evidências

Não foram testados login do zero/recuperação de senha, perfil real de cliente/engenheiro restrito, todos os módulos e abas, aprovação/rejeição, gravação, DRE calculado de ponta a ponta, emissão/recebimento/pagamento, exclusão/upload real, offline ou persistência de rascunho. Não é homologação transacional. Fluxos com efeitos reais ficaram deliberadamente na etapa de revisão; não foram declarados aprovados.

Este relatório não altera o fluxo nem requer atualização do manual, pois não houve implementação. Recomendações deverão revisar ajuda e manual quando forem executadas. Os dados financeiros foram apenas consultados; nenhum fato de previsão, compromisso, estoque físico, custo reconhecido ou pagamento foi criado ou duplicado pela revisão.

Arquivos locais: artifacts/operator-review-20261115/evidence-index.json e estados/capturas numerados. Algumas imagens obtidas logo após transições mostram quadro anterior. As PNGs 25 e 26 têm dimensão inadequada e não servem como prova visual do formulário; os estados textuais correspondentes continuam disponíveis. Não divulgar as capturas com dados pessoais fora da equipe; o relatório evita reproduzir esses identificadores.

## Ordem sugerida

1. Corrigir o atalho de medição e a inconsistência entre grupo ativo e conteúdo.
2. Nomear ações financeiras e deixar clara a diferença entre avanço informado e oficial.
3. Preservar obra entre destinos e distinguir central de documentos das pastas OneDrive.
4. Encurtar a chegada à tarefa no celular e melhorar ajuda por ação.
5. Validar os ajustes com operadores reais e contas de menor permissão; depois fazer homologação com dados sintéticos isolados.
