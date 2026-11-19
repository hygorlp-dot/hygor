# Separação ARCD/MRC — pacote local de migração e recuperação

> Registro histórico da primeira preparação. O pacote vigente e a correção de R$ 200 da K1-04 estão em [Reconciliação e pacote integrado](RECONCILIACAO-K104-PACOTE-INTEGRADO-LOCAL-20261118.md). O pacote descrito abaixo foi preservado.

Preparação de 18/11/2026. O pacote e o ensaio PostgreSQL foram feitos somente no computador. A cópia operacional local não foi migrada novamente nem recriada. A limpeza da ARCD e a inclusão do responsável técnico da MRC continuam preservadas. Não houve conexão ao projeto hospedado, execução de migração na nuvem, alteração de pastas/fotos remotas, envio de mensagem, push ou publicação.

## Entrega e limite de ativação

O pacote privado vigente fica em `C:/dev/marcell-local-review/company-isolation-20261118/cutover-package-validated/`. Contém:

- `bundle.json`: origem esperada, destino limpo por empresa, chaves, dependências, hashes de DRE e pendências.
- `apply.blocked.sql`: rascunho de aplicação transacional, com bloqueio explícito de execução real.
- `recover-clean.blocked.sql`: rascunho de restauração do destino limpo em base isolada, também bloqueado.
- `package-files.json`: hashes dos artefatos SQL/JSON. O ensaio também regenera e compara o SQL com o código conferido.
- `evidence/`: cópias independentes das provas e dos estados autorizados.
- `immutable/`: cópias integrais dos quatro arquivos externos, incluindo auditoria e catálogos.
- `files/`: 152 arquivos locais inventariados, copiados e conferidos por hash; isso não cria novas referências operacionais.
- `runtime/`: cópia de 1.630 arquivos de código/configuração/lockfile usados para reproduzir o ensaio, sem arquivos de ambiente ou credenciais de conexão.
- `preparation.json`: contagens das operações e bloqueios pendentes.

O resultado é `localOnly: true`, `remoteWrites: 0`, `activationReady: false`. Não existe executor por URL de banco neste fluxo: a aplicação executável aceita somente uma instância local de PGlite. Os rascunhos SQL abortam antes de criar tabelas ou alterar dados. Não remover esse bloqueio para tentar publicar; é necessário fechar as pendências e preparar outro pacote a partir do corte real.

## Origem, destino e preservação financeira

A origem é a captura privada já conferida, com 71 tabelas inventariadas. Seu histórico de auditoria tem corte anterior ao término da captura; ela não é declarada uma fotografia consistente e atual para execução definitiva. O destino parte dos arquivos operacionais autorizados: ARCD revisão 1, já limpa; MRC revisão 1, com quatro usuários e o responsável técnico existente nas duas obras.

O preparador exige os hashes da prova do vínculo técnico e da ARCD preservada, além da prova da limpeza. Se a cópia mudar, recusa preparar por cima. As identidades continuam sendo os IDs existentes: I-8 e K1-10 na MRC, demais 16 obras na ARCD. Não há associação por nome parecido, novo cadastro de pessoa ou cópia de fatos financeiros para as duas empresas.

A limpeza continua removendo somente os três movimentos sem conta, um extrato e dois valores comprovadamente gerados pela conciliação. Os títulos, liquidações e vínculos nativos correspondentes também não voltam ao destino. Não há cadastro bancário operacional ou nativo em nenhuma das duas cópias. Nenhuma conta é inferida da descrição de um extrato.

Todas as seções operacionais, exceto obras/usuários/metadados do simulador, são comparadas integralmente por hash com a cópia limpa. Os perfis são conferidos separadamente. Orçamentos, previsões, compromissos, estoque físico, custo reconhecido e pagamentos conservam os fatos existentes. O pacote não cria lançamento para compensar saldo nem transforma previsão em custo realizado.

O DRE é comparado nas 18 obras e nos dois consolidados, nos 12 meses de 2026: 240 combinações. Foram preservados os campos numéricos dos demonstrativos e os fatos das fontes. O ajuste de responsável e a migração não geram novo impacto no resultado. A melhora de R$ 800 no resultado ARCD em novembro pertence à limpeza já autorizada, e não é aplicada uma segunda vez. O recebimento de R$ 4.000 removido continua sendo efeito de caixa, sem redução automática de receita reconhecida.

O saldo do portal continua com a regra de data já conferida: no cenário de teste, R$ 8.620 até 17/11 e R$ 13.620 em 18/11, por causa do aporte efetivo de R$ 5.000. A migração não altera essa regra, o PDF ou o rascunho de e-mail.

