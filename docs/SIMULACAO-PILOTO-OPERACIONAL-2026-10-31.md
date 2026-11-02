# Simulação local do piloto operacional

Validado em 31/10/2026 no servidor local da porta 4192. Todos os casos usados nas ações de conferência e conciliação eram fictícios, com APIs interceptadas no navegador. Nenhuma importação ou conciliação foi aplicada à empresa; o servidor que mantém a sessão do OneDrive não foi reiniciado.

## Resultado

O piloto funciona como conferência acompanhada. O operador consulta a proposta, as evidências e o documento original, registra concordância, ajuste ou dúvida e exporta indicadores. A avaliação do piloto não corrige o lançamento, não aprova pagamento e não executa conciliação. A execução automática do módulo é um fluxo separado: propostas seguras são revalidadas no servidor, e falhas ou ambiguidades retornam à revisão.

Foram aprovados 38 testes unitários/de domínio e seis jornadas de navegador:

- Automação de correspondências únicas, falha temporária seguida de nova tentativa e ausência de pagamento duplicado.
- Divergências de favorecido e documento, visualização do original e da ficha da compra, em desktop e celular.
- Preservação de filtros e seleção; a revisão só avança depois de confirmação integral do vínculo.
- Pilotos de Compras e Conciliação com justificativa obrigatória para ajustes, exportação agregada e nenhuma gravação.
- Amostra simulada com uma proposta segura, uma execução anterior e uma dúvida: três avaliações, duas conclusivas, um ajuste e um inconclusivo; percentuais separados corretamente por tipo de caso.
- Suspensão dos disparos automáticos da tela enquanto o piloto está aberto, mesmo havendo uma proposta elegível. Após avançar os temporizadores, nenhum comando financeiro foi enviado.

O teste antigo de documentos aguardava um botão que deixou de existir quando o original passou a abrir diretamente. O teste foi atualizado para verificar a imagem efetivamente carregada; a jornada completa passou depois do ajuste. Nenhuma mudança no comportamento do produto foi necessária nesta simulação.

## Como auxilia o operador

O motor reduz a conferência manual das correspondências com identidade/referência, valor e destino seguros. Casos parciais, cadastros conflitantes, identificadores repetidos, sugestões rejeitadas e períodos fechados exigem revisão. O painel permite comparar os dados bancários com o ERP e acessar os documentos antes de decidir. Uma falha do servidor fica visível e permite nova tentativa.

## Limites para uso acompanhado

- Os percentuais desta simulação não representam a acurácia da automação nos dados reais da empresa. Nenhuma taxa de economia de tempo foi medida.
- O piloto mantém avaliações na memória do módulo. Elas não sobrevivem ao recarregamento; o JSON guarda indicadores agregados, sem lista de avaliações por caso.
- Pausar a automação da tela ou abrir o piloto não suspende o processamento independente de novas importações no servidor.
- O tempo médio inclui ociosidade e não mede trabalho ativo.
- A lista exibe até cem casos por busca; os demais são acessíveis refinando a pesquisa.
- A simulação valida o funcionamento, mas não substitui uma amostra real conferida por um operador que conheça os lançamentos.

## Repetição

Com o servidor local já ativo:

```powershell
npx vitest run src/features/pilot src/domains/conciliacao/automation.test.js server/reconciliation-after-import.test.js server/reconciliation-policy.test.js server/reconciliation-execution.test.js src/features/conciliacao/review-documents.test.js --maxWorkers=2
npx playwright test --config playwright.pilot-local.config.mjs
```

O arquivo de configuração de teste reutiliza a porta 4192, sem iniciar, reiniciar ou publicar a aplicação. Capturas fictícias em `artifacts/pilot-simulation/indicadores-desktop.png` e `indicadores-mobile.png`.
