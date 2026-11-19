# Comercial → Contratos — entrega local

Revisão: 13/11/2026.

O escopo autorizado desta entrega é cadastro, persistência, permissões, revisão e integração com Obras. **Emissão de PDF e DOCX desativada**, com aviso explícito e comandos indisponíveis. Não há composição de documento, substituição de variáveis contratuais ou geração de valores por extenso. As cláusulas da fonte não foram alteradas.

## Fluxo disponível

Em Comercial → Propostas e contratos → Contratos, a equipe pode pesquisar por número, título, cliente, obra ou modelo; filtrar situação e obra; e abrir filtros adicionais de responsável e intervalo de criação. Administradores também acessam Modelos de contrato.

Novo contrato abre sete etapas: Identificação; Contratantes; Contratada; Imóvel e obra; Condições comerciais; Prazos; Anexos e revisão. É possível iniciar sem obra. O cliente e a proposta vêm dos cadastros existentes; propostas precisam corresponder ao cliente. A cópia central da contratada é preservada. Declarações pessoais não são preenchidas automaticamente.

O servidor reserva a numeração no primeiro salvamento. Edições de rascunho são salvas após uma pausa; Salvar rascunho permite repetir uma tentativa. Falha conserva os dados no formulário, e o fechamento protege edições pendentes. Conflito de versão não é resolvido por sobrescrita: o operador recebe orientação para copiar sua edição e consultar a versão atual. Não há fila offline automática para contratos.

Enviar para revisão registra a autoria e a situação. Somente o administrador aprova, devolve com motivo, registra assinatura, cancela ou encerra. Após aprovação ou assinatura, alterações exigem Abrir nova revisão com motivo. A revisão anterior preserva seus dados e documentos, inclusive a via assinada. A consulta histórica apresenta rótulos de negócio; não expõe a estrutura JSON ao operador.

A duplicação permite escolher condições comerciais e prazos a reaproveitar. Cliente, obra, partes, anexos, datas, assinaturas e confirmações não são copiados. Em perfil restrito, o próprio escopo de obra continua obrigatório.

## Documentos externos e modelo

Para aprovar, o administrador precisa conferir externamente o documento para assinatura e os cinco anexos previstos. As referências são escolhidas entre revisões já cadastradas em Arquivos da mesma obra. Cada arquivo exige confirmação. Não há declaração automática de entrega ou recebimento. O atalho Abrir Arquivos da obra mantém a obra de origem.

A aprovação é registrada como conferência de documento externo, não como aprovação de um arquivo produzido pelo ERP. Depois, é possível registrar Aguardando assinatura e vincular a via assinada dos Arquivos, mediante confirmação manual das assinaturas. **Não há provedor de assinatura eletrônica integrado nem validação criptográfica das assinaturas nesta entrega.**

A área administrativa permite consultar o texto protegido, sem editar cláusulas ou publicar variantes, e manter o cadastro central da contratada. O texto completo é obtido por uma ação autenticada exclusiva de administrador, sem ser incorporado ao pacote JavaScript do cadastro. Falha de consulta oferece nova tentativa pelo componente padrão de carregamento.

Os contratos preservam identificação, versão e SHA-256 da fonte do modelo. O arquivo-fonte importado continua Em revisão. A conferência de um documento externo não publica uma variante ou uma nova versão do modelo. Pessoa jurídica, múltiplos contratantes e obra sem loteamento ficam sinalizados e bloqueiam aprovação porque não há variantes aprovadas disponíveis.

## Persistência e permissões

Não foi criada outra base de clientes nem alterado o armazenamento existente. Os novos agregados são `commercialContractRecords` e `commercialContractCompany`, na linha principal do ERP. A gravação passa pela autenticação, autorização, controle de versão, comando idempotente e auditoria de `/api/data` já existentes.

A implementação está em `src/domains/comercial/contracts/record-commands.js` e é conectada ao motor de comandos operacionais. O servidor substitui identidade, perfil e obra do ator pelos dados da sessão. O Comercial não pode marcar a conferência externa reservada ao administrador, mesmo enviando esse campo diretamente à API.

- Comercial e administrador preenchem, enviam para revisão, cruzam dados da obra e preparam nova revisão.
- Somente administrador decide uma revisão, registra mudanças finais de situação e mantém a contratada.
- Perfil restrito a uma obra não cria registro global nem consulta ou modifica outra obra.
- Documentos são resolvidos pela identidade da obra, documento e revisão; acesso à pasta é conferido no servidor.
- Contrato com documento protegido fora do acesso do leitor, inclusive em revisão anterior, não é exposto na projeção comercial.
- Gravação direta pelos caminhos de snapshot é bloqueada. Envio completo que omita esses agregados os preserva; não pode apagar o histórico.
- Obras com contratos vinculados não podem ser excluídas pelo comando de cadastro da obra.

Os contratos anteriores permanecem no fluxo legado, com identificação explícita. Não há conversão automática, alteração retroativa ou ativação de obra/parcelas pelo contrato de administração.

## Integração com Obras

