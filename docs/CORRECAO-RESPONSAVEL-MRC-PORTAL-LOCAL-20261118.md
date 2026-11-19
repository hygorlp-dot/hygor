# Responsável técnico da MRC e saldo do portal — correção local

Em 18/11/2026, foi corrigido o cadastro da cópia privada da MRC e estabilizada a validação do PDF/e-mail. A ARCD limpa permaneceu idêntica por SHA-256. Nenhuma operação de nuvem, publicação, push, migração remota ou envio de mensagem foi executada.

## Responsável técnico

I-8 e K1-10 já tinham o mesmo `engineerId` correto. O perfil ativo correspondente existia na origem e na ARCD, mas faltava na MRC. Foi reaproveitado esse cadastro pelo ID exato, preservando identidade de autenticação, permissões, restrições e credencial existente. Não houve associação por nome nem criação de outra pessoa.

A MRC passou de três para quatro usuários, com uma única inclusão de engenheiro para as duas obras. O cadastro principal persistido e o índice compacto de login/OneDrive foram sincronizados. A revisão local passou de 0 para 1, com recibo e backup integral anterior. Repetir o comando não inclui outro perfil nem aumenta a revisão. A ARCD continua na revisão 1 da limpeza anterior.

O planejador também inclui a dependência técnica comprovada nas próximas distribuições. Perfis ausentes, duplicados, inativos, de outro papel ou restritos a obra de outra empresa são recusados. Um perfil existente com outra identidade de autenticação não é substituído silenciosamente.

O comando `scripts/repair-company-simulation-engineers.mjs` atua somente no simulador privado em JSON. Compara o estado esperado, confere dados e DRE antes de gravar, faz backup e registra a prova. Não implementa nem executa migração de usuários de produção. A autorização real e a autenticação Microsoft/Supabase continuam pendentes de validação no corte.

## PDF e rascunho de e-mail

A divergência reproduzida era temporal: o teste esperava o saldo em 17/11/2026, mas consultava o relógio real. A fixture tem um aporte de R$ 5.000 em 18/11. O saldo correto é R$ 8.620 até o dia 17 e R$ 13.620 a partir do dia 18. Esses valores pertencem ao cenário de teste, não aos saldos reais das empresas.

O cenário original passou a usar data fixa, mantendo a expectativa de R$ 8.620. Uma regressão confere a virada do dia da Bahia: 02h59 UTC ainda é 17/11; 03h00 UTC já é 18/11. A entrada aumenta R$ 5.000, com as saídas preservadas. Os bytes do PDF e do anexo MIME do e-mail são abertos com PDF.js para conferir o saldo efetivamente impresso. O PDF de 17/11 também é conferido pelo conteúdo.

Não houve alteração no cálculo de saldo, datas ou valores operacionais do portal. O aporte válido não foi removido e o teste não foi liberado mudando sua expectativa para o resultado do relógio real. O rascunho continua sem envio automático.

## Separação e DRE

- MRC: somente I-8 e K1-10; ARCD: as outras 16 obras, incluindo BASE DE DADOS.
- Somente `usuarios` mudou nos dados operacionais MRC; obras e vínculos existentes ficaram iguais. As tabelas independentes e demais linhas persistidas ficaram iguais.
- Os demonstrativos da MRC antes e depois do vínculo são iguais. O arquivo ARCD inteiro é idêntico ao anterior à correção, preservando a retirada autorizada dos três movimentos sem conta e dos valores gerados pela conciliação.
- Foram comparadas as projeções operacionais e reconstruídas de 18 obras e dois consolidados, em 12 meses: 240 combinações. Os consolidados anuais retornados pela API de loopback coincidem com o cálculo local de cada empresa.
- O vínculo técnico não cria previsão, compromisso, estoque, custo reconhecido ou pagamento; o efeito adicional no DRE é zero. A consulta/exportação do portal também não cria fatos financeiros.
- Continuam sem contas bancárias cadastradas nas duas cópias, tanto no cadastro operacional quanto nas tabelas nativas. Não foi inferida conta a partir de descrição de extrato.
- Os arquivos locais inventariados mantêm seus hashes. Os diretórios preparados de I-8 e BASE DE DADOS continuam distintos. Não houve movimentação ou mudança de acesso na nuvem.

## Validação e provas

Foram aprovadas 176 verificações privadas de dados, arquivos, dependências e consultas à API local. A ajuda foi revisada com impeccable e shadcn, e o manual foi regenerado com 145 guias. A abertura/fechamento da ajuda foi conferida em desktop e celular, sem perder a seleção MRC nem causar rolagem horizontal no painel.

Passaram 60 testes dirigidos em dez arquivos, lint (incluindo design e manual), TypeScript e build por `npx vite build`, sem executar o `prebuild`, que contém operações remotas. A validação dirigida cobre portal, PDF/e-mail, vínculos técnicos, distribuição, restrições de obra, conciliação e ajuda. Um teste antigo da ajuda pressupunha exatamente três passos no Ponto, embora o guia atual já tivesse cinco; foi corrigido para verificar o conteúdo do primeiro passo, mantendo os testes de escopo e fechamento por Escape.

Provas privadas em `C:/dev/marcell-local-review/company-isolation-20261118/operations/mrc-engineer-correction-20261118/`: `applied.json`, `idempotency.json`, `final-verification.json`, `help-review.json` e capturas locais. O backup anterior está em `erp-simulation/backups/`, identificado no recibo. Não guardar tokens, PINs, e-mails de pessoas ou cópias operacionais no repositório.

O plano regenerado está em `C:/dev/marcell-local-review/company-isolation-20261118/plan-engineer-corrected.json`, sobre a mesma captura original. Não substitui o estado operacional pós-limpeza. Os manifestos antigos de preparação continuam vinculados ao plano histórico; novas provas de preparação precisam ser geradas para o plano corrigido antes do corte, sem recriar a cópia limpa a partir do snapshot antigo.

## O que continua pendente para publicação

As duas pendências tratadas aqui estão resolvidas localmente. A publicação permanece desativada. Continuam necessários dados fiscais/contatos e bases de orçamento próprios da MRC, atualização da captura no corte, execução transacional da migração, tratamento real da limpeza, preparação e permissões reais de pastas/fotos, autenticação e integrações por empresa, backup/restauração, certificados/flags e revisão consolidada do pacote. A lista detalhada permanece em [Revisão final da separação](REVISAO-FINAL-SEPARACAO-DRE-PUBLICACAO-20261118.md). Nenhuma dessas etapas foi executada na nuvem.
