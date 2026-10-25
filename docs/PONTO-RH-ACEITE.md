# Aceite operacional — K1-10

Atualizado em 25/10/2026. Responsável provisório da operação: **Hygor**, informado nesta sessão. Responsável por este documento/testes: sessão de integração, branch `codex/ponto-rh-aceite`.

**Resultado: prontidão ainda não demonstrada para iniciar pelo fluxo completo.** Há evidência automática do trecho cadastro → lógica do aparelho → recebimento → consulta → apropriação e de cálculos/conciliação separados. Falta integrar e verificar a quinzena mista, obrigação financeira e aparelho no ambiente isolado. Nenhum dado fictício foi enviado ao registro fiscal de produção. Nenhum pagamento real foi executado.

Critérios adotados: roadmap RH `docs/RH-PONTO-ROADMAP.md` e acompanhamento `docs/RH-PONTO-STATUS.md`, lidos na worktree `compras-ux-flow` da sessão RH enquanto ainda não publicados nesta base. Cortes mantidos: **06–20 e 21–05**. Datas de pagamento, parcelas CLT e regras coletivas dependem dos dados validados pela operação. Não presumir 50%. Operação ampliada continua dependendo de duas quinzenas e um fechamento mensal reais acompanhados.

## Versões e limites da evidência

| Componente | Referência usada | Alcance |
|---|---|---|
| Web/RH, servidor e lógica Android da primeira execução | `c7d4e777e7263b823bd2ce60797346ea69bca402` (main consultada por fetch em 25/10) | Base da suíte; não comprova os próximos candidatos |
| Testes novos | `src/integration/ponto-rh-aceite.test.js` e `.fixture.js` nesta branch | Nenhuma alteração em módulos de RH/Android |
| Banco dos testes de ponto | PGlite, migrations 016–018 do helper existente | SQL, funções, constraints e commits locais reais; banco em memória. Não testa PostgREST remoto, concorrência entre processos, restore ou permanência após reiniciar o host |
| Aparelho dos testes | lógica `terminal.js`/`sincronizacao.js`; armazém de referência em memória | Rede/relógio controlados, autenticação injetada; não é APK, câmera, SQLCipher ou Android físico |
| SQLite | suíte existente `armazem-sqlite.test.js` | SQLite local; não valida SQLCipher/Keystore no Android |
| Novo Android | sessão Android, branch `codex/ponto-android-candidato`; produtor `3daf952` informado | Não incorporado automaticamente; publicação RH ainda sem consumidor/persistência integrada nesta verificação |
| APK anterior e piloto code 4 | referências da sessão Android: `4f8b84c1`/`7a5b73c`, `3150aa14`/`c7d4e77` | Apontam a produção; não usar com fictícios. Não são candidato homologado |

O checkout original estava em `feat/ponto-livro-migracoes`, `554ab31`, com um arquivo de crítica não rastreado. Foi preservado. Worktree própria criada a partir de `origin/main`; nenhuma PR #69–#77 foi mesclada por esta sessão.

## Ensaio executável

Na raiz da worktree, com dependências instaladas, executar sem credenciais de produção:

```powershell
npx vitest run src/integration/ponto-rh-aceite.test.js --maxWorkers=2
npx vitest run apps/ponto-obra/src/logica/rep-p-ponta-a-ponta.test.js apps/ponto-obra/src/logica/funcionario-global.test.js apps/ponto-obra/src/dados/armazem-sqlite.test.js src/domains/rh/advance-commands.test.js src/domains/rh/remuneration-mode.test.js src/domains/ponto/clt-attendance.test.js src/domains/conciliacao/payroll.test.js src/integration/financial-permissions.test.js --maxWorkers=2
```

Não é necessário executar `prebuild`, migrations remotas ou popular produção. Fixture reaproveita IDs do helper existente com duas obras fictícias, diária de R$ 120, mensalista CLT de R$ 3.000, encarregado, RH e financeiro. Não representa cadastro real da K1-10.

Oráculo independente: 07h–11h na obra A e 12h–16h na B = 240 + 240 minutos, pausa de 60 minutos excluída. Quatro eventos, quatro NSRs e dois intervalos; reenvio mantém a contagem. Dia incompleto produz `sem_saida`, sem inventar intervalo. Diária de 120 − adiantamento de 20 = líquido 100; pagamento parcial de 40 deixa 60. Valores e datas são entradas de teste, não calendário aprovado da empresa. O título financeiro é montado explicitamente no teste: **não foi produzido por aprovação de fechamento**. A competência fictícia desse título não comprova apuração CLT entre meses.

