# Possível entrada duplicada — validação local

Implementação baseada na consolidação `3708066a`, sem publicação.

## Regra

- Preserva integralmente as batidas originais e sinaliza a segunda marcação como possível repetição.
- Compara marcações consecutivas do mesmo funcionário, dia e obra. Uma mudança de obra interrompe a comparação.
- Tipos explicitamente iguais indicam possível repetição. Quando falta identificação do tipo, utiliza uma janela operacional de até cinco minutos, sem relação com a tolerância trabalhista.
- Tipos diferentes explicitamente identificados, como entrada e saída, não são classificados como repetição apenas pela proximidade.
- Um dia ambíguo não gera automaticamente intervalos, integração biométrica ou saldo de horas. O RH pode informar os horários tratados e justificar a conferência, mantendo as originais.
- Apropriações já tratadas pelo RH continuam respeitadas. Não altera pagamentos, permissões ou arquivos do APK.

## Verificação

- 223 testes aprovados em 19 arquivos: domínio de ponto, API e comandos de conferência/sincronização.
- Dois cenários de navegador aprovados: computador e celular, incluindo consulta às duas originais, ausência de horários inventados e tratamento explícito com justificativa.
- Lint, compilação Vite, checagem de tipos e arquitetura aprovados.
- Ajuda contextual e manual atualizados. Revisão visual utilizou os padrões existentes MARCELL.
- Sem escrita em dados de produção, push ou deploy.
