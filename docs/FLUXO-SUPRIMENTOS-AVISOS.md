# Consolidação local de suprimentos com avisos

Revisão: 31/10/2026. Orientação do usuário: as pendências entre etapas devem avisar, sem impedir o avanço.

## Comportamento

- Pedido pode ser registrado com aprovação pendente/recusada ou acima da alçada. A decisão de aprovação não muda; o aviso identifica responsável e orientação.
- Cotação com uma proposta ou escolha mais cara pode seguir sem justificativa preenchida, mantendo aviso. Preços e os dados necessários ao cálculo continuam válidos e explícitos.
- Recebimento independe de nota, quitação e envio prévio do pedido. Quantidade acima do pedido registra a entrada real e gera aviso. Quantidade inválida continua sendo erro de dados.
- Pedido, recebimentos, entrada de estoque e custo médio são atualizados na mesma operação idempotente. Receber não cria outro custo nem pagamento.
- Recebimento de rascunho registra que o envio precisa ser conferido e retira o pedido do estado de rascunho para não ocultar fatos já realizados nas projeções.
- Pagamento acima da referência recebida/faturada é identificado como adiantamento pelo servidor, mesmo sem marcar uma opção ou informar motivo. Ausência de motivo fica sinalizada.
- Nota em conferência pode ser paga. Pagamento parcial preserva a situação fiscal; quitação mantém `conferenciaFiscalPendente` até a decisão explícita de conferência. Conferir depois de quitar não cria outro pagamento.
- Caixa ainda não ativado ou saldo projetado negativo gera aviso e mantém os fatos registrados. Não se cria aporte fictício.
- Pagamento pela nota avisa se já houver pagamento no pedido sem vínculo com aquela nota. Não se infere associação por valor/descrição. Espelhos explícitos mantêm o mesmo identificador.
- A conciliação automática mantém pendências processuais para revisão; o registro manual permanece disponível ao perfil autorizado. A mudança não amplia permissões.
- Avisos de pedidos, pagamentos e recebimentos passam pelo resumo do comando, ficam nos registros/recibos e permanecem disponíveis no reenvio idempotente.

## Interface e ajuda

Na ficha completa da compra, a conferência mostra Compras, Recebimento, Documento fiscal, Pagamento e Estoque com situação e responsável. Os avisos apresentam a pendência e como encaminhá-la, sem botão de desbloqueio.

Os guias de Compras, recebimento, estoque, conferência fiscal e pagamento incluem responsáveis e exceções. Ajuda e `MANUAL_DO_APP.md` usam a mesma fonte; o índice também pesquisa os novos textos.

## Coordenação entre chats

O usuário solicitou a verificação entre chats. Foram consultados:

- **Compras e Conciliação — Histórico de preços**: revisão somente de leitura apontou o acoplamento com automação, o risco de pagamento aprovar a nota, a projeção dos rascunhos, atomicidade do recebimento e identidade dos pagamentos. Esses pontos foram incorporados aos testes.
- **Planejar rebranding completo do app**: manteve o escopo WF06 em correção documental e recuperação de formulários; os trechos de recebimento e aprovação operacional foram separados das mudanças dessa frente.
- **Adicionar gestão de projetos**: informado para preservar sua release isolada de Arquivos/licenciamento, sem incorporar as mudanças experimentais de suprimentos deste checkout.

## Validação reproduzível

Dados dos cenários são fictícios e representativos da operação; não foram alterados dados reais ou arquivos do OneDrive.

```powershell
npx vitest run src/domains/compras src/domains/financeiro src/domains/conciliacao src/domains/sync/operational-commands.test.js src/features/help server/operational-command-policy.test.js --maxWorkers=2
npm run lint
npm run typecheck
npx vite build --outDir artifacts/ajuda/advisory-build --logLevel error
npx playwright test --config playwright.procurement-advisory.config.mjs
```

As jornadas incluem entrega parcial sem aprovação, recebimento excedente com conversão de unidades, nota/pagamento antes da entrega, quitação antes da conferência, adiantamento, reenvio sem duplicação e retenção de casos pendentes na automação. O navegador usa o comando de domínio real em memória e verifica recebimento, pagamento e ajuda no desktop e no celular.

Logs e capturas: `artifacts/ajuda/procurement-advisory-final-tests.log` e `artifacts/ajuda/procurement-browser/`.

Regressão de domínio concluída: 816 testes aprovados em 98 arquivos. Inclui os cenários novos, autorização de comandos e regressões de Compras, Financeiro, Conciliação e ajuda. Lint, tipos, arquitetura e build local também foram conferidos; os cenários de navegador usam APIs isoladas com execução do comando real em memória.

Este trabalho permanece local. Previsão detalhada de custo final e gestão de mudanças não foram alteradas nesta consolidação.
