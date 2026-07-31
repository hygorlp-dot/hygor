# Auditoria funcional, técnica e de produto — ARCD

Data: 22 de julho de 2026  
Base auditada: commit `d16a63c`  
Escopo: código-fonte, modelo de dados, APIs, autenticação, permissões, fluxos, navegação, integrações, build, dependências e prontidão comercial.

## 1. Parecer executivo

O ARCD já possui cobertura funcional ampla e coerente com uma construtora: comercial, orçamento, planejamento, execução, qualidade, compras, estoque, financeiro, RH, licenciamento, documentos, IA e portal do cliente. Os fluxos principais são demonstráveis e o build de produção compila.

O produto está apto para **piloto interno controlado**, com poucos operadores treinados, rotina de conferência e backup. Ainda não deve ser vendido como SaaS maduro para múltiplas empresas ou operações críticas sem corrigir os itens P0 deste relatório.

Principais razões:

- um usuário autenticado recebe todo o blob da empresa, mesmo quando a interface esconde setores;
- gravações comuns não aplicam autorização por coleção no servidor;
- o banco operacional ainda é majoritariamente um JSON único;
- não existe suíte automatizada de regressão;
- há múltiplas representações do mesmo evento financeiro;
- o bundle está grande;
- dependências antigas apresentam alertas de segurança;
- não há backup automático comprovado pelo repositório.

### Resultado resumido

| Dimensão | Avaliação | Observação |
|---|---|---|
| Cobertura funcional | Forte | amplitude superior a um MVP comum |
| Clareza por setor | Boa, com ressalvas | menu principal é claro; contexto global versus obra precisa de reforço |
| Experiência visual | Em evolução | identidade consolidada, mas monólito gera divergências locais |
| Integridade dos fluxos | Média | há controles, porém o financeiro possui múltiplos livros paralelos |
| Segurança de acesso | Insuficiente para venda | autorização por módulo não é aplicada a todo o payload no servidor |
| Concorrência | Média/baixa | merge por seção reduz conflitos, mas o blob continua sendo gargalo |
| Testabilidade | Baixa | nenhum teste automatizado encontrado |
| Desempenho | Médio | build funcional; bundle principal de 795,09 kB gzip |
| Prontidão comercial | Piloto | requer P0 e P1 antes de escala |

## 2. Método

Foram inspecionados:

- `src/App.jsx` — 33.175 linhas;
- `src/api.js` — cliente de sessão, dados e integrações;
- `api/data.js` — autenticação, carga, salvamento, merge e arquivos de ponto;
- APIs de IA, CNPJ, presença, referências, upload e Microsoft Graph;
- `server/data-codec.js`;
- `schema.sql`, `package.json`, `vercel.json` e README;
- estrutura das coleções criada por `DEFAULT` e `normalizeData`;
- perfis, menus e condicionais de permissão;
- build, testes e auditoria de dependências.

Validações executadas:

- `npm run build`: compilado com sucesso;
- bundle principal: 795,09 kB compactado;
- `npm test -- --watchAll=false --passWithNoTests`: nenhum teste encontrado;
- `npm audit --omit=dev`: 29 alertas, sendo 14 altos, 6 moderados e 9 baixos.

O `npm audit` inclui principalmente a cadeia antiga do Create React App, mas também aponta `xlsx` em tempo de execução. A severidade precisa ser tratada pela possibilidade de planilhas não confiáveis serem importadas.

## 3. Inventário funcional

### 3.1 Setores e módulos

| Setor | Módulos atuais |
|---|---|
| Administração | auditoria, resumo por IA, usuários, permissões e presença |
| Painel | dashboard e Modo TV |
| Engenharia | obras e módulos internos da obra |
| Compras | compras, suprimentos e estoque |
| Financeiro | DRE Empresa, DRE Obras, gestão financeira, conciliação, medições, caixa e relatórios |
| RH | equipes, ponto, gestão do ponto, folha e rescisão |
| Comercial | dashboard, indicações, leads, funil, jornada, agenda, reuniões, tarefas, propostas, negociações, contratos, clientes, parceiros, metas, perdas e relatórios |
| IA | agente e configuração Gemini |
| Ajustes | cadastros, configuração e telas antigas |

