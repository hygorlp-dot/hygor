# Limpeza financeira autorizada — 15/11/2026

**Acompanhamento de 16/11:** [base continua limpa e retomada ensaiada localmente](RETOMADA-FINANCEIRA-2026-11-16.md). As mudanças posteriores em pontos/cadastros foram mantidas. Nenhum lançamento anterior foi recriado; onze etapas com conferência do DRE e 116 testes aprovados, sem nova escrita em produção ou publicação.

**Concluída e conferida na base real em 15/11/2026 às 23h30, horário da Bahia. Sem nova publicação.** Operação `financial-reset-11c3f13e-e49e-42ef-a935-288476df93f4`.

O usuário substituiu a continuação da auditoria R1-16 pelo pedido de remover o financeiro de todas as obras. Confirmou expressamente: todas as obras cadastradas; apagar também pedidos, notas fiscais, despesas da empresa e extratos; preservar funcionários, pontos, orçamentos, planejamento e contratos de terceirizados. Optou também por **preservar locações/manutenções e seus custos**, além de manter os custos dos pontos antigos no DRE.

## Resultado da limpeza

| Coleção operacional | Antes | Depois |
| --- | ---: | ---: |
| Medições financeiras de clientes | 178 | 0 |
| Recebimentos avulsos | 1 | 0 |
| Despesas de obras | 48 | 0 |
| Despesas da empresa | 23 | 0 |
| Movimentos de caixa de obra | 5 | 0 |
| Pedidos de compra | 5 | 0 |
| Pagamentos de terceiros | 2 | 0 |
| Medições financeiras de terceiros | 5 | 0 |
| Extratos importados | 3 | 0 |
| Transações bancárias | 925 | 0 |
| Regras de conciliação | 1 | 0 |
| Histórico operacional de conciliação | 142 | 0 |

Notas fiscais, adiantamentos e rescisões já estavam sem registros nessa captura e continuam vazios. Coleções de títulos/pagamentos de folha eventualmente ausentes também foram verificadas sem lançamentos. As medições técnicas e seu progresso foram preservados; são fatos distintos das medições financeiras apagadas.

Nas tabelas nativas, foram retirados **251 títulos, 210 liquidações, 925 transações bancárias, 56 vínculos de conciliação, 251 vínculos de migração financeira, cinco pedidos espelhados e 2.555 eventos/materializações financeiras**. Essas contagens incluem representações do mesmo fato e caches; não devem ser somadas como quantidade de operações econômicas distintas. Todas as tabelas financeiras selecionadas foram relidas vazias após a transação.

As **793 pendências bancárias anteriores passaram a não existir na base ativa pela remoção dos extratos/transações**. Não foram classificadas nem homologadas. A limpeza não comprova condições contratuais, recebimentos ou diferenças investigadas anteriormente.

## Preservação comprovada

- **18 obras na coleção operacional**, com todos os cadastros e parâmetros contratuais existentes; os **20 registros nativos de projetos**, incluindo registros adicionais do cadastro, também permaneceram intactos.
- **85 funcionários**, seus vínculos e os pontos; **2.075 registros nativos de ponto e 111 vínculos de funcionários** preservados por conteúdo.
- **Sete orçamentos e cinco planos**, além do Lookahead, medições técnicas, progresso, relatórios de obra e dados de aprovação não pertencentes aos pagamentos apagados.
- **19 contratos de terceirizados**, seus perfis e valores contratuais, sem alterar identificação, etapas ou condições.
- Cadastros dos equipamentos e **201 locações / seis manutenções** na fonte operacional. As **157 alocações e um registro de manutenção nativos** existentes também foram preservados integralmente.
- Materiais, fornecedores, usuários, configurações salariais e empresariais, solicitações de compra e cotações não foram apagados.
- **Quatro movimentos de estoque físico**, mantendo IDs, quantidades, valores, datas, obras e materiais. Em dois movimentos foram desligadas somente as referências aos pedidos/itens/recebimentos apagados; os vínculos originais estão no backup e na auditoria do reset. Nenhum estoque foi baixado por confundir pagamento com movimentação física.

Foram comparados **34 campos protegidos** e todas as **22 linhas separadas de domínio que não precisavam de alteração**. Cadastros nativos protegidos foram relidos e comparados integralmente. Auditoria e registros de idempotência anteriores foram mantidos; a limpeza acrescentou seu próprio registro de auditoria e comprovante de execução.

## DRE e caixa em cada etapa

