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

## Segundo incremento

- novas locações operacionais passam a registrar `lifecycleState: active` sem
  alterar o efeito atual sobre ocupação e cobrança;
- encerramento e exclusão legados sincronizam o ciclo para `closed` e
  `cancelled`;
- a lista de locações mostra o estágio atual com nomenclatura em português;
- a interface oferece somente os próximos estados permitidos pela máquina;
- cada avanço usa o comando versionado e auditável do primeiro incremento;
- estados terminais continuam nas ações legadas até que checklists, devolução
  e estorno sejam implementados nos próximos incrementos.

## Terceiro incremento

- entidade embutida e imutável de checklist por locação;
- marcos de separação, expedição e entrega com data, quantidade, unidades
  físicas, acessórios, horímetro, combustível, condição, fotos, responsáveis,
  endereço, aceite e observações;
- validação da quantidade contratada e das unidades vinculadas à locação;
- entrega exige expedição anterior, responsável pelo transporte, recebedor e
  endereço;
- o mesmo marco não pode ser registrado duas vezes;
- transições para `ready_for_dispatch`, `in_transport` e `delivered` exigem o
  checklist correspondente;
- comando próprio com idempotência, versão esperada, escopo da obra e trilha
  de auditoria, sem movimentar o razão financeiro.

## Quarto incremento

- a ação do ciclo identifica automaticamente o checklist ausente e abre o
  formulário correto;
- formulário único para separação, expedição e entrega;
- obra, quantidade e unidades físicas são herdadas da locação;
- captura de acessórios, horímetro, combustível, condição aparente, fotos,
  responsável pela movimentação, recebedor, endereço, aceite e observações;
- após a gravação auditável, a interface passa a oferecer a transição antes
  bloqueada;
- smoke E2E cobre a abertura do checklist de separação no estágio correto.

## Quinto incremento

- checklists de devolução integral e entrada em inspeção;
- registro de quantidade e unidades devolvidas, horímetro final, combustível,
  acessórios, limpeza, fotos, avarias, itens faltantes e responsável;
- indicação explícita da necessidade de ajuste;
- devolução integral precisa corresponder à quantidade contratada;
- inspeção exige checklist de devolução anterior;
- transições para `returned` e `under_inspection` ficam bloqueadas até a
  respectiva evidência operacional;
- compatibilidade preservada para locações legadas ativas que não possuem um
  checklist histórico de entrega;
- smoke E2E cobre o formulário de devolução e seus campos críticos.

A Fase 4 ainda não está concluída.
