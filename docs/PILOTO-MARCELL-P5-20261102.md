# P5 — Recuperação, adiantamentos e formulário compartilhado

Revisão: 02/11/2026. Execução local no checkout `codex/marcell-precise-local-20261101`, a partir de `b6c78fab`. Sem push, deploy, migração ou transação em banco de produção.

## Entrega

**Retomar trabalho salvo** distingue rascunho não enviado de confirmação enviada sem resposta. O comando de pagamento, recebimento ou alocação é protegido em IndexedDB antes de alcançar a API. Após recarga, o operador escolhe explicitamente **Retomar confirmação**: o app reutiliza identificação, versão, valores e chave idempotente originais. A recarga não reenvia operações automaticamente. Confirmação aceita limpa o comando e o rascunho correspondente em transação local; rejeição definitiva libera a tentativa para revisão. Perda de acesso após resposta incerta conserva o comando original, e perfis sem permissão operacional não recebem retomada habilitada. O rascunho associado fica oculto enquanto houver confirmação pendente, evitando dois caminhos para a mesma operação. Respostas incertas preservam a operação.

Rascunhos do formulário compartilhado conservam campos e comprovante selecionado. **Reabrir rascunho** apenas restaura a edição. **Remover comprovante** retira o arquivo escolhido. Abas do mesmo usuário compartilham o rascunho do mesmo registro; uma transação local impede duas confirmações financeiras diferentes no mesmo registro. Isso não substitui concorrência no servidor nem backup: a recuperação depende do mesmo usuário, navegador, endereço e dados locais. Sem armazenamento local, o envio é bloqueado.

**Alocar adiantamento** está na ficha rápida financeira quando há pagamento disponível no pedido vinculado à nota e o perfil permite a ação. O formulário identifica o pagamento original e seu saldo; o operador informa **Valor a alocar**. A seleção é por vínculo explícito e identificação do pagamento, nunca por semelhança de valor ou descrição.

A operação verifica saldo disponível, saldo da nota, centavos, versões da nota e do pedido, acesso à obra e períodos fechados. Notas com rateio entre obras são bloqueadas com orientação. A nota recebe o vínculo e o pedido conserva seu pagamento original. A projeção divide esse pagamento entre saldo não alocado e parcela vinculada à nota, preservando data e total de caixa; parcelas iguais de uma transação bancária continuam distintas. A classificação histórica muda na data original do pagamento, e a auditoria registra a data em que a alocação foi feita. O custo continua seguindo o documento de competência.

**Desfazer alocação** exige motivo e devolve o saldo ao adiantamento, sem estornar dinheiro. Vínculo conciliado pode ser desfeito sem modificar a transação bancária, respeitados os períodos fechados da origem e da nota. Estornar ou reclassificar o pagamento original exige desfazer antes suas alocações. Pagamentos legados preservam a origem herdada do pedido, inclusive pagamento direto do cliente.

**Um formulário de pagamento para pedidos e notas fiscais** substitui as composições distintas de Compras e da central de pagamentos do Financeiro. Origem, valor, data, transação opcional, referência, comprovante e observação seguem a mesma ordem e os mesmos controles. Transações ignoradas, conciliadas ou já ligadas a pagamentos ativos não são oferecidas para outro vínculo. Demais fluxos especializados de pagamentos e recebimentos não foram declarados como migrados para esse formulário. Rascunhos de recebimento antes do envio não são recuperados por essa central; a confirmação enviada de recebimento é protegida.

## Padrão e documentação

MARCELL, paleta, IBM Plex Sans, controles e tokens compartilhados preservados. Duas colunas para valor/data no desktop e uma no celular; diálogo acompanha a área disponível. A orientação detalhada permanece na Ajuda, evitando repetir os avisos de adiantamento em sequência no formulário.

Ajuda revisada em 02/11/2026, com guias específicos de recuperação, guia de pagamento compartilhado e orientação de recebimento/fichas atualizada. Manual regenerado: **104 guias e cobertura das 65 abas**. Os ajustes finais de origem e conciliação corrigem o resultado do fluxo já descrito, sem introduzir controles ou passos adicionais.

