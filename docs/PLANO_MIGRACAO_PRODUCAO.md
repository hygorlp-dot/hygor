# Migração da produção integrada

`004_integrated_production_foundation` cria registros operacionais e trilha de auditoria sem tocar no blob legado. O rollback remove apenas as tabelas novas e só deve ocorrer antes de qualquer carga produtiva. A ativação exige execução manual no Supabase SQL Editor, backup validado e comparação de contagens por obra.
