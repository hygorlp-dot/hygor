# Sincronização biométrica da Gestão de Ponto

Implementação original sobre `ad73271018eab901ce3e369435d9fc96c294a693`, preservada no commit local `dcf55e2`. Para a publicação autorizada pelo usuário em 31/10/2026, a evolução foi integrada à produção `678da1ccc787abc2555e1fb941259b7a67a178d6`, mantendo as revisões de Compras e Financeiro.

## Operação

Em **Pessoas e terceiros → Gestão do ponto → Sincronizar batidas do app**, RH e administrador consultam todas as obras do recorte. O período corresponde à quinzena completa, inclusive fins de semana nas extremidades; a busca por nome da grade não restringe o lote. Os filtros de área e obra são respeitados, usando a obra de captura e não a lotação fixa atual.

A prévia agrupa por obra e informa dias aptos, pendências e registros já integrados. A confirmação sincroniza até 500 dias por lote. Havendo mais dias, uma nova consulta permite processar o restante. Batidas que ainda estão somente no celular não podem ser recuperadas pelo servidor: o aparelho precisa enviá-las primeiro.

## Prioridade e bloqueio

- A situação e os horários biométricos aptos substituem os registros manuais, inclusive falta ou obra manual divergente. A auditoria guarda antes/depois.
- `pontoReview` contém IDs das batidas, assinatura da fonte, escala, identidade do RH, data e revisão. A grade identifica **Biometria** e desabilita edição e troca de obra.
- O servidor rejeita edição, exclusão e lote manual do lançamento protegido, mesmo com flags internas forjadas. Nova conferência pelo RH no Ponto eletrônico continua disponível.
- O cliente não envia valores para determinar presença, horários, obra ou biometria: a confirmação reconsulta os eventos no banco e recalcula o plano dentro da transação existente de ponto.
- Mudança de fonte, escala ou lançamento desde a prévia rejeita o lote inteiro. `operationId` garante idempotência na repetição de uma confirmação já concluída.

## Critérios e limites

Somente identificação facial com horário confiável e escala vigente entra no lote. Duas batidas exigem tipos explícitos entrada/saída. Quatro batidas antigas sem tipo podem ser conferidas na prévia pelos quatro horários registrados; nenhum horário de intervalo é criado. Sequência incompleta, duplicada, inconsistente, futura ou de várias obras exige tratamento pelo RH. Ausência de batida nunca gera falta automática.

Dias bloqueados, quinzenas arquivadas, folha fechada e competências fechadas do DRE ficam pendentes. A sincronização não reabre fechamentos nem cria, cancela ou altera pagamentos. Os eventos originais do app e o APK permanecem preservados.

O servidor consulta eventos novos e legados com filtro de empresa e deduplicação por ID, em recorte de até 32 dias, recusando consultas acima de 10.000 batidas. Não há migration nem mudança de permissões do banco. A escrita usa as linhas de ponto por obra e a auditoria já existentes.

## Validação

Testes de domínio, API e PGlite cobrem prioridade biométrica, isolamento por empresa, concorrência, idempotência, troca de obra, auditoria, bloqueio da engenharia, preservação de pagamentos e fechamento do DRE. Os cenários de navegador cobrem sincronização e falha em computador e celular; também estão incluídos na configuração principal do Playwright.

Resultados locais: suíte geral com **3.941 testes aprovados e 15 ignorados**, seguida de **67 testes focais** e da confirmação final dos arquivos ajustados (**31 testes**, incluindo o status legado em texto). Os quatro cenários de navegador passaram em desenvolvimento e foram repetidos com sucesso sobre o build de produção. Lint, tipos, arquitetura e build passaram. Pacote JS/CSS: **1.744,30 KiB gzip**, abaixo do limite existente de 1.748 KiB, sem aumentar o orçamento.

Na consolidação para publicação, os 31 testes de API/persistência e os quatro cenários de navegador em computador/celular passaram novamente. Tipos, build e orçamento do pacote também passaram: **1.725,80 KiB JS/CSS gzip**, sem ampliar limites. A suíte geral é repetida pelo hook obrigatório antes do envio; os checks do GitHub e o deployment exato são conferidos na publicação.

Dados de navegador são isolados e as APIs interceptadas; testes transacionais usam PGlite local. Não há ensaio de escrita em produção. Logs de validação foram preservados fora do repositório em `C:/Users/hygor/rh-biometria-*.log` e `C:/Users/hygor/rh-bio-publicacao-*.log`. A publicação autorizada é consolidada em um único envio à produção, sem previews intermediários.
