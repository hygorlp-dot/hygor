# Onda 5 — Uso móvel, interrupções e preparação do piloto

31/10/2026. Continuação do [roadmap MARCELL](ROADMAP-SAAS-95-2026-10-31.md). O usuário escolheu preparar o piloto acompanhado para aplicação posterior. Implementação e validação locais, sem push, PR, deploy, migração ou gravação em banco real. Aplicadas Impeccable, shadcn, revisão React e verificação de conclusão.

## WF09 — Validação técnica local

### Preservar a edição e a tentativa em andamento

A ficha fiscal, o pagamento e a correção da origem do fechamento passam a oferecer **Continuar editando** ou **Descartar alterações** quando há preenchimento não confirmado. Escape, fechar e cancelar seguem essa decisão. Comando em andamento impede fechar a edição; a proteção de recarga também considera essa condição, mesmo quando os valores iniciais não foram alterados.

Solicitações e pedidos de Compras mantêm a confirmação de saída existente e recebem também a proteção de recarga. Nenhum desses mecanismos salva documentos, senhas ou rascunhos em preferências. A proteção do navegador pode variar conforme o dispositivo; não representa recuperação após encerramento forçado da aba pelo sistema operacional.

O atalho global de busca não troca o módulo enquanto há um diálogo aberto. Fechar uma confirmação filha mantém a rolagem da página bloqueada enquanto o formulário principal permanece aberto. O foco fica dentro do diálogo ativo; quando o acionador anterior já foi desmontado, retorna a um título da área de trabalho. Navegação inferior e chat não competem com os controles do formulário.

### Área visível, leitura e alcance das ações

O diálogo acompanha as dimensões e o deslocamento do `visualViewport`, com tratamento de resize/scroll e remoção dos listeners ao fechar. Isso permite adaptar o contêiner quando a área visível diminui. Controles de fechamento móveis têm pelo menos 44 px. Os rótulos da navegação inferior deixam de quebrar palavras arbitrariamente e usam a família tipográfica do sistema.

As jornadas verificam nomes longos, documento ausente, foco, retorno, ausência de overflow horizontal da página/diálogo e alcance real do botão de confirmação por hit test. A redução da altura para 360 px exercita uma área limitada, sem declarar que o teclado físico de um aparelho foi testado.

### Falhas e recibo no perfil Financeiro

Foram exercitados queda antes da confirmação, queda na consulta de recuperação, sessão expirada e resposta perdida após aplicar a operação. A edição permanece aberta e a retomada exige ação explícita. Resposta perdida é reconhecida pelo recibo; adotar a confirmação não envia outra gravação.

O ensaio com Financeiro encontrou uma lacuna que os cenários com Administrador não mostravam: a projeção de leitura retirava os recibos necessários à recuperação. A projeção agora devolve somente recibos da própria conta para edição fiscal/correção de origem, ligados a registros ainda visíveis no recorte e com acesso à aba correspondente. Retorna apenas chave, tipo, identidade da origem, autor e data; exclui resumos, recibos de outras pessoas e origens fora da obra/acesso atual.

Essa correção foi validada em testes de escopo e em seis cenários de navegador com Financeiro restrito. Não altera valores, pagamentos ou regras de autorização de comandos.

## WF10 — Preparada para aplicação posterior

Entregues o [roteiro de aplicação](piloto-wf10/README.md), o [modelo de observações](piloto-wf10/observacoes-modelo.json), a prévia sintética local e o consolidador:

- `node scripts/operator-pilot-preview.mjs`: seis contas fictícias, duas por área, com projeção, papéis, escopos e redutores existentes; dados somente em memória e todas as rotas `/api` encerradas localmente.
- `WF_PILOT_FAILURE`: modos de queda antes da escrita, resposta perdida e sessão expirada, uma vez por início da prévia.
- `node scripts/operator-pilot-report.mjs --template destino.json`: cria 24 execuções planejadas sem observações, tempos ou notas; recusa sobrescrever arquivos.
- `node scripts/operator-pilot-report.mjs --report observacoes.json`: verifica identidades, tempos, indicadores e notas; mantém amostra insuficiente como pendente e impede aceite com falha crítica.

