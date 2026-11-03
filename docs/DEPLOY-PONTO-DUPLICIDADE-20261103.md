# Publicação da conferência de batidas repetidas

Publicação autorizada em 03/11/2026. Este registro complementa a validação local de `PONTO-ENTRADA-DUPLICADA-20261103.md`.

## Fonte e preservação

A produção estava em `9d022625`, posterior à base local da correção. Foi criado o checkout isolado `C:/dev/releases/ponto-duplicidade-deploy-20261103` sobre essa produção e aplicada somente a correção de duplicidade (`68f1f7ee`). O conflito restrito ao guia de ajuda foi resolvido conservando o conteúdo vigente e acrescentando a orientação de repetição.

A revisão do aplicativo completo detectou uma ligação ausente anterior: a tela Ponto eletrônico não recebia `dispatchAttendanceCommand` nem `onTab`. O commit `acb4f772a9a45cce69b467eab2deab91c56d134d` restaura as ações existentes de conferência e cadastro, sem alterar as regras de permissão.

Não houve push, PR, migração, alteração do APK ou escrita em registros operacionais, batidas ou pagamentos reais.

## Verificação

- 223 testes aprovados em 19 arquivos sobre a base atual de produção.
- Dois cenários isolados de navegador: desktop e celular, com conferência e justificativa.
- Dois cenários adicionais no aplicativo completo local: desktop e celular, cobrindo navegação, repetição, ambas as originais e abertura da conferência sem horários inventados.
- Lint, tipos, arquitetura, auditoria de ciclos, manual e build aprovados; orçamento de bundle aprovado sem elevar limites.
- Conferência do pacote com `vercel deploy --dry`: referência de geometria operacional e detector incluídos; cenários de testes e credenciais excluídos.
- No domínio publicado, os dois cenários do aplicativo completo passaram novamente em 1440 e 390 pixels. Todas as APIs dessas sessões foram interceptadas com dados sintéticos, sem comandos de gravação. Não representam homologação com funcionário ou aparelho real.

Logs locais: `C:/Users/hygor/ponto-duplicidade-release-tests.log`, `ponto-duplicidade-fullapp-check.log`, `ponto-duplicidade-production-final-check.log`, `ponto-duplicidade-final-{lint,types,build,deploy}.log`.

## Deploy final

Projeto `mrc` (`prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`), equipe `team_poBZ5I1rwStzhvD73ar22b7v`.

Houve dois builds: `dpl_7bpjH4mn9UNdAPDdmLAed9Pa7axD` continha a sinalização; a conferência posterior encontrou a ligação ausente. O build corretivo final é `dpl_BN1wwJa2knWY1fN4T782f6uv5BWN`, READY, promovido sem reconstrução. Não foi criado preview.

URL imutável: https://mrc-oqz8n3wml-hygor-s-projects1.vercel.app. Endereço principal: https://marcellapp.vercel.app. Alias conferido pela API autenticada apontando ao deployment final. HTML público retornou HTTP 200 e entry `/assets/index-B_Jm4uca.js`; a ligação da conferência foi confirmada no JavaScript publicado e pelo ensaio de navegador.

Build remoto usa o comando direto de auditoria, Vite e orçamento configurado em `vercel.json`, sem executar prebuild ou migrações.
