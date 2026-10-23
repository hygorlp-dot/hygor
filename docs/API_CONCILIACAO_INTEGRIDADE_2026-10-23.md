# API, conciliação, Compras e DRE — 23/10/2026

## Evidência anterior à correção

Leitura do projeto Supabase `qylubfxunnpbbjnmgsdg`, empresa `arcd`:

- 925 movimentos bancários na origem e na projeção, com valores e sinais iguais.
- 53 vínculos canônicos ativos, sem vínculo órfão, invertido ou acima do saldo.
- Origem marcava 57 movimentos como conciliados: quatro não tinham vínculo canônico.
- 210 liquidações existentes; nenhuma nota fiscal cadastrada.

Os quatro casos têm evidência por ID, documento e valor em
`server/reconciliation-repair.js`. Três despesas ativas perderam a associação
bancária; a quarta associação aponta para um documento cancelado.

## Correções

- A baixa pela conciliação usa a mesma validação de saldo, aprovação e
  adiantamento que a Central de Pagamentos. Obrigações inativas são recusadas.
- O vínculo existente exige pagamento ativo, valor e direção compatíveis e
  ausência de outro vínculo. Nota e pedido espelhados recebem a associação.
- Desfazer um vínculo mantém o pagamento existente. Estornar pagamento criado
  pela conciliação continua estornando seus dois espelhos.
- O rateio para medição respeita seu saldo e registra somente a parcela
  destinada à medição, evitando repetir o restante como recebimento.
- Alterações de pedidos pela conciliação atualizam `core_purchase_orders`.
  Repetir o comando recupera essa projeção sem repetir o pagamento.
- O auxiliar de autenticação saiu de `api/` para `server/`, eliminando a rota
  acidental sem handler. Métodos de escrita são restringidos; GET dos crons,
  consultas públicas previstas e download assinado permanece disponível.
- As consultas externas ORSE têm prazo de 12 segundos.
- A RPC financeira valida no PostgreSQL a direção do banco contra o título,
  mantendo os bloqueios de período, escopo de empresa e idempotência.

## Reparo de dados no deploy

O reparo ocorre sob trava da linha de origem e na mesma transação da projeção
canônica. Somente os quatro IDs auditados são elegíveis. Se documento, valor ou
evidência mudar, a operação é recusada. Há marca de revisão idempotente e auditoria.

Três associações são restauradas, sem criar pagamentos, despesas, títulos ou
notas. O movimento ligado ao documento cancelado volta à pendência, mantendo a
evidência anterior e o documento cancelado.

O gate compara todos os fatos e liquidações, inclusive IDs, valores e datas,
além dos indicadores do DRE por competência. A apresentação de caixa pode mudar:
a origem omitia R$ 3.628,77 de saídas já presentes nas liquidações canônicas.
Os custos por competência não aumentam por restaurar esses vínculos.

A carga de validação do deploy também lê equipamentos, configurações e ponto
das linhas separadas, usando as mesmas regras de mesclagem da API. Essas linhas
não são modificadas pelo reparo. A ativação global de FIN-003 não é alterada.

## Validação

Testes de domínio cobrem saldo, aprovação, adiantamento, sinal, duplicidade e
desvinculação sem perda de pagamentos. A integração exercita o handler HTTP,
projeção do pedido, repetição do comando e reversão. PGlite executa a migration
real com baixa válida, sinal invertido, repetição e fechamento. O reparo é
simulado sobre a cópia auditada antes de qualquer escrita remota. No ambiente
real, a validação é de leitura: não se criam documentos de teste nem pagamentos.
