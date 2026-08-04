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

A Fase 5 ainda não está concluída.
