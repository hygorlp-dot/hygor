# Etapa 6 — Recuperação de falhas e nova avaliação

Revisão local de 17/11/2026. **Nota heurística local: 8,4/10. A meta 9,5 ainda não foi atingida.** Implementação e ensaios locais concluídos; aparelho físico e serviços externos reais permanecem fora desta validação.

## Escopo e proteção

- Checkout `C:/dev/repositorio-mrc`, HEAD `c6fccb0de467533efee5d40042dfe5583265a7be`, com as alterações locais anteriores preservadas. Sem commit, push, publicação, preview da Vercel ou migração remota.
- Dados fictícios dos fixtures do projeto. Nenhum lançamento financeiro antigo removido pelo usuário foi recriado. Nenhuma consulta ou alteração nos dados reais do ERP publicado foi necessária.
- Microsoft Edge/Chromium em sessões isoladas: celular emulado 390 × 844, toque, e desktop 1440 × 844/900. Também regressões de 320 px e texto ampliado já presentes na suíte. Isto não é um teste em aparelho físico.
- APIs substituídas por respostas locais; comandos autorizados nas simulações alteram somente objetos fictícios. Demais gravações são bloqueadas. Arquivos de teste e chamadas do OneDrive são simulados, sem envio à Microsoft ou ao Supabase.
- Impeccable aplicado ao endurecimento dos estados e shadcn aos controles/alertas existentes. A avaliação usa a régua anterior do projeto, feita por este agente; não é uma execução do comando independente Impeccable critique, pesquisa com clientes ou SUS.

## Falhas encontradas e corrigidas

### R01 — O rascunho da medição não estava conectado ao formulário

O utilitário e o hook de persistência existiam, porém o formulário atual de Terceirizados não os consumia. A reprodução abriu uma medição, informou 42,125%, observação e foto, fechou e recarregou: o percentual retornou a zero.

O formulário agora usa o rascunho por empresa/conta, obra, contrato e correção. Percentuais, data, observação e referências das fotos enviadas são salvos neste aparelho, com estado visível. Cancelar conserva o rascunho; Descartar rascunho exige confirmação e não apaga fotos do OneDrive. Falta de armazenamento mantém o preenchimento aberto e permite tentar salvar novamente; a proteção de saída também impede uma recarga inadvertida quando a gravação local falha.

Ao recuperar, a tela confere a base do contrato/medições. Mudança da base bloqueia uma nova confirmação e exige conferência explícita; não recalcula nem substitui silenciosamente a intenção do operador. Uma medição já confirmada não é recriada a partir do rascunho antigo. Rascunho ilegível não é sobrescrito automaticamente.

### R02 — Tentativas de medição ganhavam outra identidade ao reenviar

A identidade era criada dentro de cada clique. Agora a tentativa completa é protegida localmente antes do envio. Quando a resposta se perde, os campos ficam protegidos e Repetir confirmação reenvia a mesma tentativa: se já foi aceita, o servidor devolve sua confirmação, sem outra medição nem novo envio das fotos. Reabrir/reconectar não envia essa medição automaticamente. Recusas definitivas do servidor continuam sendo respeitadas; permissões e validações financeiras não foram afrouxadas.

### R03 — A tela de falha não diferenciava falta de conexão

O estado de erro agora distingue conexão indisponível, carregamento de arquivo da aplicação e erro de exibição. Recarregar fica desabilitado enquanto offline e é habilitado ao reconectar; a tela de erro não reenvia a operação. O botão utiliza o componente compartilhado, substituindo a antiga apresentação dourada com texto branco. Diagnóstico e referência foram preservados.

A recuperação existente de arquivos da aplicação foi testada no navegador: uma falha transitória no CSS é recuperada antes de exibir a tela; uma aba do build anterior recebe o build atual quando um arquivo antigo retorna 404; uma falha persistente para após a tentativa permitida por build, sem ciclo de recargas. Não houve deploy para produzir essas condições: dois builds locais foram servidos alternadamente sob um mesmo endereço de teste.

### R04 — Redução de percentual prometia um estorno que o servidor não aceita

A mensagem dizia que um acumulado menor geraria estorno. A regra real do comando aceita avanço, não essa operação. A mensagem foi corrigida e o envio da redução é bloqueado na tela, orientando a conferir correção/cancelamento na medição de origem, conforme o acesso. Não foi criado um comando novo de estorno nem alterado o histórico financeiro.

