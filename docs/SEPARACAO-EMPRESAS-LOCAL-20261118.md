# Separação MRC e ARCD — implementação local

Pedido de 18/11/2026: K1-10 e I-8 pertencem à MRC; todas as demais obras existentes pertencem à ARCD. O usuário confirmou que I-8 é a obra inicialmente chamada I1-08 e autorizou manter todos os registros sem vínculo na ARCD. Administradores escolhem a empresa de trabalho. Nenhuma publicação ou alteração no banco de produção está incluída nesta entrega local.

## Origem e arquitetura

A origem existente usa `company_app_data(company_id,key)` com uma linha principal compactada, linhas por domínio, ponto por obra e arquivos de quinzena. Os cadastros relacionais, o motor financeiro, o portal e o ponto eletrônico também recebem `company_id`. Antes desta alteração, APIs e autenticação usavam uma constante de processo que normalmente valia `arcd`.

`server/company-context.js` resolve a empresa de cada requisição em AsyncLocalStorage. O contexto acompanha consultas, transações, auditoria, projeções e chamadas assíncronas sem variável global mutável. Valores desconhecidos, arrays e divergências entre corpo, query e cabeçalho são recusados. Os endpoints de dados, IA, presença/chat, referências, arquivos, consulta CNPJ, OneDrive e portal passam pelo contexto.

A autenticação consulta o operador ativo dentro da empresa selecionada. Escolher um identificador de empresa não concede acesso: o mesmo usuário precisa existir e estar autorizado no destino. Administradores ativos sem restrição de obra são preparados nas duas bases pelo planejador; operadores restritos seguem o vínculo comprovado. Papéis e autorizações operacionais existentes continuam sendo verificados.

## Troca no ERP

O cabeçalho compartilhado exibe Empresa. O administrador pode escolher ARCD ou MRC. Outros perfis veem a identificação da empresa sem comando de alternância. O destino é consultado e autenticado antes de adotar a troca. Falha preserva a origem. A troca é bloqueada durante formulários abertos, comandos, edições protegidas e envios pendentes.

Após sucesso, a área anterior é desmontada, a sessão ganha nova geração e respostas anteriores são recusadas. A nova área carrega os dados do destino. A obra em foco, navegação, consultas, filas locais e recuperação de edições usam o contexto de empresa. O PIN continua sem persistência no navegador; a sessão por e-mail conserva a empresa na sessão da aba.

## Arquivos e integrações

Novos uploads privados usam prefixo da empresa. O acesso patrimonial verifica esse prefixo; uploads de obra verificam a existência da obra no índice da empresa. Prontuários já possuíam prefixo por empresa. OneDrive usa conexão central por empresa, cookies vinculados à empresa e assinatura de arquivo com a empresa. O retorno OAuth recupera a empresa do estado selado. Configurar `ONEDRIVE_ROOT_FOLDER_URL_ARCD` e `ONEDRIVE_ROOT_FOLDER_URL_MRC` para as raízes autorizadas quando o isolamento estiver ativo.

Links novos de cotação, aceite e portal conservam a empresa. O portal mantém a empresa em navegação, consultas e downloads. Links antigos, arquivos públicos e anexos privados não mudam de proprietário apenas pela troca de `company_id`: precisam ser inventariados e conferidos na migração. Aparelhos de ponto também precisam apontar explicitamente para a empresa do seu pareamento; uma chamada antiga sem empresa continua no destino padrão e não ganha acesso ao cadastro da outra empresa.

## Preparação dos dados

`scripts/capture-company-partition.mjs --output <arquivo-privado-fora-do-repositório>` captura somente leituras. Se houver conexão Postgres, usa uma transação repetível e somente de leitura. Na alternativa pela Data API, bloqueia métodos de escrita e confere o conteúdo com segunda leitura. A captura não instala certificados nem executa migrações.

`scripts/plan-company-partition.mjs --input <snapshot> --manifest <distribuicao> --output <plano-novo>` prepara duas saídas independentes. Não conecta ao banco, não executa comandos financeiros e não substitui a origem. O resultado contém dados privados e deve permanecer fora do Git. O comando retorna código 2 quando existem pendências.

O snapshot contém `tables`, incluindo `company_app_data`, com linhas completas e `company_id` explícito. `sourceRows` também é aceito quando já contém esse identificador. A configuração de distribuição contém:

```json
{
  "mrcProjectIds": {"K1-10": "ID-exato-K1-10", "I1-08": "ID-exato-I1-08"},
  "config": {"arcd": {"companyName": "ARCD"}, "mrc": {"companyName": "MRC"}},
  "assignments": {"/company_app_data/arced_ponto_v1/despesasEmpresa/ID-da-despesa": "arcd"},
  "filesVerified": false
}
```