O ambiente não oferece gravação genérica, fechamento financeiro definitivo, conexão documental ou relatório SQL. O roteiro distingue essas limitações de falhas de UX. Reiniciar a prévia restaura a referência; ela não lê nem corrige dados reais. As contas e os testes automáticos não contam como participantes observados.

**Situação da coleta:** 24 execuções planejadas, zero observações humanas, zero participantes observados e nota validada nula. A WF10 permanece parcial/preparada, conforme a escolha do usuário. Faltam a aplicação acompanhada, o tratamento dos achados e a comparação com a referência da WF01.

## Ajuda e manual

Incluída a orientação comum **Celular, interrupções e recuperação** na ajuda e no manual. A fonte única explica saída com alterações, sessão expirada, conexão perdida, consulta indisponível e confirmação incerta. O manual foi regenerado da mesma fonte; 88 guias continuam cobrindo as 65 abas autorizáveis. A seção foi aberta e operada no navegador nos seis recortes de validação.

## Evidências e limites

| Verificação | Resultado |
|---|---|
| Matriz de navegador WF09 | 48 cenários aprovados: oito tarefas/estados em 1440, 1024, 768, 390, 320 e reflow equivalente a 200% |
| Financeiro restrito | Seis cenários adicionais aprovados, usando a projeção real de leitura para recuperar somente o recibo próprio |
| Regressão financeira WF05/WF06 | 30 cenários aprovados, incluindo vínculo/retorno, conflito, correção na origem, sessão e resposta perdida |
| Regras e componentes | 53 testes em 12 arquivos: saída protegida, coleta, ajuda/manual, recuperação, identidade de sessão e projeção/privacidade |
| Prévia do piloto | Seis contas sintéticas abriram; gravação genérica foi recusada e escopo de Engenharia foi conferido |
| Modos adversos da prévia | Três ensaios HTTP reais contra o processo local; queda antes da escrita sem recibo, resposta perdida com recibo e sessão expirada; uma única versão aplicada |
| Qualidade | Build direto do Vite, lint, typecheck e manual:check; sem executar o prebuild com migrações |

São **54 cenários únicos novos de navegador**, em duas execuções (48 + 6), sem contar repetição como cobertura nova. Evidências em `artifacts/wf-wave5/`: `browser-verified.log`, `finance-profile.log`, `regression.log`, `unit-final.log`, `operator-preview-results.json`, `pilot-failure-results.json`, `pilot-status.json`, logs de qualidade e capturas em `browser-results/`.

O recorte de 200% usa viewport de 720 × 500 CSS px com escala de dispositivo 2, equivalente ao reflow de uma tela de 1440 px. Não é evidência de zoom nativo acionado no navegador. A área reduzida emula espaço disponível menor; teclado físico, rotação real, alternância de aplicativos, encerramento da aba pelo sistema, leitor de tela e conectividade prolongada devem ser confirmados no piloto com dispositivos reais. Esses limites permanecem expressos no aceite da WF10.

As jornadas usam dados sintéticos e APIs interceptadas, redutores reais e projeção real de leitura. A prévia do piloto também foi verificada como processo local, sem conexão com banco. Não se atribuem tempos de operador ou ganhos de produtividade a essas execuções. Permanecem os avisos de tamanho de chunks do build.

Durante a validação, preservadas as extrações de componentes realizadas em paralelo no workspace. O verificador de fronteiras financeiras passou a localizar as funções pela árvore sintática, sem depender de um helper vizinho que foi extraído. Também foi completada a exportação de `AlertTitle`, usada pela interface compartilhada. Nenhuma dessas adequações altera cálculo monetário.

## Nota e posição no roadmap

**WF09 concluída na validação técnica local. WF10 preparada, aplicação acompanhada pendente.** Oito entregas concluídas (WF02–WF09) e duas parciais (WF01 e WF10, pela medição humana). A onda 5 permanece aberta até concluir o piloto e tratar seus resultados.

**Nota heurística provisória: 9,4/10 nas superfícies verificadas.** Fluxo 9,4; próxima ação 9,4; recuperação 9,5; consistência 9,4; responsividade/acessibilidade 9,4; resposta 8,5. Com os pesos originais, 9,37. O avanço vem da proteção da edição e da recuperação por perfil; resposta permanece sem nova nota por não haver medição representativa de operador. A meta de 9,5 validada com usuários não foi declarada atingida.
