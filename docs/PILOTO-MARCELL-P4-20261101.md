# P4 — exceções e linguagem

Revisão: 01/11/2026. Piloto local em `C:/dev/releases/marcell-precise-local-20261101`, branch `codex/marcell-precise-local-20261101`. Prévia: http://127.0.0.1:4260/. Sem publicação, push, deploy, migração ou gravação de dados reais.

## O que foi corrigido

**Parciais e adiantamentos.** A fila diferencia Pagamento parcial de Pagamento em aberto. A ficha do pedido separa Valor do pedido, Pago e Saldo a pagar e identifica adiantamentos ativos. A ficha financeira separa Valor original, Liquidado e Saldo em aberto. Recebimento físico continua independente de pagamento; pedidos pagos sem entrega permanecem na fila. Nenhum aviso virou autorização ou trava nova.

O formulário de Compras explica a classificação automática do adiantamento e mostra o motivo recomendado sem depender de um checkbox que parecia decidir a classificação. O servidor continua calculando a classificação e os avisos. O toast repetido antes do envio foi retirado: a orientação permanece visível no formulário e os avisos do comando continuam no histórico. Compras e central financeira usam Registrar pagamento; a orientação sobre transferência bancária continua na Ajuda.

**Nota posterior ao pagamento do pedido.** O ledger mantém pagamentos sem vínculo fiscal separados do saldo da nota. A ficha financeira e o formulário da central agora avisam sobre o pagamento anterior antes de uma nova confirmação. Não foi criado abatimento automático nem associação por descrição ou fornecedor. O teste demonstra que o vínculo explícito do mesmo pagamento reduz o saldo sem criar uma segunda saída de caixa. Também foi corrigido um falso aviso em parcela de outra obra no rateio: o aviso respeita a obra da parcela.

**Envio e resposta perdida.** O protocolo compartilhado conserva o comando original após falha incerta, inclusive versão, chave idempotente, IDs de estoque/pagamento e anexos. Ele é usado no recebimento de Compras e nos pagamentos de Compras e Financeiro. A nova tentativa na mesma sessão reenvia a operação original. Testes simulam o servidor gravando e perdendo a resposta; a segunda confirmação não duplica a entrada ou a baixa.

Campos e fechamento ficam protegidos durante o envio. Na resposta incerta, valores ficam preservados e protegidos contra alteração antes do reenvio; a orientação aparece antes dos campos. O comprovante não é enviado novamente quando o comando anterior já contém o anexo. Rejeições definitivas mantêm os dados para revisão e encerram a tentativa rejeitada. O modal de recebimento também trata exceções sem deixar uma rejeição de Promise sem orientação.

**Permissões e dados adversos.** As ações da fila respeitam perfil, acesso e obra, mantendo a consulta para leitores. Engenharia conserva recebimento, conforme os papéis existentes da API, e não recebe edição de pedido por esse atalho. Pagamento e recebimento revalidam o contexto no handler; ações financeiras não são oferecidas a usuário desativado. A autorização final continua no servidor. A fila ignora registros excluídos/inativos; uma cotação excluída deixa de ocultar sua solicitação. Datas impossíveis ficam sem prazo válido, com orientação para corrigir a origem.

## Ajuda, manual e aparência

Foram revisados Compras · Receber, Financeiro · Pagamentos e as fichas rápidas. Foi criado Compras · Registrar pagamento. Recebimento e pagamento têm Ajuda dentro do formulário, com contexto temporário e restauração do guia anterior. Manual regenerado: 102 guias cobrindo as 65 abas.

O padrão MARCELL, IBM Plex Sans, tokens, controles e espaçamentos compartilhados foi mantido. Os campos protegidos usam a receita comum `mrc-command-fields`. O aviso de pagamento anterior usa Alert semântico; a informação genérica sobre transferência foi concentrada na Ajuda para reduzir repetição na ficha. Tabela e Kanban continuam com o mesmo recorte.

Foram removidos seletores e sete animações antigas sem referências atuais, de controles substituídos. Não houve aumento do teto, alteração da métrica ou exclusão de arquivos do orçamento de bundle. A revisão geral das abas verificou os efeitos da limpeza.

## Evidências e limites

