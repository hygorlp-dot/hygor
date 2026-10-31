# Onda 4 — Necessidades, compromissos e revisão em volume

31/10/2026. WF07/WF08 do [roadmap MARCELL](ROADMAP-SAAS-95-2026-10-31.md). Implementação e validação locais, sem push, PR, deploy, migração ou alteração em banco real. Marca, logo, fontes e componentes existentes preservados. Aplicadas Impeccable, shadcn, boas práticas React e verificação de conclusão.

## WF07 — Cobertura comprovada e decisão na origem

Em **Financeiro → Caixa por conta → Previsão por vencimentos → Planejamento, compras e vencimentos**, a consulta agora distingue:

- referência da etapa e suas datas;
- necessidade revisada em cada item da solicitação;
- quantidade comprovada nos pedidos vinculados;
- diferença ainda sem compra ou pendente de conferência;
- obrigações financeiras do horizonte, consultadas separadamente.

Ter um pedido não basta para declarar uma solicitação atendida. A cobertura exige identidade da solicitação e do item, obra e material correspondentes, quantidade positiva e unidades verificáveis. Unidades diferentes só são comparadas quando a referência coincide e os fatores estão explícitos. Pedidos cancelados ou em rascunho ficam fora da cobertura. Identidades repetidas, material divergente, conversão inválida ou item sem vínculo não geram cobertura fictícia.

Exemplo sintético verificado: necessidade de 10 KG e compra de 6 KG mostram cobertura parcial e diferença de 4 KG. Dois pedidos válidos de 6 e 4 KG completam a cobertura. Compra de 12 KG não cria necessidade negativa; o excedente de 2 KG pede conferência. Nenhum cálculo altera a solicitação, o estoque, os recebimentos ou o caixa.

O operador pode abrir a solicitação e a ficha do pedido pelo registro. O destino valida a obra e a identidade; o retorno mantém obra escolhida e deslocamento simulado. Entrega posterior à etapa simulada fica indicada para revisão. A simulação não reagenda etapas, entregas, necessidades ou vencimentos cadastrados: a alteração efetiva continua na origem.

Estoque livre permanece compartilhado pela obra e não é abatido ou reservado automaticamente. Itens com lacunas mostram a quantidade comprovada e a diferença **a conferir**, orientando revisar antes de ampliar a compra. Orçamento, compromisso de compra e título não são somados como saídas de caixa.

## WF08 — Seleção estável e revisão individual

A sequência documental passa a usar o recorte explícito como identidade, preservando a seleção quando a base é reordenada, recebe registros ou muda a situação de uma nota. Mudar obra, mês, busca, situação ou identidade de consulta inicia outro recorte.

Cada item é revalidado antes de abrir. Registro indisponível, fora dos filtros, sem acesso, em período fechado ou fora da fila mantém a explicação e não oferece uma ação executável. Abrir uma ficha não significa salvar ou conferir. A fila distingue ficha ainda não aberta, ficha aberta sem nova versão, registro atualizado desde a abertura e item deixado para depois. Uma versão nova pede conferir o resultado individual; não é anunciada como aprovação automática.

Falha em uma ficha conserva a edição e permite retornar à fila, reabrir o item ou seguir para outro. Não foram criadas operações de gravação em massa. A aprovação, o pagamento e a confirmação de cada ficha continuam nos comandos existentes.

Consultas continuam isoladas por usuário, empresa e restrição de obra. Somente filtros são persistidos, sem anexos, seleção, senha ou rascunho. Obra removida/inativa e filtro obsoleto mostram a correção aplicada; se o recorte anterior também não existe, a consulta usa o recorte de acesso disponível. Seleção individual indisponível também recebe explicação no contexto.

## Volume, composição e textos

O ensaio local com 1.000 notas montava **1.000 artigos, 1.000 seletores e 13.063 nós DOM**, inclusive com o painel de seleção recolhido. A lista e a seleção agora paginam em 25 registros, sem reduzir o conjunto pesquisado ou selecionável. A medição final registrou 25 artigos, 25 seletores e 404 nós, incluindo a paginação adicional ao fim das listas.

