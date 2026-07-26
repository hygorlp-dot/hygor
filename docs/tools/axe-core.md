# axe-core com Playwright

## Problema

Erros repetitivos de rótulo, nome acessível, ARIA e foco não são detectados de
forma sistemática.

## Alternativas

Revisão manual exclusiva, indispensável porém não escalável sozinha.

## Versão analisada, licença e compatibilidade

`@axe-core/playwright` 4.12.1, MPL-2.0; a documentação oficial do Playwright
indica a integração. Executa sobre páginas reais do piloto Playwright.

## Bundle e segurança

Dev-only. Não transmite dados; resultados podem conter seletor/markup e serão
artefatos internos.

## POC

Planejada para o login com bloqueio apenas de violações críticas. Não executada:
o browser da POC Playwright não inicia neste host por dependências do sistema.

## Testes

Regra de exclusão explícita, nunca global; revisão manual mantém contraste,
ordem de foco e conteúdo contextual sob responsabilidade humana.

## Riscos, decisão e rollback

**Adiar — dependente do gate Playwright.** Não foi instalado de forma persistente;
o rollback da POC removeu helper e teste sem efeito runtime.