### 3.2 Coleções principais

O estado normalizado contém, entre outras:

- obras, clientes, usuários, funcionários e terceiros;
- orçamentos, composições, materiais e bases favoritas;
- planos, RDOs, conferências e qualidade;
- solicitações, cotações, pedidos, fornecedores e estoque;
- medições, pagamentos, notas, extratos, transações, caixas e despesas;
- equipamentos, locações e manutenções;
- condomínios e licenças;
- histórico de auditoria e permissões.

## 4. Auditoria de clareza setorial

### 4.1 Pontos positivos

- o menu lateral está agrupado por setores reais da empresa;
- a Engenharia começa pela obra, reduzindo submenus duplicados;
- a obra aberta agrupa Obra, Qualidade, Suprimentos, Financeiro, RH e Recursos;
- o Financeiro separa Visão, Pagamentos, Administrativo, Notas e IA;
- Engenheiros recebem dashboard orientado a pendências;
- o Modo TV é separado da operação;
- o contexto da obra é reaproveitado ao navegar para seus módulos.

### 4.2 Ambiguidades restantes

| Situação | Risco | Recomendação |
|---|---|---|
| Compras existe globalmente e dentro da obra | operador não percebe se está no portfólio ou em uma obra | exibir sempre um chip `Todas as obras` ou o nome da obra |
| Financeiro possui várias telas relacionadas | lançamento pode começar em Compras, NF, Caixa ou Conciliação | definir a Central de Pagamentos como porta oficial de saída |
| Cadastros gerais mistura entidades de setores | usuários não sabem onde está a fonte mestre | separar catálogo, pessoas, parâmetros e bases |
| Telas antigas continuam acessíveis | dois caminhos para a mesma intenção | manter apenas para Administração até remoção |
| Orçamento aparece global e por obra | risco de editar o orçamento errado | exigir cabeçalho persistente da obra e bloquear salvamento sem obra |
| Termos “Medição” e “Medições” | pode confundir avanço técnico, cobrança e terceiro | usar “Avanço técnico”, “Contas a receber” e “Medição de terceiros” |

### 4.3 Taxonomia recomendada

- **Comercial:** captar, qualificar, propor, contratar e transferir.
- **Engenharia:** planejar, executar, registrar e medir avanço.
- **Qualidade:** inspecionar, corrigir e aceitar.
- **Suprimentos:** solicitar, cotar, pedir, receber e estocar.
- **Financeiro:** conferir documento, pagar/receber, conciliar e apurar.
- **RH:** cadastrar, lotar, apontar, pagar e desligar.
- **Recursos:** equipamentos, licenciamento, arquivos e portal.

## 5. Duplicidades e fontes de verdade

### 5.1 Clientes — média

**Achado:** o cliente mestre está em `comercial.clientes`, mas a obra também guarda `clienteId` e `cliente`. Contratos guardam `clienteId` e `contratante`.

**Efeito:** o nome pode ser alterado em Clientes e permanecer antigo na obra ou contrato.

**Decisão recomendada:**

- `comercial.clientes` é a fonte de verdade;
- `clienteId` é o vínculo obrigatório;
- nomes nas demais entidades são snapshots para documentos emitidos;
- edição do cliente deve oferecer “atualizar dados operacionais vinculados”, sem alterar documentos históricos assinados.

### 5.2 Usuários versus funcionários — média

**Achado:** `usuarios` controla autenticação e `employees` controla RH. Não há um vínculo mestre obrigatório entre ambos.

**Efeito:** a mesma pessoa pode ter nomes diferentes, ser inativada no RH e continuar ativa no login, ou vice-versa.

**Decisão recomendada:** adicionar `employeeId` opcional e único em `usuarios`, com alertas de divergência e desligamento coordenado.

### 5.3 Responsável por ID e por nome — baixa/intencional

