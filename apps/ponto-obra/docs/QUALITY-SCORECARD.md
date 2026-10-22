# Scorecard de qualidade - Ponto de Obra

`scripts/mobile-quality-score.mjs` dá a nota de cada categoria a partir de
**gates objetivos**: nenhuma nota é digitada à mão. Os gates estão em
`scripts/qualidade/gates.mjs`.

## Tipos de gate

- **teste**: um teste nomeado (arquivo + trecho do título `describe › it`)
  precisa existir **e** passar no relatório JSON do Vitest. Teste ausente é
  falha.
- **evidência**: um passo do release-check (`expo-doctor`, bundle, prebuild,
  árvore limpa) precisa ter rodado e passado. Passo não executado =
  "não verificado" (não aprovado; na CI, `--exigir-evidencias` vira falha).
- **estático**: leitura do repositório (versões, CI, docs, ausência de
  "REP-P conforme" nas telas).

Nota da categoria = soma dos pesos aprovados ÷ soma dos pesos × 10, limitada
pelo **teto** quando falta evidência física:

| categoria | teto | enquanto |
|---|---|---|
| Robustez Android | 9,3 | `docs/device-matrix.md` com menos de 3 aparelhos "aprovado" |
| Reconhecimento facial | 8,7 | `docs/calibracao-facial.md` sem "MEDIÇÃO DE CAMPO: registrada" |
| UI/UX trabalhador e encarregado | 9,0 | nenhuma linha da matriz com "ok" em "validação visual" |

O teto só cai com evidência real (aparelho testado, medição de campo
registrada); não há como subir a nota editando números.

## O que bloqueia

- gate marcado `bloqueia` falhando (P0 do Impeccable, expo-doctor, prebuild,
  `.tflite` no bundle, sem log, SQLCipher, offline, ARP, acessibilidade
  crítica, suíte verde...);
- **regressão**: gate de categoria crítica (offline, integridade, segurança,
  acessibilidade, REP-P técnico, testes) que passava em `quality/baseline.json`
  e agora não passa.

Estética subjetiva não bloqueia.

## Rodando

```bash
npm run mobile:release-check                 # tudo (na raiz)
npm run mobile:release-check -- --rapido     # só testes + scorecard
npm run mobile:release-check -- --offline    # sem rede (checks de rede do doctor = não verificados)
npm run mobile:release-check -- --passada 2  # registra a passada da rodada em quality/passadas.json
node apps/ponto-obra/scripts/mobile-quality-score.mjs --salvar-baseline   # nova baseline
```

Saída: `apps/ponto-obra/quality-out/mobile-quality-report.{json,md}` e
`evidencias.json` (na CI: artifact `mobile-quality-report`).

## Loop da rodada

AUDIT → TEST → SCORE → POLISH → TEST → SCORE, **no máximo 3 passadas**
(`--passada` recusa a 4ª). O que ficar abaixo da meta é documentado em
`docs/QUALITY-REPORT.md`, não mascarado.