Paginação está no início e no fim das listas. Avançar pelo fim retorna ao começo da nova página e posiciona o foco na indicação do intervalo. O recorte e a página permanecem na sessão ao voltar da ficha. A seleção de notas disponíveis abrange todas as páginas do filtro, com prévia antes da abertura individual.

No desktop, necessidade, compra e diferença usam três colunas; no celular, leitura vertical. Botões, formulários e tipografia usam os contratos do projeto, com controles móveis de pelo menos 44 px. O retorno à mesma tela foi padronizado como **Voltar à central de documentos**.

As medições de abertura em desenvolvimento foram 1.238 ms antes, 1.391 ms na primeira repetição depois e 1.145 ms na medição final, em execuções isoladas e com servidor aquecido. **Não demonstram ganho de tempo.** A evidência desta entrega é a redução da montagem e a navegação com todo o conjunto preservado; tempo de tarefa e desempenho representativo continuam para a onda 5.

## Ajuda e manual

Atualizados os guias de Caixa, Documentos e as exceções de Planejamento em `src/features/help/help-content.js`. O manual `docs/MANUAL_DO_APP.md` foi regenerado da mesma fonte. A ajuda contextual da Central de documentos foi aberta e verificada no navegador em 320 px. Preservadas as orientações de Compras, pagamentos, custo e aditivos mantidas por outras frentes locais.

## Validação

| Evidência | Resultado |
|---|---|
| Onda 4 no navegador | Oito cenários desktop/celular: cobertura parcial, prazo simulado, pedido e retorno; consulta salva e busca além da página; falha individual e próxima ficha; seleção e ajuda em 320 px |
| Regressão WF05/WF06 | 30 cenários de continuidade aprovados; o percurso documento → pagamento → banco → retorno foi repetido nos dois dispositivos após o ajuste final de paginação |
| Regras e componentes | 36 testes em dez arquivos aprovados, incluindo cobertura, conversão, identidades, seleção, reordenação, bloqueios, falha, volume, consulta obsoleta, manual e ajuda |
| Volume | 1.000 documentos sintéticos; montagem limitada a 25 artigos e 25 seletores; busca e seleção abrangem o filtro inteiro |
| Layout | Capturas desktop/celular e 320 px, inspeção visual e verificações de overflow nas jornadas |
| Qualidade | Build direto do Vite, lint, manual:check e typecheck; sem executar o prebuild com migrações |

Evidências em `artifacts/wf-wave4/`: `browser-verified.log`, `regression.log`, `continuity-final.log`, `unit-final.log`, `lint-final.log`, `typecheck-final.log`, `build-verified.log`, `volume-before-warm.json`, `volume-after-warm.json`, `volume-after-final.json` e capturas em `browser-results/`.

As jornadas usam APIs interceptadas e dados sintéticos em prévia local. Gravações fiscais de teste usam o redutor operacional real; nenhuma gravação ocorreu em banco real. Não se atribuem tempos de operador nem ganhos percentuais de produtividade a esses testes. Permanecem os avisos de tamanho de chunks do build e a necessidade de piloto acompanhado.

## Aceite e posição

**WF07 e WF08 concluídas no escopo aprovado. Onda 4 concluída.** Sete entregas concluídas (WF02–WF08), uma parcial (WF01, pela medição acompanhada) e duas planejadas (WF09/WF10). Próxima: onda 5, condições móveis adversas e piloto acompanhado.

**Nota heurística provisória: 9,3/10 nas superfícies verificadas.** Fluxo 9,4; próxima ação 9,4; recuperação 9,3; consistência 9,3; responsividade/acessibilidade 9,2; resposta 8,5. Com os pesos do roadmap, 9,305. A meta de 9,5 depende de corrigir o que a operação acompanhada revelar e confirmar desempenho, acessibilidade e uso em condições adversas; ainda não está declarada atingida.
