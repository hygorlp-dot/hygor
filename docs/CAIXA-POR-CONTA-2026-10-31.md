# Caixa por conta — revisão local

Na Visão financeira e no planejamento de caixa da fila Hoje, selecione uma
conta no controle de contas previstas. O bloco Caixa por conta permite informar
saldo de abertura, data de abertura e data de referência. Cada conta conserva
seus próprios valores durante a sessão do aplicativo, inclusive ao navegar
entre as áreas do financeiro. Recarregar a aplicação encerra essa hipótese.

## Base do cálculo

Abertura no início da data informada + créditos − débitos bancários desde essa
data até o final da referência, com os dois limites incluídos. A posição usa
somente os movimentos importados da conta selecionada; títulos pagos e eventos
do razão não são somados novamente. Transferências contam pela perna de cada
conta. O filtro de obra continua nos títulos previstos; a conta considera os
movimentos disponíveis da empresa inteira, inclusive de outras obras.

O valor `saldoInicial` já cadastrado não tem data associada. É apresentado
como referência e só entra na hipótese após uma ação explícita, acompanhada
da informação de datas. Ausência de saldo nunca é convertida em zero.

Transações ignoradas na conciliação continuam compondo o movimento bancário.
Arquivamento não elimina fatos; exclusão/cancelamento segue a regra canônica
de registros ativos. Movimentos sem data válida, valor válido ou identidade
única impedem a exibição de uma posição numérica. Erros fora do intervalo
com data conhecida não bloqueiam um período anterior.

## Pendências e memorial

As filas respeitam a conta e o intervalo: movimentos, pendências, vínculos
parciais e ignorados. Parciais são um subconjunto das pendências. O memorial
preserva o sinal bancário e mostra o registro original, as origens financeiras
diretas ou vinculadas por rateio ativo, obras e documentos disponíveis. Uma
origem financeira não gera uma segunda linha de movimento bancário.

A posição é uma hipótese baseada no conjunto de extratos disponível; não
certifica cobertura, saldo do banco nem fechamento conferido. Não substitui
automaticamente o saldo hipotético da previsão por vencimentos, cujo recorte
e datas são diferentes. Nenhum cadastro, transação ou vínculo é modificado.

## Comparação com a Vobi

