# Preparação local de pastas e fotos — 18/11/2026

Foram preparadas duas estruturas independentes para I-8/MRC e BASE DE DADOS/ARCD, preservando os IDs comprovados da origem. Esta etapa usa somente os arquivos capturados anteriormente: não consulta a nuvem, não carrega credenciais, não autentica Microsoft e não possui modo de aplicação remota.

## Entrega privada

Diretório vigente: `C:/dev/marcell-local-review/company-isolation-20261118/prepared-file-separation-reviewed/`.

| Destino local | Conteúdo |
| --- | --- |
| `workspaces/mrc/obras/e6d0pvjv7twg` | Estrutura da I-8, 11 categorias existentes e manifesto de dez documentos identificados |
| `workspaces/arcd/obras/obra_dados` | Estrutura da BASE DE DADOS e suas 11 categorias existentes |
| `storage/company-files-private/arcd` | Duas fotos JPEG reais, preservadas sob o ID da obra de origem, ano e nome original |
| `preparation.json` | Origens, destinos lógicos, referências por ID, condições de cópia e ordem de conferência |
| `private-photo-index.json` | Identidades das duas fotos, hashes, caminhos privados locais e vínculos existentes |
| `bucket-contract.json` | Contrato do futuro bucket privado; não é um bucket criado na nuvem |
| `preview-file-audit.json` | Inventário para a revisão autenticada usar as fotos preparadas |
| `local-proof.json` | Prova da preparação, hash do manifesto, bytes conferidos e plano financeiro intacto |

O resumo sem caminhos, links ou dados pessoais é `artifacts/company-isolation/file-preparation-summary.json`. A primeira preparação privada, sem o sufixo `-reviewed`, foi substituída por esta revisão; não deve ser usada como resultado vigente.

## Pastas e documentos

As duas obras usam a mesma pasta física na origem. Os destinos locais são exclusivos por empresa e ID da obra, com as categorias já cadastradas, incluindo Documentos/Licenciamento. As identidades futuras de drive, pasta e arquivo ficam vazias: diretórios locais e referências lógicas não são IDs inventados do OneDrive.

Foram identificados dez documentos únicos ligados à I-8 por `driveId`/`itemId` e pelo vínculo explícito da obra no cadastro ou licenciamento. A referência duplicada no cadastro relacional `core_projects` foi resolvida pelo ID exato da própria I-8; não há conflito de proprietário entre esses dez candidatos na cópia atual. Cada candidato registra seus caminhos de origem e exige conferência posterior de existência, ancestralidade, conteúdo, permissões e referências antes de uma cópia na nuvem.

Não foram encontradas referências individuais de documentos da BASE DE DADOS na cópia operacional. Isso não significa que sua pasta esteja vazia. Filhos não inventariados na nuvem permanecem sem classificação; o vínculo compartilhado da pasta não autoriza atribuir todo seu conteúdo a uma empresa. A preparação não contém PDFs ou outros documentos OneDrive fictícios: contém apenas seus manifestos e estruturas de destino.

A estratégia preparada é copiar somente itens identificados para destinos exclusivos. A pasta compartilhada original deve ser preservada até concluir o inventário e a reconciliação. Não há comando para mover, excluir ou copiar integralmente a pasta compartilhada.

## Fotos e acesso privado

As duas fotos totalizam 223.880 bytes e continuam pertencendo à ARCD, na obra identificada pelo caminho e pelo cadastro existente. Elas não foram atribuídas à I-8 nem à BASE DE DADOS. Os bytes foram conferidos novamente antes e depois de copiar, com SHA-256, tamanho e assinatura JPEG.

Uma foto possui referência ativa em RDO (Diário de Obra). O manifesto registra as linhas persistidas onde a URL exata aparece, o caminho do campo, a revisão da linha e os hashes do valor anterior e da linha decodificada. A troca futura exige concorrência otimista, leitor privado autenticado pronto e cópia verificada. Nenhuma URL da base foi substituída nesta etapa.

A segunda foto não tem referência ativa; permanece como objeto privado preparado, sem criar RDO, documento ou lançamento para vinculá-la. As duas identidades de objeto são preservadas mesmo que exista coincidência de conteúdo.

O contrato do destino define bucket privado `company-files-private`, caminho por empresa/obra/ano/objeto e ausência de leitura direta pelo cliente. A leitura futura deve passar pela autorização de empresa no servidor. Por enquanto, a revisão em `http://127.0.0.1:4205/` usa os bytes destas novas cópias locais por cookie, assinatura vinculada ao objeto/empresa e conferência de hash. Links externos e operações de gravação continuam bloqueados.

As duas fotos públicas originais continuam públicas na nuvem: preparar um destino privado local não revoga uma URL anterior. A revogação futura precisa ser conferida junto com as referências antigas e os acessos. Esta preparação não autoriza remover os originais, alterar permissões remotas ou liberar a ativação do isolamento.

## Execução e validação

`scripts/prepare-company-file-separation.mjs` recebe `--plan`, `--audit`, `--targets` e `--output`. O destino precisa ser novo e estar fora do repositório. O script lê somente os arquivos de entrada e copia as duas fotos já capturadas; não oferece comando de execução remota. `--summary` produz um resumo compartilhável sem os caminhos privados. Repetir o mesmo destino é recusado sem sobrescrever arquivos.

O teste de integração executa o comando com `fetch`, HTTP, HTTPS e conexões de rede bloqueados, verifica os dois destinos, os bytes e o hash do manifesto, recusa preparação dentro do repositório e conteúdo alterado. Os testes de domínio cobrem vínculo relacional pelo ID exato, documento compartilhado entre empresas, obra inexistente, empresa incorreta, origem divergente e tentativa de escapar da pasta local.

Não há impacto no DRE: o hash integral do plano financeiro de entrada permanece intacto. Nenhum fato de previsão, compromisso, estoque físico, custo reconhecido ou pagamento foi alterado ou criado; referências de arquivos e cópias de bytes não são eventos financeiros.

A ajuda e o manual foram revisados. Não foi necessário mudar as instruções do operador: continuam válidas as orientações já publicadas na fonte local sobre arquivos por empresa, revisão somente para consulta e bloqueio dos links externos. Esta etapa acrescenta ferramentas de preparação e artefatos privados, sem novo botão, aba, tela ou fluxo operacional. O manual foi regenerado e sua sincronização foi conferida.

Resultados desta etapa: 28 testes aprovados em seis arquivos; testes de navegador aprovados no desktop e no celular usando o inventário com as fotos preparadas; lint, design:check e manual:check aprovados. A conferência final dos artefatos confirmou o hash do manifesto, os bytes das duas fotos e o hash integral inalterado do plano de dados. Não foi executado build, prebuild, migração ou publicação: não houve alteração no código da interface, nas dependências ou no motor financeiro. As limitações de nuvem e a divergência preexistente da suíte ampla continuam registradas nos documentos anteriores.

Continuação: `SIMULACAO-APLICACAO-EMPRESAS-CONCILIACAO-LOCAL-20261118.md` registra a aplicação desses artefatos em uma simulação do ERP. O endereço local agora identifica Simulação local e permite exclusivamente a limpeza de conciliação da cópia, com confirmação e recuperação preservada. Os artefatos de preparação e a nuvem continuam intactos.