## Ensaios e evidências

| Grupo | Resultado e escopo |
| --- | --- |
| Unitários e domínio | **85 testes em 16 arquivos**: recuperação de versão/CSS, rascunhos, quota, isolamento, tentativa protegida, limpeza após confirmação, sessão, journal, fila offline, leitura/permissão de anexos e comandos/vínculos de terceiros. |
| Condições adversas no DEV | **71 cenários aprovados**, mais 1 caso exclusivo do menu móvel não aplicável ao desktop. Inclui rede lenta, cancelamento do carregamento, sessão expirada, 403/503, resposta perdida, conflito, troca de conta/obra, outra aba, armazenamento indisponível, comprovante da versão anterior e confirmação idempotente. |
| Recuperação da medição no DEV | **14 cenários aprovados**: fechamento/recarga, fotos, quota, tentativa lenta/resposta perdida, offline/reconexão, lote parcial, mudança da base e redução do acumulado, nos dois tamanhos. |
| Nova avaliação no DEV | **16 sessões aprovadas**: oito setores × celular/desktop, renderização, ações de chegada, ajuda, ausência de transbordamento horizontal e ausência de gravações de negócio. |
| Documentos no DEV | **2 cenários aprovados**: acesso negado ao anexo do OneDrive, nova tentativa autorizada, leitura da revisão anterior em endereço legado e preservação do documento/histórico. |
| Build: regressão e nova avaliação | **89 cenários aprovados**: etapas anteriores, novas medições/recuperação, oito setores e documentos no celular/desktop. |
| Build: casos adversos selecionados | **18 cenários aprovados**: carregamento lento em Folha, Rescisão, Compras e Planejamento; recebimento com resposta perdida; rascunho anterior com comprovante; conflito; troca de conta; falha ao proteger uma segunda edição. |
| Build: troca de versão e CSS | **6 cenários aprovados**: alias local do build anterior para o atual com rascunho v1, falha persistente/offline/reconexão e CSS transitório, nos dois tamanhos. |

Total no build: **113 cenários**, distribuídos nas três últimas linhas. As simulações de falha provocam erros de rede intencionalmente; isso não é uma afirmação de ausência de qualquer mensagem no console durante a injeção de falhas.

Uma fixture antiga do ensaio de recebimento usava UN para um material cadastrado como SC. O bloqueio de integridade da etapa 5 recusou corretamente a entrada. A fixture foi corrigida consultando a unidade pelo ID exato do material; os dois cenários foram repetidos e aprovados. Não se removeu o bloqueio, não se mudou a expectativa para aceitar erro e não se alterou material real. Por isso o total DEV reúne a rodada inicial de 69 aprovações com as duas repetições aprovadas; a única omissão é o menu móvel no projeto desktop.

Lint, design:check, manual:check, typecheck e architecture:check aprovados. O manual tem **144 guias para 65 abas**, com tópico específico de recuperação da medição. Nenhuma baseline ou teto foi ampliado. Build direto com Vite, evitando o prebuild que executa migrações remotas.

JS/CSS compactados: **1.835.017 bytes**, abaixo do teto vigente de **1.891.328 bytes**. A revisão visual incluiu as capturas reais dos testes no celular e desktop. Evidências e configurações em `artifacts/roadmap-usabilidade-etapa6/`; cópias anteriores dos arquivos alterados estão em `before/`.

## Nova avaliação de usabilidade

Mesmos pesos da régua de 15/11: clareza 25%, celular 25%, próxima ação 20%, consistência/contexto 20%, orientação/recuperação 10%. Notas de 0 a 10 são julgamentos heurísticos dos cenários observados, sem precisão estatística. A média é calculada antes do arredondamento. Memória do cálculo: `assessment-scores.json`.

