# Equipamentos — Fase 5: motor de cobrança e faturamento

Data de início: 4 de agosto de 2026.

## Objetivo

Separar utilização, cobrança, faturamento, apropriação, recebimento e repasse
sem substituir de uma vez a memória financeira legada.

## Primeiro incremento

- entidade `rentalChargeItems` vinculada à locação, obra e competência;
- tipos de locação, mobilização, desmobilização, frete, operador, combustível,
  limpeza, seguro, acessório, hora excedente, atraso, avaria, item perdido,
  ajuste, desconto e estorno;
- quantidade armazenada em milésimos e todos os valores monetários em centavos;
- valor bruto, desconto, imposto e líquido calculados por função pura;
- descontos e estornos possuem sinal financeiro negativo sem valores de ponto
  flutuante no registro canônico da linha;
- comando de inclusão e alteração com idempotência, versão esperada, usuário,
  escopo da obra e auditoria;
- linhas faturadas ou canceladas tornam-se imutáveis;
- o comando apenas prepara a cobrança e não cria lançamento no razão, título
  ou movimentação bancária neste incremento;
- locações e relatórios legados continuam sendo calculados como antes até a
  ativação explícita da nova projeção.

## Segundo incremento

- cada locação permite preparar cobranças adicionais diretamente no histórico;
- formulário contém tipo, competência, descrição, quantidade, unidade, preço,
  desconto e imposto;
- conversão para milésimos e centavos acontece na fronteira do formulário;
- a prévia identifica explicitamente que a linha ainda não foi faturada;
- descontos e estornos são apresentados com sinal negativo;
- o cartão da locação mostra o total líquido das linhas já preparadas,
  separado da cobrança contratual legada;
- gravação usa exclusivamente o comando auditável do primeiro incremento;
- smoke E2E cobre preenchimento e prévia exata em centavos.

## Terceiro incremento

- catálogo explícito de regras: melhor combinação, dia corrido, dia útil,
  diária mínima, semana, quinzena, mês de 30 dias, mês civil e aniversário;
- cálculo puro recebe datas, tarifas em centavos e quantidade em milésimos;
- semana, quinzena e mês contratados não são substituídos por combinação mais
  barata;
- suporte a valor mínimo de contrato, franquia de horas e hora excedente;
- regra escolhida fica congelada no snapshot comercial da locação;
- formulário de locação permite escolher a regra antes da contratação e a
  bloqueia depois que o snapshot existe;
- `menor_combinacao` legado é traduzido para `best_combination` sem alterar
  contratos históricos.

## Quarto incremento

- geração da cobrança contratual medida a partir do snapshot e do ciclo
  escolhido na locação;
- período de utilização, início e fim do ciclo e competência ficam gravados
  separadamente;
- datas de emissão, vencimento e pagamento permanecem vazias até as etapas
  próprias de faturamento e liquidação;
- a linha gerada recebe estado `measured`, distinto de `billed` e `paid`;
- identificador determinístico por locação e competência impede medição
  duplicada;
- desconto percentual é calculado em pontos-base e valores em centavos;
- comando exige versão atual da locação, escopo da obra e perfil financeiro;
- nenhuma medição cria título ou movimenta o razão neste incremento.

A Fase 5 ainda não está concluída.