Evidência em 25/10: execução inicial conjunta **9 arquivos / 50 testes aprovados**, 35,52 s. Esse total inclui teste que reproduz comportamento defeituoso de adiantamento (D01), portanto não significa aceite integral. Depois da ampliação com repetição da conciliação e recibo, o arquivo novo foi reexecutado: **4/4 aprovados**, 9,76 s. São 51 testes distintos verificados, não 54. Runtime Node v24.18.0, Vitest 4.1.11. `git diff --check` sem erros. Nenhuma execução remota/produção.

## Matriz dos 15 cenários

| # | Cenário | Resultado e evidência atual | O que ainda falta |
|---|---|---|---|
| 1 | Mesma identidade cadastro/aparelho/web | Passou no ensaio novo: `e1/e2` nos dois cadastros de aparelho; IDs dos eventos consultados iguais aos enviados | UI e APK final com cadastro persistido real |
| 2 | Offline sem perda/duplicação | Passou lógica app + SQL e SQLite existente | APK físico, reinício e envio real |
| 3 | Resposta perdida/reenvio | Passou: servidor confirma commit; fila reenvia e recebe mesmos registros | Transporte remoto e APK final |
| 4 | Sem sync não vira falta | Passou cadastro sem escrita de falta; `clt-attendance.test.js` exige resolver registro ausente | Fluxo final e UI |
| 5 | Duas obras e intervalo | Passou captura/apropriação 240+240; pausa preservada | Remuneração e custo ligados aos intervalos, sem duplicar presença |
| 6 | Corte entre meses | Fixture 21/10–05/11 preparada; importação CLT de mês civil testada na suíte existente | Fechamento misto atravessando competências |
| 7 | Vigência de valor | Modalidade por vigência testada na suíte existente | Retestar histórico de salário/diária do novo RH |
| 8 | Adiantamento uma vez | Cálculo 120−20 testado; defeito D01 reproduzido pela suíte existente | Compensação única persistida por aprovação/revisão |
| 9 | Total x demonstrativos | Pendente | Fechamento misto e obrigação emitidos pelo fluxo real |
| 10 | Pagamento parcial | Passou domínio de conciliação: 100−40=60 | API, banco e UI do candidato |
| 11 | Transferência falhou | Pendente | Confirmar estado de falha na rotina final; não houve integração bancária testada |
| 12 | Repetição sem segunda saída | Reenvio ARP passou; repetição de conciliação coberta no teste novo | Repetir aprovação/requisição de pagamento persistidas |
| 13 | Marcação tardia | Pendente nesta base | Consumidor/publicação versionada, período fechado e revisão identificada |
| 14 | Permissões | Passou negativa de gestão do encarregado e suíte `financial-permissions` | Matriz completa por obra/empresa no candidato real |
| 15 | Recibo sem assinatura inventada | Teste novo verifica campos em branco, aviso e ausência de mutação | Conferência do documento emitido pela UI final |

## Lista única de pendências e responsáveis

| ID | Pendência | Responsável | Próximo passo |
|---|---|---|---|
| O01 | K1-10 confirmada como piloto; existência/configuração efetiva no sistema não conferida nesta sessão | Hygor + RH | Abrir obra e confirmar identificação, equipe, vínculos, remuneração e valores vigentes |
| O02 | Jornada, intervalos, regras aplicáveis, datas de pagamento e parcelas CLT não confirmados | Hygor + RH/contabilidade | Validar no cadastro; preservar cortes 06–20/21–05 sem inventar parcela |
| O03 | Responsável provisório Hygor; contas e permissões de conferir/aprovar/pagar não verificadas | Hygor + RH | Identificar contas reais e testar acessos por papel/obra |
| O04 | Saldos e adiantamentos de abertura desconhecidos | Hygor + financeiro | Conferir registros/comprovantes existentes sem criar saldo fictício |
| I01 | Candidato web/servidor/RH final ainda em construção | RH | Entregar SHA e ligação recebimento→tratamento→fechamento→obrigação para reteste |
| I02 | Publicação RH versionada sem consumo/persistência ponta a ponta comprovados | Android (produtor), RH (consumidor), integração (teste) | Entregar commits compatíveis; testar multiobra, meia-noite, reenvio, conflito e tardio |
| I03 | Ambiente isolado e APK apontando para ele indisponíveis | Android + responsável de infraestrutura | Entregar URL identificada, marcador de ambiente, SHA app/servidor, build/hash APK; só então parear |
| I04 | Modelo/Android/aparelho acessível não informados | Hygor | Informar e executar roteiro físico abaixo |
| I05 | Recuperação, atualização e troca de aparelho sem ensaio físico | Android + Hygor | Usar runbook existente; preservar pendências e testar restauração em destino isolado |
| I06 | Fluxo misto, compensação única e revisão de obrigação não verificados | RH + financeiro | Gerar aprovação real no teste e seguir até conciliação/custo |
| I07 | Meio oficial de contingência ainda não confirmado nesta sessão | Hygor | Definir procedimento usado pela empresa enquanto registrador é candidato; orientar equipe |
| D01 | Cancelamento de adiantamento muda desconto de período fechado | RH | Corrigir proteção e entregar SHA para reteste; reprodução abaixo |