| Setor | Clareza | Celular | Próxima ação | Consistência | Recuperação | Ponderada |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Gestão e relatórios | 8,5 | 8,5 | 9,0 | 8,5 | 8,5 | **8,6** |
| Comercial e contratos | 8,5 | 8,0 | 8,5 | 8,5 | 8,0 | **8,3** |
| Obras e projetos | 8,5 | 8,0 | 8,5 | 9,0 | 8,5 | **8,5** |
| Compras e estoque | 8,5 | 8,0 | 8,5 | 8,5 | 8,5 | **8,4** |
| Financeiro | 9,0 | 8,5 | 8,5 | 9,0 | 8,5 | **8,7** |
| Equipamentos e locações | 8,0 | 8,0 | 8,0 | 8,5 | 8,0 | **8,1** |
| Pessoas e terceiros | 8,5 | 8,5 | 8,5 | 8,5 | 9,0 | **8,6** |
| Administração | 8,0 | 7,5 | 8,0 | 8,5 | 8,0 | **8,0** |

**Média geral: 8,4/10.** A nota publicada anterior de 7,1 usava dados reais, outro build e outro percurso. A nova nota é do conjunto local, incluindo etapas ainda não publicadas; a diferença não é uma melhora quantitativa medida com a mesma amostra.

A cobertura de chegada dos oito setores não equivale a executar cada operação do ERP. Aprofundamento desta rodada: recuperação e falhas, além das regressões de contexto, fechamento, Comercial/contratos, tarefas/aprovações, listas, percentuais e compras. As quatro jornadas transacionais e o impacto no DRE da etapa 5 permanecem documentados separadamente; esta etapa não amplia a conclusão para todos os contratos, ativos ou regras de produção.

### O que sustenta as notas e o que ainda impede 9,5

- **Gestão:** bases de caixa/competência e prioridade estão claras; ainda há indicadores e recortes que um iniciante precisa aprender.
- **Comercial:** ação de entrada legível, contratos por vínculo explícito e retorno à edição preservado. A experiência de chegada vazia continua genérica; uma negociação completa não foi avaliada com clientes reais.
- **Obras:** contexto e retornos consistentes, busca/paginação e distinção de avanço oficial. A ficha completa e o planejamento continuam extensos no celular.
- **Compras:** fila indica situação/próxima ação e o recebimento se recupera sem outra entrada. Obra em foco, obra local e seleção de fluxo ainda disputam espaço antes da tarefa móvel.
- **Financeiro:** saldo em aberto é distinguido de caixa, origem consultável e confirmação protegida. A quantidade de áreas e filtros ainda exige familiaridade.
- **Equipamentos:** ações e disponibilidade identificáveis, porém indicadores, período de referência e filtros precedem a consulta no celular. Reserva, manutenção e cobrança reais não foram homologadas nesta rodada.
- **Pessoas/terceiros:** busca/listas e percentuais preservam precisão; rascunho e resposta perdida agora são recuperáveis. O formulário ainda exige rolagem e evidência fotográfica; o uso com teclado/câmera de um celular físico continua pendente.
- **Administração:** finalidade e ajuda são acessíveis, mas a auditoria oferece muitos filtros para um iniciante. Mudança real de permissões, IA e contas de clientes não foram executadas.

Automação e comunicação entre setores não receberam uma nota global artificial: foram verificadas por evidência de origem e próximo passo nas regressões. O sistema continua exigindo decisões humanas formais de aprovação e conferência. A simulação não comprova, por si só, que todas as mensagens, integrações e filas reais estejam corretas.

## DRE, dados e limites

Rascunho local e suas fotos de referência não criam obrigação, custo ou pagamento. A proteção da tentativa reutiliza a identidade original, sem reconhecimento duplicado. O fluxo permanece: medição confirmada → aprovação do Financeiro → reconhecimento do custo; pagamento baixa a obrigação. Redução de acumulado não cria estorno. Recuperar tela ou abrir ajuda não grava lançamentos.

Limites: não houve ensaio em aparelho físico, uso simultâneo da mesma medição em duas abas, validação de credenciais reais do OneDrive, auditoria de RLS remoto ou validação com clientes. O rascunho depende deste navegador/conta e não é backup: limpar os dados do navegador pode removê-lo. O teste offline comprova trabalho local com o app já carregado; não comprova partida do ERP completo sem rede. Fotos novas continuam exigindo conexão. A repetição protegida evita reenviar as fotos da tentativa; isto não é deduplicação por conteúdo de arquivos escolhidos manualmente outra vez.

O fechamento local desta etapa não autoriza publicar. Para sustentar a meta 9,5, permanecem prioritárias a redução de escolhas antes das tarefas móveis, orientação inicial dos estados vazios, teste físico e homologação autorizada das integrações em ambiente próprio de teste.
