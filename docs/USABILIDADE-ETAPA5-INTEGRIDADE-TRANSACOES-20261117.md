# Etapa 5 — Integridade e transações entre setores

Validação local em 17/11/2026. Sem publicação, push, migração remota ou gravação no ERP publicado. As mudanças anteriores deste checkout foram preservadas.

## Base financeira após a remoção

O usuário confirmou que removeu os lançamentos financeiros antigos. Esta etapa não reconstrói essas entradas nem reaproveita as filas de conciliação da auditoria de 15/11 como situação atual. O documento `RETOMADA-FINANCEIRA-2026-11-16.md` é uma referência histórica da retomada; não é uma nova consulta à produção. Todas as transações desta validação usam registros fictícios locais.

## Correções

- Recebimento de compra: recusa movimento repetido, dois movimentos para um mesmo item deixando outro sem entrada, números inválidos, conversão ausente entre unidades diferentes e incompatibilidade entre a referência do pedido e a unidade do material encontrado pelo ID. Quantidade, custo unitário e unidades da entrada são derivados do pedido. Valores não finitos também são bloqueados após a conversão e no total.
- Solicitação: o fator não é mais preenchido a partir da descrição ou bitola do aço. Alterar unidade ou comprimento exige nova conferência. Selecionar novamente a mesma unidade preserva o fator; compra e referência iguais usam 1:1. A orientação usa os controles e os componentes existentes, seguindo Impeccable, shadcn e o padrão MARCELL.
- Guarda de preço do editor do pedido: os históricos são agrupados por ID do material, unidade de referência, unidade de compra e fator explícitos. Bases diferentes ou desconhecidas não são misturadas. Comparação com a referência exige preço, unidade e conversão válidos; a ficha explica a indisponibilidade.
- Ajuda contextual e manual atualizados nos fluxos Solicitar, Pedidos e Receber.

Não houve mudança na política de recebimento excedente: uma entrega realmente maior continua gerando aviso para conferência. Não houve estorno, recálculo ou alteração automática em pedidos, estoque ou documentos antigos. A compatibilidade de registros legados na mesma unidade foi mantida.

## Efeito no DRE e origem dos dados

| Jornada | Evidência e reconhecimento |
| --- | --- |
| Comercial → contrato → obra | Cliente e obra por IDs, aproveitamento explícito da área, nova conferência comercial e aprovação. Contrato preserva autoria/histórico e não altera a obra nem reconhece receita sozinho. |
| Compra → entrega → fiscal → pagamento → conciliação | Pedido de R$ 200 é compromisso; entrega de 2 sacos de 50 kg é estoque físico de 100 kg a R$ 2/kg. Nota reconhece R$ 200 de custo; pagamento e conciliação reutilizam esse fato, sem novo custo. |
| Ponto → folha → DRE | Presença registrada pelo comando real produz diária de R$ 150. Fechamento cria título de R$ 150 e mantém o mesmo custo no DRE. Vínculo de emprego delimitado a um dia para isolar esta prova dos feriados remunerados; o comportamento geral de folha permanece coberto pelos testes existentes. |
| Terceirizado → aprovação → pagamento | Medição de 50% sobre etapa de R$ 1.000: rascunho sem custo; pagamento antecipado à aprovação recusado; aprovação reconhece R$ 500; pagamento altera caixa sem repetir custo. Autoria e vínculo da medição são preservados. |

As quatro jornadas executam os comandos reais do domínio e gravam/reabrem cada marco como JSONB em PGlite descartável. Esse ensaio comprova a continuidade do estado após serialização; não deve ser confundido com uma execução HTTP completa contra Supabase. As permissões e os bloqueios transacionais da API são exercitados separadamente pelas suítes de autorização, persistência e fechamento do DRE. Há controles de outra obra e competência anterior, rejeição de repetição/excedente e recibos idempotentes. Nenhum vínculo foi criado por semelhança de nomes.

## Verificação

- 370 testes em 18 arquivos: comandos, recebimentos, conversões, comparação de preço, contratos, ponto/folha, terceiros, decisões, autorização por perfil/obra, persistência, conciliação e períodos fechados. As quatro jornadas persistidas também foram executadas separadamente.
- Navegador DEV: 2 cenários novos em sessões isoladas, 390 e 1440 px, sem envio de dados.
- Build final: 57 cenários de navegador, incluindo regressões das etapas anteriores, celular/desktop, contextos, permissões e recuperação. API substituída por base fictícia e requisições externas bloqueadas.
- Revisão visual das capturas de celular e desktop. Ajustada a orientação para ocupar a largura do formulário no desktop.
- Lint, design:check, manual:check, typecheck e architecture:check sem falhas. Manual com 143 guias para 65 abas; nenhuma ampliação da baseline de design.
- Build direto com Vite, sem acionar o prebuild que executa migrações remotas. JS/CSS gzip: 1.831.744 bytes, abaixo do teto vigente de 1.891.328 bytes; nenhum limite aumentado.

Evidências: `artifacts/roadmap-usabilidade-etapa5/` (`receipt-before.log`, `regressions.log`, `sector-checkpoints.json`, `sectors.log`, `browser-dev.log`, `browser-build.log`, `build.log`, `bundle.json`, `lint.log`, `typecheck.log`, `architecture.log` e capturas). Há cópias dos arquivos antes das alterações desta etapa em `before/`.

## Limites e próxima etapa

A etapa 5 foi implementada e validada localmente. Não houve homologação de RLS remoto, movimentação de banco real, envio ao OneDrive ou teste em aparelho físico nesta rodada. Divergências documentais de contratos existentes exigem conferência de sua origem; não foram corrigidas por aproximação ou recadastramento. A etapa 6 continua pendente: sessão antiga após publicação, rede lenta/offline, rascunhos, documentos legados/OneDrive, aparelho físico e nova avaliação rigorosa. A meta 9,5 ainda não foi reavaliada.
