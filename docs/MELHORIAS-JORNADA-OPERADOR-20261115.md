# Melhorias da jornada do operador — validação local

Data: 15/11/2026. Referência: `REVISAO-OPERADOR-USABILIDADE-20261115.md`.

A meta solicitada é 9,5/10. As notas da inspeção original permanecem preservadas: não foram elevadas artificialmente. Esta entrega corrige os atritos reproduzidos e melhora a jornada local. Não constitui homologação de toda a ERP nem uma nota medida com operadores reais.

## Mudanças verificáveis

| Jornada | Resultado local |
| --- | --- |
| Visão gerencial | A ação principal informa o setor da prioridade. Indicadores adicionais e a central de ações existentes foram preservados. |
| Obra → Medições | O atalho abre Medições a faturar, na obra de origem. Medição física continua como destino separado. Destinos desconhecidos oferecem recuperação em vez de conteúdo vazio. |
| Grupos da obra | Escolher Financeiro ou outro grupo abre seu primeiro destino, sem manter o conteúdo do grupo anterior. |
| Medição física | Busca por serviço, estado sem resultados recuperável e remoção do campo de obra redundante quando a obra já está fixa. |
| Percentuais | Evolução por valor identifica a ponderação pelos valores dos serviços; falta de valores é apresentada como Sem base de valor. Planejamento explica sua média pela duração das tarefas. Ambos distinguem informação de execução de aprovação do boletim. |
| Planejamento no celular | Escala, calendário e colunas ficam disponíveis sob demanda. Aviso de orçamento preliminar e instruções permanecem visíveis. |
| Medições a faturar | Obra das medições aparece no início, com rótulo acessível. Cobranças próximas e vencidas ficam em resumo expansível com quantidade e valor. Registrar recebimento abre a conferência existente; cancelar não registra recebimento. A obra fica protegida durante edição/confirmação. |
| Documentos | Central e Pastas do OneDrive têm finalidades explícitas e transição com a obra preservada. A troca de contexto aguarda o fim de uma operação pendente. Seleção continua pelas caixas; o nome abre os detalhes. |
| Terceirizados | No celular, entrada pela lista de contratos. Busca, especialidade e obra também filtram o quadro. Aprovações ficam sob resumo com contador. Saldo das etapas explica a base usada e divergências contratuais continuam exigindo conferência. |
| Equipe nas Obras | Obras sem funcionários no recorte ficam ocultas por padrão e podem ser exibidas. Pessoas sem registro continuam disponíveis; ausência de batida não é tratada como falta confirmada. |
| Ajuda | Cuidados, permissões e recuperação usa expansão acessível por teclado. Passos continuam à vista. Ajuda e manual foram revisados juntos. |

## Fontes e efeito no DRE

- O atalho financeiro consulta `medicoes`; o avanço técnico consulta tarefas, diários e boletins. Os fluxos não foram fundidos.
- A conferência do código refinou a interpretação da inspeção inicial: o indicador geral calculava percentuais ponderados pelos valores das tarefas, não exclusivamente o último boletim aprovado. O texto agora identifica essa base. O Planejamento usa duração, o que pode produzir outro total. Ausência de base de valor não é execução comprovada de 0%.
- Valores contratuais e valores das etapas continuam independentes. Nenhum cadastro foi completado por semelhança de nome.
- As mudanças são de navegação, apresentação, busca e contexto. Não criam previsão, compromisso, entrada de estoque, custo reconhecido, receita ou pagamento. Os comandos financeiros e as verificações de permissão existentes foram preservados; não há novo fato capaz de duplicar o DRE.
- O sincronismo automático já existente entre orçamento e planejamento foi preservado. O cenário de navegação usa a referência exata da versão do orçamento preenchida na massa fictícia, para testar consulta sem disparar esse sincronismo.

## Validação

- Navegador Chromium local em 390 × 844 e 1440 × 844: dez cenários de jornada/consulta, com sessões novas, sem erros de página, sem aviso de chave React duplicada e sem rolagem horizontal da página nos pontos verificados.
- Obra Horizonte → cobrança → conferência/cancelamento → medição física/busca → planejamento → Financeiro → Pastas do OneDrive → central: destinos e obra conferidos, sem comandos de gravação na jornada.
- Contratos fictícios em duas obras: busca respeitada na lista e no quadro, fila de aprovação expansível. Equipe fictícia: obra vazia reaparece por ação explícita e funcionário sem batida permanece consultável.
- Exclusão em lote: dois cenários existentes passaram, cobrindo celular/desktop, documento protegido, confirmação/cancelamento, falha parcial, recarga e retomada em armazenamento fictício local.
- Inicialização DEV: 133 verificações passaram, cobrindo as 65 abas nos dois tamanhos e três rotas públicas. Após a proteção final de contexto: mais quatro verificações de medição/faturamento e duas de arquivos passaram em sessão nova.
- Inicialização do build final: 216 verificações passaram, incluindo arquivos JavaScript gerados e telas em sessões novas.
- Suíte geral: 5.247 testes passaram e 15 foram ignorados. Houve uma divergência do manual enquanto o conteúdo compartilhado era atualizado. A nova execução, com os arquivos atuais, passou nos 20 testes de ajuda, manual, contexto e destinos da obra, incluindo o teste que havia divergido. Não é apresentado como uma única execução integral sem falhas.
- Lint, design, manual e tipos passaram. Grafo de 917 arquivos: nenhum ciclo de importação estático ou dinâmico detectado.
- Bundle final: 1.818.217 bytes gzip de JavaScript/CSS, abaixo do teto existente de 1.891.328 bytes; nenhum limite aumentado e nenhuma dependência acrescentada.
- Impeccable: 140 apontamentos nos arquivos legados analisados; os valores apontados já existiam nas cópias anteriores. Nenhum apontamento novo identificado nesta alteração e nenhuma exceção adicionada à baseline.

Durante a validação, a descoberta de dependências do DEV percorreu evidências HTML do workspace e excedeu o tempo de entrada. Ela foi limitada ao `index.html` do aplicativo. O teste permite aquecimento inicial de até 60 segundos; cada cenário continua usando uma sessão nova. Também foram diferenciadas as chaves de recuperação, operações pendentes e equipe para eliminar o aviso de identificação duplicada.

## Evidências e limites

Testes de jornada: `e2e/operator-usability.spec.js`. Capturas locais: `artifacts/operator-{home,cmp,terc,equipe_obras,billing,measurement,planning,files}-{390,1440}.png`. Logs e relatórios: `artifacts/operator-*.log` e `artifacts/operator-init/`. Diferença dos arquivos de interface em relação às cópias anteriores: `artifacts/operator-task.patch`.

Os testes usam dados e integrações locais fictícios. Não houve novo upload, exclusão, aprovação, pagamento ou deploy em produção. Isso não comprova disponibilidade real do OneDrive/Supabase, atendimento em aparelhos físicos, velocidade sob rede de obra, nem todas as combinações de perfis e dados históricos. A nota 9,5 para todas as áreas exige validar esses cenários e observar operadores reais completando as tarefas; permanece uma meta, sem certificação artificial nesta entrega.