1. **Antes:** captura da origem real e das tabelas relacionadas, sem transportar correções locais antigas para a produção.
2. **Simulação por obra:** 648 projeções mensais, cobrindo 18 obras e 36 competências de 2025–2027. Lançamentos de faturamento, recebimentos, despesas, compromissos e pagamentos selecionados retirados; mão de obra, benefícios e equipamentos comparados com os valores anteriores.
3. **Simulação da empresa:** 36 competências conferidas; preservados os cálculos de pontos e da operação de equipamentos.
4. **Transação real:** exclusões e atualização da origem realizadas juntas, com bloqueios, controle de revisão e conferência de conteúdo nativo; nenhuma etapa financeira intermediária foi publicada.
5. **Após:** dados reais relidos e **648 projeções por obra + 36 da empresa idênticas à simulação**, com zero divergência.

**O DRE continua com os cálculos das fontes que o usuário preservou.** Os custos dos pontos e dos equipamentos permanecem. A operação de equipamentos também mantém seus reflexos internos de receita no consolidado; esses cálculos não foram transformados em novos recebimentos bancários. A receita operacional de equipamentos preservada soma R$ 63.839 nas 36 competências verificadas. Valores contratuais, backlog e orçamento/planejamento continuam como previsão; a limpeza não os converte em resultado realizado.

O razão de lançamentos financeiros da base limpa retornou **zero eventos e zero pendências**, antes da inclusão dos cálculos derivados de ponto/equipamentos. As tabelas financeiras nativas foram conferidas vazias. Não houve aprovação ou homologação de fechamento.

## Backup e proteção da operação

Backup criptografado completo e verificado com **6.757 registros**, incluindo todas as colunas das 23 linhas de origem e os registros nativos relacionados. Local privado, fora do repositório:

`C:/dev/marcell-local-review/zeragem-financeira-20261115/`

Arquivo principal: `pre-reset-complete.backup`; manifesto e chave de recuperação ficam no mesmo diretório privado e **não foram enviados ao Git nem à Vercel**. SHA-256 do arquivo: `bd5df6f2cff9413cb79e1aed5dce49c252e6a79de76a1e4e2105bfa9f4166585`.

Uma mudança de revisão foi detectada durante a preparação. O conteúdo foi comparado e permaneceu igual; a revisão e o backup foram atualizados antes da aplicação, sem substituir alterações de conteúdo. O teste inicial recusou a versão antiga. Uma leitura integral de auditoria excedeu o tempo de consulta; como auditoria e idempotência não seriam apagadas ou reescritas, foram mantidas fora desse backup financeiro e preservadas na base, acrescidas apenas do registro da operação.

**Sete testes passaram em PostgreSQL descartável via PGlite:** revisão antiga bloqueia tudo; conteúdo nativo divergente bloqueia tudo; falha depois das exclusões reverte também a origem; limpeza no escopo correto; outra empresa preservada; reexecução não repete a operação; restauração recompõe as tabelas e a origem a partir do backup criptografado.

A aplicação real utilizou uma única transação, com todas as exclusões limitadas à empresa `arcd` ou aos filhos comprovadamente pertencentes a ela. A auditoria registra a solicitação explícita do usuário, o hash do backup, as contagens removidas e as referências de estoque desligadas. Uma segunda execução com a mesma identificação é inócua.

## Sincronização, documentos e próximos passos

A simulação do sincronizador após a limpeza produziu **zero fatos financeiros e zero transações bancárias para recriar**. A busca por referências operacionais ativas aos lançamentos removidos retornou zero; históricos de auditoria/idempotência continuam como histórico. Não havia publicação nativa de portal do cliente para invalidar nessa captura.

A pendência contratual da **W1-22 não foi solucionada por suposição**. Seus lançamentos antigos foram removidos junto com os demais, conforme o novo escopo, e permanecem documentados nos relatórios e no backup. O mesmo vale para as investigações R1-16, CA1-13, PC-0003 e demais hipóteses: passam a compor o histórico anterior à limpeza, não uma fila para reaplicar na base ativa.

**Não restaurar automaticamente snapshots ou correções financeiras de rodadas anteriores.** Antes de gerar novas cobranças, revisar os parâmetros contratuais/datas que permaneceram nos cadastros, especialmente as divergências documentais já identificadas. O início de nova movimentação deve usar os registros preservados de orçamento/planejamento, contratos e custos, evitando reimportar o histórico removido como se fosse dado novo.

Ao voltar ao app, recarregar a página para consultar a base atual. Não foi feita nova publicação, commit, push ou alteração de código do app nesta limpeza. Ajuda/manual não precisam de alteração de fluxo: foi uma operação sobre dados, com os controles existentes; as alterações preexistentes do checkout foram preservadas.

Evidências locais: `artifacts/zeragem-financeira-20261115/backup-summary.json`, `simulation-summary.json`, `transaction-tests.json`, `transaction-receipt.json`, `verification.json` e `resync-proof.json`. Dados detalhados e SQL com valores reais permanecem somente no diretório privado do backup.
