# Reconciliação da K1-04 e pacote integrado — somente local

> A etapa local foi encerrada com suíte completa, catálogo público e recuperação em base nova conferidos no [aceite final local](ACEITE-FINAL-LOCAL-SEPARACAO-EMPRESAS-20261118.md). As limitações dos espelhos iniciais abaixo são históricas; o aceite final distingue o que foi validado e o que depende da nuvem.

Revisão: 18/11/2026. Autorização: reconciliar R$ 200 e atualizar o pacote com o código integrado, preservando a limpeza da ARCD e a MRC. Não houve acesso à nuvem, mensagem, push, PR, commit ou publicação nesta etapa.

## Correção e efeito no DRE

A captura anterior identificou duas marcações da K1-04 em 12 e 13/11/2026, alteradas de presença para falta. A reconciliação usa os IDs exatos da obra e da pessoa e valida as células completas. Identificadores pessoais e provas integrais permanecem fora do repositório.

Foram corrigidas somente essas duas células na fonte operacional e nas linhas persistidas principal e por obra. A ARCD passou da revisão 1 para a revisão 2. O índice de acesso original da ARCD foi preservado exatamente. A MRC permanece na revisão 1, byte a byte idêntica à prova anterior, com I-8, K1-10 e o responsável técnico já conferido.

Em novembro de 2026, o custo de mão de obra da K1-04 e o custo consolidado da ARCD diminuem R$ 200; o resultado líquido consolidado aumenta R$ 200. As diferenças numéricas ficam restritas a esse mês, à obra e ao consolidado, com reflexos nos subtotais e margens. A conferência das 240 combinações de obra/consolidado e mês coincide integralmente com a captura mais recente após simular somente a limpeza já autorizada.

Isso corrige custo reconhecido pelo ponto. Não cria previsão, compromisso, estoque, receita, título, recebimento ou pagamento para compensar o delta. Os três movimentos sem conta e os valores gerados pela conciliação continuam removidos. A melhora de R$ 800 da limpeza anterior não foi aplicada novamente. Tabelas financeiras nativas, lançamentos preexistentes, fotos e pastas locais foram preservados. Nenhuma conta bancária foi criada ou inferida.

## Pacote vigente

Diretório privado vigente: `C:/dev/marcell-local-review/company-isolation-20261118/cutover-package-integrated-k104-v2/`.

Identidade: `09a01ff953711d6608f45fe40cf7d02d46a2b125d0b8aefd0365bd65715693fd`. A primeira versão integrada (`af214e26…`) também foi conservada como evidência histórica.

O pacote anterior em `cutover-package-validated/` foi preservado como evidência histórica. Esta preparação usa a captura local mais recente: 76 tabelas, todas as chaves primárias observadas, 59 relações capturadas e 10.301 eventos de auditoria no corte imutável. As releituras não equivalem a uma única transação MVCC de produção.

O preparador valida a cadeia: prova original da limpeza e do responsável técnico → estado anterior exato da ARCD → transformação autorizada → hash da revisão 2. Continua exigindo o hash original da MRC. Provas antigas não foram reescritas para aparentar a mesma revisão ou captura. Ausência dessa cadeia, mudanças extras ou origem divergente recusam a preparação.

Inclui origem, plano, estados, catálogo capturado e provas; quatro arquivos externos imutáveis; 152 arquivos verificados por hash; 1.992 arquivos de código/configuração/assets, incluindo 107 CSS, temas integrados, API, fontes/assets existentes, Vite e lockfile. Não inclui arquivos de ambiente nem credenciais. As presenças voláteis de sessão conservam os valores capturados.

O rascunho vigente contém diferenças em 18 tabelas. Os cinco registros legados de `app_data`, `app_data_import_backups` e `user_app_data` permanecem integralmente na imagem anterior privada. Não recebem empresa por inferência nem entram no destino operacional limpo. A destinação definitiva exige revisão explícita de propriedade e do arquivo privado antes da publicação. A auditoria externa é conservada sem UPDATE/DELETE sobre eventos append-only.

A revisão posterior rastreou os outros 46 registros até `server/ponto-eletronico/handler.js`: são medições do relógio do servidor, usadas tanto pela fonte de hora quanto pela consulta de status. A tabela `ponto_tempo_verificacoes` não tem campos de empresa, obra ou pessoa. O preparador agora preserva essas medições globalmente, sem atribuí-las às empresas ou duplicá-las. Recusa uma mudança no conjunto permitido de colunas ou a introdução de escopo empresarial nessa tabela. Ela não aparece mais nas exclusões nem no arquivo legado pendente. Isso preserva a evidência de hora já existente; não executa uma nova medição NTP ou conexão de rede. Sem impacto em custo, pagamento ou DRE.

