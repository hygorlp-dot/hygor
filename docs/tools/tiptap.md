# TipTap

## Problema

Conteúdo editorial estruturado para comunicados e atualizações.

## Alternativas

Texto simples atual e Lexical, comparado abaixo.

## Versão analisada, licença e compatibilidade

`@tiptap/react` 3.29.0, MIT no núcleo; React 18 compatível. A documentação mostra
extensões para tabela, imagem e persistência, algumas extensões/serviços possuem
condições próprias.

## Bundle e segurança

Runtime a medir. HTML de editor deve ser sanitizado no servidor e armazenamento
canônico precisa ser JSON versionado.

## POC e testes

Editor simples de atualização não financeira, exportação JSON/HTML sanitizado,
teclado e colagem testados.

## Riscos, decisão e rollback

**Adiar.** Não instalar junto com Lexical. Escolha ocorre após POC comparativa.
