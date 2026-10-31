# Consolidação para produção — 31/10/2026

Escopo autorizado pelo usuário: toda a versão local, incluindo Financeiro,
Compras, Projetos e interface geral. Entrega preparada em worktree local
isolado; o checkout de trabalho e seus dados não foram substituídos.

Integrada à produção `ad73271018eab901ce3e369435d9fc96c294a693`, preservando
correções já publicadas de Compras, RH e empacotamento. A navegação nova foi
combinada com a separação da equipe e os controles de Folha existentes na main.

O build da Vercel usa o gate de escritores financeiros e o Vite diretamente.
Não executa migrations do prebuild npm. Nenhuma variável de produção foi
substituída; credenciais e sessões locais do OneDrive não integram a entrega.
Ferramentas de revisão local, capturas, relatórios privados e testes ficam
fora do pacote da Vercel.

Lint, tipos, fronteiras arquiteturais e build de produção passaram. Os 28
cenários financeiros de interface passaram sobre o artefato de produção.
A suíte geral aprovou 4.093 testes inicialmente; os testes afetados por seletores
antigos da equipe e pelo caminho isolado do worker PDF foram ajustados e os
oito testes desses dois arquivos passaram na repetição. Os cálculos de Folha
não foram alterados por esses ajustes de teste.

O conjunto de chunks mede 1.806,50 KiB gzip, incluindo o leitor PDF sob demanda
e os novos módulos. O limite global foi ajustado de 1.748 para 1.812 KiB,
mantendo os limites por chunk e de mídia. Essa alteração acompanha a medição
consolidada da entrega e não muda os recursos carregados pelo login.

Publicação prevista por um único envio a main, sem branch remoto de revisão,
PR ou deployment de preview intermediário. O estado final da publicação deve
ser confirmado na Vercel e pelos arquivos públicos do domínio de produção.
