# Limpeza autorizada da conciliação ARCD — cópia local

Executada em 18/11/2026 após autorização expressa do usuário para apagar os três movimentos sem conta e os valores gerados pela conciliação, preservando lançamentos preexistentes, MRC e nuvem.

## Execução

A operação usou somente a API da simulação em `http://127.0.0.1:4205/`. A prévia confirmou os três IDs esperados, um extrato, dois valores gerados e ausência de bloqueios. A revisão do arquivo ARCD coincidiu com a prévia do servidor antes da confirmação. Não foram usados credenciais, SDKs, consultas ou comandos de escrita na nuvem.

Foram retirados da cópia ativa:

- Três movimentos sem conta: entrada de R$ 4.000, saída pendente de R$ 980 e saída conciliada de R$ 800.
- Um extrato e o histórico operacional correspondente.
- Um recebimento de R$ 4.000 e uma despesa de R$ 800, ambos comprovadamente criados pela conciliação.
- As projeções correspondentes: três movimentos bancários nativos, dois títulos gerados, duas liquidações e dois vínculos nativos.

A cópia local ARCD passou da revisão zero para a revisão um. Antes da gravação, o servidor preservou exatamente uma cópia de recuperação em `erp-simulation/backups/`. Seu SHA-256 coincide integralmente com o arquivo ARCD anterior à operação.

## Conferência

Quinze conferências posteriores passaram:

- A API do ERP apresenta os movimentos, extrato e valores gerados removidos; não foi apenas uma alteração em memória.
- Todas as demais seções operacionais e tabelas nativas permaneceram idênticas. As linhas separadas de outros domínios também permaneceram idênticas.
- Lançamentos preexistentes foram preservados; somente os IDs comprovadamente gerados foram retirados das coleções de recebimentos e despesas.
- O arquivo completo da MRC manteve exatamente o mesmo SHA-256, incluindo suas duas obras, dados e projeções.
- Plano de distribuição, captura original, preparação de arquivos e inventário de arquivos da simulação mantiveram os hashes anteriores.
- O inventário de 59 relações não apresentou referências pendentes nas tabelas locais verificadas.
- O DRE de cada uma das 16 obras ARCD permaneceu igual nos 12 meses de 2026. A alteração no DRE consolidado ocorreu somente em novembro.

A despesa removida reduziu o custo consolidado de novembro em R$ 800, melhorando o resultado líquido em R$ 800. Faturamento das obras, receita de locações, receita corporativa, faturamento total e receita líquida permaneceram iguais. A retirada do recebimento de R$ 4.000 alterou apenas o caixa; a saída pendente de R$ 980 não era custo ou pagamento realizado. Foram retiradas do caixa a entrada de R$ 4.000 e a saída realizada de R$ 800, mantendo os demais fatos independentes.

## Provas privadas e situação atual

Diretório da operação: `C:/dev/marcell-local-review/company-isolation-20261118/erp-simulation/operations/arcd-cleanup-authorized-20261118/`.

- `preflight.json`: escopo, revisão esperada, hashes e confirmação autorizada, sem token de sessão.
- `applied.json`: confirmação da API e da criação da cópia de recuperação.
- **`verification-final.json`**: prova vigente das 15 conferências, comparação do DRE e caminho da recuperação.

A primeira conferência usou um nome de campo de receita inexistente no demonstrativo consolidado e gerou um resultado negativo apenas no verificador. A conferência foi corrigida para os campos reais do consolidado e repetida em modo somente de leitura. A exclusão não foi repetida. O arquivo anterior `verification.json` foi preservado como registro técnico; o resultado vigente é `verification-final.json`, com todas as conferências aprovadas.

O resumo sem caminhos privados ou resultado líquido absoluto fica em `artifacts/company-isolation/arcd-local-cleanup-summary.json`. As provas iniciais da simulação continuam sendo históricas da revisão zero; elas não devem ser usadas como descrição do estado atual. Agora a cópia entregue está limpa, e o usuário pode atualizar a página para consultar o DRE atualizado.

Esta foi uma operação sobre dados locais, sem mudança de código ou fluxo do aplicativo. A ajuda e o manual existentes continuam descrevendo corretamente a limpeza, os bloqueios e a preservação da cópia anterior; não houve necessidade de alterar instruções do operador. Nenhum push, publicação, deployment, migração SQL ou alteração na nuvem foi realizado.