**Achado:** RDO, conferência, qualidade, auditoria e outros registros guardam ID e nome.

**Efeito:** parece duplicidade, mas preserva o nome histórico caso o usuário seja renomeado.

**Decisão recomendada:** declarar o nome como snapshot imutável na criação/conclusão e usar o ID para permissões.

### 5.4 Pagamento em pedido e nota — alta

**Achado:** quando uma nota vinculada a pedido é paga, o mesmo `pagamentoId` é gravado em `nota.pagamentos` e `pedido.pagamentos`.

**Controle atual:** alguns indicadores removem duplicidade por ID.

**Risco:** qualquer relatório que apenas concatene as duas listas pode contar a saída duas vezes.

**Decisão recomendada:** criar coleção única `pagamentos` e guardar apenas `pagamentoIds` em pedido e nota. Durante a migração, toda soma deve usar ID único.

### 5.5 Pedido, nota, pagamento, caixa, transação e DRE — crítica

**Achado:** o mesmo fato econômico pode aparecer em:

- `pedidos`;
- `notasFiscais`;
- pagamentos embutidos;
- `caixaObra`;
- `transacoes` bancárias;
- `outrasDesp` ou `despesasEmpresa`;
- `documentosMovimentacoes`.

**Efeito:** há risco de dupla contabilização, divergência de status e exclusão parcial.

**Decisão recomendada:** adotar um livro financeiro canônico:

1. obrigação;
2. pagamento;
3. liquidação/conciliação;
4. rateio;
5. documento;

Pedido e nota apontam para a obrigação; caixa e extrato apontam para o pagamento. A DRE lê apenas o razão canônico.

### 5.6 Documentos — alta

**Achado:** metadados do mesmo arquivo podem ficar no registro de origem, em `documentosMovimentacoes`, em `obra.documentosOneDrive` e no próprio OneDrive.

**Efeito:** links repetidos, legendas divergentes e documentos órfãos.

**Decisão recomendada:** coleção `arquivos` com ID, OneDrive ID, obra, pasta, hash, legenda, versão e autor. Entidades usam `arquivoIds`.

### 5.7 Avanço físico — alta

**Achado:** progresso aparece no planejamento, RDO e medições de evolução. Há regras de fusão e rollup no frontend.

**Efeito:** atualização manual e automática podem divergir ou sobrescrever interpretações.

**Decisão recomendada:** manter um livro de eventos de avanço e calcular o acumulado. O planejamento contém meta; o RDO contém evento diário; a medição contém aceite.

### 5.8 Bases de referência — média

**Achado:** o backend já restringe cadastro/exclusão ao administrador e procura uma base equivalente, mas dados históricos podem conter repetições e a UI já exibiu duplicidade.

**Decisão recomendada:** índice único lógico por empresa, fonte, competência, UF e desoneração; tela de saneamento do legado; impedir vínculo de duas bases equivalentes ao mesmo orçamento.

### 5.9 Status distribuídos — média

**Achado:** estados de pedido, nota, conferência, conciliação, qualidade e comercial são strings mantidas em diferentes componentes.

**Efeito:** transição inválida pode ser produzida por uma nova tela.

**Decisão recomendada:** máquinas de estado centrais com transições, papel permitido, validação e evento de auditoria.

### 5.10 Duplicidade literal no código — baixa

**Achado:** na normalização de `locacoesEquip.tarifas`, a propriedade `dia` aparece repetida no mesmo objeto.

**Efeito:** hoje as duas expressões são iguais, portanto o resultado não muda. Ainda assim é sinal de manutenção manual frágil.

**Decisão recomendada:** remover a repetição quando o módulo for refatorado e adicionar lint para `no-dupe-keys`.

## 6. Segurança e permissões

### 6.1 Carga integral do dataset — P0/crítica

**Evidência:** `api/data.js`, ações `auth-login` e `load`, devolvem `data: p`/`data: atual` para qualquer usuário autenticado. `allowedTabsForUser` atua no React.

**Risco:** um operador com acesso limitado pode inspecionar a resposta da rede e ler dados de outros setores, incluindo informações pessoais e financeiras.

