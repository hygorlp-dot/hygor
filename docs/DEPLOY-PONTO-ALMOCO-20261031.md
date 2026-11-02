# Publicação do almoço no banco de horas — 31/10/2026

Autorização: publicar a correção do almoço, preservando batidas originais e pagamentos reais.

- Produção: https://marcellapp.vercel.app/
- Projeto Vercel: mrc, prj_t7UJ797nm3uYPRSSTlFWWZc42tn7.
- Deployment READY: dpl_5QCgtdk9aJ6omhunsuNnzuvfhs3v.
- URL imutável: https://mrc-stto5jymc-hygor-s-projects1.vercel.app/
- Código publicado: edf48315fc5601559f377fa34cecaf6ef1098bb2.
- Cópia isolada: C:/dev/releases/ponto-almoco-20261031, branch local codex/ponto-almoco-release-20261031.
- Base preservada: dbc123edf179f454d19814c3f381f7e2c0a8fd14, publicação da central Arquivos. Essa entrega também preserva a sincronização biométrica de 5b82a081.

Foi aplicado somente o commit da correção do banco de horas sobre a base efetivamente publicada. A main remota ainda não contém a central Arquivos nem esta publicação. Próximas publicações devem partir desta cópia/branch ou integrar ambas as entregas para evitar regressão. Não houve push nem preview: um único deploy de produção foi preparado, verificado e promovido.

A estimativa desconta 60 minutos em dias válidos com mais de 6h contínuas sem intervalo registrado, respeita os intervalos já registrados e usa a escala vigente na data. Não cria batidas de almoço. Dias incompletos e apropriações tratadas pelo RH não recebem esse desconto presumido. O detalhe identifica a aplicação do almoço padrão.

Validação consolidada: 172 testes em 16 arquivos passaram; dois cenários locais de navegador e dois sobre o build publicado passaram, em computador e celular. Os cenários do banco de horas usam dados sintéticos interceptados no navegador, sem gravar no servidor. Lint, tipos, arquitetura e build passaram; JS/CSS gzip 1737,20 KiB dentro do limite existente.

Verificação pública: login HTTP 200, assets PontoEletronicoView-MSk5s1EA.js e ArquivosView-DHgfWJEK.js acessíveis; API de sincronização continua retornando 401 sem sessão. Sem erros de página e sem logs error/fatal encontrados na consulta do deployment. O domínio marcellapp.vercel.app aponta para o deployment acima.

Sem alteração de batidas, gestão de ponto persistida, pagamentos, folha, DRE, permissões ou APK. Nenhuma migração ou gravação de negócio executada para esta entrega.

Evidências locais: C:/Users/hygor/ponto-almoco-release-*.log, C:/Users/hygor/ponto-almoco-production-browser.log e C:/Users/hygor/ponto-almoco-production-smoke.json.
