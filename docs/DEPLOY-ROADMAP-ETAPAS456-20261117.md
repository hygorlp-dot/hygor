# Publicação consolidada — etapas 4, 5 e 6

Publicação autorizada pelo usuário e concluída em 17/11/2026 em https://erp.marcelleng.com.br/.

- Deployment: `dpl_4WhqJmC6HjAaTMedMvGT9NbLHroJ`, estado `READY`, destino `production`.
- Commit: `c3f15b657749b3de070f3cae6104a77202a5a61b`.
- URL imutável: https://mrc-52pki5zq7-hygor-s-projects1.vercel.app.
- Base: produção anterior `287d8ae952e74d46fd58e14ddd4638f25cd2f55d`.
- Checkout isolado: `C:/dev/releases/usability-roadmap-stages4-6-20261117`.

## Escopo e preservação

Operação no celular, integridade de recebimentos e conversões, continuidade entre setores e recuperação de falhas/rascunhos de medição, conforme os relatórios das três etapas. O código de execução do pacote foi comparado com o checkout validado, preservando as alterações existentes. Outros trabalhos locais e o branch remoto principal não foram sobrescritos.

Houve um único deployment, um único build remoto e nenhum build local intermediário nesta publicação. A publicação automática foi desativada somente para o branch isolado de release; o envio do commit não gerou deployment automático. O build explícito executou auditoria de ciclos, Vite e métricas do bundle, sem executar o prebuild de migrações. Nenhuma migração ou mudança de dados foi executada nesta publicação.

## Evidências

- 408 testes em 26 arquivos passaram na release; lint, design, manual e TypeScript passaram.
- Auditoria de importações: 931 arquivos, 3284 relações e nenhum ciclo detectado.
- Build remoto concluído em 25 segundos; JS/CSS compactados: 1791,81 KiB, abaixo do teto existente de 1891328 bytes. Nenhum limite aumentado.
- 89 cenários do frontend publicado passaram em larguras de celular e desktop, com APIs simuladas e isoladas do backend real.
- Entrada real: HTTP 200 em 390 e 1440 pixels, sem erros de JavaScript, assets ausentes ou transbordamento horizontal. Consulta sem autenticação recebeu HTTP 401.
- O domínio do ERP foi consultado novamente e aponta para o deployment acima em estado READY. A listagem por commit confirmou exatamente um deployment.

Logs e capturas locais: `C:/dev/repositorio-mrc/artifacts/roadmap-usabilidade-etapas456-deploy/`, incluindo `unit-release.log`, `lint-release.log`, `typecheck-release.log`, `cycles-release.log`, `build-production.log`, `e2e-production.log` e `production-login.json`.

## Limites e efeito no DRE

Os cenários autenticados do frontend usaram dados fictícios; não comprovam transações reais no OneDrive, permissões remotas completas ou uso em aparelho físico. Os testes transacionais de integridade e unicidade do custo foram executados em ambiente sintético, incluindo PGlite. Os registros existentes não foram alterados pelos testes e os lançamentos antigos removidos pelo usuário não foram recriados.

A publicação por si só não cria previsão, compromisso, estoque, custo reconhecido ou pagamento e não altera o resultado realizado do DRE. As regras e evidências de integração permanecem nos relatórios das etapas. A nota heurística local permanece 8,4/10; não há evidência para declarar 9,5.

A ajuda e o manual atualizados nas etapas foram incluídos no pacote e passaram na validação. Este registro posterior documenta a publicação e não muda instruções operacionais; permanece local, sem novo push ou deployment.
