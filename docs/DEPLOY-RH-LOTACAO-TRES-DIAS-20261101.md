# Publicação da lotação automática pelo ponto — 01/11/2026

Autorização do usuário: publicar a troca de lotação após três dias trabalhados, para qualquer funcionário, preservando alterações em produção, histórico, pagamentos reais e APK.

- Produção: https://marcellapp.vercel.app/
- Vercel: mrc, prj_t7UJ797nm3uYPRSSTlFWWZc42tn7, equipe team_poBZ5I1rwStzhvD73ar22b7v.
- Deployment READY: dpl_GZWDapuwPKNHe2uYNkQmezvwRjSA.
- URL imutável: https://mrc-are3pof5b-hygor-s-projects1.vercel.app/
- Código publicado: 7cdea3ea70fa5e0c06c4a1edfbc0531ad40a0b31.
- Implementação: b80007f85a688d6db253bfaa6cba80af4231bee0.
- Base publicada preservada: 1097fa22, deployment anterior dpl_BrY6aQ4dD4MG4kgi7nUeJciEi61u.
- Checkout: C:/dev/releases/rh-lotacao-tres-dias-20261101, branch codex/rh-lotacao-tres-dias-20261101.

A revisão41c373b2 de telas do outro chat permanece local e não foi publicada aqui. Próximas entregas devem consolidar a base acima para preservar a lotação automática e as publicações anteriores de RH/folha/provisões, tolerância/almoço, Arquivos, temas e navegação. A main remota não contém todas as publicações feitas por CLI. Foi criado somente um deploy de produção, preparado e promovido após inspeção; sem push, PR ou preview.

## Regra publicada

Três datas distintas de presença ou meio período, consecutivas no histórico de dias trabalhados, na mesma obra nova. Folgas/faltas não contam; trabalho em outra obra interrompe a sequência. Exige funcionário ativo com lotação anterior e obra nova ativa. Desligamentos/agendamentos e decisões manuais de lotação posteriores são respeitados. Sem obra explícita não presume destino.

Executa no servidor após salvar ponto autorizado ou sincronizar/conferir batidas, na transação já existente que trava CORE e PONTO. Salva cadastro, histórico de transferência e recibo idempotente junto com o ponto, com incremento de versão. Cliente reaproveita o delta e recusa respostas antigas. Nenhum recálculo de pagamentos ou remanejamento de pontos antigos; vigência da transferência na data da aplicação. Batidas brutas ainda não integradas não fazem a troca.

## Validação

-139 testes em15 arquivos aprovados, incluindo bloqueios financeiros/períodos fechados com PGlite, permissões, histórico e preservação dos pagamentos.
-18 cenários em navegador sobre build compilado: transferência, biometria e tentativa de sobrescrita recusada, folha, provisões, atalhos e grupos em desktop/celular.
-Dois cenários sobre build publicado: sincronização do terceiro dia e exibição da lotação atualizada em Equipes, desktop/celular. APIs interceptadas, dados sintéticos locais; sem gravação de negócio em produção.
-Lint, tipos, arquitetura e auditoria sem ciclos aprovados; ajuda/manual sincronizados (98 guias).
-JS/CSS gzip1747,55KiB, abaixo do teto1748KiB, sem aumento do limite. Prefixos de chunks internos compactados6→3 caracteres, mantendo hashes e nomes críticos de workers/LegacyApp/vendor/planilhas.
-Supabase: somente SELECT em information_schema confirmou as colunas necessárias. Conexão transacional configurada em produção; sem migração ou exposição de credenciais.
-Login público200 em1440/390px, sem overflow, erro de página ou asset ausente. attendance-upsert e attendance-sync-punches retornam401 sem sessão. Alias confirmado no deployment acima.

Consulta de logs encontrou apenas aviso Node24 DEP0169 de url.parse(), durante o GET de verificação (resposta405); nenhuma falha funcional observada. Esse aviso preexistente de runtime não foi suprimido nem tratado alterando dependências.

Não foram alterados os arquivos do APK, permissões, pagamentos reais ou histórico de ponto durante a verificação. As novas transferências ocorrerão pelos comandos normais após os três dias elegíveis.

Evidências: C:/Users/hygor/rh-lotacao-release-*.log, rh-lotacao-production-browser.log, rh-lotacao-production-smoke.json e rh-lotacao-release-status.json. Detalhes da regra em docs/RH-LOTACAO-AUTOMATICA-TRES-DIAS.md do checkout publicado.
