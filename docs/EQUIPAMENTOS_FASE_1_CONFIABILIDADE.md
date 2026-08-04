# Equipamentos — relatório técnico inicial e Fase 1

Status: em implantação incremental  
Data da análise: 04/08/2026

## Relatório técnico inicial

### 1. Modelo atual

O domínio ainda reside no snapshot empresarial compatível. `equipamentos`
representa ao mesmo tempo o modelo e um lote, usando `quantidadeTotal` para a
capacidade. `locacoesEquip` vincula equipamento, obra, período, quantidade,
tarifas negociadas, descontos, estado, versão e histórico operacional.
`manutencoesEquip`, `transferenciasEquip` e `proprietariosEquip` completam a
projeção operacional. `obraAtualId` e `status` são projeções auxiliares no
cadastro do equipamento; o histórico de locações continua sendo a evidência.

### 2. Fluxo atual da locação

A interface monta `EQUIPMENT_RENTAL_SAVED`, com chave idempotente e versão
esperada. A API autentica, aplica a política de escopo da obra e executa o
comando contra a versão vigente do snapshot. O domínio valida obra, capacidade
e sobreposição, persiste a locação e atualiza a projeção do equipamento. Fechar
e cancelar usam comandos próprios. Relatórios mensais recalculam cobrança a
partir das locações confirmadas.

### 3. Persistência

Nesta fase a fonte de verdade continua em `company_app_data`. O cliente não
grava diretamente: `dispatchCommand` envia o comando ao servidor, que aplica
idempotência, controle de versão, política por obra e auditoria no snapshot. Os
comandos de equipamentos são operacionais e alimentam posteriormente a
projeção canônica da DRE. Tabelas relacionais próprias e trava concorrente no
banco pertencem às Fases 2 e 7; antecipá-las agora violaria a implantação
incremental requerida.

### 4. Cálculos financeiros

`calculations.js` calcula pacotes diário, semanal, quinzenal e mensal, receita,
desconto, repasse ao proprietário, manutenção e margem. A matriz por obra já
distingue dias de calendário e diárias-unidade, mas o consolidado mensal por
equipamento expõe `diasTotais` sem multiplicar pela quantidade. A tarifa de uma
locação sem preço negociado ainda pode consultar a tabela atual do equipamento,
alterando retrospectivamente o histórico.

### 5. Integrações

- Relatórios gerenciais, CSV e PDF consomem a matriz e o consolidado mensal.
- O motor financeiro inclui receita e resultado de equipamentos na projeção da
  DRE, sem criar liquidação bancária no clique da locação.
- Repasses de terceiros aparecem no relatório de contas a pagar, mas ainda não
  constituem títulos conciliáveis próprios.
- RDO, mapa de ocupação e transferências consultam equipamento e obra atual.

### 6. Riscos de regressão

- contratos legados não possuem snapshot comercial;
- alterar o significado de `diasTotais` quebraria consumidores antigos;
- equipamentos em lote podem estar simultaneamente em várias obras, enquanto
  `obraAtualId` aceita apenas uma;
- manutenção legada geralmente possui apenas uma data, sem período concluído;
- valores históricos usam `number`; a Fase 1 deve arredondar em centavos sem
  mudar o formato público esperado pelas telas existentes.

### 7. Plano de compatibilidade

1. Preservar `diasTotais` como alias depreciado de dias de contrato e adicionar
   explicitamente `diasContrato` e `unidadeDias`.
2. Contratos novos recebem snapshot comercial imutável. Contratos legados
   continuam com fallback compatível até a primeira edição, quando são
   congelados com a tabela vigente e origem identificada.
3. Campos novos são opcionais na normalização; nenhum registro é removido.
4. Descontos inválidos são recusados no comando e limitados defensivamente no
   cálculo puro para impedir líquido negativo em dados antigos.
5. Estados legados continuam aceitos; novos estados de bloqueio são aditivos.
6. A indisponibilidade de manutenção usa os campos existentes e aceita os
   futuros `inicio`, `fim` e `quantidade`, sem exigir migration destrutiva.

## Fase 1 — menor alteração segura

- Centralizar validação real de datas ISO.
- Separar dias de contrato e diárias-unidade em todos os consolidados.
- Calcular dinheiro em centavos dentro da cobrança e sinalizar desconto alto.
- Validar estado, manutenção e capacidade no comando servidor.
- Congelar tarifas e condições comerciais no nascimento do contrato.
- Atualizar interface, CSV e PDF para comunicar as medidas distintas.
- Cobrir unidade única, lotes, simultaneidade, obras diferentes, recortes de
  competência, datas inválidas, descontos e imutabilidade tarifária.

## Limite consciente desta fase

A garantia transacional definitiva de capacidade, calendário unificado,
reservas e concorrência entre duas requisições será implementada na Fase 2.
Até lá permanece o bloqueio otimista do snapshot e a validação servidora do
comando, sem alegar que existe constraint relacional por equipamento.

## Resultado da implantação da Fase 1

Implementado em 4 de agosto de 2026:

- datas ISO validadas contra o calendário gregoriano;
- disponibilidade calculada por período, quantidade, locações simultâneas,
  manutenção e estado operacional;
- descontos validados e calculados em centavos, com destaque para desconto
  efetivo igual ou superior a 20%;
- snapshot comercial congelado na criação, preservado em edições e normalizado
  sem alterar contratos legados;
- `diasContrato` e `unidadeDias` separados na tela, nos relatórios e nas
  exportações, mantendo `diasTotais` como alias temporário;
- smoke E2E alinhado aos nomes canônicos atuais da navegação Comercial.

Gates executados: lint, arquitetura, typecheck, 845 testes unitários, cobertura,
build de produção, Storybook, métricas de bundle e 25 cenários E2E. Todos
aprovados. Cobertura global: 82,98% de statements e 90,54% de linhas; domínio de
equipamentos: 88,64% de statements e 97,05% de linhas.