A limpeza removeu 119 seletores de controles aposentados, preservando regras compartilhadas de seletores agrupados, utilitários do sistema de design e classes construídas dinamicamente. Não houve aumento do teto ou exclusão de assets da medição. O empacotamento permanece com a configuração existente. A prévia local passou a retornar rejeições do domínio com HTTP 409, evitando apresentá-las como resposta incerta; isso corrige a simulação, sem alterar passos do usuário.

## Verificação local

- 18 cenários P5 em Chromium: rascunho após recarga, recuperação do comprovante sem envio, resposta perdida de pagamento, recebimento e alocação, alocação parcial e desfazer, armazenamento bloqueado, transações bancárias disponíveis, perda do perfil operacional e Ajuda contextual. Desktop 1440 × 1000 e celular 390 × 844. As alocações usam pagamento bancário já conciliado.
- 18 repetições adversas: celular 320 px e texto a 200% no desktop, ambos com fontes bloqueadas. Incluem largura do diálogo, acesso ao fechamento, ajuda e confirmação.
- 18 cenários P4 de exceções, oito verificações adversas P4 e 42 regressões de fila, ficha, navegação, pagamentos e recuperação anteriores aprovados.
- 136 cenários gerais cobrindo as 65 abas no desktop/celular aprovados após a limpeza de estilos.
- 525 testes em 48 arquivos de domínio, armazenamento, políticas, projeção financeira e ajuda: `artifacts/p5-unit-final.log`. Incluem concorrência de duas conexões locais, parcela bancária de valor igual, origem legada, desfazer conciliado, fechamento e acesso à obra real com tipo forjado.
- Os casos de desfazer conciliado e origem legada foram reproduzidos falhando antes da correção e aprovados depois: `p5-allocation-red.log` / `p5-allocation-green.log`.
- Lint, padrão de interface, manual, TypeScript, análise de dependências, Vite build e orçamento de bundle verificados. Build direto por Vite, sem executar prebuild ou migrações.

Logs e capturas em `artifacts/p5-*`; as suítes usam APIs interceptadas, dados fictícios e o motor puro real. A prévia em http://127.0.0.1:4260/ também usa dados fictícios; foi reiniciada para carregar o motor novo, preservando seu conteúdo em uso. Os testes não certificam o banco real, Safari, aparelhos físicos ou leitores de tela.

## Avaliação crítica

**8,3/10, provisório e interno.** A recuperação e o vínculo do adiantamento deixam de depender de reconstrução manual, mas ainda falta evidência de operação real. A nota não é uma medição estatística.

| Dimensão | Peso | Nota | Limite principal |
| --- | --- | --- | --- |
| Fluxo | 30% | 8,7 | A alocação exige nota e pedido já vinculados; rateio entre obras continua fora desse atalho. |
| Recuperação e segurança operacional | 30% | 8,4 | Proteção local não é backup, não é cifrada pelo app e não atravessa aparelhos/endereço. Banco real sob concorrência não foi exercitado. |
| Clareza e consistência | 25% | 8,6 | Pedidos/notas compartilham o formulário; outras operações financeiras especializadas conservam seus fluxos próprios. |
| Evidência de uso | 15% | 7,0 | Chromium emulado e fixtures; sem tempos de tarefa ou operadores acompanhados. |

Bundle JS/CSS gzip: **1.789.933 bytes**, teto **1.789.952**, apenas **19 bytes de margem**. O orçamento de carregamento continua praticamente sem margem. Antes de ampliar funcionalidades, é necessário reduzir de forma estrutural o código e a carga do legado; não aumentar o teto para passar no verificador. A meta **9,5 permanece aberta**.

## Roadmap atual