A configuração de cada empresa deve ser conferida por inteiro, incluindo identificação fiscal, contas, regras e integrações; não usar apenas o nome do exemplo. Sem IDs explícitos, o planejador exige exatamente uma obra com código ou nome igual a K1-10 e I1-08. Não resolve prefixos, semelhança de nome, descrição ou valor.

Pedidos, notas, títulos e pagamentos seguem referências tipadas e IDs existentes. Registros contendo vínculos das duas empresas são bloqueados. Ausência de vínculo exige distribuição explícita pelo caminho informado no relatório. Fatos operacionais e financeiros não podem ser copiados para as duas empresas. Unidades e fases são catálogos independentes em cada saída. Cadastros, saldos corporativos, documentos mistos, fechamentos e arquivos legados exigem revisão; nenhuma pendência é silenciosamente atribuída à ARCD.

## DRE e ativação

A mudança de contexto não cria receita, custo, título, movimentação física ou pagamento. A distribuição preserva os fatos, suas identidades, valores e competências. Previsão, compromisso de compra, estoque físico, custo reconhecido e pagamento continuam sendo etapas distintas. Não somar representações legadas e canônicas como fatos diferentes. Conferir o DRE por obra antes/depois e a composição das duas empresas, incluindo despesas corporativas, folhas históricas, rateios bancários e períodos fechados. Um fechamento antigo da empresa que inclua as duas construtoras não pode ser apresentado como fechamento exclusivo de uma delas sem tratamento específico e trilha auditável.

`COMPANY_ISOLATION_ENABLED=true` ativa a nova fronteira. Cada empresa precisa ter `marcell_company_isolation_v1` com versão 1, `companyId` correspondente e `status: verified`. Sem certificado, as APIs recusam operações com `COMPANY_NOT_READY`, inclusive chamadas que omitam empresa. Sem ativação, o ERP conserva o funcionamento anterior e recusa alternância para outra empresa. Não ligar a opção na base real antes de concluir a distribuição e a reconciliação.

O planejador só inclui o certificado em saídas sem pendências, com inventário completo declarado e arquivos conferidos. Essa saída é preparação local, não uma migração aplicada ou homologação da origem real. A execução transacional no banco real, o tratamento dos registros mistos, a adequação dos arquivos e a ativação dependem de uma etapa posterior expressamente autorizada. Nenhum script de migração foi conectado ao prebuild.

## Validação local

Ajuda compartilhada revisada em 18/11/2026 e manual regenerado. A orientação explica finalidade, preparo, troca, resultado e bloqueios. Os cenários automatizados de desktop (1440 px) e celular (390 px) usam dados fictícios e verificam obras exclusivas, retorno à empresa, preservação ao abrir a ajuda e ausência de gravações durante a troca. A conferência visual não substitui teste em aparelho real.

Resultados registrados:

- 110 testes aprovados em 32 arquivos na revisão de isolamento, DRE, concorrência, autenticação e integração do aplicativo legado. O teste de DRE usa o motor existente e compara a competência antes/depois da distribuição.
- A regressão dirigida de interfaces, sessão, arquivos, filas e portal também aprovou 97 testes em 23 arquivos; ajustes finais na conferência das respostas, no OneDrive e na proteção de editores aprovaram 27 testes em seis arquivos.
- Revisão de API e integrações: 269 testes aprovados e uma divergência preexistente em `api/client.test.js`, no cenário de PDF/e-mail do portal: custo esperado 8.620, obtido 13.620. A mesma divergência foi reproduzida com o conteúdo de `api/client.js` anterior à separação; os arquivos temporários desse controle foram removidos. Nenhum cálculo foi alterado para mascarar esse resultado.
- Build local (`npx vite build`), lint, design:check, manual sincronizado e checagem TypeScript aprovados. Não foi executado o prebuild nem criada publicação.
- A primeira tentativa de captura falhou ao ler `audit_events`. A continuação abaixo resolveu a captura por páginas menores e arquivos separados, preservando os bloqueios de ativação. Nenhum certificado foi instalado nem foi executada distribuição na base real.

Evidências visuais locais em `artifacts/company-isolation/results`, com capturas ARCD/MRC para desktop e celular. O ambiente publicado e seus dados permanecem sem ativação desta funcionalidade.

## Continuação com cópia real — 18/11/2026