## Estratégia transacional preparada

O rascunho contempla alterações em 14 tabelas. Confere chaves globais e compostas e ordena a inclusão dos pais antes dos filhos; as exclusões seguem a ordem inversa. Não desativa gatilhos, não altera `session_replication_role` e não supõe que `SET CONSTRAINTS` consiga adiar uma restrição não adiável.

A transação bloqueia as tabelas gerenciadas em ordem estável, com prazo de espera, e compara o conjunto completo esperado das duas empresas. Linha nova, ausente ou alterada exige nova conferência. Depois aplica o diferencial, confere o destino e grava recibo e imagens privadas na mesma transação. Uma repetição só é aceita quando o destino ainda corresponde ao pacote; alterações posteriores são preservadas e a repetição é recusada.

O índice compacto de acesso recebe todos os metadados persistidos necessários. Linhas alteradas têm uma nova versão de atualização, preservando a conferência de concorrência. O primeiro ensaio com os dados reais detectou metadados ausentes nesse índice; a transação recusou o resultado e reverteu tudo. O preparador foi corrigido e o ensaio repetido com sucesso.

As imagens anteriores de históricos agregados ficam privadas, sem serem colocadas no histórico operacional das duas empresas. As 10.286 linhas externas de auditoria são preservadas integralmente; não há tentativa de editar ou apagar eventos append-only. A implantação real do arquivo histórico privado e sua retirada das consultas operacionais ainda precisa ser implementada/conferida no esquema real. O rascunho permanece bloqueado por esse motivo também.

IDs `local:*`, drives `local-*` e o marcador do simulador são removidos do candidato de banco. Os vínculos de nuvem capturados são conservados apenas como referência de origem. Isso não resolve a pasta compartilhada: os destinos reais exclusivos e as fotos privadas ainda precisam ser conferidos e vinculados antes de qualquer ativação. O pacote não finge que os diretórios locais são pastas OneDrive reais.

## Ensaio realizado e limites

A prova vigente fica em `C:/dev/marcell-local-review/company-isolation-20261118/cutover-validation/validation.json`.

O ensaio final aprovou 16 verificações transacionais e de recuperação. O resumo sem dados pessoais ou valores absolutos de resultado está em `artifacts/company-isolation/cutover-preparation-summary.json`, com a identidade do pacote e o hash do manifesto de artefatos.

O ensaio usa o PostgreSQL do PGlite com um espelho relacional das chaves capturadas. Foram exercitadas 57 relações internas, chaves primárias e regras de negação por RLS (segurança em nível de linha). Os demais campos preservam os tipos JSON capturados. Não é uma cópia certificada dos tipos, CHECKs, gatilhos, funções, políticas, índices adicionais, Auth ou Storage da produção.

As sete tabelas filhas vazias sem chave primária capturada continuam identificadas como pendência: `party_roles`, `journal_lines`, `party_identifiers`, `goods_receipt_items`, `purchase_order_items`, `supplier_invoice_items` e `reconciliation_candidates`. Não foi inventada uma chave para liberá-las. Os quatro arquivos externos foram conferidos integralmente por contagem, identidades e hashes, e não carregados como se fossem tabelas nativas completas do espelho.

As verificações do ensaio incluem: bloqueio do SQL de produção, reversão integral após falha provocada no meio da aplicação, aplicação com DRE preservado, repetição sem duplicar recibo, recusa de alteração posterior, RLS para `anon` e `authenticated`, negação do arquivo privado, restauração limpa em outra base vazia, DRE restaurado e repetição da recuperação. Uma base preenchida não é sobrescrita pela recuperação.

Passaram 73 testes dirigidos em 12 arquivos, incluindo nove cenários novos de migração/catálogo/recuperação e as regressões de separação, conciliação e portal. Também passaram lint, design, manual e TypeScript. A coleta SQL de catálogo foi executada somente no espelho local e confirmou transação de leitura. Não foi executado `npm run build`/prebuild, que contém operações remotas.

Não houve alteração de tela, controle, regra ou resultado mostrado ao operador. A ajuda e o manual foram revisados e continuam descrevendo corretamente a simulação e a limpeza; `manual:check` confirmou 145 guias sincronizados. Esta preparação técnica não cria um botão de migração nem promete migração ativa no app.

## Sequência necessária no corte real