| Etapa | Situação |
| --- | --- |
| P0 — pesquisa e decisões | Concluída |
| P1 — fundação compartilhada | Concluída localmente |
| P2 — gestão à vista | Concluída localmente |
| P3 — ficha e ação | Concluída localmente |
| P4 — exceções e linguagem | Concluída no piloto local |
| P5 — revisão do piloto | Implementação e validação técnica locais concluídas; aplicação com operadores pendente |
| Próximo marco | Aplicar o roteiro abaixo com seis operadores e ao menos 20 tarefas; registrar falhas, tempos e retomadas antes de rever a nota |

## Roteiro preparado para aplicação posterior

Usar uma base de teste com pedidos, notas, entregas parciais, adiantamentos e períodos fechados. Não executar pagamentos, uploads de documentos pessoais ou recebimentos reais. Participantes previstos: dois de Engenharia, dois de Compras e dois de Financeiro. A preparação respeita a decisão anterior de aplicar o piloto posteriormente; não houve contato ou convite a participantes.

| Tarefa | Perfil principal | Resultado a observar |
| --- | --- | --- |
| 1. Encontrar entrega atrasada pela obra | Engenharia | Localiza registro e próxima ação sem reconstruir filtros |
| 2. Consultar pedido e voltar à fila | Engenharia | Recorte e posição preservados |
| 3. Receber quantidade parcial | Engenharia | Uma entrada e saldo residual correto |
| 4. Retomar recebimento após resposta perdida e recarga | Engenharia | Mesmo comando, sem segunda entrada |
| 5. Alternar tabela e Kanban | Compras | Mesmo conjunto de registros e filtros |
| 6. Localizar impedimento e responsável | Compras | Identifica o responsável e a ação permitida |
| 7. Abrir solicitação e retornar | Compras | Retoma a origem |
| 8. Comparar pedido, nota e adiantamento | Compras | Distingue entrega, competência e pagamento |
| 9. Preencher pagamento parcial sem enviar e recarregar | Compras | Reabre rascunho com valores corretos |
| 10. Recuperar e remover comprovante de teste | Compras | Arquivo recuperado, nenhuma operação financeira enviada |
| 11. Consultar ajuda e retornar à edição | Compras | Preenchimento e foco preservados |
| 12. Conferir bloqueio de perfil somente leitura | Compras | Consulta disponível, comando indisponível |
| 13. Localizar vencidos em pagar e receber | Financeiro | Direções e prazos não se confundem |
| 14. Identificar pagamento do pedido ainda disponível | Financeiro | Identifica origem e saldo, sem pagar novamente |
| 15. Alocar parte do adiantamento | Financeiro | Saldo da nota reduz; caixa total preservado |
| 16. Alocar restante em outra nota vinculada | Financeiro | Sem excesso ou duplicação |
| 17. Tentar valor acima do disponível ou período fechado | Financeiro | Bloqueio explicado, sem alteração financeira |
| 18. Desfazer alocação conciliada com motivo | Financeiro | Saldo retorna; transação bancária preservada |
| 19. Retomar pagamento/alocação após recarga e resposta perdida | Financeiro | Reenvio original, sem duplicação |
| 20. Repetir uma tarefa no celular com armazenamento bloqueado | Financeiro | Ação alcançável e bloqueio explícito, sem envio |

Registrar por tarefa: operador/perfil, aparelho e largura, início/fim, conclusão sem ajuda, erros, pedidos de orientação, perda de contexto e necessidade de retorno. Comparar com a linha de base que ainda será medida. Critérios propostos: zero duplicações, zero confirmação automática por recarga, zero perda de comando na recuperação suportada e pelo menos 19/20 tarefas concluídas; qualquer falha financeira bloqueia a aprovação. Tempos e desvios devem orientar a próxima revisão, sem inventar metas antes da observação.

Revisão adversa posterior em 02/11/2026: correções locais de identidade, memória e contexto; aplicação com operadores continua pendente. Avaliação crítica atual: **8,0/10**. Ver [revisão adversa da P5](PILOTO-MARCELL-P5-REVISAO-20261102.md). Sem deploy.
