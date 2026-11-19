# Validação da retomada após a limpeza — 16/11/2026

Continuação da [limpeza financeira autorizada](ZERAGEM-FINANCEIRA-2026-11-15.md). **A nova captura real, de 16/11/2026 às 13h49min53s da Bahia, confirmou que os lançamentos financeiros removidos não reapareceram.** Nenhuma gravação na produção, correção de cadastro, nova limpeza ou publicação foi realizada nesta rodada.

## Estado atual e sincronização

As coleções de medições financeiras, recebimentos, pagamentos, despesas de obras/empresa, pedidos, notas fiscais, caixas, extratos, transações e conciliação continuam vazias. As tabelas nativas de títulos, liquidações, movimentos bancários e vínculos de conciliação também foram relidas vazias. O sincronizador produziu **zero fatos financeiros e zero movimentos bancários para recriar**, sem executar sincronização ou migração real.

Continuam cadastrados **18 obras, 85 funcionários, sete orçamentos, cinco planos, 19 contratos de terceirizados, 201 locações e seis manutenções**. Foram observadas mudanças de conteúdo posteriores à limpeza em obras, funcionários, pontos, recibos de operações de ponto, usuários e histórico geral. Esses dados foram mantidos como a fonte atual; não houve tentativa de voltar ao snapshot anterior nem atribuição de autoria às mudanças.

A conferência atual do DRE usa os **pontos e cadastros atuais**, em 36 competências da empresa e 648 projeções por obra. Não exige igualdade com o DRE do dia da limpeza quando a própria fonte preservada mudou. Custos de mão de obra, benefícios e a operação de equipamentos continuam sendo calculados normalmente. Valores contratuais e planejamento permanecem previsões, sem gerar novamente os lançamentos apagados.

## Ensaio local de retomada

Foi utilizada uma cópia da captura atual, com registros sintéticos identificados por `qa-retomada-*`, sem transportar comandos para o servidor real. Os resultados de cada etapa foram gravados em **PostgreSQL descartável via PGlite**. A simulação aplica os comandos de domínio da aplicação; não é emissão fiscal, operação bancária real ou teste de navegação autenticada em produção.

| Etapa | Conferência do DRE e do caixa na obra de teste |
| --- | --- |
| 1. Criar obra de teste | Receita, custo e caixa sem lançamento. |
| 2. Incluir orçamento e planejamento sintéticos | Permanecem previsão; sem custo reconhecido ou caixa. |
| 3. Gerar pedido de R$ 200 | Compromisso de compra; sem reconhecer custo ou pagamento. |
| 4. Registrar entrega | Dez sacos com fator 50 geram 500 kg no estoque; ainda sem custo ou saída financeira. |
| 5. Registrar nota de R$ 200 | Reconhece custo uma vez, pela regra vigente de nota recebida. Conferência fiscal permanece uma condição própria. |
| 6. Pagar R$ 200 | Saída de caixa de R$ 200, sem novo custo. |
| 7. Conciliar o débito com o pagamento existente | Mantém custo e caixa únicos. |
| 8. Registrar medição de R$ 300 | Reconhece receita por competência, sem recebimento antecipado. |
| 9. Receber R$ 300 | Baixa o recebível, sem duplicar receita. |
| 10. Conciliar a entrada com o recebimento existente | Mantém uma única entrada de caixa. |
| 11. Repetir operações e tentar excedentes | Reexecução do pedido é idempotente; nota duplicada e recebimento acima do saldo são rejeitados sem alterar os valores. |

O item do pedido reutiliza o material, unidade e vínculo do item orçamentário sintético, com preço convertido de kg para saco. Os valores reais dos cadastros não foram usados como autorização para novos lançamentos. Ao final, **a obra de teste** tem receita de R$ 300, custo de R$ 200 e entradas/saídas de R$ 300/R$ 200; o resultado de R$ 100 é somente da simulação, não lucro ou saldo disponível da empresa real.

Em todos os 11 passos foram conferidos o razão da obra de teste, a projeção mensal da obra e a variação correspondente no consolidado da empresa. Funcionários, pontos, orçamentos/planos reais, terceirizados e equipamentos da cópia permaneceram inalterados. O arquivo original da captura também permaneceu intacto. Não houve cadastro de registros QA na produção.

## Parâmetros que precisam de conferência antes de novas cobranças

