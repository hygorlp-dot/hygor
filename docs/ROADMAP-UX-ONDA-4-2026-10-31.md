# Onda 4 — Consultas salvas e necessidades no tempo

Data: 31/10/2026. Entrega local de UX07 e UX08 no escopo do piloto aprovado. MARCELL, logo, Source Sans 3 local, componentes e tokens preservados. Aplicadas Impeccable, shadcn e revisão de práticas React. Sem push, PR, deploy, migrações ou alterações de registros externos.

## UX07 — Consultas e conferência em sequência

Na central documental, “Consultas salvas neste navegador” permite nomear, aplicar, atualizar pelo mesmo nome e excluir consultas. Há limite de 20 consultas; ao atingir o limite, é necessário excluir ou atualizar uma existente, sem remoção automática. São guardados apenas busca, situação, obra e competência, sem anexos, referências de arquivos, rascunhos ou seleção operacional. O armazenamento é separado por identificação da empresa, usuário e restrição de obra.

A aplicação é explícita após recarregar. Obra removida ou fora do acesso atual conserva o recorte atual e explica o problema; filtro e mês inválidos são normalizados. JSON inválido não interrompe a central. Falha ao gravar no navegador mantém os filtros da sessão e informa o erro. Sem ID da empresa ou CNPJ, não se oferece persistência sem isolamento: a interface explica que a identificação precisa ser informada.

“Conferir documentos em sequência” apresenta seleção, prévia e motivo de indisponibilidade por registro. Perfil, obra, situação, data válida e período fechado são verificados novamente antes da abertura. A sequência usa as fichas fiscais existentes, conserva os registros já abertos ao retornar e segue para a próxima ficha disponível. Alterar o recorte invalida a seleção anterior. A prévia mostra a situação atual e distingue ficha aberta de ficha salva ou conferida.

O estudo de lotes resultou em uma fila assistida com confirmação individual. Não foi criada classificação automática em massa nem outro comando de conciliação. Erros de edição e salvamento permanecem na ficha individual. Como navegar não envia comandos de gravação, reaplicar a consulta ou abrir a fila não repete operações financeiras. Eventual classificação em massa exige validação específica de campos, elegibilidade, retorno por item e idempotência antes de implementação.

As consultas foram validadas em jornadas sintéticas por fornecedor e pendência; não há evidência de frequência de uso por usuários reais. Não foi acrescentada telemetria remota ou virtualização sem medição de volume.

## UX08 — Planejamento, compras e vencimentos

Em Financeiro → Caixa por conta → Previsão por vencimentos, a consulta “Planejamento, compras e vencimentos” compara as origens por obra e horizonte:

| Informação | Origem e interpretação |
|---|---|
| Referência da etapa | Primeira data de início válida cadastrada nas atividades da etapa do plano da obra; não equivale a necessidade quantitativa revisada |
| Solicitação | Vínculo explícito por obra, plano e etapa; mostra necessidade cadastrada e situação |
| Pedido comprometido | Pedido ativo, fora de rascunho, ligado à solicitação da etapa; entrega não equivale a vencimento financeiro |
| Título previsto | Posição em aberto da previsão canônica, conforme obra, horizonte, conta e premissas existentes |
| Título vinculado à etapa | Identidade explícita do pedido na origem do título; abre o memorial existente |

Solicitação com pedido vinculado fica fora da contagem de solicitações sem pedido; não se cria outra necessidade de compra por navegação. Isso não certifica atendimento integral: cobertura de itens, quantidades e unidades exige conferência. Estoque compartilhado não é alocado automaticamente. Quantidades ou unidades ausentes são indicadas; referências sem vínculo comprovado ficam separadas, sem associação por nome, fornecedor ou material semelhante.

O usuário pode deslocar as referências de etapas em −30, −14, −7, 0, 7, 14 ou 30 dias. A consulta mostra datas atuais e simuladas, mudança na quantidade de etapas no horizonte e pedidos com entrega posterior à referência simulada. Trocar a obra da consulta limpa o deslocamento. Essa simulação não grava o planejamento, não recalcula dependências do cronograma nem muda necessidades, entregas ou vencimentos. Etapas sem data permanecem sem data.

O memorial abre os títulos previstos da obra ou os ligados à etapa e retorna ao cenário. Atalhos autorizados levam ao planejamento da obra e à solicitação existente em Compras. O caixa por conta e a agenda diária já existentes continuam disponíveis. Títulos sem data ou conta mantêm suas filas; saldo inicial ausente continua desconhecido até a confirmação explícita de uma hipótese. Nenhum saldo empresarial é atribuído à obra por inferência.

