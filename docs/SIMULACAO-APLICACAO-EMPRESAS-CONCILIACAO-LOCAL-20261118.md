# Simulação local da aplicação e limpeza de conciliação — 18/11/2026

Escopo autorizado: simular a aplicação da separação MRC/ARCD, pastas e fotos no ERP, conferir contas bancárias e disponibilizar a exclusão da conciliação com seus valores gerados. O usuário confirmou a remoção dos custos e pagamentos criados pela conciliação, preservando fatos preexistentes apenas vinculados. Nenhuma publicação ou mudança na nuvem foi realizada.

## Aplicação simulada

O comando `scripts/simulate-company-application.mjs` recebe `--plan`, `--proof`, `--prepared` e `--output`. Exige a prova da distribuição e o hash do manifesto das pastas/fotos. Cria um diretório novo, fora do repositório, com estados separados para as empresas, pastas locais e as duas fotos privadas. Não carrega credenciais, não executa SQL e não possui modo de aplicação remota.

O resultado vigente fica em `C:/dev/marcell-local-review/company-isolation-20261118/erp-simulation/`. A ARCD tem 16 obras, e a MRC tem I-8 e K1-10. I-8 e BASE DE DADOS recebem identidades de pasta exclusivas da simulação e diretórios distintos. As 22 categorias existentes foram preservadas. Há dez documentos da I-8 identificados por referências; os bytes desses documentos OneDrive não foram copiados nem simulados como arquivos reais. As duas fotos JPEG reais foram copiadas e tiveram seus hashes conferidos após a cópia.

`companies/arcd.json` e `companies/mrc.json` são arquivos privados da simulação, com a fotografia operacional e suas projeções relacionais. Esta implementação não representa uma migração SQL aplicada. O ERP local usa o contexto da empresa e os motores de DRE existentes sobre esses arquivos. Dados originais, planos de distribuição, preparação anterior, certificados de produção e objetos na nuvem permanecem intactos.

O preview aceita `--simulation <diretório>`, além de plano, prova e `--file-audit <diretório>/file-audit.json`. O cabeçalho de conteúdo mostra **Simulação local** em todas as áreas e informa que somente a limpeza da conciliação pode gravar nesta cópia. A consulta de pastas usa somente os diretórios locais e recusa drive/pasta de outra empresa. A indicação de conexão nesse modo identifica o provedor `local-simulation`; nenhuma sessão Microsoft é aberta. Os demais envios, uploads e conexões externas são recusados.

## Contas bancárias conferidas

A origem desta conferência é a captura anterior de 18/11/2026, concluída às 12h10 de Bahia. Não foi consultado novamente o banco publicado nesta etapa.

| Item na cópia | ARCD | MRC |
| --- | ---: | ---: |
| Contas no cadastro operacional | 0 | 0 |
| Contas na tabela nativa `bank_accounts` | 0 | 0 |
| Extratos | 1 | 0 |
| Movimentos sem conta definida | 3 | 0 |
| Movimentos conciliados | 2 | 0 |
| Movimentos pendentes | 1 | 0 |

Os três movimentos e seus equivalentes nativos não possuem conta cadastrada vinculada. Dados textuais de banco/conta no arquivo importado não foram tratados como prova de cadastro ou vínculo. Nenhuma conta fictícia foi criada. Os registros permanecem na ARCD, conforme a distribuição expressamente autorizada para registros sem obra. O relatório completo privado é `bank-accounts-review.json`, fora do Git.

## Opção de apagar

Na simulação, em Conciliação → apoio → Extratos, o administrador sem restrição de obra pode usar **Apagar conciliação e valores** ao lado de uma conta. Quando existem movimentos sem cadastro de conta, aparece **Apagar conciliação dos movimentos sem conta**. A opção não aparece no ERP normal, e a API de produção não ganhou um comando de exclusão nesta entrega.

A prévia do servidor identifica a empresa, conta/grupo, extratos, movimentos, valores gerados e efeito no DRE. Exige justificativa, digitação exata do nome solicitado e confirmação explícita. Fechar um formulário preenchido usa a proteção de alterações não salvas já existente. A ajuda contextual `conc_apagar_local` e o manual explicam o fluxo.

A limpeza executa primeiro a reversão dos vínculos pelo motor existente de conciliação. Só remove fisicamente da cópia ativa os registros comprovadamente criados pela conciliação, com tipo, ID e `transacaoId` coincidentes. Fatos preexistentes recebem apenas a retirada do vínculo. O cadastro da conta e as demais contas são preservados. Período fechado, competência fechada, vínculo parcial, transferência com outra conta, conta divergente do extrato, origem ambígua, valor compartilhado e dependência nativa protegida bloqueiam a operação inteira.