| Cadastro da obra | Dado do contrato | Tratamento |
| --- | --- | --- |
| `id` | `obraId` | Vínculo por identidade |
| `clienteId` | `clienteId` | Divergência de cliente bloqueia o aproveitamento |
| `areaM2` | Área construída estimada | Compara e copia somente por seleção explícita |
| `address` | Endereço da obra | Mesma regra |
| `engineerId` | Referência ao responsável técnico | Não inventa CREA ou ART |
| `adminPercentage` | Taxa de administração | Não recalcula CGR ou teto |
| `contractValue` | Referência do valor cadastrado | Não equivale automaticamente a CGR, teto ou preço fechado |
| `contractStart` / `startDate` | Referência de início previsto | Não confirma início efetivo |
| `contractEnd` | Referência de conclusão cadastrada | Não fixa conclusão contratual definitiva |

Aproveitar dados selecionados da obra exige a mesma versão consultada e um rascunho salvo. A cópia perde confirmações de obra e condições comerciais para exigir nova revisão. A operação não grava o cadastro da obra nem altera valores negociados para ajustar um cálculo. CGR calculado é conferido por área × valor por metro quadrado; valor manual exige justificativa na aprovação.

## Ajuda e identidade

As telas usam PageHeader, WorkspaceNavigation, FilterBar, WorkspaceFilters, FormSection, Modal, LoadingState e controles compartilhados, preservando temas, densidade e toque. Não houve aumento da baseline do legado. A ajuda contextual usa `useHelpTopic`; os guias de contratos, editor e modelos foram revisados na fonte única, e o manual foi regenerado. O índice reserva o guia administrativo de modelos à área administrativa.

## Validação e limites

A evidência local fica em `artifacts/contracts/`. Os testes de navegador usam o build local com respostas de API isoladas e executam os motores reais de regra e escopo; não fazem upload de arquivos nem acessam banco real. Os testes do handler exercitam a persistência e a reabertura com o banco simulado do projeto, incluindo auditoria, idempotência, conflito e preservação dos agregados em snapshots. Não representam uma migração ou gravação em ambiente de produção.

A revisão visual cobre desktop 1440 × 1000 e celular emulado 390 × 844. Não substitui piloto em aparelho físico. As capturas de documentos são consultas do modelo, não PDFs ou DOCX emitidos.

O build e a verificação de tamanho de pacote passam, sem aumentar limites. A correção substitui o Dexie por IndexedDB nativo nos repositórios de confirmações, edições recuperáveis e operações de campo. Preserva nomes dos bancos, versões físicas, chaves, índices, isolamento de usuário, transações e a barreira contra gravação pelo protocolo antigo. Não exige apagar o armazenamento do navegador. Os valores anteriores e atuais estão em `artifacts/contracts/bundle-before.json`, `artifacts/contracts/bundle-after.json` e `bundle-metrics.json`.

Resultados finais: 339 testes de regras, permissões, projeção, handler e ajuda aprovados em 11 arquivos; oito cenários de navegador aprovados nos dois tamanhos; lint, TypeScript e build aprovados. O detector visual não apontou ocorrências nos alvos consultados. A revisão independente inspecionou 12 capturas e classificou os três ajustes solicitados como resolvidos: alinhamento dos filtros, carregamento compartilhado e histórico legível. Seu parecer não certifica o limite global de pacote.

Após a redução, o total de JavaScript/CSS passou de 1.905.268 para 1.874.632 bytes gzip, dentro do limite de 1.891.328. O bloco financeiro passou de 211.741 para 180.867 bytes, dentro do limite de 208.896. Não houve mudança na configuração de build, nas regras de medição ou nas dependências declaradas; Dexie continua disponível aos testes de compatibilidade, sem importação no código entregue ao navegador. A emissão de PDF/DOCX permaneceu indisponível em todos os testes. Não houve tentativa de contornar essa indisponibilidade.

A regressão da redução aprovou 499 testes em 29 arquivos, cobrindo Contratos, permissões, servidor, ajuda, filas e recuperação. Inclui reabertura de bases Dexie anteriores, preservação das versões 1 a 5 de confirmações, rollback de migração, concorrência, indisponibilidade e atualização bloqueada por outra aba. Lint (incluindo design e manual), TypeScript e arquitetura passaram. A ajuda foi revisada e o manual regenerado: a otimização técnica não muda os passos do operador. Nenhum componente, cláusula ou fluxo de Contratos foi alterado por esta redução.

No navegador, passaram os oito cenários de Contratos, os 56 de recuperação em desktop/celular e a navegação pelos módulos autorizados. A primeira execução do teste geral de navegação ainda esperava uma descrição da tela antiga de Contratos; a asserção foi atualizada para conferir o título, Novo contrato e o aviso de emissão indisponível. A repetição passou sem erros de runtime. Evidências: `artifacts/contracts/bundle-browser.log` (64 cenários aprovados e a asserção antiga identificada) e `artifacts/contracts/bundle-module-smoke.log` (navegação corrigida aprovada). Não foram usados serviços ou dados reais.

Tudo permaneceu local: sem push, pull request, deployment, migração de banco, upload de documentos reais ou publicação. Permanecem fora deste escopo a emissão de PDF/DOCX, variantes contratuais novas, edição/publicação de cláusulas, assinatura eletrônica e automação financeira a partir do contrato.
