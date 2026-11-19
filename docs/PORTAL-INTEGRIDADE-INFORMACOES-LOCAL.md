# Integridade das informações no portal

Revisão local: 14/11/2026. Nenhuma publicação, migração ou gravação no ERP real.

## Correções

- Saldo contratual em aberto soma o saldo de cada parcela. Recebimento excedente em outra parcela não reduz uma cobrança sem vínculo explícito.
- Parcelas emitidas sem vencimento permanecem no destaque, com data a confirmar. Medições de competência futura, sem emissão anterior à consulta, não antecipam o resumo.
- Contratos por valor não exibem percentual inventado. Recebimentos mostram a data do recebimento, e não o rótulo de vencimento.
- Avanço desconhecido permanece desconhecido; zero confirmado continua zero. Casas decimais são preservadas e estimativas de cronograma são identificadas. Medição técnica futura não antecipa o avanço atual.
- Notas marcadas como rascunho ficam fora da lista e dos anexos do extrato. Valor líquido zero não é substituído pelo bruto.
- Registros idênticos com o mesmo ID entram uma vez. Mesmo ID com conteúdos divergentes bloqueia a projeção para conferência; não há união por nome, valor ou fornecedor.
- As permissões atuais da obra restringem a publicação anterior. Retirar a liberação remove os conteúdos correspondentes, inclusive relatos dos diários; suspender a obra bloqueia a consulta. Resumos antigos de custos e etapas são substituídos, evitando duplicação e valores desatualizados no primeiro cartão.
- Totais monetários do caixa e do contrato somam centavos inteiros, evitando resíduos de ponto flutuante.

## Origem, DRE e limites

Custos e pagamentos continuam nos seletores canônicos do ERP. Pedido, estoque, custo reconhecido e pagamento não são somados como fatos equivalentes. As correções alteram a projeção do cliente; não reconhecem despesas nem registram pagamentos e não modificam o DRE realizado. A prova inclui o cenário de nota, pagamento de compra refletido no caixa e espelho canônico, sem duplicação do mesmo custo.

O cadastro de uma obra continua sendo responsabilidade da equipe. A leitura do original comprova acesso ao arquivo vinculado, sem comprovar que a imagem documenta execução física. Diários em preparação permanecem privados. Ausência de notas ou de orçamento de controle permanece explícita.

## Validação

Os testes de regressão reproduziram os defeitos antes das correções. Foram executados testes de projeção, autenticação, permissão, SQL local, razão financeiro e componentes. A auditoria da obra escolhida consulta novamente as sete áreas em desktop e celular e exige decodificação do original. Evidências reais, valores e imagens ficam fora do repositório, em `C:/dev/marcell-local-review/portal-real`.

Ajuda e manual foram revisados para avanço desconhecido, contrato por valor, parcelas sem data, recebimentos excedentes e notas em rascunho. Conferir os resultados finais dos comandos no relatório privado da revisão. O ambiente não foi publicado.
