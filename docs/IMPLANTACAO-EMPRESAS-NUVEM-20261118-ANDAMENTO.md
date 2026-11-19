# Implantação ARCD/MRC — início autorizado na nuvem

## Continuação em 19/11/2026 — transação preparada, integração pendente

O checkout continua em `cd8d029f`, com as alterações locais preservadas. Nesta continuação houve somente leituras da origem hospedada e trabalho local; não houve DDL/DML, cópia ou mudança de permissões na nuvem, commit, push ou deployment. Os registros de 18/11 abaixo permanecem como histórico, não como prova de publicação.

Foi preparada a execução versionada da transação, com preservação dos controles vivos:

- `server/company-cutover-preservation.js` confronta a captura atual com os fatos de origem, mantém o alvo limpo/reconciliado e retira sessões OneDrive, presenças, limites de tentativas e as 14 tabelas `ponto_*`/controle de acesso das imagens e da comparação transacional. Esses registros continuam no banco vivo, sem reescrita nem cópia para a MRC. Uma proposta que altere a ARP ou outra tabela do ponto é recusada.
- `migrations/023_company_cutover_private_journal.up.sql` cria somente infraestrutura privada de manutenção. Ela não separa empresas, limpa valores, altera obra ou instala certificado de ativação. Tem RLS, não cria funções públicas e nega acesso ao esquema e às tabelas para `anon`, `authenticated` e `service_role`. O `.down.sql` recusa apagar recibos de aplicação.
- O prebuild foi preparado para instalar essa infraestrutura antes da migration 019. `npm run company-cutover:migrate` foi conferido fora de produção: ignorou a aplicação e não abriu conexão. O prebuild real não foi executado. A configuração específica de build da Vercel não substitui a aplicação versionada explícita na rodada de implantação.
- `scripts/lib/company-cutover-staging.mjs` prepara fragmentos privados menores que o limite do conector. A aplicação confere quantidade, ordem, bytes, SHA-256, aprovação técnica e prazo, depois executa a carga em uma única transação. Uma falha reverte dados, recibo e marca de aplicação; os fragmentos preparados não são dados operacionais.
- `server/company-cutover-approval.js` exige oito evidências vinculadas ao pacote e ao alvo: catálogo, identidades, arquivos privados, fotos privadas, histórico privado, recuperação, DRE e código consolidado. O SQL aprovado carrega seu prazo e confere novamente o relógio após adquirir as travas. O nome “aprovação” refere-se ao recibo técnico dessas conferências; não é um pedido de nova autorização ao usuário para o escopo já autorizado.
- A tentativa possui ID próprio, derivado do pacote e do recibo técnico. Uma nova conferência do mesmo alvo não sobrescreve uma tentativa vencida. Um pacote já aplicado não é reaplicado por repetir a mesma tentativa.
- `scripts/prepare-approved-company-cutover.mjs` gera arquivos locais de migration; não executa rede nem publica. Exige relatórios reais com hashes conferidos, commit consolidado e destinos privados certificados no pacote; recusa recibos simulados e grava somente fora do repositório. O rascunho comum continua bloqueado para uso real.

### Provas locais e leitura atual

Diretório privado da captura atual: `C:/dev/marcell-local-review/company-isolation-20261118/read-only-continuation-20261119/`. Foram lidas novamente 72 tabelas em 98 requisições GET. As duas transações nativas de leitura, antes e depois da coleta, não apresentaram diferença nas 58 tabelas operacionais comparadas, excluídos os controles preservados e as quatro capturas externas históricas. Não é uma única fotografia MVCC global; a comparação sob trava na aplicação continua obrigatória. Os arquivos externos conservam seus cortes anteriores e não foram apresentados como nova captura completa de auditoria/catálogos.

O alvo fiscal e reconciliado conferiu com a origem atual sem refazer a limpeza. O novo pacote transacional local é `bdec1614bfa27398e9b6d626893221ebaee1599eab304061890ecebaa48f6b3f`, com 17 tabelas alteradas. O limite de tentativas deixou de integrar a mutação. O SQL ficou menor ao declarar as imagens antes/depois uma única vez, mantendo as mesmas comparações e o diário privado.

O ensaio final `staged-catalog-20261119-final/validation.json` executou a migração por 33 fragmentos no esquema público capturado, com 76 tabelas, 748 colunas, 288 restrições, 59 FKs, 25 gatilhos, 68 funções, quatro políticas e cinco sequências. **50 conferências passaram**, incluindo aplicação, repetição, DRE de destino, limpeza, obras e preservação de sessão renovada/presença/tentativas/ARP. O recibo de publicação foi simulado somente em PGlite; esse ensaio não certifica as oito evidências reais e não deixou arquivos de aplicação aprovados para produção.

Na primeira tentativa desse ensaio, uma asserção confundiu cadastro operacional com projeção nativa: a ARCD tem 16 obras no app e 18 registros em `core_projects`; a MRC tem duas em ambos. Na origem e no alvo já aprovado, FABEJA ainda não tem linha nativa e três IDs nativos não aparecem na lista operacional atual. A conferência passou a comparar cada origem com seu próprio alvo. Nenhum registro foi criado, unido por nome, removido ou reatribuído para fazer as contagens coincidirem. A primeira tentativa foi preservada como evidência da correção do teste.

