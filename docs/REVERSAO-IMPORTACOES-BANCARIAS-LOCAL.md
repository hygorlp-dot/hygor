# Etapa 3B — reversão de importações bancárias

Implementação local de 14/11/2026. Escopo confirmado: extratos bancários; demais origens sinalizadas para revisão específica. Sem migração, operação em dados reais ou publicação. Contratos, cláusulas da minuta e bloqueio de emissão PDF/DOCX preservados.

## Origem e operação

O importador existente continua lendo CSV/OFX e calculando as chaves de duplicidade. A preparação canônica é compartilhada entre a prévia e o comando de importação; a prévia não carrega o roteador de mutações. Novos arquivos de até 2 MB são preservados byte a byte no próprio lote, junto dos IDs efetivamente importados. Cada movimento recebe versão inicial e registro dos campos originais. Não há novo cadastro de conta, obra, valor ou etapa.

Em Conciliação → Mais opções · extratos, regras e histórico → Extratos → Revisar reversão, a prévia mostra cada movimento e seu impedimento. Baixar original permite conferir a origem. O administrador sem restrição de obra informa a justificativa e confirma os movimentos elegíveis. Financeiro consulta sem executar. Outras importações e lotes antigos sem original ou manifesto exigem revisão; não se reconstituem vínculos por nome ou valor.

A prévia permanece na versão consultada. Atualizar prévia mantém o motivo, renova os resultados e exige nova confirmação. Falha conserva o texto; uma repetição com o mesmo conteúdo conserva a chave idempotente. Fechar com alterações pede decisão antes de descartar.

## Proteção e persistência

Somente movimentos ainda pendentes, íntegros desde a importação e nunca utilizados são elegíveis. São protegidos pagamentos, conciliações, rateios, vínculos atuais ou históricos, referências diretas, alterações, bloqueios e períodos fechados. Referências históricas continuam protegendo depois de um estorno. Contas indefinidas em períodos bancários fechados exigem conferência. Duplicidade ou inconsistência de IDs/manifesto bloqueia o lote.

O comando operacional `IMPORTACAO_BANCARIA_REVERTIDA` utiliza a persistência serializada existente, autorização no servidor, identidade autenticada, horário do servidor e controle de versões do lote e dos movimentos. Antes de gravar, reconfere todos os alvos. Uma mudança concorrente rejeita a seleção inteira, sem cancelamento parcial acidental. A execução pode cancelar os elegíveis de um lote misto, preservando os protegidos.

O cancelamento é lógico: movimentos, original, chaves e trilha permanecem. O lote registra versão, justificativa, operador, horário, IDs e recibo permanente da tentativa; o histórico registra cada movimento. Repetir uma confirmação não duplica eventos mesmo depois da poda dos recibos genéricos. A mesma chave com conteúdo diferente é rejeitada pelo domínio.

Snapshots não podem forjar manifesto/original, cancelar importados fora do comando, apagar ou reabrir movimentos revertidos, nem reescrever sua trilha. A conciliação também recusa utilizar um movimento revertido. As chaves de duplicidade permanecem: reverter não libera reimportação automática do mesmo arquivo. O arquivamento existente continua disponível sem remover a origem.

## DRE, previsão e caixa

A reversão não estorna custo, receita ou pagamento; elimina somente pendências bancárias sem uso. Não cria compromisso, posição física de estoque ou custo reconhecido. Os totais operacionais bancários desconsideram os cancelamentos; o razão financeiro, o DRE e o fluxo de caixa financeiro permanecem iguais.

A automação existente pode conciliar correspondências exatas depois de importar e produzir baixas. Esses movimentos já utilizados ficam protegidos nesta etapa: a reversão do lote não desfaz a baixa. Eventual correção precisa seguir o fluxo específico do fato financeiro. Não há reconhecimento duplicado nem cancelamento indireto de garantia, medição, pedido ou contrato.

## Pacotes e compatibilidade

Os limites e a baseline de interface permanecem. O build compartilha auxiliares idênticos de nomeação do Radix, preservando identidade, retorno e descritores de `Function.name`. O adaptador de gráficos mantém as implementações oficiais das escalas linear, band e point usadas pelo ERP. Não há eixo atual com escala personalizada. Um verificador de sintaxe rejeita novas escalas não suportadas, propriedades dinâmicas ou spreads de eixo que exigiriam revisão; uma chamada incompatível também falha explicitamente. Não é uma substituição geral da API D3.

A comparação de SVG renderizado do Recharts com e sem os adaptadores verifica igualdade exata; testes cobrem nomes, descritores, limites e bloqueios de novas configurações. Nenhum asset foi excluído da medição e o minificador global foi preservado.

## Evidências locais

- `artifacts/import-reversal-regression.log`: 1.621 testes em 176 arquivos, incluindo API real com banco simulado, autorização, versões, idempotência, origem, fechamento, snapshots, DRE e regressões de Contratos/fases anteriores. A repetição final inclui a correção compartilhada da legenda móvel e a proteção de conta indefinida em período fechado.
- `artifacts/import-reversal-browser.log`: 28 cenários desktop/celular com importação real de bytes OFX, download idêntico, pagamento protegido, reversão parcial, falha recuperável, mesma chave de tentativa, recarga, legado, Financeiro e regressão de Contratos, estoque, previsão e garantia. Repetições de captura são registradas separadamente, sem somar ao total.
- `artifacts/import-reversal-cold-build.log`: 208 verificações de inicialização do build sem falhas. `artifacts/import-reversal-cold-dev.log`: 133 telas desktop/celular verificadas em desenvolvimento. A primeira inicialização do servidor de desenvolvimento excedeu o tempo de navegação durante a compilação inicial; a repetição isolada concluiu sem falhas. Há aviso React prévio de chave duplicada no usuário da fixture, sem exceção de execução; não altera dados reais.
- Lint, design/manual, tipos, arquitetura e métricas registrados em `artifacts/import-reversal-*.log`. Ajuda contextual `conc_reverter` e manual revisados na mesma alteração.
- Capturas desktop/celular e parecer independente em `.impeccable/review/importacoes/`. Detector da introdução: `[]`. Revisão independente pediu corrigir a legenda estreita da tabela móvel; corrigida no FinancialPreview compartilhado, com plural da base comum e mesmas oito recapturas. Verdict Pass: achado resolvido, `ship` restrito à correção, sem certificação global do ERP.
- Builds locais padrão e com configuração de produção aprovados; global JS/CSS gzip **1.886.434 / 1.891.328 bytes**, financeiro **190.029 / 208.896**. Folga global de 4.894 bytes. Relatórios `bundle-metrics.json` e `artifacts/import-reversal/production-metrics.json`; limites e baseline intactos.

API e banco nos testes são simulados. Não houve upload, envio de mensagens, push, PR ou deployment. A validação local não substitui homologação operacional com a equipe.
