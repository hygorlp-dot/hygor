# Equipamentos — Fase 4: ciclo completo da locação

Data de início: 4 de agosto de 2026.

## Objetivo

Introduzir uma máquina de estados explícita para a locação sem alterar o
comportamento financeiro ou apagar os status usados pelo módulo legado.

## Primeiro incremento

- catálogo puro com os 17 estados previstos no roteiro de implantação;
- transições permitidas declaradas explicitamente;
- compatibilidade de leitura para `ativa`, `encerrada` e `cancelada`;
- bloqueio de saltos inválidos, como entregar antes da separação ou encerrar
  antes da devolução e inspeção;
- justificativa obrigatória no cancelamento;
- bloqueio do cancelamento quando já existem cobranças ou faturas, exigindo
  processo de estorno futuro;
- comando `LOCACAO_EQUIPAMENTO_ESTADO_ALTERADO` com versão esperada,
  idempotência, usuário, data, motivo e auditoria;
- escopo da obra validado no servidor e mesmas permissões operacionais já
  aplicadas às locações;
- comando classificado como fato operacional, sem reconstrução indevida do
  razão financeiro.

## Compatibilidade

O novo estado é gravado em `lifecycleState`. O campo `status` existente não é
sobrescrito neste incremento, garantindo que disponibilidade, relatórios e
cobrança continuem com o comportamento atual durante a implantação gradual.

## Próximos incrementos

1. iniciar novas locações em rascunho e expor as transições permitidas na UI;
2. checklists e comprovantes de separação, expedição e entrega;
3. retirada, devolução e inspeção com quantidades e unidades físicas;
4. devolução parcial, substituição, extensão e renovação;
5. sincronizar efeitos operacionais de cada estado com disponibilidade;
6. executar cobertura, build e E2E antes do encerramento da fase.

A Fase 4 ainda não está concluída.
