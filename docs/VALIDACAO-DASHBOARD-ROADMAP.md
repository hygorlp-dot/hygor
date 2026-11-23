# Validação da Dashboard MARCELL

Revisão de 23/11/2026. Etapa 4 do roadmap da Dashboard MARCELL Plataforma.

## O que foi observado

A sessão consultada em produção mostrava 12 obras e a versão anterior da Dashboard. A consulta serviu para dimensionar o ensaio local. Os dados da operação ficaram no ERP e a verificação usou apenas informações visíveis na tela.

Na prévia local, os cenários sintéticos usam 12 e 36 obras, oito profissionais por obra, dias com ponto incompleto e pendências simultâneas. As tarefas foram adaptadas para Gestão, Engenharia e RH, usando as permissões de cada perfil.

| Cenário no celular | Gestão | Engenharia | RH |
| --- | ---: | ---: | ---: |
| 12 obras, distância da primeira à última linha antes da busca | 2.818 px | 2.818 px | 1.034 px |
| 36 obras, distância da primeira à última linha antes da busca | 9.117 px | 9.118 px | 3.290 px |

Essas distâncias descrevem o layout num navegador automatizado. O tempo de decisão depende de um teste com operadores.

## Ajuste aplicado

O Placar das obras ganhou o campo **Buscar obra**. Ele aceita parte do nome com ou sem acentos, combina com o filtro de situação e mantém a consulta ao retornar do Diário de obra. A ajuda contextual e o manual já orientam o uso do campo.

O filtro atua sobre as linhas já carregadas pela Dashboard. Nenhum registro financeiro ou operacional é criado ou alterado. A fonte e os cálculos do DRE permanecem os mesmos.

## Resultado da validação local

- O Playwright passou em 18 cenários. No MARCELL Plataforma, Gestão, Engenharia e RH foram conferidos com 12 e 36 obras, em 1440 e 390 px. Preciso, Noite e Cristal foram conferidos nas duas larguras com 36 obras.
- Ao buscar a última obra sintética, o placar exibiu uma linha, a 60 px do fim do campo no desktop e a 86 px no celular. A consulta sem acentos, o filtro de situação, a troca de dia, a limpeza da consulta e a recuperação da busca após voltar do Diário foram conferidos nos perfis aplicáveis. O Plataforma também foi conferido com texto a 200%.
- `npm run validate:local` passou, incluindo lint, arquitetura, tipos, manual e build. Os 84 testes selecionados de Dashboard, Diário, Ajuda, comandos e API de custo acumulado passaram. O detector do Impeccable não apontou ocorrências no componente do placar.

## Rodada com operadores

Há três janelas de ensaio local, **Piloto Gestão**, **Piloto Engenharia** e **Piloto RH**, com 12 obras fictícias e data simulada de 20/11. Em Engenharia e RH, a obra indicada é **Residencial Ipê**. O ensaio permite navegar e conferir as telas de origem. A etapa em operação usa os perfis e registros habituais da empresa quando a versão atual estiver disponível nesse ambiente.

Para abrir as três sessões a partir da raiz do repositório, com a prévia disponível na porta 4274, execute `node artifacts/dashboard-plataforma/piloto-ensaio-atual.mjs`. Use `--check` para repetir a conferência automatizada em 1440 px e `--check --mobile` em 390 px. O ensaio usa dados fictícios e bloqueia gravações e requisições a domínios externos.

Cada pessoa começa na Dashboard. Oriente a pensar em voz alta e observe a primeira tentativa antes de dar qualquer dica. Registre o papel da pessoa e use um identificador sem nome na planilha de observação.

| Perfil | Tarefa para ler à pessoa | Como conferir |
| --- | --- | --- |
| Gestão | “Você acabou de abrir o ERP. Qual pendência você trataria primeiro? Abra a tela em que conferiria o motivo.” | Identifica a ação em até 10 segundos e chega ao módulo esperado. |
| Engenharia | “Confira o diário de ontem da obra indicada e diga o que falta para o próximo marco. Volte ao painel.” | Seleciona a obra e a data corretas, abre o diário correspondente e retorna ao mesmo recorte. |
| RH | “Compare as faltas registradas hoje e ontem na obra indicada. Diga se um ponto em branco entra na contagem.” | Confere os dois dias e distingue falta lançada de ponto sem registro. |

Para cada tarefa, registre tempo, resultado, primeira escolha, pedidos de ajuda e eventuais erros de interpretação. Ao final, pergunte quão fácil foi a tarefa numa escala de 1 a 5 e o motivo da nota. A rodada com operadores na versão atual ainda está pendente.

| Identificador | Perfil | Tempo | Primeira escolha | Concluiu sem ajuda? | Facilidade de 1 a 5 | Observações |
| --- | --- | ---: | --- | --- | ---: | --- |
| | | | | | | |

## Ensaio automatizado na prévia atual

Os três perfis passaram a 1440 e 390 px. Gestão abriu Medições a faturar a partir da primeira pendência de Atenção agora. Engenharia abriu o RDO-019 do Residencial Ipê, de 19/11, conferiu que faltavam dois dias para o marco de três e voltou com a busca preservada. RH conferiu cinco presenças e uma falta para Hoje, e quatro presenças e duas faltas para Ontem. Dois profissionais sem registro ficaram fora da contagem de faltas em ambos os dias. A conferência observou ausência de erros de página e tentativas de gravação.

As três sessões foram abertas para uso assistido. Os seis cenários acima são de navegador automatizado. O quadro de observação continua em branco até a execução com operadores. [Capturas por perfil](../artifacts/ensaio-perfis-ponto/).