- 18 cenários P4 em Chromium, desktop 1440 × 1000 e celular 390 × 844: saldos parciais, adiantamento, leitor, resposta perdida depois da gravação, reenvio idempotente, fechamento durante envio e rejeições 401, 403 e 409 com preenchimento preservado. APIs interceptadas e motor puro real para os efeitos em memória.
- Oito cenários adversos: 320 px e texto a 200% em desktop, ambos com fontes bloqueadas. Fichas, formulário de Compras e central financeira, incluindo avisos e reenvio. Conferência de largura da página/painel e capturas inspecionadas.
- 42 cenários de regressão: filas/quadros, ficha e contexto, avisos de Compras, pagamento parcial e recuperação/cancelamento dos fluxos anteriores.
- 136 cenários gerais de layout, cobrindo as 65 abas no desktop/celular.
- 98 testes de código em 15 arquivos: tentativa, concorrência de clique, modelos, permissões, datas, recebimento, conferência, ledger, pagamentos, ajuda/manual e foco dos modais. O caso de rateio foi reproduzido com teste falhando e corrigido com teste aprovado.
- Lint, design, TypeScript, manual sincronizado e análise de dependências aprovados. Build via Vite, sem executar o prebuild com migrações.
- Bundle JS/CSS gzip: 1.789.922 bytes; teto preservado em 1.789.952 bytes. Restam apenas 30 bytes de margem: a próxima expansão exige consolidação real do legado, sem ampliar o teto para contornar a validação.

Logs: `artifacts/p4-browser-final.log`, `p4-stress.log`, `p4-regression.log`, `p4-whole-erp.log`, `p4-unit-final.log`, `p4-rateio-red.log`, `p4-rateio-green.log`, logs finais de lint/tipos/arquitetura e `p4-bundle-final.log`. Capturas em `artifacts/p4-browser` e `p4-stress`. Os testes não são um ensaio de concorrência contra banco/API de produção nem substituem operadores, aparelhos físicos, Safari ou tecnologia assistiva.

## Avaliação pessimista

**7,8/10, provisório.** A nota anterior de 9,0 refletia principalmente a experiência nominal da P3. Esta avaliação pesa falhas, recuperação e evidência de uso; não é uma medição estatística nem indica uma regressão visual.

| Dimensão | Peso | Nota | Ponto fraco |
| --- | --- | --- | --- |
| Fluxo | 30% | 8,0 | Conferir pedido, nota e pagamento ainda exige mudanças de contexto; o aviso não resolve a alocação pelo usuário. |
| Segurança da operação na interface | 30% | 7,5 | A tentativa sobrevive ao fechamento/reabertura dentro do módulo, mas não é durável após recarga ou desmontagem. |
| Clareza e consistência | 25% | 8,5 | Os controles e termos foram padronizados, mas os formulários de Compras e Financeiro ainda têm composições e anexos diferentes. |
| Evidência de uso | 15% | 7,0 | Chromium emulado e fixtures não comprovam tempo de tarefa, comportamento com volume real ou uso por operadores. |

Riscos residuais que impedem uma nota 9,5:

1. **Recarga após resposta incerta:** não há promessa de recuperar o comando/formulário. Antes de abrir outra operação, o operador precisa conferir o histórico. É necessário validar uma recuperação durável antes de considerar esse risco encerrado.
2. **Alocação do adiantamento:** o saldo não é abatido por aproximação. O aviso evita uma conclusão errada, mas o percurso de vinculação/conferência ainda precisa ser avaliado como tarefa completa com operadores.
3. **Formulários extensos:** os dois caminhos usam o mesmo protocolo e controles, mas ainda não são um único formulário. Isso conserva diferenças na operação e aumenta manutenção.
4. **Validação real pendente:** não foram medidos tempo, erros e retornos com Engenharia, Compras e Financeiro, nem testado o banco real sob concorrência. Não trato a aprovação dos cenários locais como certificação de produção.

## Roadmap atualizado

| Etapa | Situação |
| --- | --- |
| P0 — pesquisa e decisões | Concluída |
| P1 — fundação compartilhada | Concluída localmente |
| P2 — gestão à vista | Concluída localmente |
| P3 — ficha e ação | Concluída localmente |
| P4 — exceções e linguagem | Concluída no piloto local, com os riscos residuais acima |
| P5 — revisão do piloto | Próxima: consolidar os fluxos completos, avaliar recuperação durável e alocação, revisar formulários e preparar/medir tarefas com operadores |

P4 não autoriza deploy. A meta 9,5 permanece aberta até haver evidência de recuperação e uso suficientes.
