# RH, ponto e pagamentos — implantação por obra

Contexto oficial recebido em 25/10/2026. [Acompanhamento único](RH-PONTO-STATUS.md).

## Objetivo e decisões

Obra piloto confirmada: **K1-10**. Responsável pelo celular e conferência: **Hygor**. Android disponível, teste físico pendente. Entregar uma operação inicial utilizável para a nova obra em até sete dias de trabalho. Manter pagamentos quinzenais, pessoas por diária e mensalistas CLT na mesma rotina. Vínculo, remuneração e custo da obra são conceitos separados. Diária não significa autônomo; salário mensal não é diária × 26.

Preservar cortes atuais 06–20 e 21–05 até validação operacional. Separar corte, competência mensal e data de pagamento. Não presumir parcelas iguais ou adiantamento de 50%. Usar valores vigentes, dias/frações aprovados, eventos e adiantamentos identificados, compensados uma única vez. Períodos pagos e versões aprovadas permanecem preservados; diferença posterior exige ajuste com motivo/autor.

Estados distintos: salvo no aparelho → aguardando envio → recebido no servidor → dia conferido → fechamento aprovado → pagamento confirmado → conciliado. Falta de sincronização nunca vira falta. Recibo não prova pagamento/assinatura. Preservar marcações e obra de captura; conferir apropriação sem duplicar remuneração. Financeiro, conciliação e DRE existentes são a fonte; não criar segunda obrigação ou saída.

## Primeira semana (janelas máximas; avançar assim que concluir)

| Janela | Entrega e critério |
|---|---|
| D1 | Canonizar contexto; corrigir retroatividade no cadastro geral, avos/base rescisória, atraso, biometria e hora confiável. |
| D2 | Cadastro por modalidade; verificar pareamento, autorização biométrica, persistência local e sincronização; iniciar build Android. |
| D3 | Lista de registros recebidos/pendências no web, justificativas e apropriação; evitar redigitação de batidas. |
| D4 | Preparar quinzena mista, preservando competência CLT, parcelas informadas e composição por funcionário. |
| D5 | Aprovar fechamento e encaminhar ao financeiro existente, com saldo, pagamento parcial e conciliação idempotentes. |
| D6 | Verificar fluxo completo, aparelho físico e contingência; roteiro curto. Sem aparelho, entregar build quando possível e registrar pendência física. |
| D7 | Candidato para operação assistida da nova obra, com responsável, suporte e pendências explícitas. |

Uma lista de pendências e uma ação principal por tela. Manter identidade MARCELL, componentes e navegação; detalhes/fórmulas sob demanda. Casos fora das regras validadas recebem apuração identificada da contabilidade, nunca estimativa apresentada como definitiva.

## Sequência restante

1. Regras, saldos e correções críticas.
2. Cadastro único e rotina simples.
3. Mobile e ponto integrado.
4. Documentos e rotinas de RH.
5. Fechamento quinzenal e competência mensal.
6. Financeiro, contabilidade e custo por obra.
7. Conclusão formal do registrador.
8. Piloto contínuo.
9. Expansão e estabilização.

Depois da primeira semana: portal completo, documentos/férias/afastamentos mais automáticos, escalas/banco de horas se adotados, férias/13º/rescisão completos, banco automático, indicadores, polimento e expansão. Eventos reais continuam tratados por responsável mesmo sem automação.

## Critérios e estados de liberação

Demonstrar com dados de teste: diária e CLT juntos; corte entre meses; valor com vigência; offline/reinício/reenvio sem duplicar; recebimento tardio após fechamento; transferência de obra; adiantamento único; pagamento parcial; repetição idempotente; retroatividade bloqueada/revisada; perfis; totais fechamento/obrigações/pagamentos; recuperação e contingência.

Separar **pronto para operação assistida**, **piloto em acompanhamento** e **validado para operação ampliada**. A última exige duas quinzenas consecutivas e um fechamento mensal reais acompanhados. Testes não substituem esse histórico. O app é candidato controlado enquanto os requisitos oficiais do REP-P não estiverem comprovados; preservar meio oficial definido pela empresa e rótulo atual em rep-p.js.

## Reaproveitamento

Equipe, histórico, employee commands e versões; attendance-engine e fechamentos; Ponto de Obra Android/SQLite cifrado/fila; ARP e apropriação; Folha/Holerites/Provisões; adiantamentos; razão financeiro, conciliação e DRE; prontuário privado; relatórios MARCELL e testes existentes. Auditoria anterior: [RH](AUDITORIA_RH.md). Limites da folha: [Holerite CLT](HOLERITE_CLT_CARUARU.md).
