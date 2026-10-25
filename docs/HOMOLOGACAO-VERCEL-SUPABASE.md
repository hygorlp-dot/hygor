# Homologação gratuita: site, RH e ponto Android

Este ambiente serve apenas à simulação da construtora. Não publica no projeto
de produção e não está ligado automaticamente à branch `main`. O sistema
atual por diária permanece íntegro e em uso. O seed completa apenas Fulano e
Siclano, já identificados como dados de teste; não converte cadastros legados
para CLT.

## Destinos conferidos

| Recurso | Destino |
| --- | --- |
| Site | https://ponto-homologacao.vercel.app |
| API usada pelo Android | https://ponto-homologacao.vercel.app/api/data |
| Documentos do RH | https://ponto-homologacao.vercel.app/api/upload |
| Presença do usuário | https://ponto-homologacao.vercel.app/api/presence |
| Resumo diário público | https://ponto-homologacao.vercel.app/api/ai-agent, ação `daily-brief` |
| Projeto Vercel | `ponto-homologacao`, `prj_W7s5zALWmMuV4Wt5WePSz8ABAefp` |
| Equipe Vercel | `team_poBZ5I1rwStzhvD73ar22b7v` |
| Projeto Supabase | `ponto-homologacao`, `ukkzpttnbyylkyujzwnv` |
| Função Supabase | `ponto-api-homologacao` |
| Obra sintética | `piloto-k110` |
| Funcionários sintéticos | `piloto-k110-fulano`, `piloto-k110-siclano` |