**Correção:** aplicar projeção por papel e por obra no servidor. Idealmente, abandonar a carga integral e criar endpoints por módulo com autorização explícita.

### 6.2 Salvamento de seções sem política geral — P0/crítica

**Evidência:** `save-sections` aceita qualquer chave de primeiro nível para qualquer usuário autenticado. Existe proteção server-side específica para Conferências e para algumas ações isoladas, mas não para as demais coleções.

**Risco:** ocultar um botão não impede uma requisição manual que altere usuários, financeiro ou outra seção.

**Correção:** mapa server-side de permissões por ação e coleção; validar escopo da obra; impedir atualização de `usuarios`, `config`, financeiro e RH por perfis não autorizados.

### 6.3 Primeiro administrador — P1/alta

O setup sem autenticação é necessário para bootstrap, mas qualquer pessoa que alcançar uma instalação com `usuarios` vazio pode se tornar administrador.

**Correção:** exigir `SETUP_SECRET` temporário, convite de implantação ou bloqueio após provisionamento.

### 6.4 PIN — P1/alta

O PIN usa SHA-256 simples e o rate limit fica na memória da instância serverless. Se o blob for obtido, PIN curto pode sofrer ataque offline; instâncias diferentes não compartilham bloqueio.

**Correção:** encerrar a transição para e-mail/senha, usar MFA e retirar hashes de PIN do dataset operacional. Enquanto existir PIN, usar algoritmo lento e rate limit persistente.

### 6.5 Links de arquivo — P1/alta

O endpoint de arquivo aceita assinatura HMAC estática sem sessão do usuário e sem expiração. Quem possuir a URL pode acessar enquanto o segredo não mudar.

**Correção:** token curto com expiração e escopo, ou exigir sessão no download. Não registrar URLs completas em locais públicos.

### 6.6 Portal do cliente — P1/alta

O portal usa token na URL. O filtro de conteúdo no servidor é positivo, mas o token pode vazar por histórico, captura ou compartilhamento.

**Correção:** expiração, rotação, revogação, trilha de acesso e, para documentos sensíveis, autenticação do cliente.

### 6.7 Dados pessoais e LGPD — P0/crítica comercial

O produto trata CPF, RG, estado civil, salário, PIX, endereço, fotos e contratos. Não foram encontrados no repositório controles completos de base legal, consentimento, retenção, exportação, anonimização ou atendimento ao titular.

**Correção:** inventário de dados, política de privacidade, contratos com operadores, retenção, minimização, trilha de acesso e processo de incidente.

### 6.8 Pontos positivos de segurança

- a chave `service_role` fica no servidor;
- tabelas têm RLS habilitado sem política para cliente;
- comparação de PIN usa tempo constante;
- sessão Microsoft e chave Gemini são criptografadas;
- a conexão OneDrive é exclusiva do administrador;
- criação/exclusão de bases é validada no servidor;
- regras da Conferência são validadas no servidor;
- presença on-line só pode ser listada pelo administrador.

## 7. Integridade e concorrência

### 7.1 Blob único — P0

O dataset principal fica em `company_app_data` sob uma chave única. A aplicação envia apenas seções alteradas e faz merge de três vias, o que é uma evolução real em relação à sobrescrita integral.

Mesmo assim:

- toda coleção do setor continua dentro do mesmo documento;
- uma seção grande é regravada integralmente;
- conflitos no mesmo item dependem de comparação JSON;
- consultas e índices de negócio não existem no banco;
- auditoria e autorização fina são difíceis;
- o crescimento ameaça limites de requisição e tempo de função.

**Correção:** migrar por domínio para tabelas normalizadas, começando por autenticação/permissões, financeiro, compras/documentos, obras e qualidade.

### 7.2 Auditoria mutável — P1

O `changeLog` fica dentro do mesmo blob que usuários comuns conseguem salvar. Não é um ledger imutável e pode ser alterado junto com o estado.

**Correção:** tabela append-only no servidor, com usuário autenticado, ação, entidade, versão anterior/nova ou diff, IP/session ID e retenção.

