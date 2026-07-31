# Workbox

## Problema

Cache controlado de shell e assets de PWA.

## Alternativas

Vite sem service worker; menor superfície de cache.

## Versão analisada, licença e compatibilidade

`workbox-build` 7.4.1, MIT, requer Node 20+. A documentação oficial oferece
precache e orienta tratar registro e atualização de service worker de forma
explícita.

## Bundle e segurança

O piloto adiciona apenas a ferramenta de build, sem runtime no operador. Respostas
autenticadas, tokens, salários, PIX, CPF, extratos, conciliação e DRE ficam
proibidos de cache.

## POC e testes

`npm run pwa:generate` produz `dist/sw-shell-poc.js` depois do build. O manifesto
tem sete ativos públicos de bootstrap (476.932 bytes no build de referência), sem
`runtimeCaching`, sem `clientsClaim`, sem `skipWaiting` automático e sem registro
no navegador. O teste protege a lista de ativos e proíbe explicitamente chunks
legados, planilhas, gráficos e imagens pesadas; a inspeção do worker confirma a
ausência de `/api/`, Supabase e termos financeiros.

## Riscos, decisão e rollback

**Adotar somente como POC de build.** O worker não é servido nem registrado, logo
não altera sessões atuais. A ativação exige teste E2E numa imagem homologada,
tela de atualização e revisão de privacidade. Rollback remove o script e, se
futuramente registrado, desregistra o worker e incrementa a versão do cache.