Em 25/10/2026, a conta Vercel foi conferida no plano Hobby, sem trial, e a
organização Supabase no plano Free. Nenhum complemento, upgrade ou cobrança
foi contratado. Respeitar os limites gratuitos; esta configuração não autoriza
aumento de plano. O plano Hobby exige uso pessoal/não comercial conforme os
[termos atuais da Vercel](https://vercel.com/docs/plans/hobby).

## Como o código existente é usado

O site continua na Vercel. As rotas `/api/data` e `/api/upload` encaminham
pedidos para uma função Supabase que empacota os mesmos arquivos
`api/data.js` e `api/upload.js` usados pelo aplicativo. O adaptador muda apenas
o contrato HTTP de entrada e saída. Autenticação, permissões por papel,
comandos, auditoria e regras financeiras continuam nos handlers originais.

As rotas auxiliares de presença e resumo diário também reutilizam
`api/presence.js` e `api/ai-agent.js`. No segundo caso, somente a ação
`daily-brief` chega ao handler: ela consulta clima, notícias e CUB em fontes
públicas e retorna antes de carregar qualquer configuração Gemini. Todas as
demais ações de IA externa recebem `503 / AI_DISABLED_HOMOLOGACAO`, antes do
import do handler. Não há chave de provedor nem chamada de IA paga.

As credenciais do banco ficam no runtime Supabase. O build não lê arquivos
de segredos e não envia chaves para a Vercel, para o navegador nem para o APK.
A documentação do Supabase confirma as
[variáveis do runtime](https://supabase.com/docs/guides/functions/secrets),
o [uso de dependências Node/npm](https://supabase.com/docs/guides/functions/dependencies)
e a [conexão PostgreSQL](https://supabase.com/docs/guides/functions/connect-to-postgres).
O driver real `postgres` usa `prepare:false`; não há banco ou autenticação
simulados no adaptador.

A função tem `verify_jwt:false` na borda porque pareamento e consulta do
ambiente são públicos e o aplicativo já possui autenticação própria. Isso
não libera os dados: os handlers originais continuam conferindo a sessão,
o PIN ou o token do aparelho conforme cada operação.

## Isolamento e acesso

- O runtime só inicia no projeto Supabase identificado acima.
- Cada pedido confere `arcd_ambiente.id=true` e `ambiente='homologacao'`.
- Um `ambienteApp` incompatível recebe HTTP 409 antes de qualquer comando.
- A consulta pública `ponto-ambiente` só confirma o ambiente a partir do
  marcador real do banco.
- O setup público e a migração financeira pela API estão bloqueados neste
  adaptador. A preparação administrativa usa o procedimento específico.
- O bucket `rh-prontuarios` é privado. O script existente
  `scripts/ensure-rh-storage.mjs` o prepara pela Storage API, após a confirmação
  do marcador, e recusa um bucket público. Não há escrita SQL nas tabelas
  internas do Storage.
- O domínio curto listado acima é o endpoint de teste. Os domínios de
  deployment podem exigir autenticação da Vercel; nenhuma proteção de
  deployment foi desativada para contornar isso.

`company_app_data` já tinha RLS habilitada e nenhuma política pública na
conferência de 25/10/2026. As concessões de tabela existentes não tornam suas
linhas legíveis por `anon` ou `authenticated` nesse estado.

## Preparar e publicar os artefatos

Os comandos abaixo apenas geram artefatos locais. A publicação é uma ação
separada no projeto isolado, usando os manifests gerados.

```sh
npx vite build --manifest
node scripts/homologacao/build-vercel-static.mjs
node scripts/homologacao/build-edge-api.mjs
```

O primeiro script de homologação publica somente arquivos pertencentes ao
manifest atual do Vite. Ele também inclui a função Node de horário, o
`package.json` mínimo e os rewrites. O segundo cria o bundle Edge, o mapa de
imports, hashes por arquivo e o payload de deploy. Ambos recusam artefatos
acima da margem definida para o plano gratuito.

Os resultados ficam nos diretórios locais ignorados `.tools/homologacao-vercel`
e `.tools/homologacao-edge`. Antes de publicar, conferir `projectId`, os
arquivos e o estado `dirty` do manifest. Um bundle gerado com alterações
locais não deve ser apresentado como idêntico ao commit base.

Na Vercel, a publicação completa usa o commit exato pelo `gitSource`, com
`rootDirectory:apps/homologacao` e `sourceFilesOutsideRootDirectory:true`.
O [procedimento do wrapper](../apps/homologacao/README.md) informa os comandos
de instalação sem scripts e build sem migrações. O upload de assets grandes
pelo conector apresentou demora e não é o procedimento principal. O target
técnico `production` somente no projeto `ponto-homologacao` mantém seu domínio
estável; não se refere ao projeto operacional da construtora. No Supabase,
publicar `deploy-payload.json` com a ferramenta de deploy de Edge Functions,
mantendo nome e projeto do manifest.

## Banco: fases pequenas e auditáveis

O lote inicial de 14 migrações foi recusado pela revisão automática por reunir
motor financeiro, alterações globais de privilégios, funções privilegiadas e
remoção de duplicidades em uma única ação. **Esse lote não foi aplicado e
não é um procedimento autorizado de publicação.** O gerador amplo foi
substituído; não executar cópias antigas de `bootstrap.sql`.

O procedimento atual gera uma fase de cada vez:

```sh
node scripts/homologacao/prepare-schema.mjs audit
node scripts/homologacao/prepare-schema.mjs finance
```

Cada arquivo exige o marcador real e modifica somente os objetos da fase.
A fase `audit` usa `scripts/homologacao/sql/audit-minimal.sql`: cria a tabela,
RLS, permissões restritas e os dois gatilhos append-only. Não cria uma RPC
privilegiada nem muda o blob existente. A fase `finance` usa
`scripts/homologacao/sql/finance-minimal.sql`: cria as nove tabelas necessárias
à guarda e à leitura do DRE, com RLS e permissões restritas, e a implementação
real da guarda de conciliação em modo `SECURITY INVOKER`. Não instala o motor
nativo completo, não ativa enforcement, não sincroniza legado e não remove
dados. O código original da API preserva a transação entre dados e auditoria.

A geração não executa SQL. Aplicar cada arquivo revisado pela ferramenta
`Supabase apply_migration`, no projeto isolado, e conferir depois o registro
de migrações e os objetos criados. Uma chamada pendente, cancelada ou sem
resultado não comprova aplicação. O manifest local informa
`appliesAutomatically:false`; ele não executa a migração.

Registro remoto conferido em 25/10/2026:

| Versão | Nome | Fonte SHA-256 |
| --- | --- | --- |
| `20261025202829` | `homologacao_audit_minimal` | `f2a87cb3e0969bd64d0d60fd668cb156c7140c353e4f9b8429c3602792e33df4` |
| `20261025204930` | `homologacao_finance_minimal` | `6ab586316cea6b6bc78cc2f1e3d7ab5d6c0d3b6c5c0aa23a03d3cc69422e2fe3` |

A tentativa anterior `homologacao_append_only_audit`, com cerca de 4,5 KB
e uma RPC privilegiada, ficou pendente e não aparece nesse registro. O
procedimento atual não a gera. Os arquivos acima ficam na pasta específica
de homologação para evitar sua execução pela sequência de produção.

O aceite financeiro completo também exige os objetos reais consumidos pelo
razão e pela conciliação. Mesmo com `FINANCIAL_ENGINE_ENFORCE=false`, a API
chama `financial_guard_source_reconciliation` e o DRE consulta
`financial_titles`, `settlements`, `bank_transactions`, `reconciliation_links`
e `financial_events`. A fase financeira mínima aplicada fornece esses
contratos reais. Não substituir esses caminhos por stubs nem considerar
auditoria isolada suficiente para o aceite financeiro. O resultado de cada
ensaio financeiro deve ser conferido separadamente.

## Autenticação e documentos reais da simulação

O operador sintético inicial é preparado de forma controlada, preservando a
obra e as pessoas existentes. O arquivo de acesso fica fora do repositório,
com permissão `600`. Não copiar seu conteúdo para logs, chat ou manifests.

```sh
python scripts/homologacao/check-api.py --access /caminho/privado/access.json --provision
python scripts/simulacao/preparar-homologacao.py --access /caminho/privado/access.json
python scripts/homologacao/check-api.py --access /caminho/privado/access.json --verify-time
```

`--provision` usa o fluxo normal do próprio administrador sintético e deve
ser executado apenas depois da auditoria estar disponível. O login guarda os
tokens somente no arquivo privado. O verificador imprime apenas resultados
sanitizados. O seed completa os dois cadastros já marcados como teste e
confere os PDFs enviados e baixados pela mesma API privada do prontuário.

Critérios básicos de acesso:

| Pedido | Resultado esperado |
| --- | --- |
| `ponto-ambiente`, homologação confirmada | 200, `ok:true`, `ambiente:homologacao` |
| Pedido com `ambienteApp:producao` | 409 |
| `setup` público | 403 |
| Sincronização sem token de aparelho | 401 |
| Documentos RH sem sessão | 401 |
| Login do operador sintético e leitura permitida | 200 |

Checkpoint conferido em 25/10/2026: Edge versão 8 ativa, com a ficha do operário,
renovação de hora e rotas auxiliares; bundle de 791.325 bytes, hash de deployment
`96a4d1bd974f110f2da98a96abb663050626db90c50a3cc288500da208344da1`;
marcador público pela
URL Vercel retornou 200; upload direto na Edge sem sessão retornou 401; o
bucket `rh-prontuarios` está privado, com limite de 3 MiB; o login real do
operador sintético retornou 200 e os dois empregados; a listagem autenticada
de documentos retornou 200. O checkpoint Vercel
`dpl_7V5Unwcz3Mr4uzATLGpMtC79vze9` está READY e acrescenta NTP e a rota de
upload. A página desse checkpoint informa que a versão completa está em
atualização. O frontend final usa o wrapper Git em `apps/homologacao`.

Na versão 8, o teste real das rotas auxiliares confirmou heartbeat e listagem
de presença autenticados, com encerramento da própria sessão de teste.
Presença e resumo diário sem sessão retornaram 401; configurar IA externa
retornou 503 com o código explícito de desativação. Com cache CUB inicialmente
ausente, o resumo diário retornou 200 em 13,03 segundos, com clima e CUB reais.
A leitura posterior confirmou o cache CUB preenchido e nenhuma configuração
Gemini. Os logs não registraram encerramento por CPU/memória nessa janela;
registraram uma falha da fonte de notícias, devolvida como lista vazia pelo
fallback existente. Não foram criadas manchetes ou cotações fictícias.

As rotas auxiliares passaram por 32 testes focais, lint, arquitetura e
typecheck. O roteiro reproduzível é
`python scripts/homologacao/check-auxiliary.py --access /caminho/privado/access.json`;
`--edge` confere diretamente o backend isolado antes da publicação das
rewrites. O relatório real dessa rodada está em
`.tools/homologacao-auxiliary-v8-edge-report.json`. O tempo e o resultado
medidos não garantem disponibilidade permanente das fontes públicas.

## Hora do ponto

O runtime Edge não oferece o UDP exigido pela consulta NTP original. A ponte
`/api/homologacao-time` na Vercel apenas transporta um pacote SNTP restrito a
servidores autorizados e devolve a resposta. Ela não recebe chaves de banco e
não substitui a autenticação do aplicativo.

O Edge continua criando o pacote com seu próprio instante inicial e calcula
o instante final, o offset e a incerteza pelo mesmo código de NTP. O tempo de
rede HTTPS entra na medição; não se usa o relógio de outra máquina como se
fosse o do Edge. A ponte só é escolhida com `PONTO_AMBIENTE=homologacao` e
`PONTO_NTP_BRIDGE=vercel`.

É obrigatório executar `ponto-tempo-verificar` e conferir a evidência real.
Sem resposta NTP válida ou fora da tolerância, `confiavel` permanece falso e
a importação automática de marcações continua bloqueada. Compilar o APK ou
receber HTTP 200 não comprova confiabilidade do horário nem encerra o teste
de ponto em aparelho.

Medição real autenticada, em 25/10/2026 às 20:57:42 UTC: o servidor
`c.st1.ntp.br`, estrato 1, retornou offset de 10,936 ms e incerteza de
90,500 ms. A política canônica retornou `status:verificada` e
`confiavel:true`. Um servidor não respondeu, e o fallback previsto no código
obteve a evidência válida. O relatório local é
`.tools/homologacao-time-report.json`.

A evidência vence após **30 horas**, conforme a política existente. A versão
com `PONTO_NTP_RENOVACAO=oportunista` renova ao sincronizar um aparelho
autenticado, quando a última evidência confiável tem pelo menos 18 horas.
Ambiente, flag, URL exata e marcador do banco precisam confirmar homologação.
Produção conserva o fluxo atual; a agenda de backups não é copiada.

Um lock transacional evita medições concorrentes; o horário `criado_em` do
banco limita novas tentativas a uma por 15 minutos. Falhas são registradas
como `ok=false`. Uma resposta NTP fora da tolerância também pode ser medida
novamente depois desse intervalo; a pausa de 18 horas exige confiança pela
avaliação canônica. A sincronização limpa o cache da mesma fonte usada pela
ARP, inclusive quando outra instância já renovou a evidência. A revisão
independente e 58 testes focais passaram, incluindo PostgreSQL real em
PGlite, cache previamente preenchido, sincronização seguida de gravação na
ARP e comparação da evidência persistida. Lint, arquitetura e typecheck
também passaram. O teste não altera os algoritmos da ARP.

Sem sincronização de aparelho, não há tarefa em segundo plano nessa versão.
Continua disponível a ação administrativa normal e o verificador acima com
`--verify-time`. Rede indisponível ou evidência vencida continuam sem
confiança; nenhum prazo ou tolerância é ampliado para contornar falha NTP.
