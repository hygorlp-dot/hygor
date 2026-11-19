# Publicação MARCELL — 31/10/2026

- Produção: https://marcellapp.vercel.app/
- Implantação: `dpl_AVwevKHZNbQu5XDZNaAcJAg3GyDH` (READY).
- URL imutável: https://mrc-liv4ansfx-hygor-s-projects1.vercel.app
- Projeto: `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7` / equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Commit da versão: `70969adc`, branch local `codex/rebrand-workflow-release-20261031`.
- Consolidação isolada: `C:/dev/releases/rebrand-workflow-20261031`.

## Escopo e preservação

Consolida o rebranding e os fluxos locais, preservando as funcionalidades anteriormente publicadas de Ponto, Arquivos, dossiê e PDF. A base publicada `c580442a` foi conciliada com a produção anterior `cb12ca60` e o snapshot local `bc2aa45e`. O backend de produção foi preservado com as alterações necessárias de autorização e recuperação dos fluxos financeiros. A extração de backend em andamento no workspace compartilhado não foi publicada.

## Validação

- 897 testes automatizados aprovados; 14 verificações focadas de preservação aprovadas.
- 72 cenários de navegador aprovados: 56 de continuidade/fluxo financeiro e condições adversas, 14 de Arquivos e 2 de Ponto.
- Lint, TypeScript, arquitetura e build aprovados. Ajuda/manual: 90 guias e 65 abas.
- Versão preparada verificada antes da promoção, com a proteção Vercel mantida.
- Após promoção: domínio principal aponta para a implantação acima; login HTTP 200 em 1440 e 320 px, sem overflow horizontal ou erros de JavaScript.
- JavaScript e CSS publicados: HTTP 200. POST sem credenciais para `/api/data` e `/api/microsoft/onedrive`: HTTP 401. Nenhuma falha de associação de domínio reportada.

Foi criada uma única implantação e promovida sem rebuild. Não houve push, PR ou execução de migrações de banco. As verificações em produção foram de acesso público e rejeição de chamadas sem autenticação; os fluxos autenticados foram validados localmente com dados de teste. O piloto com operadores continua preparado para aplicação posterior.
