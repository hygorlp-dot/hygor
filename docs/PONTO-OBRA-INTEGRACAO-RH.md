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

## Contrato v1 — importação inicial integrada localmente

`produzirPublicacaoRh(entrada, sha256)` em `src/domains/ponto-eletronico/publicacao-rh.js`.
Preserva empresa, funcionário, data operacional, fuso, revisão, versão do
tratamento, eventos com aparelho/estabelecimento/NSR e intervalos completos
com obra apropriada, duração e eventIds. Captura e custo são campos distintos.
Não gera salários, faltas ou quatro horários artificiais. Terceiros são recusados.

`publicacaoId` é estável para empresa/pessoa/dia/eventIds/revisão; `conteudoHash`
detecta tentativa de reutilizar a mesma revisão com conteúdo diferente.
A ponte RH `5e96e4b` foi incorporada em `2503e48`; a publicação v1 em `c6956a8`.
O leitor SQL relê eventos, ARP, estabelecimento e apropriações sob os locks
existentes. O importador associa cada par de eventos ao intervalo conferido e
persiste a publicação em `attendance.mobileSource.publicacao`, com reviewer e
versões das apropriações. NSR ausente, fuso divergente, fonte alterada ou período
fechado impedem importação. Presença, horas extras e atraso são decisões explícitas.
A revisão 1 representa somente a primeira importação; o importador recusa dia
já lançado. Repetir a operação retorna o recibo anterior, inclusive após fechar.

Teste independente confirmou app → ARP PGlite → leitor SQL real → consumidor →
publicação e origem preservadas. Aprovação de título e pagamento parcial foram
exercitados em domínio em memória, sem comprovar persistência financeira remota.
Capturas 23:59/00:01 entram em dias separados e continuam pendentes sem par.
Multiobra mantém os intervalos e exige tratamento; não gera presença duplicada.

Limites: não há livro permanente de todas as revisões/publicações, nem fluxo de
republicação retroativa. O recibo operacional e o bloqueio do dia existente não
substituem esse livro. Não declarar integração completa para multiobra,
meia-noite, revisões tardias ou reprocessamento histórico após alterações manuais.

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
| Assinatura/APKs | Chave própria criada localmente, ainda não vinculada ao EAS; dois APKs pendentes, sem links |

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

Próximo passo: resolver os limites de revisão acima e obter
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

## Conciliação do commit de segurança RH

Incorporado `cff3f2858ee1725d00dac64afe97c6b7acc1d46e`: autorização biométrica
no servidor com PIN e limite persistente, relógio sem confiança presumida,
e fechamento dos bancos dos testes. A tela usa a proteção SecureStore desse
commit, que grava a tentativa antes da derivação; falha de leitura/gravação
impede entrada. Preservada a sessão com PIN apenas em memória, descartada ao
sair, por inatividade e ao desmontar; o cadastro envia essa credencial ao servidor.
A implementação SQLite anterior fica apenas como utilitário testado, sem uso
na autenticação da tela. Nenhum APK anterior usou este candidato conciliado.

## Candidato atual e entrega

Base reconciliada na branch local `codex/ponto-android-candidato`; código RH
`5e96e4b`, segurança RH `cff3f2`, publicação `c6956a8`, limites de pareamento
`e2f6758`, perfil no scorecard `1548bd4`, runtime sem fallback `d22f0af`.
Teste de aceite independente fornecido no commit `3814362`, incorporado somente
nos dois arquivos de teste/fixture, sem substituir os documentos de outra sessão.

Não foi feito push nem criado PR nesta sessão: o repositório dispara preview
Vercel automaticamente, e o usuário manteve deploy pendente sem custo. O preview
automático da PR RH #119 pertence ao projeto mrc; não é a API isolada autorizada.
A revisão do candidato pode ser feita no worktree local, sem publicar.

O release-check rápido executa testes e scorecard, mas omite doctor/bundle/prebuild;
portanto seus gates nativos ficam não verificados e a liberação permanece bloqueada.
O perfil antigo piloto foi corrigido no scorecard para homologacao/preview.
Bundle conciliado exportado com sucesso em dist-candidato; não é APK.
As evidências locais e os testes independentes não autorizam uso operacional,
nem comprovam conformidade REP-P. Matriz física continua pendente.

A4 preparado: chave RSA 2048, alias `ponto-homologacao`, destinada ao pacote
`br.com.arcd.pontoobra.homologacao`; arquivo fora do repositório em
`C:/Users/hygor/.codex/private/ponto-homologacao/ponto-homologacao.jks`.
Pasta com ACL restrita; senha protegida pelo DPAPI do usuário Windows em
`password.dpapi` (não é backup portátil). Não foi enviada ao EAS.
Certificado SHA-256 público:
`27:C5:69:BC:B1:61:3A:33:3A:B5:47:BE:71:60:19:76:A0:03:A0:48:EC:2B:AD:FC:07:2D:C2:70:54:D2:94:B3`.
Nenhuma chave de produção reutilizada. Guardar esse material para assinar ambos
os APKs e comprovar atualização com a mesma identidade; teste ainda pendente.

Os números zero do banco acima são a fotografia da verificação inicial.
A sessão RH comunicou autorização humana em seu chat para preparar Fulano e
Siclano no banco isolado; não confundir ausência inicial com estado após o preparo.
Lint e build web passaram no candidato conciliado. Aceite incorporado: 6/6.
