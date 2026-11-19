# DRE por obra e operação no celular

## Origem e impacto financeiro

O DRE por obra consulta o razão no recorte de obra, competência e apuração selecionado. A projeção do razão e o demonstrativo preservado de uma competência fechada são aceitos quando trazem os quatro indicadores do cabeçalho. Uma resposta tardia de outro recorte é descartada. Se a consulta falhar ou vier incompleta, a tela identifica o cálculo local, oferece uma nova consulta e bloqueia o PDF. Após a recuperação, o cabeçalho e o demonstrativo do PDF usam o mesmo recorte. O Excel completo segue seu fluxo anterior.

A Homologação filtra o relatório existente por tipo, grupo e texto. O resultado da filtragem não corrige divergências nem dispara a sincronização. A Frota, o Pipeline e o ranking de Fornecedores mudam a apresentação e preservam as rotinas existentes. A mudança de etapa do Pipeline continua exigindo a confirmação do operador.

As alterações de consulta e apresentação não geram previsões, compromissos, entradas de estoque, custos reconhecidos ou pagamentos. A exportação usa os valores do recorte consultado e não registra fatos financeiros. Os ensaios usaram dados fictícios e interceptaram as requisições da aplicação. A única alteração confirmada na simulação do Pipeline ocorreu na memória da própria fixture.

## Validação local

- O cenário de DRE reproduziu a falha HTTP 503, a resposta incompleta com HTTP 200, a recuperação por demonstrativo de competência fechada e a troca de obra com resposta fora de ordem. Também conferiu os valores na prévia do PDF gerado.
- No Edge em 320, 390 e 1440 px, passaram 23 cenários em desenvolvimento e 31 no build. A cobertura inclui a busca e as ações da Frota, a confirmação de etapa no Pipeline, o detalhe do fornecedor, a triagem de diferenças e avisos e regressões do DRE. A conferência visual incluiu o aviso de cálculo local, os cartões e a homologação.
- O lint, a checagem de tipos, a análise de ciclos e 37 testes unitários e de integração passaram. O build local ficou em 1.798,63 KiB de JS e CSS compactados, dentro do teto de 1.847 KiB.
- A ajuda contextual e o manual foram atualizados. Toda validação ocorreu localmente.
