# Referências para documentos dentro do MARCELL

Pesquisa consultada em 31/10/2026, priorizando documentação dos fornecedores.

| Referência | Funções úteis | Aplicação local |
|---|---|---|
| [Procore — Visualizar documentos](https://dev.support.procore.com/product-manuals/documents-project/tutorials/view-documents-in-the-project-level-documents-tool/) | Leitor dentro do produto, seleção de versão, metadados e histórico junto do documento | Visualizador próprio da central, revisão atual/anterior, etapa do licenciamento e retorno à lista |
| [Autodesk — Visualização e histórico](https://help.autodesk.com/view/BIM360D/ENU/?contextId=DOCUMENT_MANAGEMENT_VIEW_DOCUMENTS) | Consulta de documentos/modelos e troca de versões no visualizador | PDF com páginas/zoom e seleção de revisões; leitura de modelos 3D não faz parte desta etapa |
| [Vobi — Organização de arquivos](https://ajuda.vobi.com.br/pt-br/articles/5397839-conceitos-basicos-sobre-arquivos-na-vobi) | Pastas, documentos e ações de consulta no contexto do projeto | Central por obra e grupos dos anexos de licenciamento |

## Skills consultadas e disponíveis

- `impeccable` e `shadcn`: aplicadas para preservar o sistema MARCELL, os componentes e os controles responsivos.
- `pdf:pdf`: consultada para inspeção de documentos. O leitor reutiliza o PDF.js já instalado no app; exemplos são fixtures sintéticas do helper existente de testes.
- `skill-installer`: consulta ao catálogo oficial `openai/skills`, sem instalar skills novas.
- [Playwright Interactive](https://github.com/openai/skills/blob/main/skills/.curated/playwright-interactive/SKILL.md): referência encontrada para revisão iterativa em navegador. A verificação desta entrega usa os testes Playwright existentes do repositório e a aba do navegador integrada.
- [Security best practices](https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices): skill encontrada no catálogo para revisões adicionais. Não instalada nesta etapa.

A escolha foi aproveitar as skills, bibliotecas e infraestrutura já disponíveis. Nenhuma skill de terceiros foi instalada nem foi alterado o armazenamento. Migração do OneDrive foi expressamente deixada fora do escopo pelo usuário; a consulta dentro do MARCELL mantém a autorização por perfil e obra existente.

## Validação para publicação — 31/10/2026

Foram percorridos os fluxos públicos oficiais do [Procore Documents](https://dev.support.procore.com/product-manuals/documents-project/tutorials/view-documents-in-the-project-level-documents-tool/), da [Gestão Documental do Procore](https://support.procore.com/products/online/user-guide/project-level/document-management), do [visualizador Autodesk Docs](https://help.autodesk.com/cloudhelp/ENG/Docs-Files/files/View_Files.html) e das [ações e permissões de arquivos Autodesk](https://help.autodesk.com/cloudhelp/ENU/Docs-Files/files/File_Folder_Actions_Docs.html). Não foram acessados ambientes privados de clientes desses serviços.

O fluxo aprovado do MARCELL atende consulta interna, páginas/zoom, escolha de revisão, download, rastreabilidade do cadastro e recorte por obra. A validação é de comportamento e integração local; não é uma certificação de equivalência aos produtos comerciais.

Melhorias identificadas para ciclos seguintes, sem adicioná-las silenciosamente ao deploy aprovado:

| Prioridade | Melhoria | Referência e motivo |
|---|---|---|
| P1 | Aviso persistente de revisão antiga e ação Voltar à revisão atual | Procore sinaliza a consulta de versão anterior; reduz o uso de prancha desatualizada |
| P1 | Busca no texto do PDF e camada textual acessível | Procore e Autodesk permitem procurar texto; o leitor atual é baseado em canvas |
| P2 | Anterior/próximo arquivo no visualizador, sem retornar à lista | Autodesk e Procore permitem percorrer os arquivos adjacentes |
| P2 | Comparação entre duas revisões de PDF | Autodesk oferece comparação; útil para conferir exigências e reapresentações |
| P2 | Permissões por pasta/documento e registro de downloads | Procore e Autodesk têm controles adicionais; hoje o MARCELL usa perfil, aba e obra |
| P3 | Fluxo de aprovação, comentários e marcações no documento | Referências oferecem revisão colaborativa; exige modelo próprio de aprovação e auditoria |

O pacote de publicação é preparado sobre o commit da versão de produção existente para preservar melhorias de outros módulos, incluindo RH. Os dados fictícios e os uploads de teste permanecem excluídos do envio.
