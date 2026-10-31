# Piloto acompanhado MARCELL — aplicação posterior

Preparado em 31/10/2026. O usuário optou por aplicar o piloto posteriormente. **Nenhum operador foi observado nesta entrega.** As execuções automatizadas são evidência técnica da WF09, não tempos de tarefa nem avaliações de operadores.

## Preparar a sessão local

Na raiz do projeto, execute:

```powershell
node scripts/operator-pilot-preview.mjs
```

Abra `http://127.0.0.1:4234/`. As contas de demonstração são `e01@piloto.local`, `e02@piloto.local`, `c01@piloto.local`, `c02@piloto.local`, `f01@piloto.local` e `f02@piloto.local`. A senha de demonstração é `piloto-local`. São identidades fictícias para o ensaio; não use credenciais reais.

E01/E02 usam Engenharia, limitadas à obra A. C01/C02 usam Compras. F01/F02 usam Financeiro. O servidor local usa a projeção de dados, a autorização por papel, a validação de escopo e os redutores operacionais existentes. Não ampliar o acesso para fazer uma tarefa passar: uma ação fora do perfil precisa ser encaminhada a quem tem atribuição.

Todos os caminhos `/api` terminam no processo local; não são encaminhados a banco ou serviço remoto. Mudanças ficam em memória. Reinicie o servidor entre participantes para restaurar a mesma referência. Use uma sessão privada nova do navegador, feche as anteriores e entre na conta correspondente. Preserve a prévia já aberta em 4198; esta sessão usa outra porta.

Para usar telefone físico mantendo o serviço restrito ao computador, o facilitador precisa preparar encaminhamento local por USB. Sem isso, use a emulação apenas para ensaiar e mantenha a verificação no aparelho como pendente; `127.0.0.1` no telefone não aponta para o computador.

O ambiente oferece os comandos operacionais e consulta sintética. Gravação genérica, fechamento financeiro definitivo, provedor documental e relatórios SQL ficam indisponíveis. Registre essas limitações separadamente: não classificá-las como falha da operação real nem fabricar confirmação para seguir. Para conferir documentos, use apenas arquivos fictícios autorizados. Não conectar contas bancárias, OneDrive, IA ou credenciais de produção.

Para um cenário adverso, pare a prévia e reinicie com **uma** destas opções. A falha ocorre uma vez, no primeiro comando operacional elegível:

```powershell
$env:WF_PILOT_FAILURE='network-before' # queda antes de aplicar
node scripts/operator-pilot-preview.mjs
```

Alternativas: `lost-response` aplica o comando em memória e perde a resposta; `expired` encerra a sessão sintética e exige renovar a mesma conta. Após a execução, remova a opção com `Remove-Item Env:WF_PILOT_FAILURE -ErrorAction SilentlyContinue`. Nunca usar esses cenários contra um ambiente real.

## Participantes e roteiro

Buscar dois participantes de cada área e pelo menos vinte execuções acompanhadas. O modelo contém **24 execuções planejadas**, quatro por participante, distribuídas entre desktop e celular. Os códigos E01–F02 identificam sessões, sem nomes pessoais ou documentos.

| Jornada | Tarefa e resultado a conferir | Área do modelo |
|---|---|---|
| J01 | Partir da etapa, consultar materiais e preparar a necessidade em Compras mantendo obra e vínculos; não transformar a etapa inteira em quantidade automática | Engenharia |
| J02 | Comparar propostas e localizar o pedido decorrente da decisão; conferir o retorno ao comparativo e o que ficou pendente | Compras |
| J03 | Conferir e registrar entrega parcial em dados sintéticos; distinguir recebido, saldo físico e pagamento | Compras |
| J04 | Localizar documento, obrigação e evidência; retornar ao recorte inicial. Documento ausente deve orientar conferir a origem | Financeiro |
| J05 | Registrar pagamento parcial sintético e conferir saldo residual e uma única confirmação; se o perfil não puder, explicar o encaminhamento | Financeiro |
| J06 | Entrar na revisão bancária pela origem e retornar sem perder seleção ou retomar automação implicitamente | Financeiro |
| J07 | Identificar a pendência do fechamento, abrir/corrigir a origem autorizada e voltar à competência. O fechamento definitivo está fora da prévia sintética | Financeiro |
| J08 | Enviar solicitação em cenário de falha; conservar preenchimento, ler o erro e concluir apenas após confirmação explícita | Engenharia / Compras |

