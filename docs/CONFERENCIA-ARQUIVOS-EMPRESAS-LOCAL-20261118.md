# Conferência local de arquivos e integrações — 18/11/2026

Escopo autorizado: continuar a separação MRC/ARCD, com alterações somente locais. Foram realizadas consultas de metadados e downloads de leitura; nenhuma pasta, permissão, conexão, mensagem, objeto ou configuração foi alterada na nuvem. Não houve publicação, push ou build da Vercel.

## Origem e arquivos

O inventário veio de `storage.buckets`, `storage.objects` e políticas de Storage, pela conexão já existente. Os vínculos foram conferidos com a cópia privada de dados usada na separação, por IDs de obra, referências completas de arquivos e fotos de biometria. Nomes de arquivo, nomes de pessoas e semelhança de códigos não determinam associações.

| Origem | Objetos | Bytes | Situação capturada |
| --- | ---: | ---: | --- |
| diario-obra | 2 | 223.880 | Bucket público; exige destino privado antes da ativação |
| ponto-obra | 95 | 10.674.505 | Bucket privado; fotos antigas preservadas |
| patrimonio-empresa | 55 | 6.899.023 | Bucket privado; caminhos legados ainda sem prefixo da empresa |
| rh-prontuarios | 0 | 0 | Bucket privado, sem objetos nesta captura |
| Total | 152 | 17.797.408 | Cópia privada local conferida |

Todos os objetos encontrados pertencem à saída ARCD pelas referências disponíveis ou pela decisão explícita de preservar registros sem vínculo na ARCD. Não foi encontrado objeto Storage para transferir à MRC. As fotos de ponto e biometria têm 94 hashes registrados na base; todos coincidiram com os bytes baixados. Os outros 58 objetos receberam SHA-256 local, com tamanho conferido contra o inventário; isso não equivale a um hash previamente registrado na origem.

Uma foto antiga de biometria não possui referência ativa na cópia de dados. Ela foi preservada no arquivo privado da ARCD, sem criar cadastro, atribuí-la a pessoa pelo nome ou disponibilizá-la na revisão. Os originais permanecem intactos. Os metadados de todos os 152 objetos, buckets e políticas coincidiram na releitura entre 13h27 e 13h38 de Bahia.

O relatório privado vigente é `C:/dev/marcell-local-review/company-isolation-20261118/file-audit-complete-local.json`. Os bytes ficam em `storage-copy/arcd/verified` e `storage-copy/arcd/archive`, nomeados pelo hash. `storage-capture-proof.json` registra a releitura dos metadados. Credenciais, caminhos privados, conteúdo de fotos e links com acesso não são incluídos no Git. O resumo compartilhável é `artifacts/company-isolation/file-integration-summary.json`.

## Conflito comprovado no OneDrive

I-8, da MRC, e BASE DE DADOS, da ARCD, usam exatamente o mesmo par `driveId`/`folderId`. Isso é um conflito de identidade da pasta, não uma conclusão por semelhança de nomes. Foram inventariadas 222 ocorrências de referências a arquivos ou links nas duas saídas; ocorrências repetidas não representam necessariamente arquivos físicos distintos.

Não foi possível conferir os filhos e as permissões da pasta no Graph: a sessão central capturada não pode ser decifrada com a configuração local, e faltam as raízes por empresa e o endereço de retorno OAuth neste ambiente. Nenhum refresh de token, nova autenticação ou tentativa de gravação foi realizada. O fato de as obras usarem o mesmo drive não comprova segregação.

Na revisão local, todos os links externos são substituídos por acesso indisponível. Só uma referência Storage pertencente à empresa, com origem correspondente e cópia local conferida, recebe URL local. A leitura exige cookie da revisão e assinatura vinculada à empresa, objeto e hash; alterar a empresa ou abrir sem a sessão é recusado. O servidor confere novamente o hash antes de servir bytes. Objetos arquivados sem vínculo não são expostos. A projeção não altera os dados originais da captura.

## Proteções implementadas localmente

- OneDrive: sessão central de outra empresa ou sem vínculo explícito deixa de ser aceita com isolamento ativo. Sem configuração própria, a conexão falha antes de renovar tokens.
- Graph: leitura e escrita de itens conferem a cadeia de ancestrais até a raiz configurada da empresa. Estar no mesmo drive é insuficiente. Raízes ausentes ou URLs de raiz iguais entre empresas são recusadas. Essa verificação também alcança pastas, uploads, exclusões e backups que usam o cliente Graph compartilhado.
- Planejador: declarar arquivos conferidos não libera certificado quando duas empresas ainda usam a mesma pasta ou URL de raiz OneDrive.
- Backups: a pasta e o prefixo do arquivo seguem a empresa atual. A verificação rejeita um manifesto de outra empresa, mesmo com arquivo íntegro e a mesma chave criptográfica. O formato antigo continua legível; não foi criado backup remoto.
- Portal, cotação e aceite: mantêm o contexto de empresa implementado na etapa anterior e foram incluídos nos testes locais. A revisão não autentica clientes reais nem envia links.
- SMTP e WhatsApp: nenhuma conexão ou mensagem foi executada nesta conferência. Os auxiliares de prestação de contas continuam fora dos endpoints habilitados da revisão, com simulação como padrão. Conexões de remetentes não foram declaradas homologadas para a MRC.