### 7.3 Arquivo de ponto

Quinzenas são retiradas do blob e gravadas em linhas próprias. O processo reduz tamanho e possui permissão server-side. É um padrão que pode orientar a decomposição dos demais módulos.

### 7.4 Backup — P0

Não existe implementação de backup automático no repositório. Exportações manuais não substituem restauração integral.

**Correção:** Point-in-Time Recovery quando disponível, export diário do banco/Storage, retenção definida e teste trimestral de restauração.

## 8. Auditoria financeira

### 8.1 Pontos positivos

- pedido é tratado como compromisso;
- pagamento permite origem real;
- caixa negativo é bloqueado;
- comprovante pode ser anexado;
- nota possui retenções, rateios e divergências;
- conciliação possui histórico, desfazer, reabrir e ignorar com motivo;
- pagamento duplicado entre pedido/nota usa o mesmo ID em parte do fluxo;
- ranking penaliza não conformidades financeiras.

### 8.2 Riscos

1. existem duas telas capazes de registrar pagamento de pedido: Compras e Central de Pagamentos;
2. o mesmo pagamento pode existir em nota e pedido;
3. a marca `conciliado` pode ser selecionada sem uma transação vinculada;
4. pagamento pelo caixa cria também linha em `caixaObra`, exigindo deduplicação na DRE;
5. pagamento direto pelo cliente precisa de regra explícita de custo e receita;
6. documentos podem ser anexados em mais de uma coleção;
7. despesas avulsas e conciliação podem representar a mesma saída;
8. relatório gerencial não equivale a contabilidade fiscal.

### 8.3 Fluxo canônico recomendado

`Pedido → NF/Documento → Conferência → Autorização → Pagamento → Conciliação → DRE`

- Compras prepara, mas não paga.
- Financeiro paga por uma única Central.
- Conciliação confirma a saída bancária.
- A DRE reconhece a partir do razão financeiro canônico.
- Exceções sem NF exigem justificativa, aprovador e prazo de regularização.

## 9. Qualidade e engenharia

### 9.1 Pontos positivos

- conferência tem segregação de função e validação server-side;
- pendência possui impacto, responsável, prazo, evidências e validações;
- fotos aceitam anotação;
- RDO exige revisão do engenheiro;
- FVS/FVM possuem checklist e tratamento de não conformidade;
- ranking por obra e engenheiro ajuda a priorizar.

### 9.2 Riscos

- usuário pode receber dados de obras fora de seu escopo no payload;
- progresso tem múltiplas fontes;
- critérios FVS/FVM podem ser editados sem versionamento formal;
- normas e tolerâncias são texto livre;
- relatório em HTML impresso depende de pop-up e navegador;
- fotos de evidência precisam de retenção e integridade.

### 9.3 Recomendações

- biblioteca versionada de critérios por tipo de serviço/material;
- hash do arquivo e data/hora do servidor;
- assinatura/aprovação da ficha;
- revisão obrigatória de alteração de critério;
- relatório PDF gerado no servidor;
- vínculo explícito entre RDO, avanço, medição e aceite.

## 10. Arquitetura e manutenção

### 10.1 Monólito de frontend — P1

`src/App.jsx` possui 33.175 linhas e concentra componentes, regras financeiras, relatórios, modelos e estilos inline.

**Efeitos:**

- mudanças têm grande raio de impacto;
- divergências de texto, tamanho e botão reaparecem;
- revisão é lenta;
- code splitting é praticamente inexistente;
- testes unitários são difíceis.

**Correção:** decompor por domínio e usar componentes de design system.

### 10.2 Design system

Há bons componentes básicos (`Btn`, `Inp`, `Sel`, `Badge`, painéis e gráficos), mas muitas telas ainda criam botões e estilos diretamente.

**Correção:**

- tokens únicos de cor, tipografia, raio e espaçamento;
- quatro tamanhos de texto funcionais;
- três alturas de controle;
- variantes centralizadas de botão;
- ícones com semântica consistente;
- lint que proíba cores e tamanhos arbitrários fora do tema;
- catálogo visual/Storybook após a migração.

