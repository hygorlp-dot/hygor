# Cobertura do estoque na previsão — etapa 1C

Revisão: 13/11/2026. Implementação e testes locais; sem migração, publicação ou alteração de registros reais.

## Fluxo da informação

1. O orçamento de controle define demanda material, coeficientes, preço e etapa. O motor existente de Suprimentos expande composições e resolve somente identidades explícitas por ID/código único. Unidades conflitantes ficam pendentes.
2. O recebimento de Compras já grava pedido/item, material, quantidade na unidade de referência, fator de conversão e vínculo ao orçamento. A previsão lê esses campos; não solicita uma cópia.
3. Consumos usam etapa ou tarefa do Estoque. Aplicado líquido = consumo menos devolução. Perda diminui o físico, mas não comprova aplicação produtiva.
4. A reserva da mesma etapa é parte do saldo físico. Livre = físico menos reservado; cobertura da demanda da etapa inclui seu próprio reservado uma vez. Não se compartilha a mesma quantidade entre duas etapas nem obras. Vínculo ausente só permite resolver etapa se houver um único destino possível para o material; vínculo explícito inválido ou conflitante exige revisão.
5. Pedidos a receber usam quantidade comprada menos recebida, convertida para a unidade do material. Recebido fica no físico e sai de pedidos a receber. Recebimento que diverge das entradas exige conciliação.
6. Financeiro → Custos por etapa → Cobertura do estoque mostra as fontes, busca, quantidades e reposição estimada. Conferir origens e a ajuda não grava dados. A revisão explícita continua no editor existente, com suas permissões, versão, justificativa e persistência.

## Cálculos e limites

Falta comprar = máximo(0, demanda − aplicado líquido − saldo físico − pedidos a receber).

Reposição estimada = falta comprar × preço médio orçado do material na etapa. Esse preço é referência de compra; não é avaliação contábil do estoque nem preço de mercado pesquisado.

Piso de materiais = reposição estimada + compras independentes ainda não faturadas pelo razão. Pedidos já vinculados ao mesmo escopo de terceiros permanecem no grupo contratual da etapa 1B.

Restante automático = máximo(0, orçamento − incorrido, piso de compromissos sem sobreposição, piso de materiais). Os pisos não são somados: materiais e contrato podem cobrir o mesmo escopo. Na mesma etapa, o relatório gerencial pede conferência dessa possível sobreposição. O cálculo não comprova que serviços e materiais independentes estejam integralmente cobertos; o responsável pode registrar o restante total após revisar as fontes.

A revisão manual substitui a referência; ela não recebe outra soma dos pisos. Estoque, reserva, tarefa, unidade, composição ou origem alterados pedem reconferência, preservando o valor. Texto de etapa e defaults normalizados não mudam a identidade econômica. Catálogo não utilizado e registros de outras obras não provocam nova revisão.

As quantidades são atuais, assim como Compras; a data de corte não reconstrói saldos históricos. Custos seguem o razão até a competência financeira. Composição sem materiais não comprova cobertura: permanece a referência monetária, com orientação visível. Preços, quantidades ou vínculos inválidos não são estimados silenciosamente.

Entrada sem pedido/item compatíveis não prova origem financeira. Quantidade negativa, aplicação maior que demanda, reserva excessiva, conversão inválida, materiais inativos, etapas ambíguas ou unidades divergentes deixam a parcela de reposição indisponível. A linha continua visível com motivo. O custo final gerencial fica indisponível até conciliar ou registrar revisão explícita válida da etapa. Esta revisão é uma decisão gerencial e não uma correção contábil.

## Impacto no DRE

Não houve alteração no motor do razão nem na projeção do DRE. Estoque não é uma nova fonte de custo nesta entrega. Notas, medições e demais fontes financeiras mantêm o reconhecimento existente; pagamentos não geram outro custo.

Exemplo validado: demanda 100 unidades a R$ 10, entrada de 60 unidades.
- Sem nota: reposição R$ 400 + compromisso R$ 600; restante R$ 1.000, incorrido zero.
- Nota reconhecida de R$ 600: compromisso zero, restante R$ 400; custo final R$ 1.000. Não se descontam os R$ 600 do físico outra vez.
- Aplicar 20 unidades mantém a compra necessária em 40: demanda restante 80 e físico 40. O DRE permanece igual.
- Perder 5 unidades exige 45 a comprar, elevando a reposição para R$ 450. O DRE continua inalterado; eventual ajuste contábil é outro fluxo.
- Recebimento parcial de caixas usa a conversão da origem. Estorno reabre a quantidade a receber e retira a entrada cancelada, mantendo a cobertura uma vez.

As provas comparam o razão completo e a DRE antes/depois de movimentos. A cobertura altera previsão de custo e potencial margem futura; não altera resultado realizado, caixa, valor contratado ou obrigações por simples consulta.

## Acesso e preservação

Financeiro com acesso à aba recebe catálogo mínimo comum e movimentos/reservas recortados à obra permitida; sem a aba não recebe essas novas seções. O catálogo é necessário para identidade, unidade e preço de referência; observações internas não são projetadas. A projeção produz a mesma base econômica usada pelo servidor. As permissões de escrita de materiais, movimentos e reservas permanecem existentes. Não foram criados comandos ou tabelas de estoque novos.

Contratos comerciais e de terceiros preservados, assim como cláusulas protegidas, vínculos/histórico da fase 1B e emissão PDF/DOCX desativada.

## Evidência local

- 852 testes aprovados em 105 arquivos: Financeiro, Compras, Estoque, Suprimentos, Contratos, comando/API com banco simulado, projeção por perfil/obra, DRE e ajuda.
- 20 testes de navegador desktop/celular de Contratos e previsão; dois de estoque repetidos após os últimos ajustes.
- Lint com design/manual, tipos, arquitetura e build local aprovados. A execução usou npx vite build, evitando o prebuild que aciona migrações.
- Logs artifacts/stock-forecast-*.log e capturas em artifacts/stock-forecast/browser-results; detector de interface sem achados em artifacts/stock-forecast-detector.json.
- Orçamentos de bundle mantidos: global 1.891.328 bytes gzip e núcleo financeiro 208.896. Métricas efetivas em bundle-metrics.json; sem novas dependências ou exceções de design.
- Ajuda fin_estoque e orientações de custo final atualizadas; manual gerado com 121 guias, cobrindo 65 abas.

Os testes de navegador usam API isolada e fixtures. Não houve validação em dados reais, implantação, migração ou serviço externo.
