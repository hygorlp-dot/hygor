# Esquema, captura e acessos — conferência somente de leitura

> Atualização posterior: o delta de R$ 200 identificado nesta conferência foi reconciliado somente na ARCD local, conforme [reconciliação e pacote integrado](RECONCILIACAO-K104-PACOTE-INTEGRADO-LOCAL-20261118.md). A captura e as provas deste relatório permanecem intactas.

Conferência de 18/11/2026 no projeto MARCELL, sem publicação, migração, mudança de permissão, alteração de arquivos remotos, login ou renovação de credenciais. Foram usados SELECTs em transações `READ ONLY` e requisições HTTP GET. A nova captura está separada da cópia operacional limpa.

## Resultado

- Levantadas 76 tabelas públicas e 37 tabelas de apoio em Auth/Storage, com colunas/tipos, defaults, identidades, restrições, índices, gatilhos, políticas e privilégios. Também foram coletadas 96 funções, dez tipos enum/domínio e seis sequências. Não foram encontradas views nem procedures nesses três esquemas.
- Confirmadas as chaves primárias das sete tabelas anteriormente pendentes. As 59 relações capturadas estão validadas e são não adiáveis. O catálogo das tabelas públicas permaneceu igual na segunda leitura.
- Atualizada a captura das 76 tabelas, incluindo os catálogos externos e 10.301 eventos de auditoria, 15 a mais que na captura anterior. A auditoria teve identidades e conteúdo conferidos novamente no banco no mesmo corte temporal.
- Os 152 arquivos do Storage, totalizando 17.797.408 bytes, foram copiados novamente e mantêm os mesmos conteúdos e identidades. Os 94 hashes de origem disponíveis coincidem. Metadados e configurações dos buckets permaneceram iguais na segunda leitura.
- As cópias operacionais ARCD/MRC, a limpeza e o pacote de migração anterior ficaram idênticos por hash. Trinta verificações finais foram aprovadas. Isso não libera a publicação: há diferenças na origem e acessos ainda pendentes.

As tabelas globais sem `company_id` também foram inventariadas: há dados em `app_data`, `app_data_import_backups`, `ponto_tempo_verificacoes` e `user_app_data`. Elas precisam constar da reconciliação de legado/identidades do corte; não foram atribuídas a uma empresa por suposição nem apagadas.

## Mudança encontrada na origem e efeito no DRE

Dois registros de ponto da K1-04, em 12 e 13/11/2026, passaram de presença para falta na origem. A comparação com o motor existente mostra redução de R$ 200 no custo de mão de obra de novembro e aumento de R$ 200 no resultado consolidado da origem. As diferenças aparecem no demonstrativo da obra e no consolidado. Essa obra pertence à ARCD.

Os 15 eventos novos têm ações `attendance_upsert`/`attendance_batch_upsert`, entre 12h41min03s e 12h42min25s na Bahia, anteriores ao início desta revisão. A prova temporal está em `audit-new-event-timing.json`; nenhuma dessas gravações foi produzida pela conferência somente de leitura.

Foi feita uma comparação privada com a separação e a limpeza reproduzidas apenas em memória, após conferir exatamente os três movimentos, os dois valores gerados e os vínculos nativos autorizados. O candidato ARCD mantém esse delta de R$ 200 em relação à cópia aprovada. A MRC continua sem diferença no DRE nas 36 combinações de mês/escopo verificadas.

A cópia operacional local não recebeu esses pontos novos. Seu DRE permanece igual ao aprovado após a limpeza. O delta novo não é uma segunda aplicação da retirada de R$ 800, nem um recebimento, pagamento ou compromisso novo. Antes de migrar, é necessário conferir a origem das duas faltas e reconciliar os dados mais recentes; não executar o pacote antigo sobre a origem modificada nem descartar a mudança automaticamente.

As provas privadas incluem a comparação dos 228 demonstrativos da origem e das 240 combinações após a separação/limpeza, as alterações exatas de ponto e os 15 eventos novos de auditoria. Nenhum custo foi criado, estornado ou compensado nesta revisão.

## Acessos conferidos

As consultas diretas à tabela principal com os papéis `anon` e `authenticated` foram recusadas com erro de permissão. As 76 tabelas públicas têm RLS habilitada. As 68 funções públicas não apresentam função `security definer` liberada a esses dois papéis. As quatro identidades Auth referenciadas pelos perfis conferidos existem, têm e-mail confirmado e não estão banidas ou excluídas. Isso não equivale a testar login, envio de convite ou sessões reais de cada pessoa.

A nuvem ainda tem zero linhas MRC nas tabelas operacionais com empresa. A separação continua sem ativação; não foi declarado acesso real da MRC como se a migração já tivesse ocorrido.

As duas fotos do bucket `diario-obra` continuam públicas: o GET sem autenticação devolveu os mesmos bytes. Uma leitura anônima de objeto privado foi recusada. O GET administrativo dos 152 arquivos comprova conteúdo, mas não substitui a validação das permissões de cada usuário após a migração. Os caminhos privados preparados e a revogação dos links públicos continuam pendentes de aplicação autorizada.

No OneDrive, existe uma sessão legada ARCD que não pôde ser aberta com a configuração local; a MRC não possui sessão própria. Também não estão configuradas raízes exclusivas por empresa no ambiente local. Não houve login, troca/renovação de token nem chamada ao helper do ERP que gravaria a sessão central. A abertura real, ancestralidade e permissões dos documentos OneDrive continuam **não verificadas**. Os vínculos cadastrados de I-8 e BASE DE DADOS ainda indicam a pasta compartilhada; nenhum documento foi movido.

O diagnóstico de segurança apontou 75 tabelas com RLS sem política, coerente com a negação de acesso direto ao navegador, além de avisos para cinco funções com `search_path` mutável, uma extensão em `public` e proteção de senhas vazadas desativada. Não foram aplicados GRANTs ou correções. Referências: [search_path de funções](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [extensão no schema público](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) e [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Provas e limites

A nova captura e as provas ficam em `C:/dev/marcell-local-review/company-isolation-20261118/read-only-review-2026-11-18T20-47-09-767Z/`. Arquivos principais: `snapshot-current.json`, `catalog-current.json`, `final-read-review.json`, `source-dre-comparison.json`, `candidate-dre-comparison.json`, `storage-read-proof.json` e `files-audit-current.json`. Dados pessoais, sessões, arquivos e valores absolutos de resultado permanecem fora do repositório.

Uma variação em `auth_rate_limits` foi detectada durante a primeira tentativa de dupla leitura. O leitor registrou o problema, preservou os arquivos externos e recapturou os dados em leitura; a tentativa final conferiu as tabelas. A captura usa dupla leitura por tabela e corte imutável de auditoria. Ela não é uma única fotografia MVCC entre todas as requisições, nem substitui o corte consistente e o backup nativo necessários à execução definitiva.

Não houve alteração de interface ou fluxo do operador; a ajuda e o manual continuam aplicáveis. O pacote anterior foi preservado como evidência histórica. Para executá-lo futuramente será necessário preparar uma versão reconciliada com os pontos atuais, o código vigente, o catálogo coletado e os acessos de arquivos ainda pendentes, mantendo a política de recuperação limpa e separada.
