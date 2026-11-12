# Redução conservadora de egress: fotos da Equipe nas Obras

Base revisada: `hygorlp-dot/hygor`, main `46050989110c78350257def291ccf97c594caf83`.
Não foi verificada equivalência com o deploy em produção.

## Evidência e escopo

O painel consulta a cada 20 segundos (`useEquipeObras.js`). O servidor gerava
novas URLs assinadas de todas as fotos a cada resposta (`equipe-obras.js`). Cada
token distinto muda o endereço de imagem, prejudicando sua reutilização.
A documentação oficial descreve também tokens diferentes como chaves de cache
separadas no Smart CDN: https://supabase.com/docs/guides/storage/cdn/smart-cdn .
Não foi medido quanto do consumo total vem deste caminho.

A correção reutiliza URLs privadas no mesmo processo/cliente/empresa por até
90 segundos, preservando a validade original de 120 segundos e 30 segundos de
margem. Mantém o filtro de autorização atual; só devolve os caminhos pedidos
após essa filtragem. A memória é limitada a 1000 entradas por cliente Supabase.
Falhas retornadas ou exceções de assinatura usam o fallback existente e não
repetem assinatura do mesmo caminho por 60 segundos. Troca do caminho da foto
invalida naturalmente o cache. Não há cache de dados de presença ou permissão.

Em um processo aquecido, cinco consultas espaçadas por 20s passam de cinco
assinaturas para uma, mantendo a mesma URL nesses ciclos. Isso não é promessa
de 80% de redução do consumo total. Cold starts, réplicas e consultas concorrentes
podem continuar gerando assinaturas independentes. O cache não é distribuído.

## Limitações e próximos passos

- Não desbloqueia quota já excedida nem corrige HTTP 402 do REST.
- Não altera plano, banco, bucket, validade, implantação ou dados.
- Não altera atualização de 20s nem reduz a releitura dos últimos sete dias e
  do dataset completo. Avaliar projeção específica no banco e backoff de polling
  em etapa separada, com testes de autorização e frescor.
- Não publica fotos, não remove RLS e não grava URLs assinadas em disco/logs.
- Fotos que falharem podem levar até 60s para nova tentativa, sem bloquear a
  consulta de presença. O usuário conserva o fallback já existente.

## Validação e ajuda

Revisados guia `equipe_obras` em `src/features/help/help-content.js` e manual.
Não há novo controle, fluxo, regra de presença, autorização ou instrução de uso;
portanto não foi necessária alteração de ajuda/manual ou revisão visual.
`npm run manual:check` aprovou cobertura/sincronização dos 116 guias e 65 abas.

Testes focados: cache/expiração, isolamento cliente/empresa, filtro atual de
caminhos, troca de foto, lotes/deduplicação, erros e recuperação, resposta lenta,
limite de memória; regressão do handler, domínio e hook de equipe.

## Continuação: leituras enxutas e recuo de consultas

A Equipe nas Obras recebe agora leitura específica: core, meta de Ponto e
linhas de Ponto de todas as obras. Não baixa os seis outros domínios separados
(Lookahead, Config, Equipamentos, Patrimônio, RDO e Orçamentos). Não há cache
ou atraso de autorização/dados. Todas as obras continuam disponíveis ao cálculo
interno para preservar transferências; o recorte de acesso continua aplicado
antes de devolver a resposta. Valores de bytes dependem do tamanho real de cada
linha. A core ainda precisa ser lida inteira porque seu formato pode ser compactado.

Consultas de Ponto eletrônico e Equipe nas Obras mantêm ritmo normal de 20s,
mas desaceleram em falhas: 40s, 80s, 160s, até 300s. HTTP 402 aguarda 300s.
401/403 limpam dados anteriores e aguardam cinco minutos antes da nova tentativa
automática; a tentativa manual continua disponível. Mudanças de visibilidade e reconexão não furam o recuo;
Atualizar manual e revalidação após ação continuam disponíveis. Sucesso retoma
ritmo normal. Isso não modifica gravações nem sincronização do coletor/APK.
Ajuda e manual foram atualizados para distinguir última consulta de estado atual.

## Monitoramento recomendado, não ativado

Medir no Usage do Supabase o total por projeto/organização e por serviço
(Database, Storage, Realtime, Functions), distinguindo egress cached/uncached.
Registrar linha de base antes do deploy e comparar 24h/7 dias após. Métricas úteis:
requisições e bytes por ação, proporção de HTTP 402/429/5xx, tentativas automáticas,
acertos de reutilização de URLs e tamanho das linhas core/meta/por obra. Nos logs,
usar apenas nome da ação, status, duração, contagem e bytes agregados, nunca
payload, imagem, URL assinada, PIN/token ou identificação de funcionário.

Alertas recomendados: consumo projetado acima da franquia do período e limites
internos de 50%, 75%, 90%; comparar consumo diário com dias restantes, sem assumir
que notificações oficiais existentes cobrem os alertas. Não foi criada automação,
assinatura de alertas ou plataforma de telemetria neste patch.

Smart CDN é Pro ou superior. No plano Free, não prometer economia de Smart CDN:
a expectativa é evitar assinatura redundante e permitir reuso da URL/imagem no
navegador. Não há garantia de permanecer dentro da franquia até medir produção.

## Revisão de recuperação e rota real

A autenticação legada pode converter falha de leitura do índice de perfis em
401. Por isso NÃO se suspende polling indefinidamente por 401/403: os dados
anteriores são removidos imediatamente e nova consulta autenticada ocorre após
300s (ou por Atualizar manual). Isso preserva a negativa de acesso sem travar a
recuperação após quota/indisponibilidade. Nenhuma credencial é aceita em cache.

A rota real sanitiza erros de consultas pós-autenticação como HTTP 500, mesmo
quando o erro do banco traz status 402. Essa semântica compartilhada foi
preservada; o recuo genérico 40/80/160/300s cobre esse caso, em vez de depender
de HTTP 402 no navegador. Testes integrados em `api/data-ponto-recuo.test.js`
executam a rota e autenticação reais (Supabase simulado), comprovando negativa,
status sanitizado e recuperação. O ramo 402 direto também continua coberto.

## Compatibilidade com produção e orçamento do bundle

Produção verificada na Vercel: commit `2d94948f31ad4fc3ec67e3eb439f3db0714ec1f3`,
dois commits de relatórios além da main `46050989`. Patch reaplicado nesta base,
preservando relatórios e contextoJornadas; manual regenerado sobre a base atual.
Nenhum deploy foi realizado.

A/B local com as mesmas dependências e comando Vite: baseline 1.908.480 bytes
gzip; versão final 1.908.702; teto mantido em 1.908.736. A margem é pequena
(34 bytes); o gate deve ser novamente verificado no ambiente de CI.
Foram marcadas como puras somente inicializações literais de constantes
congeladas e repetição constante do hash inicial, nos módulos marcacao e
attendance-status. Quando um consumidor usa a constante, valor e congelamento
permanecem; quando não usa, o bundler pode remover a inicialização antes retida.
Nenhuma regra de ponto, constante, conteúdo de hash ou função foi removida.
O recuo foi simplificado para dobrar a espera acumulada até o teto; após status
401/402/403 ele permanece no teto até sucesso, que reinicia a espera normal.