A revisão independente do guardião do DRE confirmou a correção dos dois pontos de prazo/tentativa e não encontrou regressão de valores nem mutação da ARP nesse recorte. Os testes focados de compilação, preservação e staging passaram: **23 aprovados**, repetidos após o reforço final de prazo e ACLs do diário. A suíte completa passou com **5.460 aprovados, 15 pulados, zero falhas**, em 726 arquivos aprovados e três pulados. A CLI também recusou um recibo simulado e um pacote sem destinos privados certificados, sem criar diretório de saída nem executar rede. Os relatórios ficam na evidência atual da rodada, sem reutilizar contagens históricas abaixo.

`npm run validate:local` foi repetido após os ajustes finais e terminou com código zero: lint/manual/design, arquitetura, tipos e compilação local aprovados. Log privado: `read-only-continuation-20261119/validate-local-final.log`. Não houve nova alteração visual nesta rodada nem execução do prebuild de produção.

A captura de trabalho foi ajustada para omitir os conteúdos das 14 tabelas preservadas, retendo somente contagens e a indicação de que permanecem na origem. Isso evita novas cópias de vetores faciais e registros protegidos no pacote de implantação. A coleta inicial havia lido essas linhas; seus conteúdos foram retirados do arquivo de trabalho, e o coletor desta continuação foi alterado para usar somente HEAD/contagem nesses casos nas próximas execuções. O pacote transacional já as excluía de antes/depois, comparação e diário; seu ID e os fatos financeiros não mudaram. A origem hospedada e os pacotes históricos imutáveis não foram modificados. Não apresentar esse arquivo operacional como backup completo da ARP, Auth ou Storage.

### Conexão Microsoft conferida em 19/11/2026

A autenticação local com a aplicação Microsoft já configurada funcionou. Não é necessário obter o segredo da Vercel, criar outra aplicação nem substituir a chave de produção. A impossibilidade de abrir a sessão criptografada hospedada com o segredo local não provava que esse segredo fosse inválido para uma nova autorização OAuth. A orientação anterior para procurar outra configuração foi corrigida por esta prova real.

Foi feita uma nova autorização local com estado e PKCE, no callback de loopback existente, usando a conta proprietária das pastas. Os tokens ficaram somente na memória do processo local, sem cópia da sessão do ERP nem persistência em arquivo. A autorização Files.ReadWrite foi confirmada; as operações Graph desta conferência foram exclusivamente GET. Não houve criação/cópia/movimentação de arquivos, mudança de permissão, escrita operacional, commit, push ou publicação nesta rodada.

O relatório privado local-onedrive-connection-20261119/graph-preflight-1795091710650.json confirma:

- As duas raízes MARCELL ERP - ARCD e MARCELL ERP - MRC existem, estão vazias e suas permissões são somente de proprietário, sem link de compartilhamento.
- Os IDs Graph foram confirmados no drive A55D2E2D0945F9E2: ARCD termina em !sbe9f99dfa5f84c32ac4bf49495a8e54d e MRC em !sd4037d5321454f7baf88cb4bfaca6aff. Os antigos IDs numéricos da interface não foram usados.
- O acesso direto por drive e item funcionou para ambas. O resolvedor antigo de URL pelo endpoint /shares respondeu 403 inclusive após a autorização Files.ReadWrite. Não criar links públicos para contornar essa resposta.
- O código local em server/microsoft/graph.js agora interpreta somente URLs pessoais canônicas do domínio Microsoft, consulta os IDs diretamente e confere identidade, drive e tipo pasta. A separação recusa URLs distintas que representam a mesma raiz. Links legados de compartilhamento conservam o fluxo anterior.
- Os dez documentos identificados da I-8 foram conferidos por ID e cadeia real de ancestrais: todos pertencem hoje à BASE DE DADOS compartilhada. O inventário recursivo dessa pasta encontrou 11 arquivos. Uma certidão permanece sem vínculo comprovado; não foi atribuída à MRC por nome. Vale a orientação do usuário de manter registros sem vínculo na ARCD, preservando a origem até a separação coordenada.
- FABEJA continua sem workspace registrado. A pasta física com nome semelhante não foi vinculada por inferência. A conferência cobriu as 17 referências registradas e explicitou a obra sem referência; não certifica conteúdo/bytes de todas as demais árvores.

A conferência agregada do ponto hospedado, em arp-scope-live.json, encontrou zero estabelecimentos, dispositivos e registros ARP ligados aos IDs das duas obras MRC, e zero registros ARP sem evento correspondente. Os vínculos existentes pertencem às obras ARCD. Nenhuma tabela protegida, NSR, hash ou vetor foi alterado ou copiado para a MRC.

A ampliação do inventário terminou em graph-preflight-1795092026569.json: 16 árvores distintas, 244 pastas (incluindo raízes) e 180 arquivos, correspondentes às 17 referências de workspace registradas. Foram consultadas permissões de todas as pastas e arquivos enumerados. Todas as 424 entradas apresentaram algum acesso não exclusivo de proprietário; essa é a origem legada, não as novas raízes privadas. A enumeração não é uma fotografia atômica nem uma conferência dos bytes de conteúdo.

