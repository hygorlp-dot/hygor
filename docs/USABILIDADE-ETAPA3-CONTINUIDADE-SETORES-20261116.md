# Etapa 3 — Continuidade comercial e tarefas entre setores

Implementação local de 16/11/2026, sem publicação, commit, push ou migrações. Alterações existentes do checkout preservadas, inclusive as duas etapas anteriores. Não foram alterados registros reais.

## Lead, contratos e indicadores

A aba Contratos da ficha consultava apenas `comercial.contratos`, enquanto a central atual consulta `commercialContractRecords`. Um lead sem contrato anterior ficava com o corpo vazio. Agora há orientação específica para lead novo ou sem vínculos, lista de contratos e Abrir contratos deste lead.

O vínculo atual é exclusivamente `commercialContractRecords.propostaId` → `comercial.propostas.id` → `leadId`. Os contratos anteriores usam seu próprio `leadId`. Nome, cliente ou obra semelhantes não criam uma associação. A seleção respeita a permissão existente `mayReadContract`; perfil sem acesso, usuário inativo ou contrato de outra obra não são incluídos.

A central recebe o recorte do lead. Consultar toda a central amplia a consulta; Voltar à ficha do lead recupera a ficha e a edição ainda não salva na sessão. Essa navegação não salva o lead nem cria vínculo. O recorte e o retorno ficam apenas na memória da sessão do usuário; não constituem rascunho persistido entre recargas.

Na consulta do lead, os filtros ficam recolhidos, conservando os valores. A limitação de emissão continua explícita em Emissão de documentos indisponível; a emissão PDF/DOCX não foi implementada. Modelos de contrato continua disponível ao administrador ao consultar toda a central. O aviso Escopo dos contratos explica que Obra em foco não substitui os filtros da lista.

O Comando comercial explica os quatro indicadores e o contador Sem assinatura. Valores e equações foram preservados:

- Funil ativo: orçamento estimado das oportunidades ativas.
- Valor provável de venda: orçamento estimado ponderado pela probabilidade cadastrada; substitui o rótulo Receita provável.
- Vendas no mês: registros de venda por data de fechamento.
- Conversão geral: todas as vendas divididas por todos os leads carregados; não é a conversão mensal.
- Sem assinatura: contratos anteriores enviados ou aguardando assinatura; a central atual não é somada automaticamente.

## Aprovações e SC-0005

A evidência histórica da auditoria mostra SC-0005 em Compras, aguardando aprovação, com vários nomes, e a fila pessoal vazia. O código de `buildPurchaseWorkspace` monta os nomes com os resultados de etapas em andamento. A central pessoal também exige o snapshot da política e elegibilidade pelo identificador do usuário. Por isso, nomes exibidos não comprovam, sozinhos, a existência de uma decisão compatível na central.

A fila agora explica essa diferença e usa um seletor tolerante a snapshot ou resultados ausentes. Solicitações sem fluxo compatível aparecem em consulta separada, sem Aprovar/Reprovar e sem reconstrução automática da instância. O diagnóstico pode abrir a solicitação exata em Compras, na obra correspondente, destacando e focando o registro. O retorno usa a navegação de contexto existente. Decisões formais também podem consultar sua solicitação de origem.

Os cenários cobrem vínculo ausente, instância sem snapshot mesmo contendo elegíveis, etapas passadas/futuras, usuário não elegível, obra restrita e fluxos concluídos. Autoaprovação já concluída não é tratada como fluxo ausente; registros removidos e solicitações canceladas ou transformadas em pedido não entram no diagnóstico.

Não houve nova consulta autenticada nem alteração da SC-0005 real. O teste de navegador usa esse número em um registro fictício. A causa específica do registro real exige conferir sua instância atual; esta entrega não declara seus dados homologados.

Também foi corrigida a mistura de justificativas entre instâncias que reutilizam o mesmo identificador de etapa da política. A edição fica isolada por instância e etapa. O comando de decisão, a elegibilidade no servidor e a regra de justificativa obrigatória para reprovar foram mantidos.

## Comunicação e tarefas

Tarefas de conferência consulta as pendências existentes, sem criar uma segunda coleção de tarefas. Cada registro mostra vistoria, obra, responsável pelo ajuste, prazo completo ou Não definido, situação, responsável pela validação e próxima ação. Resolvidas ou canceladas permite consultar encerramentos; a conclusão usa a data e autoria existentes, quando informadas.

Abrir pendência leva `conferenceId`, `findingId` e `obraId` à Conferência. O destino confere o acesso e abre somente o achado solicitado. Mostrar todas as pendências amplia a consulta dentro da mesma vistoria. Voltar a Comunicação preserva a situação selecionada na sessão. Consultar a tarefa não envia mensagem, evidencia correção nem valida a vistoria. O histórico técnico existente continua no registro de origem.

