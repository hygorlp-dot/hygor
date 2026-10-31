# Piloto acompanhado de Compras e Conciliação

Implementação local. Não confirma transações, aplica ajustes, envia mensagens ou publica a aplicação.

## Como conferir

- Conciliação: escolha a conta e abra **Abrir piloto de conferência**. A conferência automática desta tela fica suspensa durante o piloto; o processamento de importações no servidor permanece independente.
- Compras: escolha a obra e use **Mais ações de Compras → Piloto de conferência**.
- O piloto guarda um retrato dos dados carregados no momento da abertura. Consulte as evidências, documentos e a ficha da compra; registre **Conferido sem ajuste**, **Ajuste necessário** ou **Não foi possível concluir**.
- Ajustes e dúvidas exigem motivo. A avaliação registra a necessidade de correção, sem executar a correção no ERP.
- Exporte os indicadores antes de sair da sessão. As anotações ficam na memória do módulo; não são persistidas no banco e não sobrevivem ao recarregamento da página.

## Indicadores e limites

- Concordância com automação simulada: avaliações positivas divididas pelas conclusivas das propostas seguras do retrato.
- Acurácia observada em automáticas executadas: avaliações positivas divididas pelas conclusivas dos movimentos que possuem auditoria de execução automática. Não mistura propostas com execuções reais.
- Sem avaliação conclusiva, o percentual fica ausente; o tamanho da amostra acompanha o percentual. Inconclusivos não contam como acertos ou erros.
- Ajustes apontados: avaliações que pedem correção; não equivale a correções já aplicadas aos lançamentos.
- Tempo médio decorrido: tempo entre abrir o caso e registrar a avaliação, incluindo eventual tempo ocioso. Não representa horas trabalhadas.
- Avaliações de versões anteriores do registro são desconsideradas ao reabrir com dados alterados. Uma reversão contábil não é classificada automaticamente como erro da automação.
- O JSON exportado contém indicadores agregados, sem nomes, documentos pessoais, comprovantes ou credenciais. A amostra exige interpretação humana e não autoriza pagamentos.

## Validação local repetível

`npm run validate:procurement` executa lint, tipos, arquitetura, suíte unitária completa, build estático sem sourcemaps, orçamento de bundle e jornadas de Compras, portal do fornecedor, Conciliação e piloto. Os cenários usam APIs simuladas e servidor local.

Relatório: `artifacts/procurement-validation/report.json`; logs por etapa no mesmo diretório. Uma etapa reprovada mantém o comando com saída de erro, mas as próximas verificações são executadas para completar o diagnóstico. `-- --only=build,bundle,browser` roda uma verificação parcial explicitamente marcada como parcial no relatório.

O orçamento existente não foi aumentado. A medição inicial do código local já excedia o teto em 94.705 bytes gzip; com o piloto, a primeira medição resultou em 1.892.104 bytes frente ao limite de 1.789.952. A liberação depende de reduzir esse excesso e repetir a validação. Esse diagnóstico não significa que o piloto com dados reais já foi executado ou que exista uma acurácia real medida.