O validador vigente encontrou alertas em **cinco cadastros**:

- **K1-04 e W1-22:** fim contratual anterior ao início informado.
- **H-02 e B2-04:** quantidade de parcelas não preenchida conforme a regra atual. Conferir a pertinência dessa exigência ao contrato de administração; não inserir número por padrão apenas para liberar a tela.
- **BASE DE DADOS:** início e quantidade de parcelas ausentes. É necessário distinguir o uso interno desse cadastro de uma obra que deve efetivamente gerar cobrança; não criar contrato ou financeiro fictício para satisfazer o validador.

A fórmula simples `entrada + quantidade de parcelas × valor da parcela` também encontrou cinco diferenças nos cadastros de preço fixo:

| Obra | Valor contratual cadastrado | Soma cadastrada | Diferença |
| --- | ---: | ---: | ---: |
| ALPHAVILLE | R$ 42.000 | R$ 504.000 | R$ 462.000 a mais |
| K1-02 | R$ 287.500 | R$ 287.501 | R$ 1 a mais |
| CA1-13 | R$ 340.000 | R$ 339.995 | R$ 5 a menos |
| W1-22 | R$ 175.000 | R$ 180.000 | R$ 5.000 a mais |
| P1-08 | R$ 340.000 | R$ 315.000 | R$ 25.000 a menos |

**Essas diferenças são alertas de configuração, não dívidas, receitas reconhecidas ou cobranças autorizadas.** A fórmula não comprova se existem entrada diferenciada, parcela final ajustada, aditivo ou outro acordo. Os dois grupos de cinco têm sobreposição; não representam dez obras distintas com erro comprovado.

W1-22, CA1-13 e R1-16 continuam com as ressalvas documentais já registradas. Na R1-16, a soma do cadastro fecha matematicamente, mas isso não homologa a composição de entrada/parcelas frente à minuta encontrada. Não foram recriadas medições históricas, importados extratos antigos, alterados valores ou solicitado novamente ao usuário o que ele já disse não saber sobre a W1-22.

Nenhuma obra recebeu autorização de geração automática de cobranças nesta análise. Cadastro sem alerta matemático não equivale a contrato vigente comprovado.

## Validação e evidências

**116 testes aprovados em oito arquivos**, sem falhas ou pulos: fluxo de suprimentos, comandos de pedido/nota, razão financeiro, conciliação, proteções da API, sincronização de planos legados e baseline aprovada. A suíte inclui proteção contra custo duplicado, operações em outra obra, datas inválidas e exclusão de obras com vínculos preservados.

**11 etapas do ensaio local concluídas**, incluindo três conferências de repetição/excedente. Não foi necessário alterar o código do app. Esta rodada não refez a revisão visual desktop/celular nem homologa integração com banco, emissão de NF ou todos os módulos do ERP. Ajuda/manual não tiveram fluxo ou regra alterados; os resultados novos são evidências operacionais deste relatório.

Artefatos: `artifacts/retomada-financeira-20261116/capture-summary.json`, `verification.json`, `tests.log` e `rehearsal.log`. Captura, DRE atual, roteiro de conferência contratual e cópia final sintética permanecem fora do repositório em **`C:/dev/marcell-local-review/retomada-financeira-20261116/`**: `snapshot.json`, `data-before.json`, `dre-current.json`, `contract-readiness.json` e `qa-final-data.json`. Não usar a cópia QA como arquivo de importação para produção.

## Próxima sequência recomendada

1. **Conferir a composição da ALPHAVILLE e a cronologia da K1-04**, pelo maior desvio matemático e pela inconsistência de datas. Localizar a versão contratual vigente antes de propor alteração.
2. Conferir K1-02 e P1-08 e resolver os critérios de cadastro dos contratos de administração H-02/B2-04, sem alterar a BASE DE DADOS por suposição.
3. Manter W1-22, CA1-13 e R1-16 documentais. Revisar os parâmetros preservados antes de usar geração de novas medições; a limpeza anterior não homologou esses contratos.
4. Iniciar lançamentos reais somente com origem, competência e obrigação comprovadas, reutilizando os vínculos de orçamento/planejamento e conferindo o DRE em cada passo. As 793 pendências antigas não devem ser reimportadas como uma fila nova.

**Sem nova publicação, push, migração, envio de mensagem ou escrita financeira em produção.**
