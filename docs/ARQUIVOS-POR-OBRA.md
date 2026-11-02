# Central de arquivos por obra — versão local

Acesso: Obras e projetos → Arquivos. Prévia isolada em http://127.0.0.1:4203/.
Login fictício: `piloto@local.test` / `piloto-local`.

## Recursos

- Seleção de obra e busca por título, revisão e descrição em toda a obra.
- Pastas e subpastas, criação de estrutura padrão, edição e mudança da pasta superior.
- Documentos por upload ou link HTTP(S). Movimentação entre pastas da mesma obra.
- Histórico imutável de revisões: nova emissão preserva as anteriores, autor, horário e descrição.
- Histórico de organização da obra, controle de concorrência e reenvio idempotente.
- Consulta das referências já cadastradas nos módulos de Projetos, Financeiro, Licenciamento, Diário, Conferência, Contratos e Medições. Somente os registros entregues pela projeção autorizada são considerados. Os documentos dos módulos são consultados na origem, sem cópia para o cadastro da central.
- Árvore no desktop e seletor nativo de pasta no celular. Controles com pelo menos 44 px no toque.
- Anexos do checklist de licenciamento agrupados em Prefeitura, Cartório e imóvel e Condomínio. A identificação usa a etapa cadastrada e o nome do anexo; não substitui conferência documental. Etapa, situação e vínculo de origem permanecem visíveis, com identificadores estáveis por anexo.
- Visualizador interno de PDF (páginas e zoom), imagens e texto, com seleção de revisão, download, mensagens de erro e nova tentativa. Não abre janela ou página do OneDrive para consultar esses formatos. Formatos sem leitor interno continuam disponíveis para download.

## Armazenamento

Na prévia, os metadados ficam em `artifacts/arquivos/demo-state.json` e os binários em `artifacts/arquivos/uploads/`. O servidor escuta apenas em 127.0.0.1 e intercepta todas as rotas `/api`: não acessa o banco ou o OneDrive real. O estado sobrevive ao reinício. Os testes de navegador usam porta 4204 e um estado separado.

Na integração normal do sistema, a central usa o upload autenticado do OneDrive já existente e salva metadados por comandos operacionais no agregado `workFileCabinets`. Nomes físicos únicos preservam arquivos de revisões anteriores. Exige a conexão do OneDrive já configurada; não foi realizado upload real à nuvem nesta entrega local.

Limite desta versão: 3 MB por upload da central, compatível com o caminho direto da API. O visualizador lê anexos existentes de até 25 MB; o limite do upload do Licenciamento permanece em 20 MB. Arquivos CAD/BIM maiores podem ser referenciados por links da nuvem. São aceitos PDF, imagens, texto, documentos, planilhas, apresentações, CAD, BIM e ZIP; HTML, SVG e executáveis não fazem parte da lista. O MIME é normalizado a partir do formato. Não há comparação visual de DWG/RVT nem compartilhamento com clientes nesta entrega.

O usuário confirmou que “nativo” significa visualizar dentro do MARCELL mantendo o armazenamento atual. Os anexos existentes continuam no provedor; o leitor obtém acesso pelo backend autenticado já usado pelo sistema, valida o conteúdo e renderiza localmente. Páginas de login ou HTML retornadas no lugar de arquivos são recusadas. URLs temporárias de visualização são revogadas ao fechar ou trocar de revisão. A prévia usa somente PDFs sintéticos do helper de QA, sem copiar documentos reais da Prefeitura ou do cartório.

Referências web genéricas preservam a ação Abrir link cadastrado; não são apresentadas como anexos PDF. O leitor PDF existente renderiza em canvas, sem camada de seleção de texto ou extração/OCR nesta etapa.

## Execução e validação

Compilar sem executar os hooks de banco do `npm run build`:

```powershell
node node_modules/vite/bin/vite.js build --outDir artifacts/arquivos/build
node scripts/work-files-preview.mjs
```

Teste de navegador (desktop, celular e recuperação de falha):

```powershell
node node_modules/@playwright/test/cli.js test --config playwright.arquivos.config.js
```

O exemplo possui um memorial fictício com R01 e R02 e PDFs sintéticos de alvará e matrícula, identificados como demonstração. A aba Projetos permanece disponível nesta mesma prévia. Nenhuma publicação foi realizada para esta funcionalidade.
