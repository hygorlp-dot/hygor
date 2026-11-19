# Melhorias locais no fluxo de desenvolvimento — 18/11/2026

## Escopo e resultado

Implementação autorizada após diagnóstico comparativo com o Vibe Coding Toolkit,
na ordem: instruções compartilhadas, validação local, índice/retomada e análise
pontual. Nenhuma instalação, push, PR, merge, deploy ou operação de banco foi
executada. O checkout já possuía alterações de outras tarefas; foram preservadas.

1. `AGENTS.md` passou a reunir as regras comuns, incluindo todas as seções
   operacionais antes exclusivas do `CLAUDE.md`. O Claude importa `@AGENTS.md`.
   As condições de autorização local/remota foram explicitadas, sem remover as
   obrigações aplicáveis a uma publicação futura autorizada.
2. `package.json` recebeu `build:local` e `validate:local`. O primeiro chama o
   Vite instalado diretamente; o segundo executa lint, arquitetura, tipos e esse
   build em sequência, interrompendo na primeira falha. Os testes são escolhidos
   separadamente; `validate:local` não é uma suíte completa.
3. Foram criados [roteiro de validação](VALIDACAO-LOCAL.md),
   [índice de desenvolvimento](INDICE-DESENVOLVIMENTO.md) e
   [roteiro de retomada](RETOMADA-DE-TAREFAS.md), ligados pelo README e AGENTS.
4. O roteiro de revisão independente agora remete às regras MARCELL vigentes,
   exige rastreamento de dados e evidência por achado e serve a ambos os clientes.
   O guia de TypeScript passou a registrar os dois arquivos efetivamente incluídos.

Os scripts existentes em `package.json`, as dependências, o `prebuild`,
`.githooks/pre-push` e `.github/workflows/quality.yml` foram preservados.
Os novos comandos não têm hooks pre/post no estado revisado. O build gerou
artefatos locais em `dist`, ignorado pelo Git; não houve publicação.

## Verificações executadas

| Verificação | Resultado e limite |
| --- | --- |
| `npm run validate:local` | Aprovado, saída 0: lint, arquitetura, typecheck e build local. O lint inclui design e manual. |
| `node node_modules/vitest/vitest.mjs run src/tooling-architecture.test.js src/tooling-typescript.test.js src/tooling-bundle-budget.test.js` | Três arquivos e seis testes aprovados. |
| Conferência programática contra captura anterior à edição | Regras preexistentes do AGENTS e todas as seções operacionais do Claude preservadas integralmente; scripts existentes, dependências, gates de publicação, fonte de ajuda e manual sem alteração. |
| Conferência de referências locais | Trinta links locais do AGENTS e dos três guias novos verificados como existentes. |
| Revisão do diff e `git diff --check` nos arquivos rastreados desta tarefa | Sem erro de whitespace; escopo restrito a documentação e dois comandos adicionais. |

A arquitetura percorreu 1.789 módulos e 6.213 dependências sem violação das
quatro regras configuradas. O manual foi confirmado sincronizado: 145 guias e
65 abas. Essas contagens são evidências desta execução, não metas fixas.

O build concluiu com avisos de externalização de `fs` usado pelo ExcelJS no
navegador e de tempo dos plugins. Não houve alteração dessas dependências ou
plugins nesta tarefa; a compilação aprovada não comprova o funcionamento de
todas as exportações em navegador.

Não foram executados a suíte completa, testes com PostgreSQL, navegação real,
auditoria de dependências, release check Android ou uma nova sessão do Claude
para observar o carregamento da importação. A ponte foi conferida no arquivo;
isso não é evidência de execução em todos os clientes. Como esta mudança afeta
somente documentação e comandos de desenvolvimento, a validação foi limitada
ao fluxo introduzido e aos testes de ferramentas existentes.

## DRE, ajuda e próximas decisões

Sem efeito no DRE realizado: nenhuma origem de dados operacionais, regra de
custo/receita, projeção, lançamento, pagamento ou persistência foi modificada.
As obrigações de rastrear os vínculos e evitar duplicação de custo foram mantidas.

Ajuda e manual revisados quanto ao impacto: não houve mudança de controle,
fluxo, permissão ou resultado apresentado ao operador. A fonte e o manual
existentes foram preservados e `manual:check` passou; não foi necessário alterar
as instruções do usuário nem regenerar o manual nesta mudança técnica.

Não se instalou ESLint/Biome, RTK, Graphify, Context7 ou telemetria. A análise
pontual aproveitou os gates existentes e tornou sua cobertura explícita. Novas
regras de análise precisam de uma lacuna medida, prova pequena e adoção gradual;
nenhuma necessidade nesta tarefa justificou introduzir dependências ou ampliar
o escopo de tipagem. Os guias registram esse critério para próximas alterações.
