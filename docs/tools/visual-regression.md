# Storybook Visual Tests / Chromatic

## Problema

Detectar regressões de componentes, temas e viewports.

## Alternativas

Screenshots locais do Playwright com snapshots versionados.

## Versão analisada, licença e compatibilidade

Storybook Visual Tests é integrado ao Storybook; Chromatic é serviço externo com
custo, armazenamento e política próprios.

## Bundle e segurança

CI-only. Capturas não podem conter dados de obras, pessoas, PIX ou documentos.

## POC e testes

Após Storybook, capturar Button/Input/Card com dados sintéticos e temas. Avaliar
Chromatic apenas se artefatos locais forem insuficientes e houver aprovação LGPD.

## Riscos, decisão e rollback

**Adiar.** Screenshot externo é risco de privacidade. Rollback remove snapshots
ou integração de serviço, sem runtime.
