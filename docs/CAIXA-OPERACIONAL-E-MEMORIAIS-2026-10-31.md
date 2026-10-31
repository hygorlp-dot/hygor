# Área do caixa, atualização bancária e memoriais paginados

Implementação local de 31/10/2026, preservando as alterações existentes,
os dados da empresa e o processo de revisão com OneDrive.

## Área própria

Em Financeiro → Gestão financeira → Caixa por conta, o operador encontra
a conta bancária, as datas dos dados disponíveis e a posição simulada.
A fila Hoje e a Visão financeira oferecem acesso ao caixa; a previsão por
vencimentos fica em um bloco recolhível dentro dessa nova área.

Conta bancária e conta prevista dos títulos são seleções independentes.
O cenário de vencimentos e a posição de cada conta continuam guardados na
sessão do módulo, inclusive ao navegar para documentos e voltar. A posição
da conta abrange a empresa inteira; o filtro de obra permanece explícito
para os títulos previstos. Não se atribui saldo bancário a uma obra.

A prévia final 9896 continua exclusiva do desenvolvimento na origem 4192,
ativada pelo endereço local já usado na revisão. Seus vínculos continuam
somente na cópia de exibição. Agência, titularidade, tipo, situação, PIX,
saldo de abertura e datas não confirmados permanecem em branco. Nenhuma
evidência cadastral consultada na Vobi foi aplicada automaticamente.

## Atualização bancária

O cabeçalho da conta informa o último movimento bancário conhecido e a
última importação registrada, quando essas informações estão disponíveis.
Importações com horário usam apresentação no fuso America/Bahia; datas
sem horário são apresentadas como datas civis, sem deslocamento de dia.

Se a referência escolhida for posterior ao último movimento conhecido,
o aviso informa que a cobertura posterior não foi comprovada. Enquanto a
referência está em branco na prévia, o aviso compara com a data atual,
sem preencher o campo. A ausência de movimentos também tem aviso próprio.

As informações são específicas da conta e não usam dados bancários da
contraparte. O fim registrado de um extrato não é tratado automaticamente
como prova de cobertura contínua. Arquivamento mantém seu histórico;
registros excluídos ou cancelados seguem o critério canônico de atividade.

Esta organização aproveita a aproximação entre contas, saldos e conciliação
observada na Vobi. Mantém explícitos o recorte e os limites do saldo, pois
a documentação da Vobi informa que o saldo total pode independer do filtro
de datas. [Extrato financeiro da Vobi](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi).

## Memoriais financeiros

O memorial genérico apresenta 50 registros por página. A busca percorre
todo o conjunto, reinicia na primeira página e informa sua quantidade e
subtotal. O total original do conjunto permanece separado e preserva a
eventual diferença sem detalhamento individual do indicador.

Dados completos, documentos e evidências de cada lançamento são montados
ao expandir sua linha. A navegação para a central de documentos guarda
busca, página, registros expandidos e rolagem do diálogo para o retorno.
Os identificadores de expansão usam a posição no conjunto original, sem
mudar quando a busca reduz os resultados.

Na observação anterior, um conjunto fictício de 925 registros montava
151.709 elementos no diálogo. O cenário equivalente agora montou 265
elementos, com 50 linhas e nenhum painel de detalhes inicial. Isso mede
esse cenário de navegador, não representa uma promessa de tempo para
todas as combinações de documentos da empresa.

## Verificação e limites

- Suíte financeira: 222 testes aprovados em 43 arquivos.
- Regressores específicos verificam corte por conta, ausência de datas,
  preservação de zero explícito, subtotal além da página, detalhes sob
  demanda e retorno dos documentos com página e expansão preservadas.
- Navegador em 1440 e 390 px: nova área, alerta, prévia em branco,
  pesquisa sobre 925 registros, paginação, expansão, navegação, relatórios
  e exportação integral do recorte. As APIs de escrita foram interceptadas
  nos cenários fictícios; nenhuma gravação foi enviada.
- Lint, tipos e build direto do Vite aprovados; permanece o aviso conhecido
  de chunks grandes. Não foi executado o prebuild com migrações.

Reprodução principal: `node scripts/finance-cash-workspace-verify.mjs`.
Regressões: `finance-navigation-verify.mjs`, `finance-reports-verify.mjs`,
`finance-account-cash-verify.mjs`, `finance-account-preview-verify.mjs`
e `finance-operational-layout-verify.mjs`, na pasta scripts.
As verificações foram ajustadas à nova localização do caixa e ao rótulo
explícito Total do conjunto; as validações dos valores foram mantidas.

Capturas e resultado novos: `artifacts/financeiro/caixa-operacional/`.
A sessão habitual confirmou a área nova, os 925 movimentos da prévia,
o último movimento conhecido em 15/08/2026, campos desconhecidos em branco
e OneDrive conectado, local e somente leitura. O relatório de estados e
contagens fica fora do repositório em
`C:/dev/marcell-local-review/contas-bancarias/CAIXA-OPERACIONAL-VALIDADO.json`.

Não foram alterados cadastros, saldos, lançamentos, vínculos, arquivos,
conciliações ou credenciais. O servidor não foi reiniciado. Nenhum push,
branch remota, preview ou deployment foi criado.