Esses itens impedem declarar prontidão do fluxo digital completo. Não são afirmação de que a obra física não pode iniciar por um procedimento oficial alternativo definido pela empresa.

## Defeito D01

- Reprodução: `src/domains/rh/advance-commands.test.js`, teste “achado: cancelar um adiantamento…”. Criar R$ 300 com parcela em 05/07; fechar julho; cancelar em agosto; recalcular 21/06–05/07.
- Ocorreu: cancelamento aceito e desconto histórico caiu de 300 para zero.
- Esperado: preservar o período fechado; correção por revisão/ajuste identificado, conforme roadmap.
- Versão: `c7d4e777e7263b823bd2ce60797346ea69bca402`; RH avisado pelo canal entre sessões em 25/10.
- Responsável: RH. Reteste: pendente do commit de correção. O teste atual passa porque documenta o defeito; não é aprovação de comportamento.

Detalhe reproduzível de I02: `ponto-apropriacao-propor` devolve `intervalos[].eventos`; `ponto-apropriacao-salvar` não passa essa lista à RPC, e `ponto-apropriacoes` não a devolve. O teste novo comprova somente pessoa/obra/horário persistidos. Na base `c7d4e77`, os eventos originais seguem íntegros na ARP, mas falta o vínculo explícito persistido usado pelo produtor RH novo. RH e Android foram avisados. Reteste pendente; não se declarou perda das próprias marcações.

## Ensaio físico curto — pendente

Reaproveitar `apps/ponto-obra/docs/HOMOLOGACAO-PILOTO.md` e `homologacao-registro.csv` do candidato Android; consultados na worktree Android, ainda ausentes nesta main. Recuperação segue `docs/PONTO-OBRA-BACKUP-RESTAURACAO.md` da frente Android, sem assumir sua infraestrutura.

1. Anotar executor (Hygor provisoriamente), modelo, Android, build/versionCode, SHA do app, hash APK, SHA servidor/web e URL. Conferir ambiente isolado antes de parear. Todos esses campos, exceto executor, continuam pendentes.
2. Instalar o APK de homologação identificado por Android. Confirmar etiqueta de homologação e servidor no **Diagnóstico**. Não usar os APKs anteriores de produção.
3. Conferir os mesmos IDs de funcionários no cadastro web e no aparelho. Bater online; verificar confirmação e evento correspondente na consulta web/banco de teste.
4. Sem internet, bater, fechar/reabrir e reiniciar o aparelho. Conferir pendentes; religar internet; usar **Sincronizar agora**. Integração confere os mesmos IDs uma única vez, fila vazia e NSR correspondente.
5. Executar dois intervalos com pausa e mudança de obra. RH confere os intervalos; só depois prepara/aprova a quinzena no candidato disponível. Comparar demonstrativos, obrigação, parcial, saldo e custo por obra.
6. Com suporte Android, ensaiar atualização e troca com pendências, falha durante envio e restauração em destino isolado. Não desinstalar/limpar dados para tentar resolver fila pendente.

Guardar resultado APROVADO/REPROVADO/BLOQUEADO por passo e evidência sem CPF completo, rosto, PIN, token ou dados bancários. Fotos de outra versão, emulador e testes Node não aprovam aparelho. Registro físico atual: **PENDENTE, nenhuma execução**.

Próximo teste: receber candidato RH/Android compatível e testar a publicação persistida de um dia conferido até a obrigação financeira; depois repetir com duas obras e marcação tardia. Guias por papel: [PONTO-RH-GUIAS.md](PONTO-RH-GUIAS.md).