O facilitador deve ensaiar cada tarefa com os dados de referência antes de chamar os operadores, anotando identificadores fictícios e o resultado inicial. Se a referência já tiver sido alterada, reinicie a prévia. Não alterar condições ou instruir um atalho no meio da comparação.

## Conduzir e observar

1. Explique a tarefa e o resultado esperado, sem indicar os botões. Confira perfil, obra, competência e dispositivo.
2. Inicie o tempo quando a pessoa entender a tarefa e estiver na tela inicial. Encerre quando ela identificar o resultado confirmado ou declarar que não conseguiu.
3. Registre a espera do sistema separadamente. Anote mudanças de módulo, identidades redigitadas, perda de contexto, necessidade de ajuda e interpretação da próxima ação.
4. No celular físico, exercite teclado aberto, rotação, retorno após alternar de aplicativo, nomes longos e conectividade intermitente. No desktop, confira zoom nativo de 200% e navegação por teclado.
5. Ao sair com edição pendente, observe se a pessoa entende Continuar editando e Descartar alterações. Em resposta incerta, confira se procura a confirmação antes de repetir.
6. Ao final, peça notas de 1 a 10 para as seis dimensões abaixo e registre o motivo. Não transformar a nota heurística do relatório técnico em nota do operador.

Use `completed`, `partial` ou `failed` para o resultado. Uma ação que não foi observada mantém `result: null`. Não preencha duração, nota ou indicador com zero para representar dado ausente. O tempo total inclui decisão e navegação; `systemWaitMs` é a parcela de espera dentro dele. `note` recebe somente observações de UX, sem senhas, dados bancários, conteúdo de documento ou dados pessoais.

## Registrar e consolidar

Copie `observacoes-modelo.json` para um arquivo próprio, sem substituir o modelo. Ou crie outro modelo vazio:

```powershell
node scripts/operator-pilot-report.mjs --template artifacts/piloto-wf10/observacoes.json
node scripts/operator-pilot-report.mjs --report artifacts/piloto-wf10/observacoes.json
```

O gerador recusa sobrescrever um arquivo existente. O relatório rejeita identidade repetida, tempo impossível e observação incompleta; não conta sessões só porque as contas foram criadas ou abertas automaticamente. O modelo vazio retorna `awaiting-human-observations`, zero observações e nota nula.

| Campo da nota | Pergunta ao operador | Peso |
|---|---|---:|
| flow | Conseguiu concluir e identificar o resultado? | 35% |
| nextAction | Entendeu o que faltava e onde agir? | 20% |
| recovery | Conseguiu retomar depois de falha/interrupção? | 15% |
| consistency | Textos, controles e organização foram consistentes? | 15% |
| responsive | Conseguiu alcançar, ler e operar no dispositivo usado? | 10% |
| response | O tempo de resposta permitiu trabalhar com clareza? | 5% |

Não concluir o ciclo com perda de trabalho, duplicação de operação ou acesso indevido. A meta de nota exige média ponderada ≥9,5, fluxo/próxima ação/recuperação ≥9,5 e nenhuma dimensão <9. A amostra deve ter vinte observações, duas pessoas por área, os dois dispositivos e as oito jornadas. Compare também os indicadores de tarefa e as metas do roadmap; não inferir redução de tempo ou navegação sem uma referência equivalente da WF01.

Os vinte e quatro registros, as contas e os exemplos unitários do consolidador **não são uma coleta realizada**. A WF10 só pode ser concluída depois da aplicação acompanhada e do tratamento dos achados.
