# Ponto de Obra — integração Android / RH

Atualizado em 25/10/2026. Base `c7d4e777e7263b823bd2ce60797346ea69bca402`.
Android: `codex/ponto-android-candidato`. RH: `codex/rh-ponto-week-one`.
Aceite independente: `codex/ponto-rh-aceite`. Obra piloto informada ao RH: K1-10.

## Responsáveis e plano

- Android: app, guardas de ambiente, fila, recuperação, build e produtor `publicacao-rh.js`.
- RH: consumidor administrativo, aprovação, remuneração e financeiro. O handler e a persistência precisam de coordenação antes de incorporar alterações concorrentes.
- Aceite: testes novos em `src/integration/ponto-rh-aceite*` e guias operacionais.
- Ordem: reconciliar alterações pequenas → testar produtor/consumidor/persistência → validar ambiente → APK identificado → instalação e atualização física.

## Reconciliação

As PRs #69–#77 continuam abertas. #77 `3a5075a` não está publicada.
Main contém evolução posterior de dependências (Expo 57.0.31), design system,
calibração, fuso e scorecard. Essas partes foram preservadas; não se aplica a
sequência antiga de merges. A simulação local de merge integral foi abortada.

Recuperados seletivamente: #73 (ambiente explícito, pacote separado, guardas),
#74 (PIN ao servidor apenas em memória), #76 (trava persistente e remoção de
segredos após revogação), #75 (métricas da fila e módulo de estatísticas).
As métricas nativas ainda não medidas permanecem sem medições. Nenhum limiar
facial foi alterado. #69 escrita única da confirmação fiscal reaproveitada.
#70/71 (migration 019/livro/deploy) não aplicadas automaticamente: exigem
reconciliação com o caminho de migrations atual e validação conjunta.

## Contrato v1 — produtor disponível, integração ainda pendente

`produzirPublicacaoRh(entrada, sha256)` em `src/domains/ponto-eletronico/publicacao-rh.js`.
Preserva empresa, funcionário, data operacional, fuso, revisão, versão do
tratamento, eventos com aparelho/estabelecimento/NSR e intervalos completos
com obra apropriada, duração e eventIds. Captura e custo são campos distintos.
Não gera salários, faltas ou quatro horários artificiais. Terceiros são recusados.

`publicacaoId` é estável para empresa/pessoa/dia/eventIds/revisão; `conteudoHash`
detecta tentativa de reutilizar a mesma revisão com conteúdo diferente.
O consumidor deve persistir um livro de publicações, com unicidade permanente
por empresa/publicacaoId, antes de lançar jornada/custo. Não basta guardar
somente a última chave: reprocessar revisões antigas também deve ser idempotente.
Mesmo id/hash = retorno anterior; mesmo id/hash diferente = conflito; revisão
nova em período fechado = pendência identificada, sem alterar valores aprovados.

Pendência confirmada na base: a proposta tem `eventos`, mas salvar/listar a
apropriação ainda não persiste essa origem. O consumidor RH em desenvolvimento
também precisa transportar esses ids. Não declarar ponta a ponta enquanto
RPC/migration, produtor e consumidor não forem testados juntos.

## Ambiente e artefatos

Autorização histórica confirmada pelo usuário: conversa “Análise do Roadmap”,
13/10/2026 às 19:21 UTC, resposta “sim” limitada a A1–A5. O documento do commit
`3a5075a` preservava o pedido anterior à resposta; não era negativa posterior.
A1 Supabase isolado; A2 projeto Vercel separado; A3 URL no EAS preview;
A4 assinatura própria; A5 dois APKs para instalação/atualização.
Nenhum custo novo sem aprovação; estimativas não autorizam cobrança.
Não inclui main, produção, APKs antigos ou A6–A9. A referência histórica era
RC1; este candidato é posterior e precisa de testes próprios.

Recursos conferidos em 25/10/2026:

| Item | Estado verificado |
| --- | --- |
| Supabase | `ponto-homologacao`, `ukkzpttnbyylkyujzwnv`, ACTIVE_HEALTHY, sa-east-1 |
| Organização | ARCD, `hlptwhofcbsojiwbkhnd`, confirmada pelo usuário |
| Custo Supabase | Cotação de criação US$ 0/mês; nenhum plano pago contratado |
| Banco | Marcador `arcd_ambiente=homologacao`; migrations 016–018 e proteção persistente de autenticação aplicadas; sem seed ERP |
| Dados | Zero eventos, registros fiscais e dispositivos na verificação; 16 tabelas públicas com RLS |
| Storage | `ponto-obra`, privado |
| Vercel | Nenhum projeto de homologação criado; deploy pendente por decisão expressa do usuário: “Manter deploy pendente, sem custo” |
| API isolada | Ainda inexistente; URL Supabase não substitui `/api/data` |
| EAS | Conta `hygorf` acessível; ambiente preview sem variáveis; PONTO_API_URL ainda não configurada |
| Assinatura/APKs | Chave de homologação e dois APKs ainda pendentes; nenhum link de APK deste candidato |

