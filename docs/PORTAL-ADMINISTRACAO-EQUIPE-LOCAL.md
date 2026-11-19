# Administração e equipe — implementação local

Revisão: 14/11/2026. Sem publicação, migrações ou gravação de dados reais do ERP.

## Fontes e vínculos

A aba consulta a obra pelo ID autorizado e exige tanto a liberação da obra quanto a permissão do perfil. O ponto é limitado aos dias e apropriações da obra até a data da consulta. A remuneração usa o motor canônico e os vínculos vigentes em cada dia. Títulos de folha fechada usam exclusivamente o rateio da obra, sem atribuir o líquido integral de uma pessoa a várias obras. CPF, PIX, observações e motivos médicos não são publicados.

Os custos reconhecidos vêm do razão financeiro canônico, incluindo benefícios e rescisões. Custos históricos sem composição individual permanecem identificados como não detalhados; não se inventam funcionários ou valores zero. Quando a base é insuficiente, a estimativa completa fica em apuração.

## Referência de composição

A planilha fornecida `Custo_Mensal_Profissional_Servente_Marcell.xlsx`, abas Custo Mensal e Premissas, orienta o modelo. Os pisos da referência não substituem a remuneração real. O cálculo reproduz 13º, férias com um terço, encargos dessas verbas, aviso indenizado, FGTS e reflexos do aviso e multa do FGTS. A conferência independente dos exemplos da referência produz reservas mensais de R$ 827,11 para remuneração de R$ 2.406,80 e R$ 622,23 para R$ 1.810,60.

EPI, uniforme, exames admissionais/demissionais, treinamento e outros serviços de segurança não compõem a reserva. São compras/despesas da obra provenientes dos registros financeiros existentes. Aviso prévio e multa rescisória são verbas distintas dos exames de admissão/demissão.

Parâmetros editáveis pelo administrador em Folha → Regras e descontos → Encargos: encargos patronais, FGTS, multa, permanência média, proporção de desligamentos sem justa causa, avisos indenizados e dias de aviso. O modelo exige ativação explícita; valores zero são preservados. O comando existente de configuração salva apenas essa configuração adicional, preservando as demais regras.

## Repasse e taxa

Repasse previsto = custo reconhecido da equipe + complemento de encargos + complemento de reservas. Cada complemento desconta o que já está embutido no custo; não se soma a reserva inteira novamente. A taxa utiliza o percentual e as categorias previstos no contrato existente. Se a mão de obra integrar a base contratual, os complementos também compõem a estimativa da taxa. Valores já emitidos são apresentados separadamente. A estimativa não cria cobrança, folha, pagamento ou medição.

## Impacto no DRE e caixa

O modelo gerencial adicional não cria lançamentos no resultado realizado nem altera o caixa. A origem reconhecida continua sendo o razão existente; previsão, compromisso de compra, estoque e pagamento permanecem separados. Desembolso não é reconhecido novamente como custo. A criação ou liquidação efetiva das obrigações continua no fluxo operacional do ERP, fora desta consulta.

## Validação local

Testes cobrem fórmulas da referência, parâmetros inválidos e zero explícito, rateio entre obras, histórico incompleto, corte de datas, privacidade, permissões, revogação e EPI fora das reservas. A revisão com a cópia local da B2-04 verifica os meses atual e histórico, as três visões no computador e celular e a integridade da origem antes/depois. O servidor de revisão mantém gravações remotas bloqueadas e ativa o modelo somente na cópia em memória.

Ajuda contextual e manual foram revisados na mesma alteração. A configuração tem guia específico e explica que salvar parâmetros não emite folha ou cobrança.
