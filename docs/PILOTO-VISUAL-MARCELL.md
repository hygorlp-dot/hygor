# Piloto visual MARCELL

Continuação: [expansão para a operação web](REBRANDING-EXPANSAO-MARCELL.md), com nova tipografia e prévia na porta 4198.

Implementado localmente em 30/10/2026, após aprovação da direção descrita no
[diagnóstico](REBRANDING-MARCELL-2026-10-30.md). Escopo: Dashboard, Compras e
Financeiro. Sem push, PR, deployment ou migração de banco.

## Revisão local

Prévia: http://127.0.0.1:4196

- E-mail: `piloto@local.test`
- Senha: `piloto-local`
- Dados fictícios; a API da prévia responde em memória no próprio processo.
- Reiniciar: `node scripts/rebranding-pilot-preview.mjs`.
- A prévia usa o código real do app. Nenhum backend de produção é necessário.

As capturas em `artifacts/rebranding-pilot/` usam o mesmo conjunto isolado de
dados, com notas, vencimentos, solicitações, cotações, pedidos e duas obras.

## Mudanças

- Fundo operacional neutro, marca e logo MARCELL preservadas.
- Título, contexto e controles com a mesma hierarquia nos três módulos.
- Botões de 40 px no desktop e alvos de 44 px no mobile, respeitando a
  preferência de densidade no desktop.
- Dashboard com indicadores compactos e valores monetários completos. As
  contagens do painel gerencial aparecem diretamente, sem animação numérica.
- Obras e ações lado a lado no desktop. Outras pendências, resumos e notícias
  são acessíveis por regiões expansíveis.
- Compras com a fila antes do comparativo por obra. Busca visível no mobile;
  filtros avançados e exportação ficam no botão Filtros. Recolher não limpa
  os campos nem altera o agrupamento.
- Financeiro com seleção de área e de fila no mobile; documento, vencimento,
  valor e acesso ao memorial agrupados no registro.
- Uma barra inferior no mobile. As demais telas do módulo continuam
  acessíveis no seletor do cabeçalho; a lista respeita as permissões existentes.
- Cálculos, autorização, gravação e integrações permanecem nos fluxos atuais.

Os componentes `PageHeader`, `WorkspaceNavigation` e `WorkspaceFilters`
formam a base reutilizável do piloto. O CSS está limitado a
`main[data-workspace]` e às receitas próprias desses componentes. Não houve
troca de biblioteca, de fontes ou de implementação do motor financeiro.

## Verificação

- Compilação local direta pelo Vite passou, sem executar o `prebuild` que
  contém migrações. O bundler ainda informa chunks grandes no legado.
- Lint e typecheck passaram.
- 84 testes unitários/de contrato passaram em 14 arquivos, com dois workers.
  A tentativa inicial com paralelismo padrão falhou na inicialização dos
  workers; a execução limitada concluiu. Um teste de autoria do Financeiro
  passou a conferir as props necessárias sem depender de espaços ou da
  ausência de outras props na chamada.
- Cinco jornadas Playwright de Compras passaram: busca e retorno, recebimento
  parcial sem pagamento, formulários mobile, comparativo por obra e cabeçalho.
- O script `node scripts/rebranding-pilot-verify.mjs` passou com 14 capturas,
  sem erro de runtime ou comando de negócio durante a inspeção visual.
  Inclui 320, 390, 1024 e 1440 px e texto ampliado a 200% em Compras e Financeiro.
- Conferidos abertura/fechamento do memorial, preservação da obra e dos
  filtros, troca de área e fila no mobile, acesso aos indicadores adicionais
  e troca de tela pelo cabeçalho.

No cenário de revisão em 390 × 844, o primeiro registro de Compras começa a
607 px, o de Financeiro a 528 px e a primeira ação do Dashboard a 663 px.
Essas posições descrevem o cenário testado, não um limite garantido para
todas as fontes, registros, perfis e preferências de tamanho.

O detector Impeccable foi executado nos arquivos alterados e gerou
`artifacts/rebranding-pilot/impeccable-detect.json`. Os quatro avisos do tipo
warning estão em fontes de relatórios legados; os quatro advisories do novo
CSS são a cor e os degraus tipográficos do piloto, agora documentados no
DESIGN.md. Os demais advisories pertencem ao código extenso já existente.
Não se trata de certificação de acessibilidade de todo o ERP.

## Limites do piloto

O ambiente de revisão usa dados fictícios. Impressão, Android, TV, portais e
os demais módulos não receberam a migração visual desta etapa. Os relatórios
anteriores do React Doctor continuam parciais e não foram usados como
aprovação. A expansão do rebranding deve reutilizar as receitas aprovadas
após a avaliação deste piloto.