As decisões confirmadas foram aplicadas por IDs exatos: K1-10 (`a5sjnopi5mmc`) e I-8 (`e6d0pvjv7twg`). O nome I-8 foi preservado. A despesa corporativa de R$ 800 em novembro, banco, comercial e patrimônio sem vínculo permanecem na ARCD. Três referências históricas a obras ausentes também foram mantidas na ARCD e registradas como avisos; nenhum vínculo foi inventado.

A captura somente de leitura foi concluída às 12h10 de Bahia, com 64 tabelas por empresa e 295.595 registros, incluindo catálogos de custos. Outras sete tabelas dependentes sem `company_id` foram verificadas vazias por seus vínculos. As 59 restrições relacionais foram inventariadas e conferidas dentro da mesma empresa. Referências de identidade a `auth.users` continuam externas às cópias e não conferem autorização operacional.

O histórico de auditoria foi limitado ao corte de 11h42 de Bahia: 10.286 linhas em arquivo separado de aproximadamente 614 MB. A lista de identidades e os resumos nativos de conteúdo antes/depois coincidiram. Os demais conjuntos passaram por releitura e comparação. Essa captura pela Data API não constitui uma transação única nem inclui eventos posteriores ao corte; uma ativação futura exige nova conferência da origem corrente.

Arquivos privados ficam fora do repositório em `C:/dev/marcell-local-review/company-isolation-20261118/`. Os resultados vigentes são `plan-review.json` e `proof-review.json`. O resumo sem dados pessoais fica em `artifacts/company-isolation/real-data-summary.json`. Histórico de auditoria, backups e projeções antigas permanecem arquivados na origem privada, sem serem reapresentados como fatos atuais de uma empresa.

A cópia ARCD contém 16 obras, 85 funcionários, cinco orçamentos e quatro planejamentos. A MRC contém duas obras, dois orçamentos e um planejamento. Cadastros auxiliares seguem referências tipadas por ID; apenas dependências comprovadas são reproduzidas quando necessárias. A MRC não herda identificação fiscal, contatos de aprovação ou pasta geral OneDrive da ARCD. Seus campos ficam vazios para configuração própria.

O verificador aprovou 38 conferências sem diferenças: DRE mensal de cada uma das 18 obras nos 12 meses de 2026, soma das empresas, despesas corporativas e identidades dos fatos financeiros. A separação não reconhece novo custo, receita, pagamento ou movimentação de estoque. Previsões e compromissos não são somados como custos realizados; os fatos financeiros não foram duplicados. As folhas históricas necessárias foram reconstruídas pelo mesmo fluxo de origem usado pelo servidor.

`scripts/company-partition-preview.mjs` abre a revisão em `http://127.0.0.1:4205/`, usando somente os arquivos privados e os motores locais. Há um administrador sintético local, seleção de Empresa e consultas de DRE. Gravações e integrações externas são recusadas; nenhuma chamada operacional é encaminhada à produção. O teste `e2e/company-data-review.spec.js` confere desktop e celular, 16 versus duas obras, consulta cruzada recusada, gravação recusada, contatos separados e escolha preservada após recarregar. Capturas reais ficam na pasta privada `review`.

A distribuição dos dados está conferida para revisão local. A ativação permanece bloqueada por dois controles: inventário de implantação completo e arquivos/integrações conferidos. Anexos e links existentes precisam de validação de acesso na nuvem; a cópia não altera permissões do OneDrive. Não foi instalado certificado, habilitado isolamento no ambiente publicado, executada migração, realizado push ou disparado build da Vercel. A execução de migração em produção não faz parte desta implementação local.

Validação final da continuação: 38 testes aprovados em 12 arquivos; duas verificações de navegador aprovadas (desktop e celular), capturas revisadas visualmente sem transbordamento horizontal; lint, design:check, manual:check, TypeScript e build local aprovados. Ajuda e manual explicam a decisão sobre registros anteriores sem vínculo. O problema preexistente de PDF/e-mail descrito acima continua registrado separadamente. A área local utiliza dados copiados e bloqueia gravação, mesmo quando um comando operacional aparece na interface compartilhada.

## Conferência de arquivos e integrações

A continuação autorizada em 18/11/2026 está em `CONFERENCIA-ARQUIVOS-EMPRESAS-LOCAL-20261118.md`. Os 152 objetos Storage (17.797.408 bytes) foram copiados e conferidos localmente; 94 hashes registrados coincidiram com os bytes. O conflito exato da pasta de I-8/MRC com BASE DE DADOS/ARCD foi identificado e impede certificação. Na revisão, os links externos ficam bloqueados e os arquivos Storage conferidos usam acesso privado local. O preview agora recebe também `--file-audit C:/dev/marcell-local-review/company-isolation-20261118/file-audit-complete-local.json`. A nuvem permanece sem alterações.
