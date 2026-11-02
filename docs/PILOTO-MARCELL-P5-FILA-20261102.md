# P5 — Retomada da fila geral e resolução de conflitos

Revisão local em 02/11/2026, posterior ao commit a9b2b514. Checkout codex/marcell-precise-local-20261101. Sem push, deploy, alteração de API/banco ou operação financeira real.

## Problemas confirmados e correções

- Depois de esgotar as tentativas transitórias, a fila mantinha a edição, mas exigia outra edição para reabrir o envio. O aviso persistente agora oferece **Tentar salvar novamente**, usando o snapshot pendente. Não repete pagamentos ou recebimentos: esses fluxos mantêm seus comandos e confirmações próprias.
- A retomada aceita falhas transitórias e timeout; não libera sessão expirada, recusa de acesso ou conflito. Clique repetido durante uma requisição em andamento não abre outro envio.
- A resolução de conflito descartava a pendência antes de carregar a versão atual. Agora, se a leitura falha, o aviso, a edição e a proteção de saída permanecem disponíveis. Depois de uma leitura válida, a reaplicação usa a fila: outra indisponibilidade continua recuperável nesta aba.
- Reaplicar usa a edição local mais recente e a base anterior para combinar dados. Duas resoluções simultâneas nesta aba são bloqueadas. Isso não elimina disputas entre operadores nem torna segura toda substituição do mesmo campo: o aviso continua informando esse risco.
- Avisos de conflito e de edição recusada usam o Alert compartilhado. O conflito acompanha o conteúdo, sem ocupar uma faixa fixa sobre a operação. SaveRecovery centraliza o novo aviso para os módulos do shell.
- O indicador offline deixa de prometer proteção durável. A Ajuda informa que recarregar pode perder edições da fila geral. O conteúdo de salvamento no painel de Ajuda agora reutiliza sua fonte única, também usada pelo manual.

## API e Supabase: o que se pode afirmar

Os cenários 401, 403, 409 e 503 foram simulados com APIs interceptadas. Não foram incidentes observados no Supabase. O cliente chama /api/data e já tenta renovar sua sessão; os testes de autenticação e integridade de resposta passaram. Isso não prova a disponibilidade do servidor nem valida a integração com o banco.

O botão é recuperação operacional. Diagnosticar uma falha real exige preservar horário/ação/registro, resposta HTTP e correlação com logs do servidor, sem expor credenciais. Só então se distingue conexão, sessão, regra de acesso, concorrência ou dependência indisponível. Não há evidência nesta rodada para atribuir uma causa ao Supabase ou alterar suas permissões.

## Verificação

- Três novos testes de fila falharam antes da implementação (p5-followup-red.log). A versão final passou em 65 testes de fila, armazenamento, Ajuda, autenticação e integridade de resposta, em nove arquivos (p5-followup-unit-final.log).
- 38 cenários P5 passaram no desktop/celular e 38 na repetição adversa a 320 px ou com texto a 200% e fontes bloqueadas. O caso adicional de sessão expirada e os demais casos novos foram verificados separadamente em dez execuções desktop/celular (p5-followup-browser-final.log). Não somar essas contagens como se fossem cenários independentes.
- A nova retomada foi acionada pelo teclado. O teste verifica o mesmo conteúdo reenviado, preservação do título da edição depois do conflito, ausência de comandos financeiros e proteção de saída enquanto há pendência. Capturas desktop/celular revisadas.
- 42 verificações de regressão de filas, fichas e navegação: p5-followup-regression.log. Lint/design/manual, TypeScript, arquitetura, build direto Vite e orçamento: p5-followup-lint.log, p5-followup-types.log, p5-followup-arch.log, p5-followup-build.log e p5-followup-bundle.log.
- Manual gerado com 104 guias para 65 abas. Revisão em 02/11/2026. Nenhuma nova aba ou guia operacional próprio foi criado; a orientação comum de salvamento está disponível na Ajuda de todos os módulos.

A navegação compartilha seus mapas puros em src/features/workflow/help-topics.js; a localização anterior em features/help mantém a reexportação compatível. Os textos continuam em help-content.js. Isso consolida um pequeno chunk compartilhado sem carregar os guias completos na entrada nem alterar a configuração do empacotador.

JS/CSS gzip: **1.789.905 bytes**, teto preservado em **1.789.952**, margem de **47 bytes**. O orçamento passa, mas essa margem é inadequada para crescimento: o peso estrutural continua uma pendência. Não houve aumento do teto nem exclusão de assets.

## Nota crítica e roadmap

**8,0/10, avaliação interna do piloto.** O caminho de falha ficou mais claro, mas o número não representa validação de produção ou teste com operadores.

| Item | Situação |
| --- | --- |
| P0–P4 | Implementação local histórica; não requalificadas como produção nesta revisão |
| P5 — pagamentos e recuperação local | Implementada e revisada tecnicamente no piloto |
| P5 — falhas terminais da fila geral | Retomada explícita e correções de conflito concluídas localmente |
| P5 — operadores | Roteiro preparado; aplicação com seis operadores e pelo menos 20 tarefas continua pendente |
| Meta 9,5 | Aberta |

Próximas prioridades:

1. Recuperação durável da fila geral e renovação de acesso preservando a edição, além dos formulários de pagamento já cobertos. Atualmente, manter a aba aberta ainda é necessário; copiar antes de sair não equivale a recuperação automática.
2. Conflitos no mesmo registro/campo: tornar explícita a comparação e escolha antes de substituir. O merge existente não é garantia contra perda de intenção entre operadores.
3. Validar API/banco em ambiente de teste, concorrência real, expiração de sessão e resposta perdida. Nenhuma indisponibilidade real foi diagnosticada nesta rodada.
4. Tratar formulários que permanecem abertos após falha: o aviso geral fica na página; pode ser necessário fechar o formulário para alcançá-lo. Não se afirma que todos os editores legados evitam nova submissão ou duplicação de cadastro. A retomada geral conserva o snapshot, mas não conclui automaticamente o estado de cada formulário.
5. Reduzir o pacote com margem sustentável e aplicar o piloto em aparelhos reais, armazenamento restrito e tecnologias assistivas. Testes automatizados e emulação não substituem essa etapa.
