# Backup operacional no OneDrive

O backup diário copia todas as linhas operacionais de `company_app_data` da empresa para a pasta raiz `00 - Backups ARCD` do OneDrive corporativo, às 03:00 (horário UTC definido pela Vercel).

Cada execução gera dois arquivos com o mesmo nome-base:

- `*.arcdbackup`: conteúdo compactado e criptografado com AES-256-GCM;
- `*.arcdbackup.manifest.json`: inventário sem dados pessoais, contendo data, contagem de registros e hashes SHA-256.

O token de conexão do OneDrive (`onedrive_auth_v1`) é excluído. Após uma restauração, a conexão Microsoft deve ser feita novamente por um administrador.

## Variáveis obrigatórias

- `BACKUP_ENCRYPTION_KEY`: segredo base64 de 32 bytes, mantido somente na Vercel;
- `CRON_SECRET`: segredo usado pela Vercel para invocar o backup agendado;
- credenciais Microsoft já configuradas e conexão corporativa ativa.

## Verificação

Um administrador pode executar `POST /api/data` com `action: "backup-verify"`. A operação baixa o backup mais recente, descriptografa apenas em memória e compara o conteúdo com o manifesto. Ela não altera o banco nem restaura dados.

## Recuperação

Não aplique um backup diretamente em produção. Primeiro restaure em ambiente separado, compare contagens e hashes e só então execute um item de recuperação aprovado, com janela de manutenção e registro de auditoria.
