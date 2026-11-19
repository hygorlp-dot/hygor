# Correções locais da reauditoria — 17/11/2026

Escopo autorizado: corrigir os problemas da auditoria, começando pela homologação financeira e comparação da chave PIX, preservando alterações e dados, com prioridade ao celular e sem publicar. Referência: `docs/REAUDITORIA-OPERADOR-PUBLICADO-20261117.md`.

## Resultado por achado

| Achado | Correção ou limite |
|---|---|
| A01 — Homologação contraditória | Estado efetivo do motor separado do resultado das verificações. Todos os grupos do relatório existente são consultáveis: totais, DRE, compras/DRE, banco, vínculos e integridade. Busca, filtro, paginação de 12 registros, obra, competência, quinzena/mês, esperado, consultado e diagnóstico. Ausência de diferenças não equivale a verificação concluída. |
| A02 — Identificador do extrato comparado como PIX | A chave genérica de deduplicação deixa de alimentar identificação, índice, pontuação, bloqueio PIX e sugestão de funcionário. Somente `chavePix`/`pixKey` explícitos são evidência PIX. FITID continua como referência bancária própria e a deduplicação permanece intacta. PIX ausente aparece como sem dados; PIX explícito divergente continua bloqueando a sugestão. Comparação visual e motor usam a mesma normalização, sem retirar acentos da chave. |
| A03 — Atualização sem rede | Mensagem distingue consulta indisponível e edição protegida, mantendo os dados exibidos em caso de falha. O teste sem edição não recebe aviso de edição protegida inventada. |
| A04 — Contexto e retorno | Ponto eletrônico explica o seletor local de Obra e a independência de Obra em foco. Voltar de uma tarefa à Comunicação restaura o contexto anterior. Não sincroniza nem transfere funcionários ou batidas silenciosamente. |
| A05 — Navegação móvel extensa | Ficha do lead usa a navegação compartilhada: seletor Áreas do lead no celular e destinos equivalentes no desktop. Troca de área e retorno dos contratos preservam o preenchimento. A redução geral de rolagem nas demais telas continua como trabalho de experiência, sem alegação de nota 9,5. |
| A06 — Alvos pequenos | Célula do ponto e ação de detalhes do fornecedor respeitam o token compartilhado de toque, verificado em pelo menos 44 × 44 px. |
| A07 — Compra sem foco na origem | Próxima ação fecha a ficha e aguarda sua devolução de foco antes de abrir a etapa, posicionando e focando a solicitação exata. Testado com SC-0005 antes de SC-0004. |
| A08 — Automação comercial | Nenhum gerador de PDF/DOCX foi criado. É uma limitação funcional documentada, não um erro que autorize inventar emissão, assinatura ou conversão. Os vínculos existentes continuam explícitos por lead/proposta. |
| A09 — Privacidade do portal | A abertura informa que Administração e equipe pode liberar nomes, folha individual, reservas e ponto para perfis autorizados. As regras e opções de publicação não foram alteradas; o manual já descrevia essa liberação. |

A ação de sincronização técnica permanece disponível, recolhida separadamente da consulta e com confirmação existente. Não foi executada. Falha ao consultar o relatório não implica necessidade de preparar o banco.

## Origem das informações e impacto no DRE

A homologação reaproveita a resposta de `financial-shadow-report` e os vínculos de origem existentes. Não cria campos persistidos, cadastros ou associações por nomes semelhantes. Grupos de diferenças não são somados como novos custos. Compras em centavos recebem conversão explícita para reais; valores genéricos de projeção não são presumidos como moeda, pois também podem representar quantidades ou campos estruturais.

Na conciliação, `chaveTransacao` permanece sendo o identificador de deduplicação produzido por FITID ou impressão da linha. Essa informação não demonstra titularidade de PIX. Identificadores bancários próprios continuam disponíveis como evidência independente. Ausência de PIX não autoriza conciliação automática por nome; uma chave explícita incompatível permanece como impedimento.

Não houve criação ou alteração de previsão, compromisso, estoque físico, custo reconhecido, liquidação ou pagamento. Não houve estorno, recarga de dados removidos, sincronização financeira ou migração de banco. Nenhum custo foi duplicado por estas consultas e alterações de apresentação; não se certifica aqui a inexistência de duplicações em transações reais não executadas. A lógica de reconhecimento do DRE e os controles de confirmação financeira não foram modificados.

