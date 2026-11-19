# Revisão de layout com os usuários reais · 01/11/2026

Conferência de “Minha equipe” em modo de consulta. A aba autenticada confirmou nove linhas visíveis em uma janela de 1704 pixels, com área de conteúdo de 1398 pixels, sem transbordamento da página ou do diretório e sem sobreposição de nomes. Evidência local somente com medidas e contagens: `C:/dev/marcell-local-review/usuarios/TELA-NATIVA.json`.

Também foi executada uma revisão visual em navegador isolado com projeção de apresentação dos nove cadastros reais: oito ativos e um inativo. Foram preservados nomes, e-mails, perfis, situação e escopo de obra para renderização; PINs, hashes, credenciais e identificadores de autenticação não foram copiados. As requisições de API desse navegador foram respondidas localmente, sem encaminhamento ao backend; presença foi simulada. A revisão não comprova o estado de autenticação ou a última atividade real de cada conta.

## Verificações

- Desktop em 1704 pixels, tablet em 1024 e celular em 390.
- Contagem de membros, filtros de ativos e inativos e busca por dados existentes, sem abrir editores ou menus de alteração.
- Nenhum transbordamento horizontal da página ou do diretório; nenhuma sobreposição entre a identidade e os demais campos.
- Textos de nomes/e-mails legíveis; celular com blocos rotulados em vez de colunas estreitas.
- Alvos dos nomes com 40 pixels no desktop/tablet e 44 pixels no celular.
- Nove membros restaurados ao limpar os filtros e a busca.
- Sem erros de renderização ou comandos de alteração na revisão isolada.

As capturas com dados reais ficaram fora do repositório, em `C:/dev/marcell-local-review/usuarios/usuarios-reais-1704.png`, `usuarios-reais-1024.png` e `usuarios-reais-390.png`. O relatório de medidas e resultados fica em `REVISAO-LAYOUT.json`, no mesmo diretório.

## Correção de apresentação

O servidor aceita o vínculo do login por `authUserId` ou por e-mail (`server/app-auth.js`). Portanto, a ausência daquele identificador não autoriza concluir “Login por e-mail não ativado”. O texto agora informa **“Vínculo de login não informado”**; quando o identificador existe, informa **“Login por e-mail vinculado”**. Isso descreve o cadastro disponível, sem testar nem alterar a conta. Senhas, PINs, funções e permissões permaneceram intactos.

O auxiliar de navegação local também passou a localizar o grupo Administração pelo controle existente e a emitir medidas somente no atalho com `layout-review=1`. Ele não abre cadastros nem executa alterações.

## Preservação

O leitor da base restringiu a rede a GET/HEAD. A cópia dos usuários e permissões manteve o mesmo hash antes e depois da conferência. Zero gravações na origem e zero acessos ao OneDrive. O servidor autenticado existente não foi reiniciado; o endpoint de revisão confirmou gravações bloqueadas. Nenhuma publicação, push ou deployment.

Validação da correção: suíte do componente e das regras de acesso; revisão visual repetida nas três larguras. Os testes não utilizam credenciais reais, nem publicam capturas contendo os cadastros.
