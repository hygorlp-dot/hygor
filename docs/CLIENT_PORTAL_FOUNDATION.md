# Portal do Cliente ARCD — fundação implementada

## Situação inicial

O repositório já possuía uma tela isolada em `/cliente`, porém sem carregador
de sessão, sem endpoint próprio e sem publicação editorial persistente. Também
há um link público legado dentro de `LegacyApp`; ele não é utilizado pelo novo
portal e não atende aos critérios de autenticação individual.

## Entregue nesta etapa

- Inventário explícito de campos publicáveis e proibidos.
- Projeções server-side com seleção campo a campo, status publicado,
  visibilidade por perfil/usuário e isolamento por obra.
- Resumo financeiro contratual exclusivo de uma publicação aprovada; não há
  leitura de DRE, razão, PIX, conciliação ou custos internos.
- Migração não executada para usuários, memberships, sessões revogáveis,
  auditoria e publicações do portal em tabelas próprias.
- Login por e-mail/senha com hash `scrypt`, cookie `HttpOnly`, `Secure` em
  produção, expiração de 12 horas, revogação e resposta não enumerável.
- Endpoints de sessão, login, logout e dashboard por obra.
- Shell `/cliente` permanece lazy e não baixa `LegacyApp`.

## Rotas preparadas

| Rota | Estado |
| --- | --- |
| `/cliente` | Login individual e shell isolado |
| `/cliente/obra/:projectId` | Carrega dashboard publicado da obra vinculada |
| `POST /api/client/auth/login` | Preparada; depende da migration |
| `GET /api/client/auth/session` | Preparada; depende da migration |
| `POST /api/client/auth/logout` | Preparada; depende da migration |
| `GET /api/client/projects/:projectId/dashboard` | Projeção publicada e autorizada |

## Limitações deliberadas

O portal não é ativado enquanto a migration não for homologada e não houver
usuários, vínculos e conteúdos publicados. Magic link, recuperação, 2FA,
envio de e-mail, painel interno de publicação, decisões graváveis, mensagens,
assistência, galeria e agenda ainda não foram ativados: ativá-los antes da
fundação de publicação e sessão criaria uma superfície de dados insegura.

## Próxima prioridade única

Homologar `005_client_portal_foundation.up.sql` em ambiente de teste e criar o
painel interno de publicação com revisão dupla. Sem essa etapa, nenhum dado do
ERP deve chegar ao portal.
