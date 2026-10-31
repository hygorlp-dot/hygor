# Onda 1 — Referência de jornadas e padrões compartilhados

31/10/2026. Trabalho exclusivamente local, sem push, PR, deploy ou migrações.

## Entregas e posição

**WF02 concluída no escopo da base compartilhada. WF01 tem a referência automatizada entregue, mas permanece parcial para medição acompanhada e cobertura integral de J01/J07/J08.** Não se considera a onda inteira encerrada: 1 de 10 entregas concluída, 1 parcial; onda 1 de 5 em consolidação. A próxima frente de implementação é WF03/WF04, levando as lacunas de fluxo para os respectivos cenários.

WF02 unificou o renderizador e os quatro papéis semânticos das três APIs de botão; os adaptadores legados mantêm suas chamadas. Campos nativos compartilham contrato visual, foco e erro. Cabeçalhos fiscais e de fechamento passaram a ser seções sob o H1 Financeiro. Diálogos preservam o foco por teclado e o devolvem ao acionador. O catálogo mostra cabeçalho, filtros, registro, formulário, ações e estados reais do sistema de design. Consulte [os padrões](PADROES-OPERACIONAIS-MARCELL.md).

## WF01 — Referência reproduzível

Os oito casos foram executados antes e depois, com as mesmas fixtures isoladas, relógio fixo e APIs interceptadas. Cada fase tem 16 sessões de navegador; J01 inclui três larguras, J06 uma e os demais duas. Perfis principais das fixtures são Administração; restrições de Compras são exercitadas na regressão específica. Isso não substitui a passagem real entre Engenharia, Compras e Financeiro.

| Caso | Referência e estado exercitado | Antes / depois | Lacuna para operação completa |
|---|---|---|---|
| J01 | Planejamento → preparação de solicitação, origem e retorno | Passou / passou | Confirmar solicitação originada do plano; cenário atual prepara e cancela. |
| J02 | Solicitação → cotação → pedido com dados isolados | Passou / passou | Aprofundar passagem entre perfis, pendências e compras parciais na WF03. |
| J03 | Recebimento parcial a prazo; estoque e saldo, sem pagamento | Passou / passou | Atraso, cancelamento e exceções na WF04. |
| J04 | Conferência documental e navegação para a origem | Passou / passou | Cobertura integral de divergências e vínculos na WF05. |
| J05 | Documento aprovado de 1.000, com 250 pagos; confirmar 100 → saldo 650, um comando e dois pagamentos | Passou / passou | Complementar contas e datas ausentes na WF05. |
| J06 | Revisão de extrato conserva seleção e elegibilidade | Passou / passou | Ampliar vínculos parciais e volume nas WF05/WF08. |
| J07 | Consulta das pendências e prioridades do fechamento | Passou / passou | Não executa correção e fechamento real; completar na WF06. |
| J08 | Falha ao salvar solicitação conserva formulário e permite retomada | Passou / passou | Conflito, sessão expirada e arquivo indisponível na WF06/WF09. |

Os estados e transições são os existentes: preparação não equivale a envio; pedido não equivale a recebimento; documento não equivale a pagamento; revisão não equivale a conciliação. As políticas e permissões não foram ampliadas. A referência de pagamento usa o mesmo adaptador de comando operacional do app.

`scripts/wf-foundation-baseline.mjs` executa os casos; `scripts/lib/workflow-evidence.mjs` registra ativações, alterações de campo, mudanças de módulo e duração de requisições. Não registra o conteúdo dos campos, senhas ou payloads. Ativa-se somente com `WF_EVIDENCE_DIR`. Resultados: `artifacts/wf-foundation/before/baseline.json` e `after/baseline.json`.

Os tempos incluem login, preparação, assertions e concorrência local. **Não são tempo humano de tarefa e não demonstram ganho de produtividade.** Mudança repetida de campo pode ser uma edição deliberada do roteiro; não representa automaticamente redigitação desnecessária. Ativações e transições incluem verificações e retornos do teste. O tempo dos processos posteriores aumentou nesta execução; sem protocolo de desempenho isolado, isso não determina regressão nem melhoria.

Para concluir a parcela acompanhada, registrar por tentativa: jornada, perfil, dispositivo, dados iniciais, início/fim da tarefa, espera do sistema, decisão do operador, troca manual de módulo, identidade redigitada, ajuda necessária, resultado e motivo de interrupção. Comparar a mesma tarefa antes/depois, sem remover conferências. Esses campos constituem a ficha do piloto; ainda não há observações humanas preenchidas.

## Validação

- Oito casos de referência aprovados em ambas as fases, com 16 sessões por fase.
- 41 regressões de Compras e 14 financeiras aprovadas, incluindo cenários móveis presentes nas suítes.
- 13 testes unitários aprovados em três arquivos: contrato compartilhado, contexto de sessão e fila financeira.
- 100 capturas por fase: 25 superfícies em 1440/768/390/320 px. Nenhum overflow de página ou erro JavaScript; inspeção de consulta sem comandos de gravação. Isso não significa que todo controle específico do app foi auditado.
- Antes havia H1 duplicado em oito capturas de Fiscal/Fechamento; depois não houve H1 duplicado nas 100 superfícies capturadas.
- Catálogo: 16 comparações de papel × largura, cada uma entre as três APIs; estilos computados iguais, oito capturas, Tab/Shift+Tab/Escape e retorno de foco aprovados.
- Build direto do Vite, build estático do Storybook, lint e typecheck aprovados. Permanece o aviso de tamanho de chunks do build; não houve mudança de bundling nesta entrega.

## Nota da revisão

**8,9/10, provisória e heurística para as superfícies verificadas.** A avaliação considera fluxo 8,8; próxima ação 9,0; recuperação 8,8; consistência 9,2; responsividade/acessibilidade 9,0; resposta 8,5, com os pesos 35/20/15/15/10/5 do roadmap. Resultado ponderado: 8,895. Não é uma medição de satisfação nem comparação direta com a nota anterior, cuja matriz tinha pesos diferentes.

A base visual ficou mais coerente e verificável. Para alcançar 9,5 ainda faltam os fluxos completos de exceção, passagem entre pessoas, recuperação adversa, revisão em volume e piloto acompanhado. Nenhuma meta de redução de cliques ou tempo foi declarada atingida nesta onda.

Na inspeção das capturas, ficam como alvos concretos da próxima onda: distribuir melhor os atalhos de situação e contagens de Cotações em 390 px; reduzir a largura excessiva da ação “Receber material” no cartão desktop; substituir textos como “1 pedido(s)” por flexão correta e uniformizar “Status”/“Situação” na revisão das filas. São ajustes de composição e microtexto dos módulos, além do contrato comum já entregue.