O plano privado file-staging-plan.local.json contém 18 workspaces de destino: 16 ARCD e dois MRC. Os 180 arquivos enumerados têm exatamente um destino no plano: 144 ARCD e 36 MRC (dez identificados da I-8 e 26 da K1-10). A validação recusaria IDs duplicados ou arquivos enumerados sem destino. FABEJA recebe somente a proposta de workspace novo vazio, sem vincular a pasta legada pelo nome. Os demais filhos do App que não possuem vínculo registrado são preservados na origem para conferência; não foram atribuídos por semelhança. Nenhuma operação de cópia foi executada e os IDs de destino ainda não estão certificados.

company-roots.verified.pending.env guarda somente as duas URLs privadas conferidas, sem credenciais. O arquivo não foi carregado em ambiente local ou hospedado e não habilita o isolamento. O servidor de manutenção permanece em loopback 127.0.0.1:4192; a autorização Microsoft continua somente em memória.

### Orientação para o administrador

Para esta rodada, não há configuração pendente a procurar no portal Microsoft: a aplicação existente e o callback local já funcionaram. A conexão de manutenção fica na memória e poderá exigir novo login quando o processo encerrar; isso não altera a conexão do ERP publicado. Não substituir o segredo de produção para tentar abrir uma sessão local.

Depois da ativação conferida do ERP, o administrador escolhe Empresa no cabeçalho e abre Arquivos e pastas. Se a integração estiver desconectada, o controle é Conectar OneDrive; deve entrar com a conta autorizada a acessar a raiz daquela empresa. Preparar pastas é uma ação de escrita e só deve ser usada depois de instalar os vínculos conferidos desta separação. Não executar essa preparação na produção antiga enquanto I-8 e BASE DE DADOS ainda compartilham o mesmo workspace. Trocar Empresa não move documentos.

### O que falta para concluir a implantação

A configuração Microsoft deixou de ser bloqueio. Continuam necessários o preparo dos destinos de cada workspace e dos arquivos por IDs exatos, a conferência de conteúdo e acesso privado, os novos vínculos no alvo transacional, a proteção coordenada das fotos e do histórico/backup, a certificação do código consolidado e a aplicação/publicação única. As pastas vazias e a autenticação bem-sucedida não significam que a separação hospedada terminou.

O pacote selado anterior permanece imutável e ainda não contém a correção do resolvedor privado; uma próxima consolidação deve incorporar o código atual e as evidências reais dos destinos antes de gerar os arquivos aprovados de aplicação. Nenhum certificado foi instalado nem rascunho desbloqueado. Esta correção técnica não muda controles ou passos do operador e não altera receita, compromisso, estoque, custo ou pagamento; não há efeito no DRE. A orientação de ajuda existente continua aplicável. A correção passou em 27 testes selecionados de raiz/sessão/escopo/API. O teste do novo caminho foi executado sem a correção e falhou no endpoint antigo /shares, depois passou com a correção restaurada. npm run validate:local terminou com código zero: lint, manual, arquitetura, tipos e compilação local aprovados. A nova suíte completa terminou com 5480 testes aprovados, 15 pulados e zero falhas, em 730 arquivos de teste. Relatório privado: local-onedrive-connection-20261119/vitest-private-root.json. Os testes com ambiente próprio pulados continuam sem certificação. A consolidação local desta correção e das provas Microsoft usa release-preparation-onedrive-20261119; ela conserva a referência ao pacote transacional anterior, sem ativação nem publicação.

## Histórico de 18/11/2026

Atualização: 18/11/2026, horário de Brasília. O usuário respondeu **“Sim”** à autorização para executar a etapa na nuvem descrita no aceite final, incluindo pastas, fotos privadas e implantação consolidada. Essa autorização substitui a restrição anterior de manter tudo local para este trabalho. Não pedir novamente a mesma autorização; informações fiscais ou autenticação realmente ausentes são questões distintas.

## Estado confirmado e ações executadas

- Projeto Supabase: MARCELL, `qylubfxunnpbbjnmgsdg`, ativo e saudável. O projeto `locacoes` não foi alterado.
- Projeto Vercel: `mrc`, `prj_t7UJ797nm3uYPRSSTlFWWZc42tn7`, equipe `team_poBZ5I1rwStzhvD73ar22b7v`.
- Produção encontrada: commit `cabfc6100b3d12f5c0f133ac3ff542356e3169ad`, deployment `dpl_3eEqL9dJs5Rq76qBMr2vgb1JQbGc`. Não foi publicado um novo deployment.
- `git fetch origin` executado: a branch auditada continua em `cd8d029f`; `origin/main` está em `46050989`. O checkout contém o commit publicado. Não houve reset, force push, commit ou push nesta rodada.
- As duas referências históricas de `user_app_data` existem em Auth e não estão excluídas. Isso resolve a pendência de existência, sem criar usuários ou inferir a empresa a que pertencem.
- A sessão atual do ERP consegue renovar a conexão OneDrive no servidor de produção. Essa renovação atualiza a linha de autenticação central; não é uma alteração de obra ou valor financeiro. A sessão criptografada não abre com a configuração local disponível. Não imprimir, pedir ou copiar tokens/segredos para logs.
- Foram criadas na raiz do OneDrive do usuário as pastas **MARCELL ERP - ARCD** e **MARCELL ERP - MRC**, ambas com estado **Particular** e vazias. As pastas preexistentes `ARCD` e `MRC` não foram reutilizadas por semelhança. Nenhum arquivo ou pasta operacional foi movido nesta etapa.
- Foram conferidas as duas fotos de origem contra seus hashes e criadas cópias idênticas em `company-files-private`, bucket privado, sob os caminhos aprovados `arcd/...`. A leitura sem autenticação das cópias foi negada. A foto sem referência não foi vinculada a um novo lançamento.
- Os dois objetos originais em `diario-obra` foram preservados. Esse bucket e os links antigos **continuam públicos** até a troca coordenada das referências e da publicação; não declarar a privacidade final concluída.