Limite deliberado: a entrega não monetiza referências de etapas nem distribui consumo diário automaticamente. Não há dados suficientes para transformar toda referência orçamentária em compra adicional ou projetar sua conta bancária. Orçamento, pedidos e títulos não são somados entre si; compromissos ainda sem obrigação documentada não viram vencimentos inventados.

## Layout e notas

As ferramentas ficam recolhidas junto do contexto existente. Na central documental, nome e aplicação compartilham a linha no desktop, evitando campos com largura excessiva. A prévia substitui a lista de seleção, reduzindo repetição. No celular, controles reorganizam-se e mantêm alvos de 44 px. Etapas apresentam datas e vínculos em quatro colunas no desktop e duas no celular, em fluxo normal da página.

Notas manuais das telas e estados verificados; cinco critérios de igual peso. Não representam estudo com usuários ou desempenho da base real.

| Critério | UX07 | UX08 |
|---|---:|---:|
| Hierarquia e próxima ação | 8,5 | 8,5 |
| Consistência de textos e componentes | 9,0 | 9,0 |
| Aproveitamento de espaço | 8,5 | 8,0 |
| Adaptação a telas e conteúdo | 8,5 | 8,5 |
| Clareza dos controles e estados | 9,0 | 9,0 |
| **Nota da entrega** | **8,7** | **8,6** |

A consulta temporal exige explicações para distinguir suas bases e ainda ocupa altura relevante quando expandida. A conferência é assistida, sem classificação em massa. Esses limites impedem interpretar as notas como certificação de uma operação automatizada completa.

## Validação local

Build estático em 4199, com dados sintéticos e APIs interceptadas. A prévia compartilhada em 4198 não foi reiniciada. A gravação local das preferências de consulta é intencional; as jornadas não gravam dados financeiros.

| Verificação final | Resultado |
|---|---|
| Domínio e componentes | 26 testes aprovados em sete arquivos |
| Regressão financeira desktop/celular | 14 cenários aprovados |
| Continuidade de navegação | Dez verificações aprovadas |
| Documentos e ficha fiscal | Dez verificações aprovadas |
| Jornada específica da onda 4 | 1440, 768, 390 e 320 px; 36 capturas; zero comandos operacionais; sem erros de página ou transbordamento verificado |
| Lint, TypeScript e build direto do Vite | Aprovados; aviso conhecido de chunks grandes mantido |
| Detector de layout dos arquivos revisados | Sem ocorrências; capturas também revisadas visualmente |

A jornada cobre salvamento e aplicação após recarregar, atualização pelo mesmo nome, obra obsoleta com explicação, isolamento ao autenticar outro usuário, seleção de notas disponíveis com exclusão da aprovada, retorno da ficha e avanço sem duplicar abertura na sequência, necessidade com pedido, etapa sem data, deslocamento temporal, memorial de títulos ligados à etapa e troca de obra. A fixture financeira permanece inalterada. A regressão fiscal separada inclui salvamento explícito em API simulada.

Foram corrigidas esperas e seletores do roteiro durante sua preparação; os resultados acima são da execução final completa. Uma importação temporariamente incompleta em edição simultânea de Arquivos interrompeu um build intermediário; o build final passou após o componente existir, sem reverter trabalho compartilhado.

Artefatos em `artifacts/roadmap-wave-four`: `verification.json`, 36 capturas, `journeys-final.log`, `unit-final.log`, `finance-regression-final.log`, `navigation-final.log` e `invoice-regression-final.log`. Build em `build`; log em `artifacts/roadmap-wave-four-build.log`.

Reprodução: `npx vite build --outDir artifacts/roadmap-wave-four/build`; servir com `npx vite preview --host 127.0.0.1 --port 4199 --strictPort --outDir artifacts/roadmap-wave-four/build`; executar `node scripts/roadmap-wave-four-verify.mjs`. Não usar o prebuild npm, que executa migrações.

## Posição no roadmap

**Onda 4 de 4 entregue no piloto local; UX01 a UX08 entregues, 8 de 8.** O roteiro de interface está concluído neste escopo; validação de uso real, volume, classificação em massa e cobertura de necessidades permanece como evolução posterior. Nenhum deploy está autorizado. [Roadmap completo](ROADMAP-UX-FINANCEIRO-COMPRAS-2026-10-31.md).