### 10.3 Build e dependências — P1

- Create React App está descontinuado;
- bundle principal é significativamente maior que o recomendado;
- `npm audit` reportou 29 alertas;
- `xlsx` possui alertas altos e sem correção automática no pacote atual.

**Correção:** migrar para Vite, aplicar lazy loading por setor e substituir/atualizar o leitor de planilhas com avaliação de compatibilidade.

### 10.4 Testes — P0

Nenhum teste automatizado foi encontrado.

Cobertura mínima antes de venda:

- autorização por perfil e obra;
- login, refresh e inativação;
- orçamento, BDI e importação;
- parcelas e medições;
- pedido, nota, pagamento, caixa e conciliação;
- bloqueio de caixa negativo;
- DRE sem duplicidade;
- folha e rescisão;
- conferência e segregação de função;
- OneDrive e documentos;
- portal do cliente;
- merge de concorrência.

## 11. Prontidão comercial

### 11.1 O que já é demonstrável

- jornada completa da construtora;
- identidade visual própria;
- obra como contexto central;
- integração de engenharia, compras e financeiro;
- qualidade auditável;
- portal do cliente;
- OneDrive;
- IA multimodal;
- painéis executivo, operador e TV.

### 11.2 Condições para vender com segurança

#### P0 — antes de qualquer cliente externo

- autorização server-side por módulo, ação e obra;
- decompor ou proteger efetivamente os dados sensíveis;
- razão financeiro canônico e teste contra duplicidade;
- testes automatizados dos fluxos críticos;
- backup e restauração comprovados;
- pacote LGPD mínimo;
- logs imutáveis;
- correção/mitigação das dependências de alto risco.

#### P1 — antes de crescer

- migrar de CRA para Vite;
- dividir `App.jsx` por domínio;
- observabilidade e monitoramento de erros;
- expiração de links e tokens;
- MFA e recuperação de senha;
- migrations versionadas;
- ambientes separados de desenvolvimento, homologação e produção;
- contratos de SLA, suporte e incidente.

#### P2 — maturidade

- multiempresa real com isolamento por tenant;
- aplicativo/offline de campo;
- filas assíncronas para IA e documentos;
- assinatura digital;
- API pública e integrações contábeis;
- métricas de produto e onboarding guiado.

## 12. Plano de execução recomendado

### Etapa 1 — segurança e integridade

1. criar matriz de autorização no backend;
2. filtrar respostas por perfil e obra;
3. bloquear escrita de coleções não autorizadas;
4. criar ledger de auditoria;
5. cobrir fluxos críticos com testes.

### Etapa 2 — financeiro canônico

1. modelar obrigação, pagamento, conciliação, rateio e documento;
2. migrar dados mantendo IDs;
3. definir Central de Pagamentos como único ponto de pagamento;
4. validar DRE e rankings;
5. reconciliar exceções.

### Etapa 3 — modularização

1. Vite;
2. pastas por domínio;
3. hooks e serviços;
4. design system;
5. lazy loading;
6. páginas e rotas explícitas.

### Etapa 4 — dados e documentos

1. tabelas por domínio;
2. catálogo único de arquivos;
3. versionamento;
4. busca e índices;
5. backup e retenção.

### Etapa 5 — produto comercial

1. homologação;
2. LGPD;
3. telemetria;
4. suporte;
5. piloto com outra empresa;
6. correções;
7. lançamento controlado.

## 13. Conclusão

O ARCD tem valor funcional real e um diferencial claro: integra o que acontece no canteiro com orçamento, qualidade, suprimentos, financeiro e cliente. O principal obstáculo para venda não é falta de funcionalidades; é transformar os controles atuais, ainda muito concentrados no frontend e no blob, em garantias de segurança, integridade, teste e escala.

Prioridade recomendada: não adicionar novos módulos antes de concluir P0. O ganho comercial agora virá mais de confiabilidade, velocidade e clareza do que de ampliar o menu.

