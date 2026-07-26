# size-limit

## Problema

Evitar regressão de bundle.

## Alternativas

O ARCD já possui `scripts/bundle-metrics.mjs`, executado no CI, que registra os
assets e falha quando um chunk JS ultrapassa 600 kB gzip.

## Versão analisada, licença e compatibilidade

`13.0.1`, MIT, Node `^22.18 || ^24 || >=26`.

## Bundle e segurança

Dev-only; sem impacto runtime. Duplicaria relatório e manutenção existentes.

## POC e testes

Converter progressivamente o script interno em limites por entrypoint, preservando
o JSON atual e cobrindo-o com teste de script; não instalar outra ferramenta.
O piloto cria orçamentos versionados para total, LegacyApp, planilhas, gráficos,
vendor, portal e chunks novos. O relatório passa a registrar as violações.

## Riscos, decisão e rollback

**Substituir por solução interna — gate aprovado.** A linha de base passou com
1.110,86 kB gzip e todos os limites de chunk. Um único medidor evita dois
formatos de relatório. Rollback é reverter apenas o orçamento adicional do
script interno.
