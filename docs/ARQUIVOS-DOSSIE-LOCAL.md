# Arquivos e dossiê — roteiro de revisão local

As melhorias foram posteriormente publicadas por autorização do usuário. Veja [o registro da publicação](DEPLOY-ARQUIVOS-DOSSIE-20261031.md). Este roteiro continua descrevendo a demonstração fictícia local.

Revisado em 31/10/2026. Cenário fictício para conferir o fluxo de documentação da obra, sem acesso a arquivos, sessões Microsoft ou dados de produção.

## Abrir a demonstração

Na pasta deste checkout, use o build local em `artifacts/arquivos/build`. Se precisar recompilar, execute diretamente o Vite, sem o `prebuild` de produção:

```powershell
npx vite build --outDir artifacts/arquivos/build
node scripts/work-files-preview.mjs
```

Abra [a demonstração local](http://localhost:4205) e entre com `piloto@local.test` e senha `piloto-local`. Em **Arquivos**, escolha **Residencial Alameda** em **Obra dos arquivos**; em **Área da documentação**, selecione **Dossiê de licenciamento**. O processo usa a porta 4205 por padrão e grava dados e uploads fictícios em `artifacts/arquivos/dossie-demo`.

As alterações do dossiê passam pelo pipeline de comandos com controle de versão e ficam em `licencas`, compartilhando o cadastro com Licenciamento. Recarregar a página deve conservar os registros confirmados. Uma gravação concorrente deve pedir atualização dos dados, sem substituir silenciosamente a versão mais recente.

## Conferir exigências, anexos e revisões

1. Selecione **Taxa administrativa**. A demonstração contém um PDF com R01 e R02; use **Visualizar anexo e revisões**.
2. Em **Revisão do documento**, escolha R01. Confira o aviso de revisão antiga e o botão **Abrir revisão atual**, que deve retornar à R02.
3. Use **Buscar no texto do PDF** com uma palavra do exemplo. A busca percorre o texto extraível de todas as páginas e oferece **Ir para página**. Não faz reconhecimento óptico de caracteres (OCR); um PDF somente digitalizado pode não oferecer texto pesquisável.
4. Use **Comparar revisões** e **Comparar com a revisão**. A comparação apresenta os conteúdos para inspeção visual, lado a lado no desktop e adaptados à tela estreita. Não identifica diferenças automaticamente. **Encerrar comparação** retorna à consulta individual.
5. Feche a visualização. Edite **Situação da exigência**, **Responsável pela exigência**, **Validade do documento** e **Observações da exigência**; confirme em **Salvar exigência**. O responsável é informação de acompanhamento; não é uma aprovação do órgão.
6. Para uma exigência condicional, defina **Esta exigência se aplica?**. **Não** ou a situação **Não se aplica** exigem justificativa. Documento vencido, anexo ausente, situação pendente ou aplicabilidade ainda indefinida podem impedir o fechamento.
7. Use **Anexar documento à exigência** para um anexo novo e **Enviar nova revisão de…** para atualizar o mesmo anexo. Cada upload aceita até 20 MB. O nome padronizado identifica obra, área, exigência, posição do anexo e revisão; o nome original permanece no histórico e no índice da exportação.

O cadastro reúne Prefeitura, cartório e condomínio conforme a licença e os itens existentes. A conferência interna usa os dados cadastrados e não substitui a análise do órgão responsável nem estabelece novos requisitos legais.

## Conferir acesso a pastas

Volte a **Arquivos e pastas** em **Área da documentação**. Como administrador, abra as permissões de uma pasta e confira **Acesso à pasta**, **Herdar acesso da obra e das pastas superiores** e **Restringir a pessoas selecionadas**. A restrição oferece **Sem acesso**, **Leitura** e **Leitura e edição** por pessoa.

Subpastas acumulam as restrições das pastas superiores; liberar uma subpasta não deve contornar a restrição da pasta mãe. Administradores mantêm acesso. Leitura permite consultar os arquivos; edição também exige autorização para alterar a pasta. Essas permissões se referem aos arquivos desta central. O dossiê segue o acesso ao módulo Licenciamento; a edição e a exportação exigem perfil administrador ou engenheiro autorizado.

## Conferir a exportação

1. Abra **Ver documentação faltante**. Enquanto houver pendências, **Baixar dossiê final** deve ficar bloqueado.
2. Use **Baixar ZIP parcial · INCOMPLETO**. Confira `INCOMPLETO` no nome do ZIP, `INDICE.csv`, `MANIFESTO.json` e `PENDENCIAS.txt`. O índice mantém o nome original, a revisão e a indicação de inclusão. O manifesto relaciona os arquivos e as pendências, incluindo falhas de leitura.
3. Confira que o ZIP inclui somente a revisão atual de cada anexo, inclusive exigências adicionais e anexos gerais já cadastrados. Revisões antigas permanecem disponíveis no histórico, sem entrar junto da revisão atual no pacote.
4. Resolva as pendências para habilitar o final. A exportação final também deve falhar se algum arquivo não puder ser lido; ela inclui `CONFERENCIA.txt`. Confira o registro em **Histórico de exportações**.

A montagem ocorre no navegador e limita a soma dos arquivos lidos a 100 MB. No pacote parcial, arquivos que falharem são registrados como não incluídos e relacionados nas pendências; confira esse resultado antes de compartilhar. Um ZIP final significa ausência de pendências documentais cadastradas, sem equivaler à aprovação externa.

## Evidências e escopo

As capturas ficam em `artifacts/arquivos/`: `dossier-1440.png`, `dossier-390.png`, `dossier-compare-1440.png`, `dossier-compare-390.png`, `dossier-condominio-1440.png` e `dossier-condominio-390.png`. As duas capturas principais foram inspecionadas visualmente para este guia: mantêm a identidade MARCELL, os controles do cabeçalho, a navegação desktop e a navegação inferior mobile; a seleção de exigência usa um controle compacto no mobile.

Validação informada pela implementação: 93 testes unitários em 9 arquivos, 12 cenários Playwright em desktop de 1440 px e mobile de 390 px, lint, typecheck e build direto pelo Vite. O roteiro acima descreve os fluxos implementados e seus limites.

Trabalho mantido no checkout local `C:/dev/releases/arquivos-dossie-local-20261031`, branch `codex/arquivos-dossie-local-20261031`, base `dbc123ed`. Nenhum push, pull request ou deployment foi realizado nesta etapa. `DESIGN.md`, `.impeccable/design.json`, tokens e estilos globais permanecem fora do escopo deste documento; não foi criado `PRODUCT.md`.

## Referências de produto

Referências oficiais pesquisadas pela implementação para organização documental, sem importar regras legais ou prometer funções adicionais:

- [Autodesk Docs — arquivos em pasta com padrão de nomes](https://help.autodesk.com/cloudhelp/ENG/Docs-Files/files/files-naming-standard/Add_Files_To_Naming_Standard_Enforced_Folder.html).
- [Procore — criar e gerenciar placeholders](https://v2.support.procore.com/product-manuals/document-management-project/tutorials/create-and-manage-placeholders-in-the-document-management-tool/).
- [Procore — baixar documentos](https://v2.support.procore.com/product-manuals/document-management-project/tutorials/download-documents-from-the-document-management-tool).