Foi consultada novamente a documentação oficial do
[Extrato financeiro na Vobi](https://ajuda.vobi.com.br/pt-br/articles/8632130-extrato-financeiro-na-vobi).
Ela reúne saldos por conta e pendências de conciliação e informa que o saldo
independe do filtro de datas. Aqui a posição explicita abertura, referência e
intervalo de cálculo, mantendo a distinção entre importado e conciliado.
Esta comparação usa a documentação pública; não presume nova inspeção da
sessão privada autenticada.

## Verificação reproduzível

- `npx vitest run src/domains/financeiro src/features/financeiro --maxWorkers=2`
- `node scripts/finance-account-cash-verify.mjs http://127.0.0.1:4192`
- `node scripts/finance-operational-layout-verify.mjs http://127.0.0.1:4192`
- `npm run lint` e `npm run typecheck`
- `npx vite build --outDir artifacts/financeiro/caixa-por-conta-build`

O roteiro de navegador intercepta as APIs com dados fictícios, bloqueia
requisições externas e verifica ausência de gravações. Exercita desktop e
celular, limites de datas, isolamento de conta, retorno do memorial,
preservação da sessão e independência da previsão. Capturas e resultado em
`artifacts/financeiro/caixa-por-conta/`. Sem migrações, push ou deployment.

Resultado: 202 testes em 35 arquivos aprovados, lint e tipos aprovados,
build direto do Vite aprovado (aviso já existente de chunks grandes).
As duas jornadas novas e as oito regressões operacionais passaram em
1440 e 390 px, sem erros de execução nem gravações nas APIs interceptadas.

O servidor de dados reais na porta 4192 manteve a sessão do OneDrive, sem
reinício. A verificação de carregamento encontrou uma espera no recurso
`/src/index.css`; o log do Vite mostrou atualizações repetidas de CSS e
artefatos de outras verificações. As jornadas finais usaram o build estático
local na porta 4196 para isolar o teste do carregamento de desenvolvimento.
O problema de espera no CSS do servidor 4192 não foi declarado resolvido.

## Correção do carregamento local — 31/10/2026

A investigação seguinte confirmou a varredura de 1.717 arquivos de artefatos
pelo Tailwind e recargas do Vite disparadas por rastreamentos de outras
verificações. A geração de utilitários foi limitada a `src` e `index.html`;
o observador de desenvolvimento passou a ignorar artefatos, análises,
relatórios e saídas de verificação. Nenhum arquivo de evidência foi apagado.

O Vite recarregou sua configuração no mesmo processo Node (PID 120292),
preservando o adaptador OAuth em memória. Uma verificação isolada confirmou
que essa recarga reutiliza o objeto de sessão do plugin passado na
configuração inline. Depois da recarga, as dez verificações operacionais
e de caixa passaram no próprio servidor 4192, em desktop e celular.
O carregamento completo foi medido em 573 ms numa sessão isolada.

O link local `/?local-review=account-cash` navega pelos controles normais,
após o login habitual, e seleciona uma conta disponível, sem preencher saldos
ou datas. O auxiliar só é carregado em desenvolvimento na origem 4192 e
não integra o código executável de produção. A navegação espera a montagem
da Visão financeira para não interagir com a previsão recolhida da fila Hoje.

Na sessão habitual do usuário, o verificador recebeu confirmação de tela
aberta e OneDrive conectado, local e somente leitura. O cadastro carregado
apresentou zero contas disponíveis; a interface informa essa ausência sem
inventar uma conta ou um saldo. Os lançamentos reais permanecem disponíveis
na previsão. O relatório privado contém somente estados e contagens, sem
credenciais ou valores financeiros, fora do repositório.

Regressões adicionais: `node --test scripts/local-css-source.test.mjs` valida
as fontes e os utilitários; `node scripts/finance-local-cash-open-verify.mjs`
valida a navegação automática em 1440/390 px, campos de saldo intactos, ausência
de gravações e ausência de recarga ao criar um artefato HTML. Evidências em
`artifacts/financeiro/css-local/verification.json`. O servidor de dados reais
continua em somente leitura. Nenhum push, deployment ou migração foi executado.

## Prévia local da conta identificada nos extratos

O endereço local `/?local-review=account-cash&account-preview=9896` abre uma
prévia identificada da conta final 9896. Ela existe apenas em desenvolvimento,
na origem `http://127.0.0.1:4192`. O módulo e seu código de projeção não são
incluídos no JavaScript executável do build de produção.

O componente recebe os dados já carregados com a autorização habitual e cria
uma cópia dos três extratos e dos 925 movimentos, acrescentando referências a
uma conta provisória somente nessa cópia. O estado global do ERP, o cadastro
original e os títulos previstos permanecem intactos. Nenhum comando de gravação
é chamado. Se a identidade for ambígua ou houver vínculos já preenchidos,
a prévia para com uma explicação e preserva esses registros.

Banco e conta vêm dos metadados preservados na importação. Agência, titular,
documento, tipo, situação ativa/inativa e PIX aparecem em branco. Saldo de
abertura, data de abertura e data de referência também começam em branco,
sem inferência de zero ou da data atual. Podem ser preenchidos apenas para
uma simulação local e limpos sem alterar a empresa.

As consultas gerais do memorial são independentes das datas da simulação:
925 movimentos, 793 pendentes, 56 conciliados e 76 ignorados na base revisada.
Os dois extratos arquivados e as sete coincidências de data/valor/descrição
continuam preservados; nenhuma coincidência foi eliminada automaticamente.
As consultas da posição calculada, quando o usuário informa as datas,
continuam respeitando o intervalo definido.

A sessão habitual confirmou a prévia carregada, os 925 vínculos simulados,
campos desconhecidos e abertura/datas em branco, e OneDrive conectado em
somente leitura. O mesmo processo do servidor foi mantido. Relatório privado:
`C:/dev/marcell-local-review/contas-bancarias/PREVIA-LOCAL-VALIDADA.json`.

Verificações: suíte financeira com 211 testes aprovados; jornadas em 1440/390 px
para campos em branco, memorial, cálculo hipotético explícito, limpeza e volta
à base original, sem gravações; lint, tipos e build direto do Vite aprovados.
Reprodução: `node scripts/finance-account-preview-verify.mjs`. Capturas e
resultado em `artifacts/financeiro/previa-conta/`. Nenhuma publicação realizada.