As projeções nativas correspondentes — bancos, títulos gerados, liquidações e vínculos — são removidas junto com a fotografia operacional. Liquidação nativa de fato preexistente exige revisão específica e bloqueia a limpeza automática. O verificador conferiu as 59 relações inventariadas sem encontrar referências pendentes após limpar a cópia de teste.

As gravações locais são serializadas. O servidor relê o estado e exige a mesma revisão da prévia. Antes de gravar, salva a cópia anterior em `backups/`, fora da área operacional, e substitui o estado por arquivo temporário seguido de rename. Uma chave idempotente permite recuperar resposta perdida sem repetir a exclusão ou gerar outra cópia de recuperação; reutilizá-la com conteúdo diferente é recusado. Nada disso envia operações ao banco publicado.

## Valores e DRE

O grupo sem conta contém uma entrada de R$ 4.000, uma saída pendente de R$ 980 e uma saída conciliada de R$ 800. A conciliação criou um recebimento de R$ 4.000 e uma despesa de R$ 800. A limpeza da simulação retira os três movimentos, um extrato e esses dois fatos gerados, além de suas projeções.

A despesa removida reduz o custo do DRE em R$ 800 e melhora o resultado em R$ 800. O recebimento de R$ 4.000 era caixa sem reconhecimento de receita; sua retirada reduz o caixa, sem reduzir receita reconhecida. A saída pendente de R$ 980 não era um novo pagamento ou custo realizado. Os custos de mão de obra e demais fatos independentes da conciliação permanecem. Não foi criado evento financeiro compensatório nem duplicado custo.

Antes da limpeza, a aplicação da separação e das identidades locais de arquivos preservou o DRE das 18 obras em cada um dos 12 meses de 2026, sem diferenças. O teste de limpeza é separado dessa validação: ele altera o DRE intencionalmente pelo fato de R$ 800 removido, como o usuário autorizou.

## Evidência e limites

`scripts/verify-company-simulation.mjs` compara o DRE antes/depois da aplicação e simula a limpeza em memória, sem gravar o estado entregue ao usuário. A prova privada é `erp-simulation-proof.json`. O resumo compartilhável fica em `artifacts/company-isolation/application-simulation-summary.json`.

Os testes de navegador usam cópias próprias e novas para desktop e celular, preservadas em `simulation-test-runs/`. Eles não apagam os três movimentos da simulação entregue ao usuário; a opção continua disponível para revisão em `http://127.0.0.1:4205/`. As capturas e possíveis traces com dados reais ficam fora do repositório em `simulation-review/`.

As duas fotos originais continuam públicas na nuvem, e a pasta OneDrive original continua compartilhada. A simulação local não comprova novas permissões na nuvem, não transfere documentos OneDrive e não habilita isolamento no ambiente publicado. A captura precisa ser atualizada e as pendências de acesso precisam ser resolvidas antes de uma implantação futura.

## Validação final

Foram aprovados 90 testes dirigidos em 11 arquivos, incluindo preservação de pagamentos preexistentes, remoção das projeções dos fatos gerados, proteção de período fechado, origem ambígua, identidade repetida, conta divergente e rateio múltiplo. Dois testes de navegador aprovaram o fluxo completo no desktop e no celular: separação 16/2, pastas exclusivas, consulta cruzada recusada, confirmação explícita, persistência após recarga, repetição idempotente e chave reutilizada com outro conteúdo recusada. As capturas finais foram revisadas visualmente, e cada execução de limpeza preservou exatamente uma cópia com os três movimentos anteriores. A conciliação automática permanece pausada na simulação.

Lint, design:check, manual:check, TypeScript e build local por `npx vite build` passaram, sem executar prebuild ou publicação. A prova final `erp-simulation-proof-final.json` aprovou a comparação do DRE e a integridade das 59 relações. A simulação entregue ao usuário permaneceu na revisão zero, com os três movimentos disponíveis para conferência. A divergência preexistente da suíte ampla de PDF/e-mail continua registrada na documentação anterior; estes resultados são da validação dirigida desta alteração.

## Exclusão efetivamente autorizada na cópia entregue

Em solicitação posterior de 18/11/2026, o usuário autorizou apagar os três movimentos e os valores gerados na própria cópia local ARCD entregue. A operação foi executada e conferida; o estado atual é a revisão um, sem esses movimentos e valores. A MRC e os lançamentos preexistentes foram preservados. O histórico da execução e a prova vigente estão em `LIMPEZA-CONCILIACAO-ARCD-COPIA-LOCAL-20261118.md`. As referências acima à revisão zero descrevem a entrega inicial, não o estado atual.
