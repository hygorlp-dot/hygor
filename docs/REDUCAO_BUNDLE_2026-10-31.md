# Redução local do bundle — 31/10/2026

O gate de tamanho passou sem alterar os limites ou excluir arquivos da medição.

| Medida | Bytes gzip de JS/CSS |
| --- | ---: |
| Antes | 1.853.033 |
| Depois, build local com mapas de diagnóstico | 1.786.654 |
| Depois, configuração de produção compilada localmente | 1.786.654 |
| Limite preservado | 1.789.952 |
| Redução líquida | 66.379 |
| Margem atual | 3.298 |

## Alterações

- O navegador usa um adaptador ZIP com `fflate` no lugar da árvore completa
  JSZip/Pako. O leitor do SINAPI continua indexando o arquivo e expandindo
  somente os XMLs solicitados. O adaptador de escrita implementa o contrato
  usado pelo ExcelJS; não pretende substituir a API geral do JSZip.
- CSV utiliza as mesmas classes e opções do fast-csv por imports específicos,
  sem carregar suas funções de arquivos Node. O `setImmediate` necessário para
  processar lotes ficou explícito no adaptador, em vez de depender de um efeito
  colateral do JSZip.
- O ExcelJS importa somente UUID v4 para sua formatação condicional. O Buffer
  compartilhado substitui o wrapper legado equivalente. A normalização de
  entrada do SHA-512 foi especializada para seu único consumidor no browser:
  `exceljs-encryptor.cjs` sempre passa o resultado de `Buffer.concat`. Há uma
  guarda de tipo; algoritmo, salt, codificação e rodadas permanecem iguais.
- A rota lazy tem uma entrada que reexporta somente a aplicação. A API nomeada
  de `LegacyApp.jsx` permanece disponível para compatibilidade, enquanto o
  build pode eliminar exportações desnecessárias à rota.
- A logo embutida passou de PNG de 10.515 bytes para WebP sem perda de 4.908
  bytes. A comparação confirmou os mesmos 480 × 163 pixels e o mesmo SHA-256
  dos bytes RGBA decodificados. As fontes oficiais dos relatórios continuam
  embutidas e inalteradas, mantendo os documentos independentes.
- Os mapas locais continuam sendo gerados no modo `hidden`, sem acrescentar
  referências a mapas ao JavaScript servido. A produção continua sem mapas.
  O minificador original do Vite foi mantido.

A transformação das dependências gera sourcemaps. Mudanças nas linhas de
importação esperadas provocam erro explícito no build, para que uma atualização
das bibliotecas exija revisão dos adaptadores.

## Regressão encontrada durante a validação

O teste ampliado de CSV revelou a ausência de `setImmediate` e depois uma cópia
antiga do adaptador no cache do DEV. A primeira falha foi corrigida no consumidor.
O nome do plugin agora incorpora o hash dos adaptadores e da configuração, de
modo que o Vite invalide o prebundle quando eles mudam. O servidor DEV também
observa os adaptadores e reinicia a compilação quando são editados. Os testes
foram repetidos com o cache existente e passaram no DEV e no build.

## Validação

Evidências em `artifacts/bundle-reduction/`:

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Gate local e de produção | Ambos aprovados; todos os limites iguais aos anteriores | `result.json`, `final-metrics.json`, `production-metrics.json` |
| Inicialização no DEV | 766 casos aprovados: 633 módulos e 133 sessões de telas | `cold-dev-all.json` |
| Inicialização no build | 250 casos aprovados: 117 chunks e 133 sessões de telas | `cold-build-all.json` |
| Telas | Todas as 65 abas em sessões novas, 1440 e 390 pixels, mais três entradas públicas | relatórios `cold-*.json` |
| Integrações de navegador | Dez testes aprovados, desktop/celular, DEV/build | `integrations.json`, `integrations-final.log` |
| Conteúdo das planilhas | Fórmulas, datas, notas, imagens, CSV multilinha, formatação condicional e proteção SHA-512; ZIP validado também pelo JSZip/ExcelJS originais no Node | `integrations-final.log` |
| Workers | SINAPI e ORSE aprovados em DEV/build com arquivos sintéticos | `workers-final.log` |
| Endereço do incidente, porta 4198 | Navegação, recarga e leitura antecipada da paleta sem reproduzir o erro | `4198-final.log` |
| Regressão geral | 4.360 testes aprovados, zero falhas e 15 ignorados | `unit.json` |
| Regressões direcionadas finais | 44 testes aprovados em oito arquivos | `targeted-final.log` |
| Grafo de importações | Zero ciclos estáticos ou dinâmicos em 763 arquivos e 2.170 arestas | `cycles-final.json` |
| Referências de assets | 1.094 referências verificadas; nenhum arquivo ausente | `assets.json` |
| Lint, tipos e arquitetura | Sem erros; arquitetura com 1.430 módulos e 4.252 dependências | logs `*-final.log` |

O checkpoint de hashes confirmou que os fontes e dependências permaneceram
iguais durante a última rodada de build e testes. Alterações existentes de
outras frentes foram preservadas. A ajuda e o manual foram revisados; esta
otimização técnica não muda os passos operacionais. O manual foi regenerado e
validado, com 88 guias cobrindo as 65 abas.

As verificações de telas usam fixtures e APIs interceptadas; a emulação mobile
não substitui medição em aparelho físico. Nenhum serviço externo recebeu
registros dos testes. Não houve push, commit, PR ou deploy.

Referência da biblioteca de compactação: [documentação oficial do fflate](https://github.com/101arrowz/fflate).