1. Autorizar separadamente a janela real e bloquear gravações do ERP, portal, ponto, integrações, filas e rotinas que possam produzir dados. Registrar o último evento e a configuração anterior; manter os acessos bloqueados durante a validação. Nada disso foi acionado nesta preparação.
2. Obter backup nativo completo e restaurável do banco, identidades globais, arquivos e configurações. Conferir a restauração em ambiente separado antes de tocar na origem. O JSON do app sozinho não cobre Auth, Storage e dependências globais.
3. Capturar a origem de forma consistente e atual, junto com o catálogo. O arquivo `scripts/sql/company-cutover-preflight.sql` prepara uma coleta somente de leitura de tipos, defaults, colunas geradas, PKs, FKs, restrições, gatilhos, índices, RLS, permissões e referências externas. Ele não foi executado no projeto hospedado.
4. Comparar todas as mudanças desde a captura anterior. Reconciliar os IDs exatos da limpeza com seus valores, origens, vínculos e versões atuais. Dependência ou recebimento novo bloqueia a remoção automática. Não reproduzir uma exclusão ampla com base em descrição, valor parecido ou ausência de conta.
5. Conferir permissões e identidades dos administradores, engenheiro e clientes nas duas empresas. Preparar dados fiscais/contatos e referências de orçamento próprios da MRC. Conferir integrações e remetentes por empresa, inclusive backup e ponto.
6. Concluir o arquivo histórico privado sem reescrever auditoria imutável. Conferir pastas e documentos por ID/conteúdo/ancestralidade; preparar raízes exclusivas. Copiar/verificar as fotos privadas e conferir a revogação dos links públicos antigos. Sem destino verificado, manter o acesso ao arquivo indisponível.
7. Gerar outro pacote com o esquema real certificado e os vínculos finais, mantendo a limpeza e o responsável já aprovados. Repetir aplicação, falhas, restauração, acesso e DRE nesse esquema. Validar os anos efetivamente envolvidos no corte, além da cobertura de 2026 desta preparação.
8. Somente então preparar a execução real, a instalação dos certificados de isolamento e a publicação consolidada. Os certificados não estão presentes neste pacote. A confirmação de prontidão deve vir das provas do corte, não da troca manual de uma flag.

## Plano de recuperação

| Situação | Procedimento | Critério para liberar |
| --- | --- | --- |
| Falha antes do commit | Abortar a transação. Os dados anteriores permanecem; recibo parcial não fica gravado. Manter a manutenção e investigar. | Nova captura e ensaio aprovados. O estado legado anterior pode conter dados mistos; não reabri-lo como operação separada. |
| Commit concluído, acesso ainda bloqueado | Conferir destino, recibo, arquivos e DRE. Se houver falha, restaurar a imagem **limpa e separada** em outra base isolada, com o esquema e os arquivos certificados. | ARCD limpa, MRC preservada, integridade e DRE iguais ao ponto aprovado; acessos e caminhos privados conferidos. |
| Existem gravações posteriores ao corte | Recusar a restauração por cima. Fazer nova cópia e reconciliar os eventos posteriores por identidade/versão antes de preparar outra tentativa. | Nenhuma gravação nova perdida, duplicada ou movida para outra empresa. |
| Falha de arquivos ou integração | Manter somente o recurso afetado bloqueado e as referências anteriores como evidência; não voltar a uma pasta compartilhada nem tornar a foto pública. | Hash, empresa, autorização e abertura privada comprovados. |
| Necessidade de voltar a versão do app | Manter o bloqueio operacional se a versão anterior não suportar duas empresas. Não recombinar os dados para fazê-la abrir. | Uma versão compatível com o estado separado e limpo passa na conferência. |

A imagem anterior, que contém o legado misto e valores anteriores à limpeza, é evidência forense privada. Ela não é o destino padrão de recuperação operacional. O ensaio de recuperação usa o estado limpo separado e recusa sobrescrever uma base com dados novos.

Para reproduzir **somente o ensaio local**, com o checkout correspondente aos hashes do pacote:

```powershell
node scripts/rehearse-company-cutover.mjs --package C:/dev/marcell-local-review/company-isolation-20261118/cutover-package-validated --output C:/dev/marcell-local-review/company-isolation-20261118/cutover-validation-outra-tentativa
```

O diretório de saída precisa ser novo. Divergência no código, dados, cópias, manifesto ou SQL exige nova preparação; o comando não busca dados na nuvem nem aceita URL de conexão.

Referências consultadas: [restrições adiáveis no PostgreSQL](https://www.postgresql.org/docs/current/sql-set-constraints.html), [bloqueios transacionais](https://www.postgresql.org/docs/current/sql-lock.html) e [RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). O changelog atual foi conferido; esta implementação não depende de comandos novos da CLI Supabase.
