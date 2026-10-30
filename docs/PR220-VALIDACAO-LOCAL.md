# PR #220 — recuperação e validação local

## Consolidação autorizada para publicação

Após a validação abaixo, o usuário autorizou em 30/10/2026 a consolidação e
publicação conjunta. A #229 já havia sido integrada e publicada pelo chat
responsável na main `2ba5daa67b0150da63890afcd741ecbdd282f567`. Essa versão foi
preservada na branch da #220, incorporando a resolução de imports já testada na
branch de compatibilidade. Comparada ao commit de compatibilidade `230a68d`, a
consolidação altera somente este registro documental; o código executável é o
mesmo que passou nas validações combinadas. A entrega usa um envio da branch
da PR #220 seguido do fluxo normal de checks e merge, sem republicar a #229
isoladamente ou gerar APK.

## Registro da etapa local anterior

Verificação realizada em 30/10/2026. Sem push, alteração da PR remota, preview,
merge remoto ou deploy. O APK e os dados de produção não foram alterados.

## Recuperação

- Clone isolado: `C:/Users/hygor/mrc-pr220-local`.
- Branch da entrega: `codex/folha-administracao-projecao`.
- HEAD remoto recuperado: `a1bd104638095192a0b29eac4f1a4f9bad573f32`.
- Base integrada localmente: `main` em `89fb23d`.
- Commit local dos testes: `948e627`.

A atualização da main já inclui o seletor `Conciliados` no teste de categorias
da conciliação, que causou a falha do CI anterior. O cenário foi executado
novamente e aprovado em desktop e celular. O cenário MEI que oscilou no CI
anterior também passou nas duas telas, sem mudança das regras do cadastro.

O teste novo verifica os filtros Consolidado, Obras e Administração Central na
Folha, Gestão do ponto e Ponto por obra. Confere engenheira e mestre na Central,
preserva a obra da engenheira ao abrir o cadastro e garante que consultas não
modificam os dados. Sua massa de dados usa diaristas para isolar a classificação
por área; os testes existentes continuam cobrindo CLT e MEI separadamente.

## Resultados da branch da entrega

- Lint, arquitetura, tipos e `vite build --sourcemap false`: aprovados.
- Suíte geral com Node 22.23.4 e dois workers: **3.784 aprovados, 15 ignorados**
  em 491 arquivos (488 aprovados, três ignorados).
- Playwright: **44 aprovados**, cobrindo grupos, projeção, PDF/Excel, CLT, MEI,
  provisões, simulação, fechamento e categorias da conciliação.
- Pacote JS/CSS gzip: **1.728,22 KiB**, dentro do orçamento existente.
- Regressão verificada: o teste novo falha se `LaborAreaTabs` não renderizar os
  filtros. Após restaurar o componente original, passou novamente em desktop e
  celular (dois testes). Nenhuma alteração temporária permaneceu no componente.

Há avisos de desenvolvimento de ResizeObserver no teste de conciliação e avisos
de React/fixtures na suíte geral; não houve testes reprovados nessa rodada.
Não foi necessário alterar a interface ou relaxar os limites para resolvê-los.

## Compatibilidade com a PR #229

A coordenação foi feita com o chat responsável pela jornada e conferência do RH.
Sua suíte geral local encerrou antes de iniciarmos a nossa. Nenhum arquivo do
clone `C:/Users/hygor/ponto-rh-publicacao` foi editado por esta entrega.

A combinação existe somente na branch local `codex/pr220-pr229-compat`, commit
`230a68d672ed7e1878f288e47162d74744f2a8b4`, usando a #229 em `4247f3d`.
Na etapa local anterior, a branch da entrega não incorporava a #229 ainda aberta.

O único conflito foi no início de `src/domains/rh/components/EquipeView.jsx`.
Na consolidação futura, preservar os três imports:

```jsx
import { laborArea } from "../labor-area.js";
import WorkScheduleFields from "./WorkScheduleFields.jsx";
import "../../ponto-eletronico/components/conferencia-batidas.css";
```

As alterações de `LegacyApp.jsx` foram combinadas automaticamente. Foram
preservados a escala do RH, a conferência e integração das batidas, as proteções
de dias bloqueados, arquivamento e competências fechadas.

Validação da combinação:

- **166 testes direcionados aprovados**, em 12 arquivos, incluindo projeção,
  acesso restrito, cadastro, painel do ponto e transações de conferência.
- **Oito testes Playwright aprovados** de grupos, projeção e PDFs. A execução
  com `MRC_PR229_COMPAT=1` também exige os campos de escala no cadastro da
  engenheira, mantendo sua obra.
- **Dois testes de conferência RH aprovados**, em desktop e celular.
- Lint, arquitetura, tipos, build e orçamento aprovados.
- Pacote combinado JS/CSS gzip: **1.731,37 KiB**.

## Continuidade

Logs estão em `.local-validation/`, ignorados pelo Git, com resultados separados
por branch. A integração com a #229 é uma fotografia dos commits acima; novas
alterações dela ou da main precisam de nova conferência antes de publicar.

Não incorporar a correção de provisões legadas de outro chat por este registro:
ela permanece em `C:/Users/hygor/rh-integracao-local`, fora do escopo da #220.
A publicação foi autorizada posteriormente, conforme registro no início deste documento.
