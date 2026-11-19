# Deploy — homologação financeira, PIX e usabilidade — 17/11/2026

Publicação autorizada pelo usuário e concluída em https://erp.marcelleng.com.br/.

- Deployment: `dpl_DAoawDJB8371Kvfe9svaoudhKUbF`, estado `READY`, destino `production`.
- Commit: `e039c36695e212253def6cdf45fa82d8098606be`.
- URL imutável: https://mrc-gzk87nceb-hygor-s-projects1.vercel.app.
- Base de produção preservada: `c3f15b657749b3de070f3cae6104a77202a5a61b`.
- Checkout isolado: `C:/dev/releases/audit-financial-usability-20261117`.
- Branch: `codex/audit-financial-usability-20261117`.

## Conteúdo e preservação

Inclui as correções descritas em `docs/CORRECOES-AUDITORIA-FINANCEIRA-20261117.md`: estado e pendências da homologação separados, detalhes e filtros das diferenças, identificador de extrato separado da chave PIX, normalização consistente entre tela e motor, mensagens de atualização, contexto e retorno, navegação móvel do lead, alvos de toque, foco da solicitação de compra e clareza do compartilhamento no portal.

A comparação dos arquivos anteriores com a produção confirmou a base correta. Os 23 arquivos do pacote foram copiados do checkout validado com conferência de hash; o único ajuste adicional de configuração desabilita deploy automático para este branch de release. Os demais trabalhos locais, arquivos de dados e regras de acesso foram preservados. O checkout principal continua no mesmo commit e manteve os hashes dos 15 arquivos de execução/manual conferidos na validação.

## Publicação e validação

- Exatamente **um deployment**, **um build remoto** e nenhum build local adicional nesta publicação. A consulta de deployments pelo commit confirmou uma única entrada.
- O push do branch não gerou deployment automático. A criação explícita da produção utilizou o commit exato já validado.
- Build seguro: `node scripts/audit-import-cycles.mjs && npx vite build && node scripts/bundle-metrics.mjs`. O hook antigo de push, que executaria `npm run build` e migrações de banco, não foi usado; as verificações foram feitas separadamente na release.
- 273 testes aprovados novamente em 26 arquivos no checkout de release. Lint, design e manual aprovados. Os testes e verificações locais anteriores continuam documentados no relatório da correção.
- Build remoto concluído em **28 segundos**. Auditoria de importações: 934 arquivos, 3.299 arestas, nenhum ciclo estático ou total.
- JS/CSS gzip remoto: **1.794,93 KiB**, abaixo do teto existente de **1.847 KiB**, sem ampliar limites.
- **36 cenários passaram no frontend publicado**, incluindo homologação, PIX ausente/divergente, atualização sem conexão, alvos de toque, foco da compra, preservação do lead, retorno entre setores e perfis restritos. Larguras de 320, 390 e 1440 px conforme cada cenário.
- Tela de entrada real: HTTP 200 no celular e desktop, sem erro JavaScript, assets ausentes ou transbordamento horizontal. Consulta de dados sem autenticação: HTTP 401.
- O domínio do ERP foi conferido e aponta para o deployment acima. Nenhum erro de associação de domínio foi registrado.

Os cenários do frontend publicado usaram APIs simuladas com dados fictícios e bloqueio de gravações. Isso verifica o código entregue, não uma conciliação ou pagamento real nem todas as permissões remotas. A entrada e a recusa da consulta sem autenticação foram verificadas contra os endpoints reais. Não houve login com credenciais reais, sincronização financeira, preparação de banco, alteração, aprovação, pagamento ou exclusão de registros.

## Impacto no DRE e limites

A publicação não criou previsão, compromisso, estoque físico, custo reconhecido ou pagamento. Não executou migração, não recriou lançamentos removidos e não apagou nem compensou divergências reais do DRE. As regras de reconhecimento permaneceram intactas. A chave de deduplicação do extrato mantém sua finalidade; somente os campos explícitos de PIX podem fornecer essa evidência para a conciliação.

Não foi produzida uma nova nota de usabilidade nem declarada nota 9,5. A ampliação funcional de contratos, a melhoria geral de densidade móvel e a homologação transacional completa permanecem nos limites documentados no relatório anterior.

Evidências: `C:/dev/repositorio-mrc/artifacts/auditoria-financeira-usabilidade-deploy-20261117/`, incluindo manifestos, comparação da base, `unit-release.log`, `lint-release.log`, `build-production-excerpts.log`, `e2e-production.log`, `production-login.json`, metadados e capturas. Os trechos do build são parciais devido ao limite de retorno do conector; o estado READY e o resultado do build foram consultados diretamente na Vercel.

Este registro posterior permanece local. Não gerou outro commit remoto, build ou deployment.
