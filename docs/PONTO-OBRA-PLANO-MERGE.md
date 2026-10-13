# Ponto de Obra — plano de merge das PRs #69 a #77

13/10/2026. **Nenhum merge foi feito.** Cada merge na `main` dispara o deploy
de produção da Vercel (com `prebuild`): exige autorização da direção e a
ordem do runbook (`docs/PONTO-OBRA-RUNBOOK-PRODUCAO.md`).

## Grafo de dependências

```
main (8c5e52a)
 └─ #69 fix/ponto-obra-fase-01-estabilizacao ............ 7293b3d
     ├─ #70 feat/ponto-migration-019-preliminar ......... 058a71a
     │   └─ #71 feat/ponto-livro-migracoes .............. 554ab31
     │       └─ #73 feat/ponto-homologacao-isolada ...... 4c7e8b5  (contém #72 por merge)
     │           └─ #77 integ/ponto-hardening-piloto .... 53a7272  (= #73 + #76 + #75; tag ponto-homologacao-rc1)
     └─ #72 feat/ponto-obra-precision-fase01 ............ 2c15bdc
         ├─ #74 fix/ponto-pin-no-servidor ............... 14b323a
         │   └─ #76 fix/ponto-limite-pareamento-pin ..... 2021ab3
         └─ #75 feat/ponto-observabilidade .............. 0a6eb92
```

## Ordem e procedimento

| Passo | PR | Base no momento do merge | Observação |
|---|---|---|---|
| 1 | #69 | `main` | deploy: 016–018 reaplicadas como hoje |
| 2 | #70 | retargetar para `main` | só arquivos da 019; **não aplica** |
| 3 | #71 | `main` | trava + gate no deploy; **antes:** fuso UTC do banco confirmado e backup real restaurado (runbook) |
| 4 | #72 | `main` | app; servidor só ganha o campo `ambiente` e a recusa 409 |
| 5 | #73 | `main` | `guarda-prebuild.mjs` entra no `prebuild`; na produção sai 0 sem conectar |
| 6 | #74 | `main` | PIN no servidor só com o flag; padrão desligado = igual a hoje |
| 7 | #76 | `main` | limites (sem migration nova) |
| 8 | **#77** | `main` | traz a #75 **com o conflito do `App.js` já resolvido** e os documentos da integração |
| 9 | #75 | — | fica contida pela #77; fechar como incorporada (não mesclar à parte) |

Regras:
- **Sempre "Create a merge commit".** Squash ou rebase reescrevem os commits.
  Isso quebraria as PRs empilhadas e duplicaria o histórico.
- Depois de cada merge, retargetar a PR seguinte para `main`
  (`gh pr edit <n> --base main`) e esperar os 5 jobs verdes **na PR
  retargetada** antes de mesclar.
- Nunca mesclar a #75 sozinha depois da #76: ela conflita no `App.js`. A #77
  já contém a resolução.
- A migration 019 **não** é aplicada por nenhum destes merges. Ela segue o
  runbook: livro implantado → janela → `--verificar` = GO 019.

## Validação (branch descartável, local)

Branch `sim/merge-ponto-*`, criada a partir de `origin/main` `8c5e52a`,
com merges `--no-ff` na ordem acima:

| Resultado | Valor |
|---|---|
| Passos 1–7 | sem conflito |
| #75 direto depois da #76 | **conflito** em `apps/ponto-obra/App.js` (esperado) |
| #77 depois da #76 | sem conflito |
| Árvore final × #77 | **idêntica** (`git diff` vazio) |
| Branches #69–#77 contidos no resultado | 9 de 9 |
| Commits novos fora das PRs | 0 (só merges) |
| Commits da #77 ausentes | 0 |

Como a árvore final é idêntica à da #77, vale para ela a CI da #77 (5 jobs
verdes em `53a7272`).