Ajuda compartilhada e manual foram atualizados com a fronteira de arquivos, conexão por empresa, recusa de backup estrangeiro e limites da revisão local. Os componentes e tokens MARCELL existentes foram preservados.

## O que depende de uma etapa na nuvem

1. Preparar raízes exclusivas para ARCD e MRC e autenticar a conexão autorizada de cada empresa. Conferir suas identidades reais e permissões; URLs diferentes sozinhas não provam pastas distintas.
2. Inventariar o conteúdo da pasta compartilhada por I-8 e BASE DE DADOS. Separar documentos com referência comprovada por `driveId`/`itemId`; não transferir a pasta inteira com conteúdo potencialmente misto. Itens sem referência exigem conferência, mantendo os originais até a conclusão.
3. Preparar armazenamento privado para as duas fotos atualmente públicas, copiar para os caminhos por empresa e atualizar as referências. Conferir também os caminhos patrimoniais legados antes de liberar a assinatura por empresa. Fotos antigas de ponto seguem seu fluxo legado privado; não alterar seus caminhos sem adaptar e conferir o leitor correspondente.
4. Renovar links assinados, conferir downloads com os perfis reais e atualizar a captura de dados no corte. A origem operacional desta revisão continua sendo a captura anterior; a conferência dos arquivos não a transforma em uma transação atualizada.
5. Só depois da reconciliação de arquivos, integrações e dados, instalar certificados e ativar o isolamento. Os indicadores `cloudVerified` e `activationReady` continuam falsos nesta entrega local.

Não há efeito novo no DRE: nenhuma leitura, cópia de bytes, alteração de autorização ou verificação de backup cria previsão, compromisso, estoque físico, custo reconhecido ou pagamento. Os fatos e o plano financeiro da etapa anterior foram preservados; não houve nova contabilização nem duplicação de custo.

## Reprodução local

`scripts/audit-company-files.mjs` recebe `--plan`, `--storage`, `--manifest` e `--output` (privado, fora do repositório). `--download-storage` usa somente GET autenticado na origem configurada, confere tamanhos e hashes disponíveis e nunca grava remotamente. `--existing-copy` permite rever os bytes já capturados sem novo download. `--summary` produz apenas contagens e estados, sem caminhos ou credenciais.

O preview aceita `--file-audit` com o relatório privado, além dos argumentos de plano e prova descritos em `SEPARACAO-EMPRESAS-LOCAL-20261118.md`. Continua em `http://127.0.0.1:4205/`, somente para consulta, com gravações e integrações externas bloqueadas. Nenhuma nova conexão na nuvem é necessária para revisar a cópia local.

## Validação desta etapa

Foram aprovados 92 testes em 17 arquivos, incluindo rejeição de sessão Microsoft estrangeira ou sem empresa, raiz duplicada, leitura/exclusão fora da raiz, arquivo Storage de outra empresa, origem de arquivo divergente, backup estrangeiro e links de portal/fornecedores. Duas verificações de navegador passaram em desktop e celular: 16 versus duas obras, arquivos locais acessíveis somente com sessão e assinatura corretas, empresa adulterada recusada, nenhuma URL externa na projeção, gravações bloqueadas e escolha preservada após recarga. As capturas finais foram revisadas visualmente.

A primeira execução de desktop excedeu o limite durante a navegação inicial do servidor de desenvolvimento; a repetição sem mudança no teste aprovou os dois cenários em 11,3 segundos. Não foi aumentado o timeout para ocultar a ocorrência. Lint, design:check, manual:check, TypeScript, build local (`npx vite build`) e conferência de espaços do diff passaram. A divergência preexistente do teste de PDF/e-mail do portal segue registrada no documento da etapa anterior; esta validação dirigida não declara toda a suíte do repositório aprovada.

## Preparação local seguinte

A estrutura de destinos, os dez documentos candidatos da I-8 e as duas fotos privadas foram preparados sem acesso à nuvem. A entrega vigente e suas condições estão em `PREPARACAO-PASTAS-FOTOS-EMPRESAS-LOCAL-20261118.md`. As fotos usadas pelo preview agora vêm de `prepared-file-separation-reviewed/preview-file-audit.json`. A preparação não resolve o inventário desconhecido da pasta compartilhada nem altera os originais públicos na nuvem.
