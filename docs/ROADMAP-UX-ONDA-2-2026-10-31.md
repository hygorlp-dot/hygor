# Onda 2 — conferência conectada e próxima ação financeira

31/10/2026. Execução local de UX03 e UX04 do [roadmap](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md). Marca MARCELL, tipografia e tokens preservados. Sem deploy, migração ou alteração na Vobi.

## UX03 — Conferência conectada da compra

A ficha da compra agora oferece uma seção de conferência com pedido, recebimento registrado e notas fiscais ativas vinculadas. Os seletores permitem consultar cada pedido e nota; a escolha fica na memória da sessão para o retorno entre módulos.

- Pedido, recebido valorizado pelos preços do pedido e faturamento são apresentados separadamente. As diferenças usam o motor existente de conferência; alertas não acrescentam bloqueios de pagamento ou aprovação.
- A associação depende dos identificadores do pedido e da obra. Documentos cancelados, rejeitados ou de outra obra ficam fora da comparação ativa. Não há associação por descrição, fornecedor ou valor semelhante.
- Quantidades do pedido e do recebimento mantêm a unidade de compra. Os itens fiscais mantêm a unidade do documento, sem conversão ou equivalência inferida. Nota sem detalhamento de itens fica explicitamente pendente de revisão.
- Dados incompletos deixam a comparação monetária indisponível; não aparecem como confirmação de valor zero.
- O leitor fiscal existente mostra o original ao lado dos dados em desktop e usa Documento/Dados da nota em telas estreitas. Acesso protegido, falha de leitura e abertura do original reutilizam o comportamento existente.
- Usuários autorizados consultam o saldo residual dos títulos pelo motor financeiro, inclusive pagamentos parciais. A consulta abre o memorial existente. Escape fecha o memorial interno e mantém a ficha da compra.
- “Abrir ficha fiscal” leva ao registro existente no Financeiro, sujeito ao perfil e à obra. O retorno recompõe a compra e a seleção de conferência. Não há geração de nota, obrigação ou pagamento por navegação.

O histórico completo da ficha permanece disponível: origem, decisões, condições comerciais, recebimentos, notas, pagamentos e anexos. A navegação da ficha não fica sobreposta ao conteúdo nas telas menores; tabelas extensas mantêm sua própria região de rolagem.

## UX04 — Próxima ação na fila Hoje

A fila passa a resolver o destino a partir da origem atual do título e das permissões:

| Origem comprovada | Ação | Destino |
|---|---|---|
| Nota fiscal | Conferir documento | Ficha fiscal existente, com documentos, vencimento e pagamentos |
| Pedido, quando apresentado como origem de um título | Conferir compra | Ficha conectada da compra, se houver acesso a Compras |
| Medição financeira | Conferir cobrança | Registro selecionado na central documental |
| Origem ausente, cancelada, incompatível ou sem acesso | Ver memorial | Consulta já disponível, sem inventar destino operacional |

“Ver memorial” continua disponível nas linhas com próxima ação. O atalho revalida o registro ao ser acionado e não depende da descrição. O retorno conserva a fila, obra, seleções documentais e posição de consulta. Quando a ficha fiscal é aberta dentro da conferência de uma compra na fila financeira, o retorno identifica essa conferência.

Textos usam verbos e objetos consistentes, datas em `dd/mm/aaaa`, valores em reais e botões dos componentes existentes. Foco, estados e alvos de toque seguem o sistema MARCELL. Não houve mudança nas fórmulas do razão, nas permissões, nas alçadas ou nos comandos financeiros.

## Notas de design

Revisão manual das telas locais e dos estados verificados. Cinco critérios com peso igual, escala de 0 a 10; as notas se referem a esta entrega e não constituem uma medição de produtividade ou estudo com usuários.

| Critério | UX03 | UX04 |
|---|---:|---:|
| Hierarquia e próxima ação | 9,0 | 9,0 |
| Consistência de textos e componentes | 9,0 | 9,0 |
| Aproveitamento de espaço | 8,5 | 8,0 |
| Adaptação a telas e conteúdo | 8,5 | 8,5 |
| Clareza dos controles e teclado | 8,5 | 8,5 |
| **Nota da entrega** | **8,7** | **8,6** |

Limites: notas sem identificação dos itens não permitem certificar correspondência de quantidades; o confronto monetário não substitui essa revisão. Origens financeiras ainda sem um destino confiável conservam o memorial. A revisão bancária mais próxima do registro e os leitores de evidências além da nota pertencem à onda 3.

## Validação local

A bateria de navegador usa build estático local na porta 4199, dados sintéticos e APIs interceptadas. O servidor de desenvolvimento da porta 4198 não foi reiniciado nem substituído.

| Verificação final | Resultado |
|---|---|
| Domínio, componentes e continuidade da sessão | 25 testes aprovados em sete arquivos |
| Regressão completa de Compras | 41 cenários aprovados, sem retries |
| Continuidade financeira em desktop e celular | Dez verificações aprovadas |
| Jornada específica da onda 2 | Quatro larguras, 23 capturas, zero comandos operacionais, sem erros de página ou transbordamento verificado |
| Lint, TypeScript e build local direto | Aprovados; permanece aviso conhecido de chunks grandes |
| Detector de layout nos arquivos visuais alterados | Sem ocorrências; capturas também revisadas manualmente |

- Jornadas específicas em 1440, 768, 390 e 320 px, com 23 capturas: pedido → nota → retorno à compra, título parcial → memorial → Escape, original XML e fila Hoje → ficha fiscal → retorno à fila. Nenhum comando operacional enviado nesses roteiros; sem erros de página ou transbordamento da página/modal nos recortes verificados.
- Testes direcionados: associação por identidade/obra, cancelamentos, notas parciais, dado incompleto, saldo residual canônico, permissões e origens sem destino; componentes da fila, preview e continuidade da sessão.
- Regressão de Compras e continuidade financeira reutilizam as suítes existentes. O seletor de nota passou a ter o mesmo texto do título histórico; o teste correspondente foi atualizado para identificar o heading, preservando a verificação de visibilidade.
- Lint, TypeScript e build direto do Vite. Permanece o aviso conhecido de chunks acima de 650 kB; não foram executados hooks de migração.

Artefatos: `artifacts/roadmap-wave-two/verification.json`, capturas no mesmo diretório, `journeys-final.log`, `compras-regression-final.log`, `finance-regression-final.log`; build em `artifacts/roadmap-wave-two/build` e log em `artifacts/roadmap-wave-two-build.log`.

Reprodução: build direto do Vite para a pasta acima e `npx vite preview --host 127.0.0.1 --port 4199 --strictPort --outDir artifacts/roadmap-wave-two/build`; em outro terminal, `node scripts/roadmap-wave-two-verify.mjs`. As APIs desse roteiro são inteiramente simuladas.

## Posição no roadmap

**Onda 2 de 4 concluída localmente: UX03 e UX04 concluídas; 4 de 8 entregas no total.** Próxima onda: UX05, revisão de conciliação, e UX06, evidências além da nota fiscal. A contagem de entregas não corresponde a uma estimativa percentual de esforço.