As 678 diferenças do ensaio são dados fictícios que reproduzem a quantidade observada na auditoria. As divergências reais não foram compensadas, apagadas nem declaradas resolvidas. A correção permite localizá-las e conferir as origens preservadas.

## Validação concluída

- Regressão reproduzida antes da correção: identificador genérico causava evidência ou impedimento PIX indevido. Outro teste reproduziu comparação visual incorreta de chave com acento. Logs `red.log` e `red-pix-normalization.log`.
- 273 testes aprovados em 26 arquivos: conciliação, evidências, homologação, ponto eletrônico e continuidade entre setores. `unit-final.log`.
- Bateria complementar de proteções financeiras: 35 testes aprovados, incluindo relatório em sombra, verificações de ativação e paridade bancária. Inclui seis testes da homologação já contados acima; não somar como testes únicos. `financial-guards.log`.
- DEV: 36 cenários aprovados; após a última alteração de normalização PIX, seus seis cenários afetados passaram novamente. `e2e-dev-complete.log` e `e2e-dev-pix-final.log`.
- Build final: os 36 cenários passaram em sessões novas. `e2e-build-final.log`.
- Larguras 320, 390 e 1440 px nos testes financeiros e de toque; continuidade comercial, tarefas e perfis restritos em 390 e 1440 px. Sem transbordamento horizontal nos estados verificados. Revisão visual das capturas de homologação, PIX e ficha do lead.
- `npm run lint`: aprovado, incluindo design e manual. Nenhuma ampliação da baseline. Manual gerado com 144 guias para 65 abas; conteúdo de portal revisto e instruções dos fluxos modificados atualizadas.
- `npm run typecheck`: aprovado. Auditoria de importações: 934 arquivos, 3.300 arestas, zero ciclos estáticos ou totais. `typecheck-final.log` e `import-cycles-final.log`.
- Build local final aprovado. JS/CSS gzip: **1.838.171 bytes (1.795,09 KiB)**, dentro do teto **1.891.328 bytes (1.847 KiB)** e dos limites individuais. Nenhum limite foi elevado. `bundle-metrics.json`, `bundle-final.log` e `build-final.log`.
- Impeccable: nenhum achado nos componentes de homologação, evidências, ponto eletrônico e fila de compras. A varredura ampliada registrou seis avisos principais preexistentes em trechos legados e avisos consultivos. O aviso de cor na linha do fornecedor já existia; a alteração nessa linha foi apenas do tamanho do alvo. Não foram criadas exceções para ocultar achados. `impeccable.json` e `impeccable-review.json`.

Os testes usam cópias fictícias locais e bloqueiam gravações; APIs reais e chamadas externas ficam indisponíveis nos servidores de ensaio. A imutabilidade das bases dos cenários é conferida ao terminar cada fluxo. Não houve consulta autenticada ou alteração da base de produção nesta correção. A validação móvel usa emulação do Edge; não substitui teste em aparelho físico nem certificação de acessibilidade.

## Preservação e evidências

As alterações locais anteriores foram mantidas. Cópias anteriores, manifestos, diff desta tarefa, hashes do código validado, logs e capturas estão em `artifacts/correcoes-auditoria-20261117/`. Os testes comerciais usam também `artifacts/roadmap-usabilidade-etapa3/*audit-build*.png`.

Capturas principais:

- `artifacts/correcoes-auditoria-20261117/homologacao-build-320.png`
- `artifacts/correcoes-auditoria-20261117/homologacao-build-390.png`
- `artifacts/correcoes-auditoria-20261117/homologacao-build-1440.png`
- `artifacts/correcoes-auditoria-20261117/pix-build-390.png`
- `artifacts/roadmap-usabilidade-etapa3/lead-vazio-audit-build-390.png`

As primeiras tentativas de navegador registraram seletor de teste incorreto, dependência CommonJS não otimizada na configuração isolada do DEV e corrida de inicialização dessa otimização. Esses resultados não foram usados como prova de sucesso; os cenários foram repetidos e aprovados com o servidor pronto e a configuração de teste corrigida. O segundo build local foi necessário após identificar e corrigir a regressão adicional de comparação visual PIX. `npm run build` e seus hooks de migração não foram executados.

Sem push, preview remoto ou deploy. A auditoria publicada continua sendo um registro histórico: estas correções locais não atualizam sua nota nem provam que chegamos a 9,5. Permanecem pendentes a melhoria geral de densidade móvel, a ampliação funcional de contratos e a homologação transacional completa em base isolada autorizada.