O checklist considerava `status !== resolvida`, incluindo cancelamentos como abertos. Agora exclui pendências e vistorias canceladas. Os pesos do ranking permanecem iguais; a pontuação derivada pode refletir a correção do checklist. Os estados de tarefas e de conclusão não são persistidos separadamente.

No celular, tarefas e decisões aparecem antes das explicações adicionais. Conversa, decisões e acompanhamento explica o acesso Abrir chat da equipe no cabeçalho e a separação entre mensagem e decisão formal. Usuários sem acesso à Conferência não recebem suas tarefas; engenheiros consultam somente os achados atribuídos a eles, respeitando a obra do perfil.

## Origem dos dados e efeito no DRE

Esta etapa não cria previsão, compromisso, estoque, receita reconhecida, custo ou pagamento. Valores comerciais são tratados como negociação/contratação, separados de recebimentos e competência financeira. Abrir contrato, solicitação ou pendência não emite comando de gravação. Aprovação continua dependendo do comando existente, conferido no servidor; a mudança da chave local de justificativa não muda o payload financeiro nem cria outro fato contábil.

Não foram alterados API, motores de aprovação/Conferência, razão, regras de reconhecimento ou conciliação. Não há duplicação de custo por navegação ou pagamento. As transações e divergências reais da etapa 5 continuam pendentes.

## Validação

| Verificação | Resultado |
|---|---|
| Unitários | 72 testes aprovados em 7 arquivos: vínculos/filas/tarefas, justificativas, comandos de aprovação, sessão, comandos de contratos, fila de Compras e fluxo de Conferência |
| DEV | 12 cenários, sessões novas em 390 e 1440 px |
| Build | 32 cenários: 12 desta etapa e 20 regressões das etapas anteriores |
| Fluxos | Vazio, vínculo por proposta, nomes semelhantes sem vínculo, retorno com edição, filtros recolhidos, consulta de solicitação, tarefa exata, conclusão, cancelamento e perfil restrito |
| Integridade | Dados fictícios e APIs interceptadas localmente; zero comandos de gravação e zero erros de página nos cenários aprovados; dados antes/depois iguais |
| Qualidade | Lint, design:check, manual:check e typecheck aprovados; sem ampliar baseline |
| Inicialização | 925 arquivos e 3.246 dependências, sem ciclos estáticos ou dinâmicos |
| Bundle final | 1.827.036 bytes gzip, abaixo do teto de 1.891.328; nenhuma violação individual ou aumento de limites |
| Ajuda/manual | Revisados em 16/11/2026 e regenerados: 143 guias cobrem as 65 abas |
| Visual | Capturas do build revisadas no celular e desktop; decisões e tarefa acessíveis sem os textos extensos antes da ação; sem overflow horizontal nos cenários |

As primeiras execuções identificaram normalização indevida do código da solicitação em um botão legado e datas sem ano; os novos acessos passaram a usar Button compartilhado e datas completas. Um cenário posterior precisou selecionar o cartão resolvido específico quando o conjunto de teste ganhou outra pendência encerrada da mesma vistoria. Essa ambiguidade do seletor foi corrigida no teste.

Builds locais serviram para conferir o resultado empacotado e as correções encontradas na revisão. Não foi usado `npm run build`, cujo prebuild executa migrações. Artefatos ficaram em `artifacts/roadmap-usabilidade-etapa3`, sem sobrescrever `dist` ou `bundle-metrics.json` preexistentes na raiz.

Para repetir: prévia DEV isolada na porta 4400, com `scripts/rebranding-pilot-preview.mjs` e `MARCELL_PREVIEW_PORT=4400`; executar `npx playwright test --config artifacts/roadmap-usabilidade-etapa3/playwright.config.mjs`. Build servido por `artifacts/roadmap-usabilidade-etapa3/preview.mjs` na porta 4402; executar `npx playwright test --config artifacts/roadmap-usabilidade-etapa3/playwright.build.config.mjs` com `ROADMAP_MODE=stage3-build`.

Evidências: logs `unit.log`, `lint.log`, `typecheck.log`, `cycles.log`, `build.log`, `bundle.json`, `e2e-dev.log`, `e2e-build.log`; capturas `lead-vazio-*`, `central-vinculada-*`, `aprovacoes-*`, `tarefas-*`, `origem-*`. As versões anteriores dos arquivos modificados estão em `before/`.

Não foi atribuída nova nota de usabilidade. A meta 9,5 depende das próximas etapas e de nova avaliação sustentada por evidência.
