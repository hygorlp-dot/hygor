# TypeScript progressivo

## Problema

Explicitar contratos em módulos novos sem reescrever o monólito.

## Alternativas

JavaScript com JSDoc e testes, mantendo Vite atual.

## Versão analisada, licença e compatibilidade

TypeScript estável, Apache-2.0. A documentação oficial permite migração com
`allowJs`, `checkJs` e ativação gradual de `strict`.

## Bundle e segurança

Sem runtime direto; risco é deslocar esforço para conversão ampla e criar falsos
contratos em domínio financeiro.

## POC e testes

O piloto inclui `src/domains/documentos/upload-retry.ts`, para retentativas de
envio, e `src/observability/local-error-diagnostic.ts`, para diagnóstico local.
Na revisão de 24/11/2026, seis módulos JavaScript passaram a usar `@ts-check`
com contratos em JSDoc:

- `src/domains/obras/work-data-snapshot.js`, para recorte e recomposição dos dados da obra.
- `src/domains/orcamentos/budget-work-context.js`, para seleção e agrupamento de orçamentos por obra.
- `server/closed-dre-command-period.js`, para a guarda de competência de Ponto e Conciliação.
- `server/command-role-policy.js`, para autorização de comandos por perfil.
- `server/operational-command-audit.js`, para montar a trilha de auditoria de comandos operacionais.
- `server/operational-command-persistence.js`, para identificar quando um comando exige persistência financeira e proteger competências fechadas.

Na etapa 5 do roadmap, o piloto passou de oito para dez módulos. A leitura de
quinzenas arquivadas tipa os adaptadores de consulta e as respostas por status.
A retentativa de salvamento tipa a fotografia, as versões e as ações aceitas
na gravação. As seções do blob legado continuam com conteúdo `unknown` e
mantêm as validações que já ocorrem nas rotas.

O próximo ciclo ampliou o piloto para doze módulos. A busca global tipa a
origem, os resultados e os destinos. A verificação de persistência tipa o
adaptador, o perfil de entrada e as respostas por status. Ambos continuam
em JavaScript com `@ts-check`.

Na etapa 2 desse ciclo, o piloto passou para catorze módulos. A navegação
tipa a intenção, os filtros da obra e as entradas da trilha de retorno. A
carga autenticada tipa a versão da fotografia, o perfil, os adaptadores e a
resposta. As coleções da fotografia legada continuam como conteúdo
`unknown` na fronteira dessa consulta.

Na etapa 3, o piloto passou para quinze módulos. O contrato de escrita
legada identifica as operações `save` e `save-sections`, os rótulos de
auditoria, a correlação gerada pelo servidor, as versões e a resposta por
status HTTP. O servidor tipa as seções após a validação do mapa e a expansão
dos deltas, com valores internos `unknown`. O blob completo e a versão
recebida conservam a validação e a coerção existentes. A retentativa usa os
mesmos tipos da escrita inicial.

No início do ciclo seguinte, o piloto passou para 17 módulos. A fila do
Dashboard tipa os registros consultados para compor as prioridades, os perfis
e o contexto de navegação. A leitura do link legado do Portal do Cliente
tipa o recorte do projeto, os adaptadores de comparação de token e assinatura
de foto e o retorno discriminado por status HTTP. As coleções usadas somente
pela projeção editorial existente continuam com valores `unknown`.

A extração do salvamento e da recuperação do CompanyWorkspace ampliou o
piloto para 19 módulos. O hook tipa o snapshot, as entradas de atualização
e os recibos de recuperação. A fila genérica tipa a tentativa, o resultado
e os estados sem exigir tipos para todos os campos do cadastro. As
declarações de tipos de React são usadas apenas no desenvolvimento.

A extração de Relatórios ampliou o piloto para 21 módulos e incluiu seu
primeiro arquivo JSX. O hub tipa os dados que lê, os registros de compras
e administração, as linhas do relatório mensal e os parâmetros de
exportação. O extrato do Caixa de Obra tem contrato próprio para os
movimentos e totais. As regras financeiras continuam nos motores atuais.

A carteira de Obras ampliou o piloto para 22 módulos. A checagem cobre o
recorte de dados da carteira, o cadastro contratual, as fases, a resposta
de preparo de pastas e os comandos com versão esperada. O detalhe da obra
continua ligado à navegação existente e os comandos continuam sujeitos
à validação e às permissões do servidor.

O `tsconfig.quality.json` mantém a checagem estrita, sem emitir arquivos, e o CI
executa `npm run typecheck`. O teste do piloto confere a lista de entradas e
a ativação por arquivo. O restante do JavaScript continua com checagem optativa.

## Riscos, decisão e rollback

**Manter o piloto estrito.** A checagem não acrescenta dependências ao código
executado pelo app. Amplie o escopo por responsabilidade, com casos de teste
dos consumidores antes de incluir outro módulo. Em uma extração financeira,
confira a entrada, a ordem das guardas e a igualdade dos resultados. Para
desabilitar a checagem de um módulo JavaScript do piloto, remova a entrada
correspondente do `tsconfig`, o marcador `@ts-check` e a expectativa no teste.
