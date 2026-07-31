# Golden master financeiro

`src/fixtures/financial-reference.js` é uma massa sintética e determinística para regressão financeira. Ela não contém dados de produção.

O cenário fixa julho de 2026 com duas obras, recebimento parcial, receita avulsa, mão de obra, benefícios, terceiros, compra, equipamento, rescisão e overhead corporativo. O teste `financial-golden-master.test.js` compara os totais por obra e o consolidado contra valores aprovados, impedindo mudança silenciosa no DRE.