## Validação e recuperação

`cutover-validation-integrated-k104-v2/validation.json` aprovou 16 verificações: bloqueio do SQL real, falha injetada com reversão integral, aplicação e DRE, repetição sem duplicação, recibo único, RLS, imagens privadas, recusa de dados posteriores e restauração limpa em base isolada vazia.

Esse primeiro modelo é um espelho relacional no PGlite, com PK/FK capturadas e RLS de negação. O catálogo completo observado está no pacote como evidência.

O ensaio adicional `cutover-validation-captured-types-k104-v3/validation.json` passou em 14 verificações, incluindo aplicação, falha com reversão, repetição e recuperação do mesmo pacote. Reproduziu 76 tabelas, 748 colunas com os tipos capturados, 601 campos obrigatórios, 127 CHECKs, 26 restrições UNIQUE, 76 chaves primárias e 57 relações internas, além dos modos de identidade capturados. O DRE foi preservado na aplicação e na restauração. A tentativa inicial parou antes da carga por falta de suporte às três identidades dos catálogos de orçamento; o ensaio passou após reproduzir explicitamente o modo `BY DEFAULT` observado. As provas das tentativas foram mantidas em diretórios separados.

Ainda não reproduz defaults/posições de sequências, gatilhos, funções, índices adicionais, políticas reais, Auth ou Storage. As duas FKs externas para Auth não foram exercitadas. Os quatro arquivos externos permanecem conferidos no pacote, sem carga artificial como tabelas nativas completas. Os dois ensaios usam RLS de negação; não certificam autenticação real por empresa nem o esquema integral de produção.

`operations/k104-reconciliation-20261118/final-checks-v2.json` aprovou 27 itens, incluindo transformação exata, MRC e arquivos inalterados, limpeza, DRE coincidente com a captura, rejeição de provas adulteradas, pacote anterior intacto, retenção privada dos cinco registros legados e preservação das evidências de hora.

Para recuperação local, `operations/k104-reconciliation-20261118/before-arcd.json` conserva a revisão 1 limpa; há também o backup automático registrado na prova. A prova final é `verification-final.json`; o registro intermediário foi conservado para rastreabilidade. Conferir hashes e recusar sobrescrever mudanças posteriores. A recuperação da migração usa a imagem **limpa e separada**, em destino vazio; a imagem mista anterior serve apenas à evidência privada.

`apply.blocked.sql` e `recover-clean.blocked.sql` abortam antes de alterações em banco real. Somente o ensaio PGlite gera a variante executável em memória. Não remover esse bloqueio para publicar.

## O que falta para publicar

- Captura consistente no corte definitivo e nova conferência de concorrência, sem sobrescrever dados futuros.
- Validação do esquema completo, segurança real e restauração em ambiente isolado equivalente à produção.
- Arquivo privado da auditoria e revisão de propriedade dos registros sem empresa, sem exposição cruzada.
- Destinos OneDrive exclusivos para I-8 e BASE DE DADOS e permissões reais por empresa. As duas fotos continuam públicas na nuvem; o acesso privado foi somente preparado localmente.
- Autenticação e integrações efetivas das duas empresas, configuração fiscal da MRC e bases de orçamento.
- Backup/recuperação certificados e autorização explícita para publicação consolidada.

## Checkout, ajuda e verificações

Base integrada: `cd8d029f8e27a21ed0e57d9735f34651057f52d7`, mais as alterações locais preservadas. `npm run validate:local` passou: lint/UX/design/manual, arquitetura (1.791 módulos e 6.220 dependências), typecheck e build local. Não foi usado o prebuild com migrations.

`npx vitest run` nos nove arquivos de reconciliação, cutover, partição, limites por obra, limpeza bancária, integração financeira/DRE e financeiro/extrato do portal passou com 66 testes, sem falhas ou pulos. Inclui a preservação da hora e a recusa de campos empresariais nessa evidência. A suíte inteira do repositório não foi repetida nesta etapa. A etapa anterior passou nos mesmos nove arquivos com 64 testes, e seu primeiro recorte de dois arquivos passou com 13 testes.

A revisão da ajuda/manual concluiu que esta etapa altera ferramentas de manutenção e dados privados, sem mudar controles ou fluxos do operador. As instruções existentes continuam válidas; `manual:check` confirmou 145 guias para 65 abas. Não houve alteração visual nesta etapa.

Resumo vigente sem dados pessoais: `artifacts/company-isolation/k104-reconciliation-infrastructure-summary.json`. O resumo anterior `k104-reconciliation-integrated-summary.json` permanece como registro histórico, assim como as provas e pacotes anteriores.
