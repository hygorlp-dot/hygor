# Cadastro de usuários · referência Vobi

Adaptação local de 01/11/2026. O navegador de inspeção abriu a Vobi no login, sem sessão autenticada. A referência visual foi conferida nas imagens e no texto da documentação oficial [Minha equipe](https://ajuda.vobi.com.br/pt-br/articles/5491826-o-que-e-e-como-utilizar-a-minha-equipe). Não houve alteração na Vobi ou envio de convites.

## Entrega no MARCELL

Em **Ajustes → Usuários e Permissões**, a seção passa a apresentar “Minha equipe”: contagem de membros ativos/inativos, botão Adicionar membro, pesquisa por nome/e-mail e filtros de situação e perfil. Cada membro exibe identidade, e-mail, perfil, alcance das obras, estado do cadastro/login e última atividade quando o operador é administrador.

O nome abre a edição. O menu Ações mantém editar, ativar login/redefinir senha, PIN, ativação/inativação e liberação de obras já existentes. A listagem se apresenta como tabela no desktop e blocos rotulados no celular.

No formulário, **Dados do membro** e **Permissões de acesso** separam identificação/perfil dos acessos por módulo e tela. Trocar a aba não redefine o rascunho. Cancelar não salva. As regras de perfil-base, acesso de administrador, restrição de obra, limite de desconto, ativação de conta e PIN não foram modificadas.

O MARCELL mantém seu mecanismo de permissões por tela e as políticas de servidor existentes. Esta adaptação não simula permissões de ver/criar/editar/excluir que não estejam implementadas, nem cria envio de convite por e-mail. Não foram copiados limites de assinatura ou contagens de vagas da Vobi.

## Verificação

- Jornadas com dados fictícios em 1440 e 390 pixels: busca, filtro de inativos, abertura do cadastro, leitura das permissões previamente concedidas, mudança de aba, cancelamento e novo cadastro sem envio de gravações.
- Conferência visual em ambos os tamanhos, com teste de largura e de ausência de sobreposição dos campos no celular.
- Teste de componente para ausência das ações administrativas ao renderizar um perfil não administrador e suíte existente das regras de acesso.
- Lint, tipos e build local. Nenhum usuário real, perfil, senha ou vínculo foi alterado.

Arquivos: `src/domains/administracao/components/UserDirectory.jsx`, `user-directory.css` e integração pontual em `LegacySettings.jsx`. O backend de autenticação e autorização permaneceu intacto. Sem publicação, push ou preview remoto.