O time Vercel consultado é `hygor-s-projects1`,
`team_poBZ5I1rwStzhvD73ar22b7v`. Nenhum upgrade ou contratação autorizado.
A sessão de aceite confirmou independentemente, somente por leitura, o banco
ativo, marcador, ausência de dados, RLS e bucket privado. Corrigido search_path
nas sete funções sinalizadas pelo advisor do banco isolado. Avisos restantes
“RLS sem policies” correspondem ao acesso exclusivo pelo backend service_role.
Não foram lidos nem publicados segredos. Nenhuma migration foi aplicada em produção.

Build iniciado pela sessão RH: `3150aa14-fe38-4074-a00e-b6b8582f8290`, origem
`c7d4e77`, perfil piloto, app 1.1.0, versionCode 4. Não é o candidato reconciliado
nem prova de homologação isolada. APKs históricos e4f41447/4f8b84c1 também não
servem para registros fictícios. Nenhum registro fiscal de teste em produção.

Bundle/prebuild locais podem usar `https://ponto-homologacao.invalid/api/data`
somente para verificar compilação. É domínio reservado sem backend: nunca
gerar/distribuir APK testável com ele ou registrar isso como integração remota.

## Recuperação e testes físicos

Novo pareamento recusa qualquer evento, foto pendente ou foto com problema,
antes de consumir o código. Banco ilegível conserva arquivo/chave/fotos e
encaminha ao suporte; não oferece recriar banco como recuperação comprovada.
Não há rotina de resgate/transferência de fila validada: pendência operacional.

Platform-tools oficial preparado localmente; `adb devices -l` retornou vazio.
Nenhum aparelho acessível para instalação nesta sessão. Galaxy A15 é alvo da matriz, não evidência de disponibilidade.
Manter os 18 cenários e H1–H6 pendentes até evidência do APK correto. H6 corrigido:
offline só último contato e última telemetria; quantidade atual desconhecida.

Próximo passo: receber contrato/persistência RH, rodar aceite conjunto e obter
endpoint com banco/Storage isolados. Então build EAS homologacao, verificar
SHA-256/pacote/certificado/permissões/endpoint/commit e testar atualização com
fila pendente. Sem isso, código verificado não equivale a APK liberado.

## Evidências locais do candidato (25/10/2026)

- App/lógica/dados/domínio: 270 testes aprovados em 28 arquivos.
- Servidor/migrations: 70 aprovados e 5 ignorados em 8 arquivos; ignorados não são aprovação.
- Expo doctor: 21/21 verificações aprovadas.
- Export Android: bundle Hermes e dois modelos TFLite presentes.
- Prebuild e verificar-prebuild: SQLCipher, backup desabilitado, permissões e autolinking aprovados.
- Essas compilações usaram endpoint reservado `.invalid`: não são integração remota nem APK.
- npm audit do app: 5 achados altos, nenhum crítico; transitivos node-forge e zod. Não aplicar downgrade Expo sugerido nem troca major cega. Auditoria não aprovada.
- Diretórios gerados android/dist-ci permanecem ignorados: limpeza recusada pela revisão automática; não contornada.

A ponte RH em desenvolvimento usa `attendance.mobileSource`, relê eventos e
apropriações sob locks e limita importação a jornadas confiáveis de obra única.
É alternativa distinta ao produtor v1 acima; não declarar que o consome.
Multiobra e revisões tardias exigem validação própria. A ausência de eventIds
na apropriação não determina sozinha a solução, mas a origem precisa ser
rastreável no caminho real e testada de ponta a ponta.

## Conciliação do commit de segurança RH

Incorporado `cff3f2858ee1725d00dac64afe97c6b7acc1d46e`: autorização biométrica
no servidor com PIN e limite persistente, relógio sem confiança presumida,
e fechamento dos bancos dos testes. A tela usa a proteção SecureStore desse
commit, que grava a tentativa antes da derivação; falha de leitura/gravação
impede entrada. Preservada a sessão com PIN apenas em memória, descartada ao
sair, por inatividade e ao desmontar; o cadastro envia essa credencial ao servidor.
A implementação SQLite anterior fica apenas como utilitário testado, sem uso
na autenticação da tela. Nenhum APK anterior usou este candidato conciliado.