Não houve escrita nos dados operacionais para aplicar a separação ou a limpeza. Ainda não há dados MRC nem certificados de ativação no banco. Os três movimentos e os dois títulos nativos continuam na origem hospedada, aguardando a migração autorizada. A cópia local limpa/reconciliada e a MRC local foram preservadas.

## Captura e concorrência

Diretório privado: `C:/dev/marcell-local-review/company-isolation-20261118/cloud-cutover-authorized-20261118/`.

Foi realizada nova captura das 72 tabelas não externas em 98 requisições GET. As quatro capturas externas imutáveis anteriores continuam com seus cortes explícitos; não foram apresentadas como uma nova fotografia integral de produção. A conferência nativa em transações de leitura antes/depois detectou alterações somente em `auth_rate_limits` e `company_app_data`.

A comparação de conteúdo confirmou que as linhas operacionais de `company_app_data` não mudaram. Mudaram somente autenticação OneDrive e presenças voláteis; o controle de tentativas também é volátil. As demais tabelas capturadas e o DRE de origem coincidem com a captura anterior. `operational-stability-proof.json` registra essa conclusão.

Não é uma única captura MVCC de todo o banco. A migração real ainda deve bloquear/conferir as linhas e recusar concorrência nos fatos que serão alterados. **Não sobrescrever autenticação, presenças ou limites de tentativas atuais com as cópias antigas do pacote.** A contagem de linhas pode variar pela expiração normal de presença; isso não autoriza apagar ou recriar sessões.

## Evidências e pendências concretas

- `private-photos-staged.json`: duas cópias privadas, hashes, leitura autenticada confirmada e acesso anônimo negado; origem e referências ativas preservadas.
- `onedrive-private-roots-detail.png`: as duas raízes com o estado Particular.
- `native-before-after.json`, `snapshot-current.json`, `capture-log.json` e `operational-stability-proof.json`: captura e comparação de origem.
- `cloud-stage-status.json`: estado hospedado ao fim deste avanço, ainda sem certificados e sem publicação.

Os IDs numéricos das duas novas pastas observados na interface (`1134075`/`1134076`) são IDs de itens da interface/lista. **Não usá-los como IDs Graph.** Os IDs Graph, permissões efetivas e URLs de raiz ainda precisam ser confirmados antes do vínculo operacional.

O usuário informou `69.946654/0001-09`, normalizado para **69.946.654/0001-09**, com dígitos verificadores válidos. A consulta ReceitaWS retornou **MARCELL ENGENHARIA LTDA**, situação ATIVA. A primeira tentativa na BrasilAPI retornou HTTP 403; a falha não foi tratada como confirmação fiscal. O resultado de consulta está guardado privadamente em `mrc-cnpj-second-source.json`.

A identidade foi acrescentada somente ao alvo local de implantação, nas configurações principal e separada da MRC. O pacote histórico, a simulação original da MRC e a ARCD foram preservados. Prova: `fiscal-target-20261118/proof.json`; alvo privado: `target-tables.json`. A identificação fiscal ainda não foi aplicada à produção. Nenhum endereço, contato, representante ou cadastro contratual foi inferido a partir do CNPJ.

Continuam por concluir:

1. Incorporar o alvo fiscal conferido à transação definitiva, preservando a identidade da ARCD e as demais configurações. O recebimento e a conferência do CNPJ da MRC estão concluídos.
2. Conferir os IDs Graph e as permissões das raízes; inventariar a pasta compartilhada I-8/BASE DE DADOS e separar os dez documentos por IDs exatos, preservando filhos não classificados até a conferência. A criação de duas pastas vazias não conclui a separação dos arquivos.
3. Preparar e testar a transação de produção versionada contra o corte atual, incluindo arquivo privado e preservação dos fatos voláteis. O SQL local bloqueado não deve ser executado simplesmente removendo a trava.
4. Certificar o backup e a recuperação para o corte real. O procedimento é restauração limpa em uma base nova, com as proteções capturadas criadas depois da carga, sem desligar gatilhos em base operacional.
5. Aplicar a separação/limpeza uma única vez, configurar as integrações por empresa e as referências das fotos privadas. Negar os links públicos antigos na troca coordenada.
6. Fazer uma publicação consolidada, conferir usuários reais, obras, arquivos, contas e DRE e registrar o resultado hospedado.

## DRE, ajuda e publicação

As ações executadas nesta rodada não criam previsão, compromisso, estoque, custo, receita ou pagamento. O DRE operacional não foi modificado; o destino esperado continua sendo a cópia local com a limpeza e a correção de R$ 200 da K1-04. Não aplicar novamente o efeito anterior de R$ 800.

