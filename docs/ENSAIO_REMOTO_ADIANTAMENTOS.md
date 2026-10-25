# Ensaio remoto de adiantamentos fictícios

## Resultado da execução

**Concluído em 25/10/2026, às 20:53:02 UTC**, pela API real isolada, com autenticação corporativa e persistência no Supabase de homologação. Foram criados dois adiantamentos, importado um extrato fictício e registradas quatro baixas. Cada um dos sete comandos foi reenviado e confirmou idempotência.

O total pago fictício foi **R$ 1.920,00** e o saldo dos dois títulos ficou **R$ 0,00**. O roteiro conferiu pagamento parcial, quitação, recarga, vínculos, elegibilidade para compensação e preservação do cadastro/ponto/fechamentos/configuração. Os hashes de estado fora do ensaio permaneceram iguais.

O alvo é somente `https://ponto-homologacao.vercel.app/api/data`, projeto `ukkzpttnbyylkyujzwnv`, com marcador `homologacao`. Não há transferência bancária real, alteração do relógio, alteração do ponto ou fechamento da folha de outubro.

## O que foi demonstrado

| Pessoa fictícia | Solicitação em 20/10/2026 | Primeira baixa sintética | Segunda baixa sintética | Saldo final |
| --- | ---: | ---: | ---: | ---: |
| Fulano (`piloto-k110-fulano`) | R$ 1.320,00 | R$ 660,00 | R$ 660,00 | R$ 0,00 |
| Siclano (`piloto-k110-siclano`) | R$ 600,00 | R$ 300,00 | R$ 300,00 | R$ 0,00 |

As baixas também têm data de negócio de 20/10/2026. O relatório registra separadamente o instante real da execução. A parcela de compensação será programada para 31/10/2026: o ensaio verifica a elegibilidade do valor pago, sem criar o holerite ou aplicar antecipadamente um desconto no salário.

O banco é identificado como `BANCO QA FICTÍCIO — SEM TRANSFERÊNCIA`. O total de saídas sintéticas é R$ 1.920,00. A solicitação cria uma obrigação sem caixa; a primeira baixa produz pagamento parcial; a segunda quita a obrigação. Cada comando enviado é repetido com a mesma chave e deve retornar idempotência, sem alterar os registros já gravados. Uma execução posterior preserva etapas já válidas e retoma somente o que falta.

## Arquivos e comandos

- `scripts/simulacao/adiantamentos-homologacao.mjs`: plano fixo e conferência de estado, sem rede ou leitura de credenciais.
- `scripts/simulacao/simular-adiantamentos-homologacao.py`: cliente da API e relatório de execução.
- `src/integration/simulacao-adiantamentos.test.js`: sete testes locais do plano, dos comandos oficiais e das guardas.

Preparar e inspecionar o plano local, sem acessar credenciais ou rede:

```bash
python3 scripts/simulacao/simular-adiantamentos-homologacao.py
```

Somente depois da liberação do ambiente e do seed:

```bash
python3 scripts/simulacao/simular-adiantamentos-homologacao.py \
  --execute \
  --access /caminho/privado/access.json \
  --report .tools/homologacao-adiantamentos-report.json
```

O arquivo de acesso deve estar fora do repositório e sem permissões de leitura para grupo ou outros usuários. E-mail, senha e tokens são lidos apenas durante essa execução; não são impressos nem gravados no relatório. O cliente usa o login corporativo da API. A tela web correspondente abre por padrão em **E-mail e senha**, com os campos **E-mail corporativo** e **Senha**. O PIN de responsável do aparelho é outro mecanismo.

## Guardas antes e depois de cada etapa

O cliente exige endpoint e projeto exatos, marcador de homologação, administrador autenticado, os dois IDs canônicos com `testData=true` e versão da massa correta, obra fictícia e valores contratuais esperados. Recusa outubro fechado ou confirmado, outro adiantamento ativo para a mesma dupla na mesma data, identificadores/chaves já usados por registros diferentes, liquidação revertida, alteração do banco/conta e valores divergentes.

O relógio real deve estar entre 20 e 31/10/2026. Não existe parâmetro de linha de comando para mudar essa data. Os testes unitários fornecem uma data de referência explicitamente; isso não é oferecido na execução remota.

A recarga da API verifica os títulos, as liquidações, os vínculos de conciliação, o saldo a pagar, o caixa e o desconto elegível. Hashes detectam alteração no cadastro, ponto, fechamentos, rescisões, configuração e registros financeiros fora do roteiro. A projeção canônica da DRE da obra de teste em outubro deve permanecer igual ao início. Uma divergência interrompe o roteiro e preserva o relatório parcial para revisão; não há limpeza ou reversão automática de histórico.

## DRE remota e limite da prova

Depois das baixas, foram consultadas pela API real `financial-dre-report` e `financial-company-dre-report`, para outubro de 2026. Ambas retornaram sucesso, fonte `canonical_ledger` e zero ocorrências de integração. A DRE da obra e a da empresa mostraram **R$ 1.920,00 de saídas de caixa**, **R$ 0,00 de contas a pagar** e **R$ 270,00 de custo operacional**, igual ao custo existente no início do ensaio. Esse custo vem do calendário/contratos fictícios já cadastrados; as baixas não criaram um segundo custo.

O ambiente continua no modo de persistência auditada existente (`engineEnforced:false`). Foram aplicadas apenas a auditoria mínima e as nove tabelas/guarda necessárias à conciliação operacional e à leitura da DRE, com acesso direto fechado a `anon` e `authenticated`. Não foram ativados o enforcement ou as RPCs nativas de outro motor financeiro. Títulos e baixas de folha permanecem na fonte transacional já usada pela aplicação.

Relatórios locais reproduzíveis da execução: `.tools/homologacao-adiantamentos-report.json` e `.tools/homologacao-dre-report.json`. Não contêm senha, PIN ou token. Os dados fictícios permanecem no ambiente isolado para a conferência na interface.

Este ensaio remoto não fecha outubro antes do fim do mês, não cria a folha mensal, não produz batida física e não transfere dinheiro. O ciclo mensal completo, com relógio controlado e pagamentos fictícios de R$ 5.507,11, é uma prova local diferente, descrita em `SIMULACAO_COMPLETA_FULANO_SICLANO.md`.

## Evidência local complementar

Em 25/10/2026, os sete testes passaram. O lote de revisão mais amplo com provisões, prontuário e indicadores passou com **44 testes em 10 arquivos**. O cliente em modo padrão também foi executado pelo teste com um caminho de acesso inexistente, comprovando que esse modo não abre o arquivo de credenciais.

Os testes do roteiro exercitam as funções de domínio oficiais com estado local. A prova com API, SQL e auditoria reais em PGlite e a execução remota acima são evidências complementares, com seus respectivos escopos identificados.
