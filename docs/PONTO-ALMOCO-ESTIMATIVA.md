# Almoço e escala na estimativa de horas

Correção local da consulta **Ponto eletrônico → Banco de horas**, sobre `5b82a08`. Sem push ou deploy desta correção.

## Regra

- A escala vigente em cada data prevalece sobre a jornada fixa. A escala cadastrada de 44h utiliza 9h líquidas de segunda a quinta, 8h na sexta e zero previsto no fim de semana. Antes da vigência, permanece o cadastro ou padrão da empresa.
- Em dias considerados, com mais de seis horas corridas pelas batidas e nenhum intervalo registrado, a estimativa desconta 60 minutos de almoço padrão, conforme solicitado. Turnos curtos, dias incompletos e consulta sem cobertura confirmada não recebem esse abatimento.
- Uma pausa já registrada é respeitada, inclusive de 30 minutos ou abaixo de um minuto. Não há complemento automático nem desconto duplicado. Apropriações tratadas pelo RH também são preservadas.
- O desconto padrão é indicado no resumo e no detalhe do dia. Os horários originais continuam visíveis; não se fabricam batidas de almoço nem se atribui artificialmente esse desconto a uma obra.
- O modelo é somente leitura. Esta correção não altera marcações, apropriações, grade, folha, pagamentos, DRE ou APK.

## Exemplos sintéticos

Quinta-feira, somente 07h–17h: 10h corridas menos 1h padrão = 9h líquidas, comparadas às 9h da escala. Sexta-feira, somente 07h–16h: 9h corridas menos 1h padrão = 8h líquidas, comparadas às 8h da escala.

Com batidas 07h, 12h, 13h e 17h, o intervalo já foi excluído: continuam 9h líquidas, sem deduzir outra hora. Duas jornadas que totalizem 18h45 corridas, sem nenhuma pausa registrada, totalizam 16h45 após dois descontos padrão; o saldo depende da escala de cada data.

## Verificação

Testes de regressão reproduziram o erro antes da correção. A validação cobre almoço ausente/registrado, intervalo tratado, turnos curtos, pausa inferior a um minuto, pureza dos dados, histórico de escala, gráficos e totais da tela. Há testes reais de navegador em computador e celular, com APIs interceptadas e nenhuma escrita de negócio permitida.

A revisão visual também corrigiu o cabeçalho estreito e a altura da identificação do funcionário nos cartões do celular, para evitar sobreposição com a jornada variável.

Validação final: **57 testes aprovados em quatro arquivos**, **dois cenários de navegador aprovados** (computador e celular), lint, tipos, arquitetura e build aprovados. Pacote JS/CSS: **1.726,23 KiB gzip**, dentro do orçamento existente, sem elevar limites. Logs locais: `C:/Users/hygor/ponto-almoco-*.log`. Nenhum teste enviou comando de negócio ao servidor de produção.