O código local agora resolve referências estáveis `company-file://empresa/obra/ano/arquivo` para links temporários de cinco minutos, após autenticação e conferência de empresa, perfil e obra. Chat, fotos do diário, PDF, análise de imagens e os dois caminhos do portal consomem a autorização correspondente; a referência privada não vira um link público persistido. A troca de empresa/usuário remove a imagem resolvida anterior. Uploads isolados devolvem referências privadas. Antes da publicação, ajustar o bucket privado já criado para o limite de 4 MB e os tipos aceitos pelo servidor, pois ele foi preparado inicialmente apenas para as duas fotos JPEG. Esse ajuste ainda não foi aplicado.

O planejador local também recusa certificar funcionário necessário nas duas empresas sem conferência específica de folha/feriados e ponto sem cadastro correspondente. Não houve mudança no motor financeiro nem nas regras de feriado, lotação ou ARP. A regressão foi reproduzida com o planejador anterior: ele aceitava os dois cenários sintéticos; a correção os recusa. O alvo real aprovado foi mantido, sem gerar outro plano automaticamente.

Validações desta revisão:

- `npm run validate:local`: lint, regras UX/UI, design, manual, arquitetura, tipos e compilação local aprovados. Não foi executado `npm run build` nem seu prebuild de banco.
- `npm test -- --maxWorkers=4`: **5.448 aprovados, 15 pulados, zero falhas**; 724 arquivos aprovados e três pulados. Os testes pulados exigem Postgres/concorrência próprios e não certificam esses ambientes.
- DRE de origem versus alvo fiscal: **1.944 combinações por obra**, nos períodos mensal e duas quinzenas, anos 2025–2027, sem divergências. Alterar somente nome/CNPJ também não mudou o DRE do alvo aprovado.
- Contas bancárias: **zero cadastradas na ARCD e zero na MRC**, conforme captura e alvo. Isso não equivale a inexistência de movimentos: os três movimentos sem conta na origem hospedada ainda aguardam a limpeza transacional.
- Ajuda revisada e manual regenerado, com orientação para arquivos privados. O detector Impeccable não indicou problema no novo resolvedor visual; os avisos no diário referem-se ao HTML de impressão preexistente, mantido claro. A revisão visual em desktop/celular não é substituída por esse detector.
- Revisão visual local do diário com resposta de assinatura simulada: quatro testes Playwright aprovados nos temas Preciso e Noite, em 1440 × 1000 e 390 × 844; miniatura carregada, abertura/fechamento da imagem, ausência de gravações, erro de página ou rolagem horizontal. As quatro capturas foram inspecionadas. A primeira tentativa com servidor de desenvolvimento não concluiu o carregamento; a segunda expôs um seletor incorreto do teste (`Ver foto` era título, não nome acessível). O teste foi corrigido para clicar na imagem e a execução final usou o build local por `vite preview`. Não atribuir essas duas falhas ao acesso hospedado nem apresentar a simulação como teste da integração real.
- Conferência adicional somente de leitura no OneDrive: `App/BASE DE DADOS/02 - Projetos` contém `Topografia-A2.pdf`, ainda compartilhado; `03 - Documentos/Licenciamento` contém as subpastas Associação Terras Alpha Caruaru e URB Caruaru. Isso confirma o cruzamento de origem e a necessidade de separar por IDs; não prova inventário completo nem autoriza copiar toda a pasta para a MRC. Nenhum arquivo foi movido nesta conferência.

A conexão de produção funciona no ERP, mas o segredo Microsoft local não abre a sessão criptografada hospedada. A variável sensível da Vercel não devolve o valor para leitura. A sessão aberta do OneDrive permite conferência pela interface; a certificação por Graph e a execução dos vínculos continuam pendentes. Não extrair PIN, tokens do navegador ou segredos para logs para contornar esse limite.

O [aceite final local](ACEITE-FINAL-LOCAL-SEPARACAO-EMPRESAS-20261118.md) mantém o valor de evidência histórica. As validações atuais acima não provam implantação: não houve novo commit, push, deployment, ativação ou limpeza operacional hospedada nesta revisão. A autorização existe, mas os passos pendentes continuam necessários.

## Execução autorizada em 19/11/2026 — arquivos copiados e vínculos preparados

O usuário autorizou explicitamente copiar/conferir arquivos, atualizar vínculos e concluir a separação com uma única implantação. Depois, autorizou configurar a conexão PostgreSQL com o acesso existente. Não houve autorização para trocar senha ou contratar serviço pago, e nenhuma dessas ações foi realizada.

### Arquivos e origem

Foram executadas 72 operações de preparação/cópia no Graph, preservando todos os originais. O total conferido é de **286 arquivos disponíveis em 21 estruturas privadas**: 250 arquivos na ARCD e 36 na MRC. As estruturas incluem as 18 referências operacionais (16 ARCD e duas MRC) e três pastas de projetos nativos ARCD que já existiam fora da lista atual do app. Não foram criadas novas obras para ajustar contagens: I-02 OÁSIS (ORÇAMENTO), D1-04 INCORPORADORA e J1-14 foram associados pelos IDs e vínculos nativos existentes, sem inferência por nome.

A primeira etapa de 180 arquivos foi ampliada ao confrontar todas as referências do alvo. Esse confronto recusou 363 ocorrências sem correspondência, equivalentes a 139 IDs distintos. A leitura real encontrou 137 itens existentes (101 arquivos e 36 pastas) e duas revisões com 404. O inventário das três árvores nativas identificou 106 arquivos ao todo, incluindo cinco não referenciados, que também foram preservados na cópia. As duas revisões antigas da central documental da K1-10 já estão indisponíveis na origem; seus registros permanecem na MRC, sem inventar arquivos ou tratar os bytes como recuperáveis.

