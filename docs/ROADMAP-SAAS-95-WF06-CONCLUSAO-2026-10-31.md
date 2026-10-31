# WF06 — Correção na origem e recuperação concluídas

31/10/2026. Complementa o [relatório inicial da onda 3](ROADMAP-SAAS-95-ONDA-3-2026-10-31.md), que registrava WF06 parcial. Trabalho local, sem push, PR, deploy, publicação ou migração de banco. Aplicadas Impeccable, shadcn e verificação de comportamento, layout e falhas.

## Correção das origens não fiscais

O fechamento agora abre uma ficha de correção para **pedido, medição, despesa da empresa e despesa da obra**, conservando a competência e a conferência ao fechar. A operação é restrita a referências documentais e, nas despesas, categoria do catálogo da origem. Não permite alterar valor, pagamento, recebimento, obra, identidade ou situação financeira do registro.

O comando `ORIGEM_FECHAMENTO_CORRIGIDA` foi conectado à autorização da API, à validação de escopo, ao redutor operacional e à persistência financeira existente. Exige Administração/Financeiro, acesso à aba de origem, versão correta, motivo e referências válidas. O escopo vem do registro atual do servidor; um identificador de obra enviado pelo cliente não amplia esse acesso. Períodos fechados são respeitados. Reclassificação de registro ligado diretamente à conciliação exige a regularização na origem.

Cada confirmação incrementa a versão e registra autor, motivo, antes/depois e recibo idempotente. A repetição da mesma chave não acrescenta outra correção nem outro registro. Os testes com as quatro origens comparam os eventos monetários antes/depois e confirmam que quantidade e valores desses eventos são conservados.

Referências apontam para arquivos existentes; remover uma referência não exclui o arquivo do provedor. Esta entrega não criou upload ou armazenamento documental novo. A categoria corporativa usa o catálogo corporativo; a despesa da obra usa o catálogo da obra, incluindo suas categorias personalizadas e o valor legado já existente.

## Recuperação da edição fiscal

A versão do comando fiscal passou a vir da fotografia aberta no formulário, evitando confirmar uma edição antiga sobre uma versão nova que chegou em segundo plano. Uma rejeição mantém o preenchimento e oferece a consulta da versão atual.

A revisão compara **base aberta, edição local e versão atual**. Alterações feitas somente por outra pessoa são preservadas. Alterações locais em campos diferentes continuam no formulário. Se o mesmo campo mudou dos dois lados, o operador vê os valores e escolhe explicitamente qual manter. Aplicar a revisão não salva a nota; a confirmação continua no botão de salvamento. Campos não editáveis, como pagamentos, vêm da versão atual.

Notas legadas sem retenções ou listas opcionais são preparadas para o editor sem quebrar a tela. A ordem de propriedades de um documento não cria um conflito artificial. Labels, datas, valores e identidades de obra/pedido usam apresentação legível; a interface não expõe nomes técnicos dos campos como instruções de trabalho.

## Sessão, conexão e resultado indefinido

- **Sessão expirada:** renovação por e-mail dentro da edição, com a mesma conta. Uma resposta de autenticação de outra identidade é recusada antes da troca de credenciais. A senha fica apenas no estado transitório do controle e é limpa ao iniciar a requisição. A renovação não fecha o formulário nem confirma uma operação. O fechamento também oferece essa renovação sem perder competência ou chave de tentativa.
- **Queda antes da confirmação:** o formulário permanece aberto. Repetir exige ação explícita e conserva a chave quando o conteúdo não mudou. Não foi adicionada uma fila offline nem tentativa automática para operações financeiras.
- **Resposta perdida depois da confirmação:** consultar a versão atual também consulta o recibo do comando. Se já aplicado, o operador pode adotar a confirmação recebida; a tela não envia outra operação para simular sucesso.
- **Novo documento ainda ausente na consulta:** a identidade reservada permanece a mesma. Após revisar o preenchimento, a confirmação usa essa identidade e o controle de versão; não cria um segundo documento por trocar de tentativa.
- **Origem existente indisponível:** a edição não é recriada silenciosamente. A interface conserva o preenchimento e orienta conferir acesso e origem.

Avisos de erro, versão consultada e confirmação recebida usam estados semânticos distintos. O painel de recuperação fica próximo dos campos e entra na área visível. No desktop, a comparação usa duas colunas; no celular, uma. A ficha de origem agrupa nome/endereço da referência em linha no desktop e empilha no celular, com ações de pelo menos 44 px.

## Evidências de validação

| Verificação | Resultado |
|---|---|
| Continuidade e recuperação | 30 cenários únicos aprovados em desktop/celular: suíte de 28 mais dois casos de novo documento após queda |
| Revisão de layout e recuperação | 16 casos repetidos após refinamento dos avisos; oito casos de origem repetidos após o ajuste final de composição |
| Conflito real | A fixture incrementa a versão no servidor antes da primeira confirmação; o comando antigo é recusado; a revisão permite escolher e confirmar sobre a versão atual |
| Quatro origens não fiscais | Correção documental e categoria onde aplicável; um registro, uma confirmação, mesmos valores e pagamentos |
| Sessão expirada | HTTP 401 e falha da renovação automática, seguidos de autenticação explícita da mesma conta e retomada; também exercitado no fechamento |
| Resposta perdida | API aplica o comando e a resposta é abortada; consulta do recibo e adoção sem segundo comando |
| Queda antes da escrita | API aborta antes de aplicar; mesma chave na repetição explícita, uma versão confirmada |
| Regressão financeira | 14 casos aprovados |
| Regras e fronteiras | 227 testes aprovados em sete arquivos: correção, revisão, identidade de sessão, autorização, escopo e persistência/execução bloqueada |
| Jornadas J01–J08 | Oito referências aprovadas, com 16 sessões no protocolo atual |
| Revisão visual geral | 100 capturas em 1440/768/390/320 px, sem overflow de página, erro JavaScript ou comando de escrita nessa varredura de consulta |
| Qualidade | Build direto do Vite, lint, verificação do manual e typecheck aprovados; detector delimitado de layout sem achados |

Evidências em `artifacts/wf06-completion/`: `continuity-final.log`, `new-document.log`, `review-final.log`, `layout-final.log`, `finance-regression.log`, `unit.log`, `visual/verification.json`, `final-results/`, `review-results/` e `layout-results/`. Referências gerais em `artifacts/wf-foundation/wf06-completion/baseline.json`.

As APIs do navegador foram interceptadas com dados sintéticos; os comandos, versões e recibos usam os redutores reais do projeto. Autorização, escopo e integração de persistência foram testados localmente, sem executar gravações em um banco real. Nenhum período real foi fechado. A captura geral que coincidiu com uma atualização do build foi descartada e repetida com a prévia estável. Permanecem os avisos de tamanho de chunks do build.

## Aceite e nota

**WF06 concluída no escopo previsto de correção e recuperação. Onda 3 concluída.** Posição: cinco entregas concluídas (WF02–WF06), uma parcial (WF01, pela medição acompanhada) e quatro planejadas (WF07–WF10). Próxima onda: **WF07/WF08**, cobertura de necessidades/compromissos e revisão em volume.

**Nota heurística provisória: 9,2/10 nas superfícies verificadas.** Fluxo 9,2; próxima ação 9,2; recuperação 9,3; consistência 9,2; responsividade/acessibilidade 9,1; resposta 8,5. Com os pesos do roadmap, resultado 9,17. A meta de 9,5 não está declarada atingida. Validação acompanhada, volume representativo, conexão intermitente prolongada, zoom e uso real com teclado móvel continuam no ciclo WF09/WF10.
