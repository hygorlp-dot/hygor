# Verificação da identidade dos PDFs

Ajuste do padrão compartilhado `src/reports/marcell-report.js`.

- Assinaturas visuais conhecidas ArcD Construtech, ArcD Obras e ArcD Construtora passam a MARCELL. CNPJ, configuração persistida, células de tabelas e observações livres são preservados.
- Monograma oficial incorporado como imagem, com opacidade de 4,5%, centralizado e repetido pelo Chromium em todas as páginas. A impressão aguarda sua decodificação e as fontes locais.
- Exportação real da folha com 41 funcionários fictícios: A3 paisagem, três páginas, com nomes longos e a tabela principal completa na primeira página. Relatório de verificação A4: duas páginas. Conteúdo extraído sem a assinatura antiga e transparência da marca confirmada em cada página; todas as páginas foram renderizadas e inspecionadas.
- Seis testes unitários e dois testes Playwright aprovados. Lint e build Vite aprovados.
- Detector impeccable: aviso de imagem quebrada corresponde ao literal de expressão regular que reconhece tags img, não a uma imagem do documento. Imagens reais terminaram de carregar nos testes. Avisos de tipografia e raio pertencem ao padrão de impressão preexistente, já descrito em DESIGN.md, e foram preservados nesta alteração de identidade. Nenhum desses avisos foi convertido em regra nova ou motivo para mudar a diagramação.
- A divergência preexistente do arquivo auxiliar de design do impeccable não foi reparada fora do escopo.

Reproduzir as amostras: `npx playwright test e2e/pdf-mrc.spec.js --project=pdf-mrc`. Arquivos locais com dados fictícios em `output/pdf/`, excluídos de Git e do pacote de publicação.

## Colunas e linhas ajustáveis na folha

A prévia da folha substitui a impressão automática. Distribui as larguras pelo conteúdo, priorizando funcionário, cargo e obra e compactando contagens. Permite selecionar qualquer coluna de cada tabela, ajustar largura, fonte e espaçamento, salvar o padrão localmente e restaurar o automático. Os anexos fluem no espaço disponível; a opção de iniciá-los em novas páginas continua disponível. Os controles não aparecem no PDF.

O teste de navegador verifica distribuição inicial, ajuste por teclado, independência entre tabelas, persistência após reabrir, restauração, impressão somente pelo botão e igualdade de todas as células antes/depois. A extração do PDF confirma os 41 nomes, três páginas e a marca d’água em todas elas.