Todas as cópias disponíveis tiveram tamanho e SHA-256 comparados a partir de leituras independentes dos bytes de origem e destino, em fluxo, sem guardar novos arquivos de conteúdo local. As permissões das pastas e arquivos de destino foram conferidas como somente de proprietário. O campo sha256Hash dos metadados Graph não foi usado como prova final: a documentação Microsoft declara esse campo sem suporte. As cópias retornaram somente QuickXor; a comparação final calculou o SHA-256 dos dois conteúdos. Um ensaio parou inicialmente enquanto a cópia assíncrona da pasta J1-14 ainda não havia terminado; a conferência posterior exigiu o conjunto completo e os hashes de todos os 106 arquivos.

Provas privadas: file-copy-authorized-20261119/verified-private-files.json, native-file-copy-authorized-20261119/verified-private-files.json e file-copy-authorized-20261119/combined-verified-private-files.json. A abertura de uma cópia privada foi testada no navegador real: redirecionamento 303, CORS, decodificação da imagem e SHA-256 passaram, sem credencial do ERP enviada ao armazenamento. Prova: browser-real-private-file-proof.json.

### Código integrado e controle de acesso

A produção havia avançado para 2f2c59d0 (tema sobre a linha cabfc610). Foi feito fetch, checkpoint local 18847a70 e merge normal 3ab15f3e, preservando o seletor de empresas e os ajustes publicados. Nos conflitos foram preservados os trechos de ambas as mudanças; a folha manteve um único bloco de fechamento. Ajuda e manual foram regenerados. As duplicações de imports introduzidas pelo merge foram removidas após a primeira compilação as identificar. Não houve reset, force push, push ou deployment.

Foram identificadas edições paralelas no checkout principal. Elas foram preservadas; a continuação e os testes finais usam o worktree isolado C:/dev/marcell-company-release-20261119, branch codex/company-isolation-release-20261119. A versão em produção deve ser reconferida novamente antes da publicação efetiva.

No modo separado, referências OneDrive são abertas pela sessão autenticada do ERP; links GET com assinatura antiga são recusados. Capas, anexos, licenciamento, evidências, compras, comercial e terceiros reutilizam o resolvedor comum. A resposta autenticada usa 303 para o armazenamento Microsoft, evitando transportar arquivos grandes pelo limite de resposta da Vercel; o navegador cria uma URL local temporária e a descarta na troca de sessão/empresa. HTML e SVG recebidos como anexos ficam inertes. O administrador sem restrição de obra pode ler raízes históricas nativas conferidas da própria empresa; isso não amplia uploads ou acesso do engenheiro a outra obra. Ajuda e manual descrevem o acesso privado.

### Alvo, limpeza, contas e DRE

O alvo atualizado é verified-bindings-20261119-v2/bundle.json, ID 062b053d787a30090e1a500acc02f62620c3a199dc07aa81014ed5ad1706d28f. O alvo anterior e todas as imagens de origem permanecem preservados. Foram atualizados somente company_app_data, core_projects e client_portal_publications em relação ao alvo já aprovado; os hashes dos projetos nativos foram recalculados com buildCoreRegistrySnapshot. A transação final contém 18 tabelas alteradas, mantendo a preservação de controles vivos.

A comparação do DRE passou em **2.016 solicitações suportadas**: 1.944 por obra (mês e duas quinzenas, 2025–2027) e 72 empresariais mensais. O DRE empresarial não aceita quinzena; não foi alterada essa regra para atender ao teste. Nenhuma diferença numérica. A revisão independente do guardião confirmou a origem before idêntica, limpeza/reconciliação/validação/preservação iguais e mais 720 comparações mensais, todas iguais. Permanecem três movimentos removidos e dois valores gerados removidos no alvo, lançamentos preexistentes preservados, ajuste de R$ 200 da K1-04 mantido e nenhuma mudança financeira na MRC. Nenhum efeito de R$ 800 foi aplicado novamente. Contas bancárias cadastradas no alvo: zero ARCD e zero MRC.

O primeiro ensaio do novo alvo recusou client_portal_publications fora da ordem de mutações; a transação reverteu. A ordem relacional foi ampliada para incluir as referências dessa tabela. O ensaio corrigido staged-verified-file-bindings-20261119-v2/validation.json passou em **54 verificações** no catálogo completo: 76 tabelas, 748 colunas, 288 restrições, 156 índices, 25 gatilhos, 68 funções, quatro políticas, cinco sequências e 59 FKs. Incluiu os 2.016 DREs e os hashes nativos. Aprovação e commit foram simulados somente em PGlite; não são certificados reais de implantação.

### Validação atual e limite da conclusão

A suíte isolada passou com **5.498 testes aprovados, 15 pulados e zero falhas**. Uma execução anterior recusou o worker PDF por estar no node_modules compartilhado fora da raiz do worktree; a configuração local de testes foi limitada explicitamente ao worktree e à pasta de dependências. A segurança de produção não foi alterada. Duas regressões privadas foram reproduzidas sem a correção, a fonte foi restaurada byte a byte e os 18 testes focados passaram novamente.

