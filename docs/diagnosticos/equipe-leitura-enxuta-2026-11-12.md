# Equipe nas Obras: leitura enxuta sem cache de presença

## Mudança

`api/data.js` injeta um novo callback `lerDadosEquipe` exclusivamente em
`ponto-equipe-obras`. O handler continua autenticando e conferindo perfil/aba
antes de chamar a leitura; o usuário e sua obra seguem para a projeção existente.
Os demais fluxos (banco de horas, fiscais, coletores) conservam seus leitores.

A leitura consulta somente:

1. Core e meta de Ponto, em uma consulta por empresa/chaves exatas.
2. Linhas de ponto por obra, paginadas e ordenadas, incluindo `sem_obra`.

Deixa de ler os domínios separados Lookahead, Config, Equipamentos, Patrimônio,
RDO e Orçamentos. Usa os mesmos `decodeAppData`, `mergeDomainRows`,
`withAttendanceSyncedAt` e `mergeAttendanceObjects` do caminho completo para o
fallback core/meta, precedência por célula e tombstones entre obras.

Não restringe a leitura bruta à obra do usuário, pois isso quebraria transferências
entre obras e resolução de tombstones. A projeção autorizada continua acontecendo
posteriormente, como antes. O helper retorna apenas `employees`, `obras` e
`attendance`, os três campos usados pelo painel.

## Frescor e limites

Não há cache de dados ou decisões de autorização. Cada consulta relê tudo que
precisa e propaga falha de leitura em vez de exibir presença vazia. O helper não
faz a compactação/migração transparente de `lerLinha`: consulta é somente leitura.

Para até 999 linhas de obra, são duas consultas ao invés de três no caminho de
recomposição completo. A economia de bytes vem principalmente da exclusão dos
seis domínios. O core continua sendo baixado inteiro: é um blob possivelmente
compactado e não pode ser projetado em campos sem mudança de persistência. O
histórico bruto de sete dias de eventos e as biometrias permanecem inalterados.
Não foi medido ganho total em produção, nem houve deploy ou mudança no banco.

As duas consultas, como as três anteriores, não compartilham snapshot transacional;
não foi introduzida promessa de atomicidade entre cadastros e ponto. A paginação
agora evita truncamento silencioso acima de 1000 linhas de obra.

## Validação

24 testes passaram (dados-equipe, equipe-leitura-autorizada e handler). Cobertura:
seleção por empresa/chave, exclusão de domínios irrelevantes, fallback legado,
compactação, tombstones e timestamps de célula, atualização/remoção sem cache,
paginação, propagação de erro, sessão/perfil/aba negados antes de leitura e
preservação de identidade para a projeção por obra.

Não muda controles, regras de presença ou instruções de uso, portanto a ajuda
existente não exige revisão textual por esta mudança técnica.
