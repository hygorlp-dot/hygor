# Lighthouse CI

## Problema

Medir regressões de performance, acessibilidade e boas práticas por rota.

## Alternativas

Métrica local de bundle; ela não mede LCP, CLS, INP ou navegação real.

## Versão analisada, licença e compatibilidade

`@lhci/cli` 0.15.1, Apache-2.0. O projeto oficial permite assertions e coleta em
CI, inclusive saída no filesystem. A instalação foi avaliada e revertida: ela
introduz `tmp` vulnerável por dependências transitivas (`inquirer` e
`external-editor`), incluindo uma vulnerabilidade alta sem correção compatível
oferecida pelo pacote.

## Bundle e segurança

Seria Dev/CI-only e com relatórios privados no filesystem. A dependência não ficou
instalada; `npm audit --audit-level=high` voltou a zero vulnerabilidades após a
reversão.

## POC e testes

Além do risco transitivo, esta máquina não tem Chrome/Chromium instalado. A POC
real dependeria de um runner homologado com navegador. Nenhum script, workflow ou
relatório LHCI foi criado.

## Riscos, decisão e rollback

**Reprovado nesta versão.** Não adicionar ao CI até que uma versão sem a cadeia
vulnerável esteja disponível e seja executada em runner com Chrome. A alternativa
atual é o orçamento interno de bundle, já aprovado e sem dependência adicional.
