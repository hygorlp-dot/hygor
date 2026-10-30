# Exportação de Compras: cancelamento intermitente do download

Correção local de 30/10/2026, sem push ou deploy.

## Problema e correção

O XLSX era gerado, mas o navegador nem sempre concluía o download. O endereço Blob era revogado um segundo após o clique; o clique inicia a navegação, sem garantir que o navegador já tenha consumido esse endereço.

A reprodução controlada atrasa em 1,5 segundo o clique do link de download. Com a implementação anterior, o download foi cancelado. A correção mantém o endereço disponível por 60 segundos e depois libera a memória. O limite de 60 segundos do teste não foi ampliado.

A mudança está no helper compartilhado src/lib/spreadsheet.js. Não altera consultas, filtros, dados da planilha ou lançamentos financeiros.

## Evidências

- Antes: excel-atraso-antes.log reproduz o cancelamento com início atrasado.
- Depois: excel-correcao.log confirma as duas exportações, normal e atrasada. Os testes abrem o arquivo baixado com ExcelJS e verificam abas, recorte filtrado, números e datas.
- excel-unit.log: sete testes de exportação e leitura seletiva passaram.
- Suíte completa de navegador de Compras: 39 de 39 cenários passaram (excel-compras-completa.log), incluindo exportação normal e atrasada.
- Domínio de Compras, portal e API: 307 testes em 37 arquivos passaram (excel-compras-unit-completa.log).
- Lint, tipos e build passaram: excel-lint.log, excel-types.log e excel-build.log. O build mantém o aviso de pacotes acima de 650 kB.

Todos os logs ficam em artifacts/compras/. Os testes usam dados e APIs simulados.
