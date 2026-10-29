# Integração da fila — 29/10/2026

Base examinada: `f7424d7860dbc20b978aaf1926e7c0804a59bf59`.
Escopo autorizado: revisar branches, integrar o que está pronto e publicar o conjunto validado.

## Inventário

A fila inicial continha 174 branches remotas e 36 PRs abertos (20 prontos e
16 drafts). Noventa heads já eram ancestrais da main, 43 estavam associados a
PRs encerrados e cinco não tinham PR associado. Branch antiga não equivale a
trabalho novo: a análise usou ancestralidade, equivalência de patches e o
fluxo funcional atual, com histórico Git completo.

## Conjunto integrado

| PR | Entrega |
| --- | --- |
| #163 | Remoção de imports mortos, preservando as regras atuais da conciliação |
| #171 | Remoção de locais mortos, após #163 |
| #184 | Acompanhamento de adoção do módulo de Compras |
| #192 | Exportação Excel de Compras com os filtros da tela |
| #195 | Salvamento autorizado de licenciamento por comando |
| #186 | Guarda SQL para fontes legadas de períodos fechados |
| #189 | Proteção das mutações que afetam DRE fechado |
| #198 | Rateio histórico de salários CLT após arquivamento do ponto |
| #199 | Arquivos imutáveis como fonte de custos de mão de obra |
| #200 | Verificação de prontidão da atribuição de custos por etapa |
| #201 | Serialização entre carga financeira e fechamento |
| #205 | Exclusão de manutenção cancelada do custo do DRE |
| #206 | Evidência bancária no diagnóstico de ativação financeira |
| #207 | Comparação dos campos bancários originais |
| #208 | Evidência de fechamento respeitando a data de corte |
| #211 | Banco de Horas e consulta de ponto, com escopo autorizado no servidor |
| #213 | Equipe nas Obras e modo TV, preservando o payload do APK atual |
| #214 | PDFs MRC e ajustes de colunas/área de impressão |
| #82 | Login por identificação digitada e retirada da lista pública de operadores; adaptado à interface e autenticação atuais |

Também foi integrada `fix/fin-96-gate-fail-closed`: o gate exige prova explícita
de cada comparação. A sanitização de erros do servidor foi recuperada de
#69; esse PR permanece pendente porque contém outras mudanças móveis.

## Correções necessárias na integração

- **Competência e pagamento:** um título de julho pode ser liquidado em
  agosto, mesmo com julho fechado. A guarda usa a competência para o
  reconhecimento e a data efetiva para a liquidação, inclusive estornos.
- **Concorrência:** escritores de fatos financeiros e do ponto travam e
  releem a linha principal antes das linhas de domínio. A guarda não decide
  sobre um estado anterior ao fechamento que acabou de vencer a corrida.
- **SQL repetível:** reclassificação bancária feita em período aberto pode
  ser repetida depois do fechamento sem falso conflito. O rollback da
  migration 022 preserva a função original mesmo quando executado novamente.
- **Arquivos CLT:** arquivos antigos recebem apenas o complemento de
  remuneração ausente; obra, diária e benefícios históricos continuam vindo
  da fotografia. Arquivos compactados também são decodificados. CLI e deploy
  usam a mesma reconstrução autoritativa e recusam fonte ausente.
- **Fotografias fechadas:** o DRE mensal fechado e um ano totalmente fechado
  continuam legíveis sem recalcular arquivos antigos. Meses abertos ainda
  exigem a fonte imutável. O anual mantém os meses em suas posições originais.
- **Banco de Horas:** a API verifica a aba autorizada e a população de
  funcionários do usuário. A jornada completa dos funcionários permitidos
  é mantida, inclusive quando houve transferência entre obras.
- **Busca de categorias:** o foco inicial do modal deixa de sobrescrever
  uma interação já iniciada. Isso evita que o popup feche enquanto a pessoa
  digita, sem remover o foco inicial ou o retorno de foco ao fechar o modal.
- **Login:** nomes, IDs e papéis deixam de sair na resposta pública. Nome
  completo ou e-mail resolve um único operador ativo; sessões existentes
  continuam por ID. Limites de PIN não bloqueiam sessões JWT válidas.

A versão de projeção do DRE foi incrementada para
`2026-10-fila-integrada-custos-competencia-v9`.

## PRs que permanecem pendentes

| PR | Impedimento ou trabalho residual concreto |
| --- | --- |
| #69 | Sanitização recuperada. Escrita única da confirmação fiscal local exige integrar SQLite, memória, sincronização e diagnóstico do APK juntos; dependências antigas não devem substituir versões atuais. |
| #70 | Muda ARP/NSR, relógio fiscal e proteções de dispositivo. Precisa de rodada fiscal própria e reconciliar numeração com a migration 019 atual. |
| #71 | Livro de migrations, backup e gate precisam ser separados da cadeia fiscal e adaptados ao pipeline atual. |
| #72 | UI/feedback parcialmente incorporados por #62; guardas e câmera ainda precisam ser recuperados sem substituir o app atual. |
| #73 | Homologação isolada depende da cadeia fiscal e precisa ser portada separadamente; merge não implica provisionamento de ambiente. |
| #74 | PIN de responsável precisa preservar compatibilidade dos APKs que ainda não enviam esse campo. |
| #75 | Observabilidade pode ser portada isoladamente, sem carregar a base antiga do aplicativo. |
| #76 | Limite por IP parcialmente incorporado em #81; contador atômico e trava persistente precisam ser reconciliados com os mecanismos atuais. |
| #77 | Agrega #69–76; não é uma entrega independente da cadeia ainda incompatível. |
| #119 | PIN obrigatório quebra cadastro facial do APK atual; fechamento misto pode coexistir com o atual e duplicar obrigação. |
| #120 | Herda os impedimentos de #119 e conflita com a conciliação atual; contém ficha do operário e controles ainda não integrados. |
| #121 | Correção de pareamento móvel útil, mas herda #119/#120 e precisa de verificação de teclado/rolagem no APK. |
| #122 | Captura em rajada foi superada pelo desenho de captura frontal de #137; não reintroduzir o fluxo antigo. |
| #137 | Servidor de coexistência de motores parcialmente incorporado em #153. FaceNet-512 e runtime móvel requerem atualização de aplicativo coordenada. |
| #148 | Política de ponto e fechamento precisam coexistir com #164/#169 e com o Banco de Horas #211; herda a duplicação de obrigações. |
| #150 | Terminal autônomo precisa considerar a evolução posterior na branch de release e exige validação/distribuição de APK. |
| #204 | `MeiContractsPanel` usado sem importação; RH vê ação que o servidor permite só a admin; filtro de presença sem consumidor real e ausência de validação MEI no servidor. |

A duplicação de #119 e descendentes foi reproduzida em memória: um título
misto de R$ 100 sem `periodKey` não é reconhecido pelo fechamento atual do
mesmo empregado/período; o resultado são dois títulos, totalizando R$ 200.
O bloqueio deve ser corrigido nas duas direções antes de unir os fluxos.

As branches experimentais de reconhecimento facial, a release Android
`release/ponto-h204-piloto-producao-d9` e a recuperação arquitetural de agosto
não são publicadas por consequência deste deploy web. A recuperação contém
workflows autônomos e versões de dependências de uma base anterior; precisa
ser revista contra a automação atual antes de qualquer ativação.

Nenhuma flag de ativação financeira, integração paga ou publicação de APK é
introduzida por este conjunto. Migrações seguem o pipeline versionado do
projeto; a checagem de acesso público permanece no fim do prebuild.