npm run validate:local passou (lint/manual/design, arquitetura, tipos e compilação). Quatro testes de navegador passaram em Preciso e Noite, 1440 px e 390 px: troca de empresa, ausência de obras da outra empresa, acesso autenticado às capas, 303 convertendo POST em GET sem corpo, ajuda, ausência de erros e de gravações. Capturas ficaram no diretório privado browser-company-isolation. O detector Impeccable apontou avisos no HTML de impressão preexistente; os novos wrappers não alteram a composição ou criam uma paleta por módulo.

O painel Supabase confirmou plano Free sem backup gerenciado; PITR é um adicional pago e não foi contratado. A Vercel contém POSTGRES_URL_NON_POOLING como variável sensível e não devolve o valor. A configuração local não possui URL PostgreSQL válida até a entrada da senha atual pelo titular. Foi preparado o formulário de loopback http://localhost:4193/: testa somente leitura, usa os parâmetros de sessão confirmados no painel e salva a conexão apenas no .env.local ignorado pelo Git, sem imprimir a senha nem mudar credenciais. Ainda não há prova de conexão configurada ou backup integral ensaiado.

**A separação hospedada não está concluída.** Antes de implantar: concluir backup/recuperação integral e cópia de Storage; proteger o histórico legado; preparar a única publicação com as duas raízes e isolamento; usar a recusa de prontidão como janela de manutenção e drenar requisições antigas antes do corte; capturar/conferir a origem final; certificar as oito evidências no hash definitivo; aplicar uma vez e instalar os certificados; conferir fotos, vínculos públicos antigos, conexões por empresa, usuários, contas e DRE. Não liberar o código antigo para gravar sobre dados já separados. Não gerar aprovação real por copiar os recibos simulados.

Os vínculos atualizados estão no pacote local. Os dados operacionais hospedados, a limpeza real, os certificados, o bucket público antigo e os compartilhamentos da origem ainda não foram trocados. Nesta rodada, somente os destinos OneDrive receberam cópias privadas. A restrição pendente é informação de conexão necessária à recuperação; não é falta de autorização para a implantação solicitada.

## Recuperação e reconciliação da origem em 19/11/2026

A senha do PostgreSQL foi redefinida pelo titular. A conexão local passou com validação completa do certificado oficial e consulta somente de leitura; os quatro segredos PostgreSQL existentes de produção/prévia foram atualizados na Vercel, sem criar deployment. Nenhuma credencial faz parte deste registro.

Backup lógico nativo completo: PostgreSQL 17.12 sobre origem 17.6, todas as 117 tabelas dos esquemas de usuário, funções, permissões e papéis sem senhas de papéis. Arquivos cifrados com AES-256-GCM e chave protegida por DPAPI CurrentUser. Os 154 objetos Storage (18.021.288 bytes) também foram copiados cifrados e conferidos. A restauração em imagem oficial Supabase 17.6.1.121, rede desabilitada e sem portas expostas, passou sem erros; contagem e digest das 117 tabelas coincidem. Os 154 arquivos foram descriptografados e os hashes coincidem. Evidência privada: integral-backup-20261119/restore-verification.json. Limites: backup lógico; o serviço Storage externo não foi recriado; a recuperação da chave DPAPI depende do perfil Windows.

A produção mudou para 1f658d76, incluindo 65e7ce6d (dispensa de desconto de atraso na folha). Ambos foram integrados com merge normal e resolução por trechos; ajuda e manual regenerados. O motor compartilhado e a versão v14 da DRE foram preservados. Dois testes de wiring ainda exigiam chamada/versão anteriores e foram atualizados; os quatro arquivos focados passaram em 46 testes. A validação local completa passou. A primeira suíte integrada passou 5.508 testes, pulou 15 e encontrou somente essas duas expectativas antigas; não é aprovação da suíte final.

A comparação somente leitura das 58 tabelas operacionais detectou alterações em company_app_data e projeções financeiras. O rebase exato preservou desligamento, ponto, recibos e um usuário de Engenharia inativo vinculado à FABEJA/ARCD, sem replicá-lo para MRC. As alterações monetárias da origem foram conferidas em 1.764 projeções da ARCD com o motor v14; margens são razões recalculadas, sem comparar deltas percentuais entre carteiras diferentes. MRC e suas projeções permaneceram idênticas; limpeza 3/2 e reconciliação K1-04 preservadas. Alvo local 75f3a0f4c5876b5fde7946208fdb00883923516ac9fdb2cfe7dac9e142e565b3.

A transação e sua reaplicação foram ensaiadas no PostgreSQL real restaurado, atualizando somente as duas tabelas de origem da cópia descartável para a captura atual. Os 2.016 resultados DRE pós-SQL coincidem com o alvo. Evidência: live-rebased-target-20261119/native-rehearsal.json. Isso ainda não constitui aplicação hospedada nem oito certificados reais de ativação. Permanecem corte final, privacidade do histórico/links antigos, sessões OneDrive por empresa e implantação única coordenada.

### Rotinas versionadas de privacidade e revisão final do candidato

A suíte integrada final passou em 5.510 testes, com 15 pulados e nenhuma falha. As duas rotinas novas de manutenção passaram em nove testes adicionais. Os quatro cenários de navegador da separação passaram novamente no código integrado em Preciso/Noite e desktop/celular, sem gravações; as capturas foram revisadas. Os 14 digests e contagens das tabelas protegidas no PostgreSQL restaurado ficaram idênticos após o ensaio.

