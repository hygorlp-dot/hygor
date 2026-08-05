# Equipamentos — Fase 2: calendário único de disponibilidade

Data da análise: 4 de agosto de 2026.

## Comportamento anterior

Locações eram validadas pelo domínio da Fase 1 contra locações, manutenções e o
estado do cadastro. A grade mensal, porém, continuava sendo uma projeção própria
de locações. Reservas, transportes, inspeções, avarias e bloqueios não possuíam
uma entidade comum nem apareciam juntos no calendário.

O cálculo anterior também somava todo registro que tocasse o período. Duas
locações sequenciais, sem simultaneidade, podiam parecer concorrentes quando a
consulta abrangia ambas. A disponibilidade correta precisa ser o menor saldo
em qualquer instante do período, calculado pelos pontos de mudança dos eventos.

## Persistência e concorrência

A fonte persistida da aplicação nesta fase permanece o snapshot
`company_app_data`. Será adicionada a coleção aditiva
`equipmentUnavailability`, sem remover `locacoesEquip`, `manutencoesEquip` ou
`transferenciasEquip`.

O servidor já executa todo comando operacional dentro de uma transação
PostgreSQL que:

1. bloqueia a linha da empresa com `SELECT ... FOR UPDATE`;
2. relê o snapshot depois de obter o bloqueio;
3. executa a validação de domínio contra esse estado atual;
4. grava resultado e auditoria antes de liberar a transação.

Logo, duas solicitações para a última unidade são serializadas: a segunda só é
calculada depois que a primeira foi persistida e recebe conflito. A Fase 2 usa
essa garantia existente e adiciona um teste de concorrência do comportamento.
A migração para tabelas relacionais e bloqueio por equipamento continua sendo
responsabilidade explícita da Fase 7.

## Menor alteração segura

- Criar a entidade canônica de indisponibilidade com os oito tipos previstos.
- Materializar eventos criados pelos comandos novos e projetar registros
  legados que ainda não tenham evento correspondente.
- Fazer locação, reserva e manutenção consultarem o mesmo motor puro.
- Calcular o pico real por pontos de mudança, não pela soma indiscriminada do
  período inteiro.
- Usar transportes como eventos informativos no legado atual, pois a
  transferência ocorre dentro de uma locação e não deve consumir a mesma
  unidade duas vezes.
- Substituir a grade de ocupação por calendário que mostre texto, ícone/sigla,
  quantidade e saldo livre, além da cor.

## Arquivos previstos

- `src/domains/equipamentos/availability.js` e testes;
- `src/domains/equipamentos/commands.js` e testes;
- `src/LegacyApp.jsx` para normalização, formulários e calendário;
- testes de política/concorrência do servidor;
- esta documentação.

## Compatibilidade

Registros antigos continuam legíveis. O motor projeta locações, manutenções e
transferências legadas somente quando não existe um evento materializado com o
mesmo vínculo, evitando duplicidade. Campos e coleções novos são opcionais na
normalização e nenhuma migration destrutiva é necessária.

## Resultado da implantação

Implementado em 4 de agosto de 2026:

- entidade `equipmentUnavailability` com quantidade, período, tipo, motivo,
  estado, obra, vínculos de origem, autoria e versão;
- oito tipos canônicos: locação, reserva, manutenção, inspeção, transporte,
  avaria, bloqueio administrativo e quarentena;
- motor por pontos de mudança que retorna total, inativo, locado, reservado,
  manutenção, bloqueado, livre, excedido, data crítica e conflitos;
- materialização automática de locações, manutenções e transportes, com
  projeção compatível para registros legados;
- comandos auditáveis para criar, editar e cancelar reservas e bloqueios;
- locação, reserva e manutenção bloqueadas pelo mesmo cálculo no servidor;
- calendário mensal com siglas textuais, motivo no detalhe, quantidade por
  tipo e saldo livre, sem depender apenas de cor;
- teste de duas reservas serializadas disputando a última unidade disponível.

## Banco de dados

Nenhuma migration foi necessária nesta fase. A nova coleção é persistida no
snapshot versionado. O caminho autoritativo do servidor já usa transação e
`SELECT ... FOR UPDATE` antes de reler e validar o snapshot. A modelagem
relacional por equipamento/unidade permanece reservada para a Fase 7.

## Qualidade

- `npm ci`: aprovado;
- lint, arquitetura e typecheck: aprovados;
- 852 testes unitários em 189 arquivos: aprovados;
- cobertura global: 82,93% statements e 90,48% linhas;
- disponibilidade: 96,38% statements, 90,36% branches e 98,43% linhas;
- build de produção, Storybook e bundle: aprovados;
- 25 cenários E2E: aprovados.

## Riscos e pendências

- O bloqueio transacional ainda é da linha inteira da empresa, seguro porém
  mais amplo que o bloqueio por equipamento planejado para a Fase 7.
- Transferências legadas são informativas para evitar dupla contagem durante
  uma locação; o ciclo de transporte dedicado será refinado na Fase 4.
- `npm ci` informou quatro vulnerabilidades transitivas (uma moderada e três
  altas). Não foi aplicado `npm audit fix`, pois isso mudaria dependências fora
  do escopo e exige validação própria.
