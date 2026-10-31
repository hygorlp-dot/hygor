# Tolerância no banco de horas — CLT e CCT Caruaru

## Fonte conferida

PDF original fornecido pelo usuário: `C:/Users/hygor/OneDrive/Desktop/Arquivos/cct-caruaru-2026-17853519576a6a4f1580c96 (2).pdf`.
SHA-256: `79a1846cdbda5c88e83ef37961f96ef1c717ab7620ff3db76f838f3042e2fe55`.
Registro PE000665/2026, solicitação MR042249/2026, de 14/07/2026; vigência 01/05/2026–30/04/2028. Abrangência: construção civil em Caruaru/PE.

Texto extraído e página 13 renderizada para conferir a cláusula 43. A cláusula não fixa minutos diferentes de tolerância; §2 dispensa marcação intrajornada e §3 condiciona a redução do intervalo a acordo coletivo e assembleia. A cláusula 42 trata da garantia de repouso remunerado no ingresso com atraso compensado, não autoriza abono geral do atraso. Não alteramos DSR ou holerite.

Regra numérica utilizada: [CLT art.58 §1º](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm): até 5 minutos por marcação e até 10 minutos de variações totais por dia, para crédito e débito. Não cria autorização para atraso habitual.

Consulta complementar identificou o aditivo PE000729/2026, MR047175/2026, de 30/07/2026. A cópia pública em https://podever.com.br/cct/3044/ trata da coparticipação na alimentação, sem nova tolerância de ponto. O acesso direto ao Mediador retornou 403 nesta sessão; a fonte principal para a CCT é o PDF original do usuário, não um resumo de busca. Não alteramos descontos de alimentação.

## Comportamento

- Somente projeção de leitura do banco de horas; nenhuma gravação de negócio, migração ou alteração de folha/DRE/pagamentos/APK.
- Usa `scheduleOnDate`: horários da escala efetivamente cadastrada pelo RH e vigente na data, incluindo saída de sexta às16h na escala44h. Não presume horários a partir de uma jornada genérica de8h.
- Para duas batidas válidas, compara entrada e saída e mantém o desconto estimado de almoço já existente. Para quatro, compara também saída e retorno do intervalo. Preserva o intervalo realmente registrado.
- Cada desvio é calculado em milissegundos e sua magnitude entra na soma diária. Só aplica quando TODOS estão dentro de5min e a soma é no máximo10min. Não usa o saldo líquido para decidir e não permite que outro dia compense os limites.
- Dentro dos limites, saldo do dia fica zero; fora deles, mantém a diferença integral, sem deduzir uma franquia. Não arredonda segundos antes de verificar limites.
- Preserva horas observadas, intervalos, obras, batidas e fontes. `saldoSemToleranciaMinutos` e `ajusteToleranciaMinutos` explicam a diferença entre horas líquidas menos jornada e o saldo após tolerância. Totais, filtros e gráfico usam o saldo após ajuste.
- Sem escala, informa que a tolerância não foi aplicada. Tratamento RH por apropriação permanece respeitado; não aplica novamente a tolerância. Fontes com avisos, sequências especiais, transferências interpretadas, horários incompletos e cobertura incompleta não recebem abono automático. Dias sem registro continuam sem débito.
- A consulta permanece estimativa, sem saldo anterior/compensações; não constitui implantação de acordo de banco de horas nem liquidação de direitos.

## Exemplos na escala seg–qui 07–12 /13–17

| Batidas | Saldo observado após almoço | Saldo após tolerância |
| --- | --- | --- |
|07:05 /16:55|−10min|0|
|06:55 /17:05|+10min|0|
|07:06 /17:00|−6min|−6min|
|07:03 /11:57 /13:03 /16:57|−12min|−12min (soma diária excedida)|

Base da publicação: `edf48315fc5601559f377fa34cecaf6ef1098bb2`, preservando a correção do almoço, a sincronização biométrica e a central Arquivos. A main remota não contém todas essas entregas; não publicar diretamente dela sem consolidar a base em produção.

## Validação local da entrega

188 testes em17 arquivos aprovados, incluindo limites em segundos, sem compensação entre dias, fonte preservada, cobertura parcial, escala histórica, sexta-feira, fim de semana e tratamento RH. Quatro cenários Playwright no build compilado aprovados em computador e celular, com APIs interceptadas e sem gravação de negócio. Revisão visual das capturas concluída. Lint, tipos, arquitetura e build passaram;1738,18KiB JS/CSS gzip dentro do limite existente. Nenhum arquivo de API, servidor ou APK alterado.

Evidências: `C:/Users/hygor/ponto-tolerancia-entrega-tests.log`, `C:/Users/hygor/ponto-tolerancia-entrega-browser.log` e logs `ponto-tolerancia-*` na mesma pasta. Regressões reproduzidas antes da correção em `ponto-tolerancia-red.log` (12 falhas), depois aprovadas.