A conferência do histórico legado identificou 821 itens (514 arquivos e 307 pastas) sob o App original, incluindo as 19 raízes de origem por ID exato; seu compartilhamento antigo ainda precisa ser encerrado no corte. scripts/lib/company-legacy-drive-privacy.mjs recusa árvore divergente, raízes privadas e permissões herdadas de fora do escopo; remove somente permissões não proprietárias e confere todos os descendentes. Não apaga nem move arquivos ou versões.

A manutenção scripts/apply-company-storage-privacy.mjs exige pacote e prova das duas fotos, verifica conteúdo privado antes de mudar buckets e só certifica quando ambos recusam acesso anônimo. Mantém os objetos originais. O bucket privado acompanha o limite de 4 MB da API; os tipos continuam validados pela política autenticada do servidor. A configuração de Git da branch de release impede deployment automático; a publicação deve ser uma única criação explícita de produção, sem PR ou prévia intermediária. Essas rotinas técnicas não introduzem controles de tela; a ajuda de arquivos privados e o manual foram revisados e permanecem coerentes.

O backup anterior contém o estado legado e é evidência forense cifrada. Em recuperação, restaurar em destino isolado, aplicar novamente o alvo limpo/separado conferido, proteger Storage e histórico, validar DRE/identidades e só então liberar certificados. Não reabrir a versão antiga com dados mistos nem restaurar por cima de gravações posteriores ao corte.

A liberação dos dois certificados passou a ter compilador versionado: server/company-cutover-activation.js exige as oito evidências, uma conferência real posterior com o mesmo pacote/alvo/tentativa e o recibo de aplicação no banco; recusa simulações, prazo vencido e certificado de outra migração. scripts/prepare-company-activation.mjs confere hashes dos relatórios e prepara SQL privado de ativação e retenção de acesso (down), sem executar rede. Quatro testes PGlite executaram o SQL, incluindo recusa antes do recibo, reaplicação sem duplicidade e bloqueio sem recombinar dados.

A suíte desse candidato passou em 5.523 testes, pulou 15 e não teve falhas. Em rodada separada, os quatro arquivos PostgreSQL passaram em 16 testes (incluindo os 15 pulados), usando contêiner descartável exclusivo; ele foi removido após o sucesso. O catálogo público inteiro do banco hospedado foi comparado em leitura ao PostgreSQL restaurado: 748 colunas, 288 restrições, 156 índices, 25 gatilhos, 68 funções e quatro políticas, todos com hashes iguais. Nenhuma função ou dado protegido foi alterado na origem. A nova publicação 046c57f4, identificada antes do push, também deve ser integrada antes da publicação única.

### Candidato consolidado com a última publicação e integrações

A publicação 046c57f4 foi integrada por merge normal, sem substituir arquivos inteiros. A ajuda e o manual foram regenerados. A suíte final passou em 5.527 testes, com 15 pulados; os testes PostgreSQL omitidos foram cobertos pela rodada nativa de 16 aprovações. npm run validate:local passou no candidato com o cron de backup.

A revisão identificou que o agendamento antigo de backup executava somente a empresa padrão. server/company-backup-cron.js agora executa os mesmos serviços existentes em contextos independentes, com prontidão por empresa; falha em uma conexão não combina dados nem impede a tentativa da outra. Chamadas manuais continuam na empresa selecionada. Três testes cobrem contextos, prontidão e falha isolada; ajuda e manual explicam o resultado. O serviço continua sendo o backup existente de linhas do app, distinto do backup lógico integral nativo ensaiado nesta implantação. Nenhuma regra do custo realizado, do ponto protegido ou do cron de verificação de tempo foi alterada por esse ajuste.

Na aplicação Microsoft existente, o retorno https://erp.marcelleng.com.br/api/microsoft/callback foi acrescentado e conferido, preservando os dois retornos anteriores. A Vercel recebeu esse retorno e o segredo já existente que passou no OAuth local, com o mesmo client ID e sem criar credencial Azure nem ampliar escopos. As sessões centrais deverão ser reconectadas por empresa após a liberação. Isso não exporta o token pelo chat nem o inclui no código. O nome técnico do registro Microsoft permanece ARCD Gestão de Obras; a autorização e a pasta do ERP são verificadas no contexto da empresa.

Uma conferência de atualização do backup original comparou novamente as 117 tabelas. Detectou mudanças em sessões/refresh tokens/metadados Auth, limite de tentativas e company_app_data, sem mudança nas tabelas protegidas de ponto ou nos eventos financeiros. Esse relatório não é uma captura final nem autoriza aplicação: será feita nova conferência e atualização do backup no corte. Nenhuma migração operacional foi executada nesta etapa.

Antes de qualquer envio remoto, o hook pre-push antigo foi interrompido ainda durante os testes: ele chamaria npm run build e seu prebuild de banco. O hook versionado foi alinhado a npm run validate:local (inclui tipos e build:local) e mantém a suíte completa; não há desvio com --no-verify. O Vite permite apenas a raiz do projeto e o caminho real de node_modules compartilhado, para que workers de PDF sejam verificáveis no worktree sem liberar pastas privadas irmãs. O envio interrompido não aplicou migrations nem criou branch remota. A validação do novo hook será registrada antes da publicação.
