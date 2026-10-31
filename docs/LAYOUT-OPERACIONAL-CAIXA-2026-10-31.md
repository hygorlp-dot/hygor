# Financeiro operacional e saldo inicial — 31/10/2026

Implementação local em `C:/dev/repositorio-mrc`, preservando os dados da empresa
e o trabalho existente. Sem push, PR, deployment, migração ou reinício do
servidor local que mantém a sessão Microsoft em memória.

## Comportamento entregue

- **Hoje:** aviso com quantidade e saldo dos vencidos da obra selecionada,
  acompanhado de acesso direto. Uma fila vazia não troca automaticamente para
  outra; a escolha anterior do usuário continua válida.
- **Relatórios:** tipo e obra permanecem à vista; os filtros adicionais ficam
  em uma seção recolhível com período explícito. Os totais aparecem antes da
  explicação detalhada da base. Busca, categoria, tipo, agrupamento e filtros
  específicos ativos têm remoção individual sem zerar o restante da consulta.
  CSV, Excel, impressão e memorial continuam usando o mesmo recorte completo.
- **Fechamento:** seletor de mês, situação do motor, pendências e resumo de
  valores precedem a ação final. A ação repete a competência a fechar.
  Documentação pendente e motor sem divergências são informações separadas;
  nenhuma regra de bloqueio, permissão ou confirmação foi alterada.
- **Saldo inicial:** campo vazio significa desconhecido, e não zero. Entradas,
  saídas e títulos continuam disponíveis, mas saldo acumulado, menor saldo e
  primeira insuficiência só aparecem após informar ou confirmar uma hipótese.
  Zero possui uma ação explícita. A hipótese mostra origem manual, data e conta;
  não é apresentada como saldo bancário certificado.
- **Contexto da hipótese:** valor digitado é preservado ao trocar obra, conta
  ou data, mas só serve à projeção quando confirmado para aquele recorte.
  Voltar a um recorte que coincide com a confirmação existente permite reutilizar
  a hipótese correspondente. Nada é salvo em lançamento ou cadastro.
- **Preparação por conta:** seleção de contas existentes, todas as contas ou
  títulos sem conta prevista. Apenas `contaBancariaId` explicitamente informada
  na origem determina a destinação. Conta de um pagamento anterior, fornecedor
  ou conta contábil não é usada para inferir destino do saldo restante.
  Títulos sem conta continuam identificados e consultáveis pelo memorial.

## Limites da preparação por conta

Não foi adicionado saldo bancário automático, conexão bancária, cadastro de
saldo de abertura ou atribuição de contas aos títulos existentes. Uma conta
selecionada pode não ter títulos porque a origem ainda não informa destinação;
a quantidade fora do recorte e a fila sem conta permanecem explícitas.
Selecionar uma conta não modifica o lançamento.

O saldo informado é uma hipótese para o recorte obra/conta/data, inclusive quando
há uma obra específica selecionada. Não se atribui o saldo total de uma conta
da empresa a uma obra sem confirmação. A integração futura deve definir origem,
data de corte, cobertura de conciliação e tratamento de transferências antes
de chamar qualquer saldo de bancário conferido.

## Comparação com a Vobi

A documentação oficial do [extrato da Vobi](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi)
foi revisitada: ela aproxima contas, saldos e conciliação e ressalta a necessidade
de conferir os registros com o banco. O MARCELL passa a explicitar conta prevista,
ausência de saldo e origem manual da hipótese, aproveitando os memoriais já
existentes. Não foi presumida nova inspeção da sessão privada da Vobi.

## Verificação

- Suíte financeira: 192 testes aprovados em 33 arquivos.
- Novo roteiro operacional: oito verificações, em 1440 e 390 px, para saldo
  ausente/zero, escopo por conta, origens, filtros, vencidos e ordem do fechamento.
- Regressões de relatórios/exportações e continuidade: 20 verificações aprovadas.
- Lint, typecheck e build direto do Vite passaram; permanece o aviso conhecido
  de chunks grandes. Não foi usado o prebuild que executa migrações.

Os roteiros de navegador usam dados fictícios e interceptam todas as APIs.
Confirmam ausência de gravações nos cenários exercitados. Capturas e relatório
em `artifacts/financeiro/layout-operacional/`; build em
`artifacts/financeiro/layout-operacional-build/`.

Reprodução: `node scripts/finance-operational-layout-verify.mjs http://127.0.0.1:4192`.
Os roteiros de relatórios e navegação foram ajustados para os controles
recolhíveis; os contratos de filtros e exportação foram mantidos.
