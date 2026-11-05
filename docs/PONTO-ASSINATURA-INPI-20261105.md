# Adequação REP-P e assinatura - implementação local

Data: 05/11/2026. Complementa PONTO-FISCAL-LOCAL-20261105.md.
Sem push, deploy, migração, consulta a produção ou alteração no APK18.
Não declara conformidade integral nem registro no INPI.

## Identificação e limites

A empresa desenvolvedora pode ser a própria usuária. O usuário forneceu
o comprovante de CNPJ; a identificação do desenvolvedor foi preparada em
arquivo privado fora do Git, com hash da fonte documental e INPI nulo.
O empregador continua vindo de cada estabelecimento original. Não trocar
CNPJ de batidas anteriores, não retroagir cadastro e não refazer cadeias.
A informação documental não comprova por si só a titularidade do código.

## Funcionalidades implementadas

- Consulta autenticada de prontidão por estabelecimento, somente RH/admin
  sem restrição por obra, com os mesmos controles da exportação fiscal.
- Verificar requisitos fiscais na área Estabelecimento fiscal e nos detalhes
  de batidas com estabelecimento. Emissão do PDF só após configuração privada
  e gates de formalização, dados completos e assinatura.
- Emissão fiscal separada dos rascunhos. Nenhuma falha retorna rascunho como
  documento autenticado. O manifesto distingue assinatura validada de
  conformidade global, que permanece falsa.
- Worker Python pyHanko 0.38.1: PAdES PDF, CAdES separado para AFD/AEJ;
  confere hash do arquivo, assinatura, cobertura integral, raiz pinada,
  validade, identificação do desenvolvedor no certificado e revogação.
- Produção usa validação de revogação hard-fail. Certificado sintético exige
  modo de teste explícito; retorna icpBrasil=false e é recusado pela emissão.
- Configuração sensível fica em ambiente e arquivo privados, não no ERP,
  body de API, PDF, repositório ou WhatsApp. O adaptador local não é executável
  dentro da função Node da Vercel; a publicação exige hospedar/configurar um
  worker privado compatível e validá-lo, não copiar o Python para a função.
- O servidor lê metadados de PONTO_FISCAL_CONFIG_JSON, sem valores padrão de
  CNPJ/INPI. Serviços de renderer/assinatura são injetados no servidor; nunca
  recebidos do cliente. Na ausência deles, não existe emissão assinada.
- Worker HTTP privado em scripts/ponto-assinatura/worker.py, ligado pelo
  adaptador servico-http.js. Autenticação por segredo, escuta apenas loopback,
  limite de documento, mensagens de erro sem segredos, redirecionamentos
  proibidos e HTTPS obrigatório no cliente de produção. Renderer de servidor
  usa ReportLab/Helvetica, layout A4 e marca MARCELL; logoArquivo permite usar
  o logo local do mesmo kit. Não carrega URLs de imagens ou fontes do cliente.
- Extensão canônica opt-in versaoCaptura=1 protege offline no hash de eventos
  futuros. Continua aceitando eventos antigos sem alterar sua canonicalização.
  Dado antigo ausente/desprotegido impede emissão oficial: não presumir captura.
- Endereço/CNO específico da obra pode ser informado em locaisPorObra;
  emissão assinada de comprovante exige local da obra identificada no evento.

## Configuração privada da assinatura

Instalar em worker privado: pip install -r scripts/ponto-assinatura/requirements.txt.
Não usar certificados reais para os testes unitários. Não importar chave do APK.

Arquivo privado, sem versionamento (exemplo de estrutura, não cadastro):

```json
{
  "modo": "producao",
  "pkcs12": "CAMINHO_PRIVADO_DO_CERTIFICADO_A1",
  "senhaEnv": "MARCELL_CERTIFICADO_SENHA",
  "certificadoSha256": "SHA256_REAL_DO_CERTIFICADO_DER",
  "raizesPem": ["CAMINHO_DA_RAIZ_ICP_BRASIL_CONFERIDA"],
  "raizesSha256": ["SHA256_REAL_DA_RAIZ_DER"],
  "desenvolvedor": {"tipo": "cnpj", "numero": "CNPJ_REAL_DO_DESENVOLVEDOR"}
}
```

A raiz deve ser obtida do ITI e conferida por canal independente. Não promover
uma CA local a ICP-Brasil mudando nome ou configuração. O certificado deve ser
do desenvolvedor identificado: certificado de outro CNPJ bloqueia a operação.
Certificado A3/token/HSM não é suportado pelo adaptador PKCS#12 desta etapa;
exige adaptador específico. Não é necessário enviar a senha ao desenvolvedor
nem ao chat para configurar um cofre de segredos na implantação.

Definir PONTO_ASSINATURA_CONFIG (caminho do JSON privado),
PONTO_ASSINATURA_PYTHON (Python absoluto do worker) e a variável de senha
indicada pelo arquivo. O CLI não lê .env automaticamente.

O titular pode preparar o certificado no próprio terminal:

```text
python scripts/ponto-assinatura/configurar_certificado.py --cadastro-desenvolvedor CAMINHO_PRIVADO_DO_CADASTRO --saida NOVO_JSON_PRIVADO
```

A senha é solicitada sem eco e não é gravada. O helper confere validade,
política ICP-Brasil e CPF/CNPJ antes de escrever a configuração sem senha.
As raízes confiáveis continuam vazias até conferência independente.

No Windows local existe suporte opcional a senhaDpapi: arquivo cifrado por
DPAPI CurrentUser, vinculado à mesma conta e computador, com contexto do
MARCELL. Não é texto simples e não pode ser transferido para worker Linux
ou Vercel. O titular escolhe se deseja persistir o segredo cifrado; sem essa
escolha, a senha continua dependendo do ambiente privado do worker.
Testes Windows verificam abertura e recusa de blob adulterado. Nunca publicar
o PFX ou arquivo DPAPI. A cópia local de configuração fica fora do Git e
do OneDrive, com ACL exclusiva do usuário e SYSTEM; o original é preservado.

Para integração do ERP, configurar o worker privado por trás de HTTPS e definir
PONTO_FISCAL_WORKER_URL e PONTO_FISCAL_WORKER_TOKEN no servidor. O mesmo segredo
de pelo menos 32 caracteres vai no worker; configurar certificado/senha somente
nele. Iniciar com python scripts/ponto-assinatura/worker.py. Não abrir a porta
3095 ao público. O cliente exige HTTPS em produção; HTTP só é permitido em
loopback com NODE_ENV diferente de production e PONTO_FISCAL_WORKER_LOCAL=1.
Não executar build/deploy ou criar serviço pago para testar esta configuração.

```text
npm run ponto:fiscal:assinado -- --entrada snapshot.json --saida PASTA_NOVA --tipo comprovante --de AAAA-MM-DD --ate AAAA-MM-DD --evento UUID_REAL
npm run ponto:fiscal:assinado -- --entrada snapshot.json --saida OUTRA_PASTA_NOVA --tipo afd --de AAAA-MM-DD --ate AAAA-MM-DD
```

Metadados fiscais do snapshot exigem: rep.inpi, rep.desenvolvedor, certificado
documentado em registroInpi (numero, sha256, responsavel, conferidoEm),
atestadoTecnico (sha256, responsavel, conferidoEm), locaisPorObra[obraId].endereco
e histórico administrativo comprovado. Evidência informada é um registro de
conferência administrativa, não verificação automática no INPI ou do atestado.
O atestado precisa de assinaturas dos responsáveis técnico e legal.

## Preparação para INPI

```text
npm run ponto:inpi:preparar -- --nome NOME_DO_PROGRAMA --versao VERSAO_CONGELADA --saida PASTA_NOVA
```

Produz material técnico determinístico, hashes individuais e SHA-512 do conjunto
de fontes do escopo declarado. Inclui alterações locais; não confundir com hash
do commit ou do APK. Não efetua pedido no e-Software, não paga GRU e não gera
certificado. Conservar exatamente o material congelado e revisar autoria,
titularidade, dependências/licenças e escopo antes de assinar a declaração.
Gerar novamente após qualquer alteração no código. Não anexar fonte ou chave
privada indiscriminadamente a um pedido de registro.

## Pendências que impedem declarar o aplicativo pronto para uso REP-P

1. Registro real do programa no INPI (usuário informou que ainda não possui).
2. Confirmar tipo A1 e titularidade do certificado disponível; configurar
   cofre/worker e validar a cadeia ICP-Brasil e revogação com o certificado real.
3. Atestado Técnico e Termo de Responsabilidade dos responsáveis reais.
4. Implantação e ensaio do worker privado e configuração fiscal real (o código
   de integração está implementado; o serviço não foi publicado nem configurado
   com certificado real).
5. Portal ou outro acesso individual e entrega após cada marcação, com extração
   das últimas 48 horas independentemente de WhatsApp. A tela atual de RH não
   substitui esse acesso e o worker não publica PDFs em URLs abertas.
6. Histórico administrativo fiscal completo, com NSR, que não pode ser
   reconstruído por suposição nem liberado apenas preenchendo uma flag.
7. APK18 não envia a extensão de captura protegida. Uma versão futura do coletor
   deve gerar esses campos no instante da batida, exibir relógio com segundos e
   ser testada em captura online/offline. Nenhum APK foi alterado ou compilado.
8. Ensaio operacional da HLB, retenção, restauração, redundância e disponibilidade.

Um hash ou número no PDF não substitui essas condições. Um PDF com assinatura
criptográfica de teste não equivale a documento autenticado por ICP-Brasil.
Arquivos legados sem informação suficiente permanecem preservados e pendentes.

## Referências primárias

- [Portaria 671 compilada, arts. 79-91 e Anexo IX](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/legislacao/portarias-1/portarias-vigentes-3/WORDPortarian671de8denovembrode2021compilada21.07.2026.pdf)
- [Perguntas e respostas do MTE, inclusive desenvolvedor que usa seu REP](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/Perguntas%20e%20Respostas%20REP)
- [Registro de software no INPI](https://www.gov.br/inpi/pt-br/assuntos/programas-de-computador)
- [Assinatura pyHanko](https://docs.pyhanko.eu/en/latest/lib-guide/signing.html)

## Validação

Testes Node de bloqueios, autorização, integridade, preservação dos dados e
interface; testes Python reais com CA efêmera para PAdES/CAdES, adulteração,
titularidade, expiração, CA não autorizada e recusa de teste em produção.
Resultados finais da execução são registrados no encerramento da tarefa.

Evidência local desta execução:

- Regressão ampliada: 545 testes Node aprovados, cinco ignorados por dependerem
  de PostgreSQL externo. Checagem final após ajustes do handler: 78 testes
  direcionados aprovados (sobrepõem-se à regressão; não somar os totais).
- Onze testes Python aprovados, incluindo criptografia e HTTP privado.
- Lint, manual, arquitetura, sintaxe e build Vite aprovados, sem prebuild nem
  migrações. Build final registrado em ponto-assinatura-build-20261105.log.
- Interface em 1366x900 e 390x844: consulta e bloqueio de PDF sem requisitos,
  sem transbordamento. Capturas locais em tmp/ponto-fiscal.
- Dois renderizadores PDF conferidos em PNG. Demonstração PAdES de uma página,
  assinatura íntegra e cobertura integral, icpBrasil=false explicitamente.
- CLI sem INPI: saída bloqueada com FORMALIZACAO_FISCAL_PENDENTE, sem publicar
  PDF/arquivo ou diretório de saída.
- Material para revisão do INPI: 1646 fontes; SHA-512 do material conferido
  independentemente. Escopo preparação-local, nenhum pedido enviado.
- APK18: SHA-256 c44704a3be2cd3a98f82f9a09009ad68a7b3bc1251a9dde4bba113ac30a64e51
  preservado. Na validação inicial foi usado apenas certificado sintético.

Os logs de lint, build, arquitetura e regressão ficam em C:/Users/hygor com
prefixo ponto-assinatura- e data 20261105. Nada foi publicado.

## Configuração posterior do certificado real

O usuário forneceu o caminho do A1 e digitou a senha em janela local nativa,
sem enviá-la pelo chat. Identificação do desenvolvedor, validade, cadeia de
confiança e revogação foram verificadas com sucesso. As raízes v5/v12/v13
vieram por HTTPS do repositório AC-Raiz referenciado pelo portal do ITI, com
hashes fixados na configuração privada. Nenhuma raiz foi instalada no sistema.

O PFX foi copiado para pasta privada fora do OneDrive/Git, com ACL do usuário
atual e SYSTEM, preservando o original. Não foi importado no repositório de
certificados do Windows. O titular não marcou o armazenamento da senha;
portanto ela não foi persistida. O worker de assinatura automática precisa
receber o segredo pelo ambiente privado quando for iniciado. INPI permanece
pendente e emissão oficial bloqueada. Não se assinou documento real nem se
efetuou pedido no e-Software nesta configuração.

Validação após adicionar suporte DPAPI: 13 testes Python aprovados, incluindo
proteção do segredo no Windows e recusa de blob adulterado. O material técnico
preparatório anterior ao suporte DPAPI não representa a última revisão: deve
ser congelado novamente após conclusão do escopo, antes de qualquer depósito.

## Entrega e acesso individual — complemento validado localmente

O worker possui cofre SQLite privado e persistente. Antes de armazenar um PDF,
valida novamente sua assinatura ICP-Brasil; o acervo confere SHA-256 na leitura
e impede substituir um comprovante existente por bytes diferentes. O manifesto
vincula empresa, trabalhador, evento, estabelecimento, NSR e instante original.

O RH pode criar acesso individual, revogar e confirmar o número do WhatsApp.
O código pessoal tem 256 bits de aleatoriedade; guarda-se apenas seu hash,
com expiração de 90 dias. A página /meu-ponto não lê o cadastro operacional.
O segredo chega no fragmento do endereço, é retirado da barra, permanece só
na memória e não é incluído em query string, cookies ou armazenamento local.
Cada pessoa consulta apenas seu acervo, com paginação e download de PDF.
O acesso não exige aprovação por comprovante; requer entrega inicial segura.

Processador separado do worker consulta novas entradas pela sequência fiscal,
inclusive marcações antigas recebidas tardiamente. Persiste cursor e pendências,
repete falhas de emissão após cinco minutos e não bloqueia o recebimento das
batidas. Nenhuma escrita em tabelas do ERP foi adicionada neste fluxo.

WhatsApp usa WAHA /api/sendFile com arquivo base64 e resolução de destinatário.
Exige número confirmado pelo RH e habilitação explícita do administrador.
A reserva do envio é persistida antes do POST; timeout fica como incerto e
nunca é repetido automaticamente. Aceito pelo provedor não significa lido.
Não houve envio real de PDF ou ativação automática nesta validação.

### Implantação privada, ainda não realizada

No JSON privado do assinador, informar cofreArquivo com caminho absoluto fora
do Git/OneDrive, protegido por ACL do usuário do serviço e SYSTEM no Windows,
ou diretório 0700 e arquivo 0600 em Linux. Usar volume persistente e backup
consistente do SQLite, incluindo restauração ensaiada. Não copiar o arquivo
WAL isoladamente nem expor o banco ou a porta do worker à internet.

Adicionar automacao com companyId do ambiente, estabelecimentos como lista
dos IDs reais e apiUrl HTTPS terminada em /api/data. Não inventar IDs.
PONTO_FISCAL_AUTOMACAO_TOKEN é segredo distinto do token do worker, com pelo
menos 32 caracteres, compartilhado apenas pelo backend e processador.
Executar python scripts/ponto-assinatura/processador.py --uma-vez para uma
rodada deliberada; sem a opção, consulta a cada 15 segundos. Não executar
contra produção durante revisão local. Emissão depende dos gates fiscais.

Para WhatsApp, automacao.wahaUrl e automacao.wahaSessao identificam o serviço
privado já pareado. PONTO_WHATSAPP_API_KEY vai no ambiente privado e
PONTO_WHATSAPP_HABILITADO=1 habilita envios somente a contatos confirmados.
Sem essa variável não há envio. Não se contratou serviço pago.

### Limites que permanecem reais

O INPI e o atestado técnico com responsáveis reais continuam pendentes.
O titular não persistiu a senha do A1: assinatura desassistida ainda depende
de fornecer o segredo ao processo privado. O coletor APK18 permanece intacto;
não possui a extensão protegida de modo de captura desta implementação.
Registros antigos não recebem dados inferidos, e o histórico administrativo
fiscal integral não é reconstruído. Não foi executada homologação formal,
validação de alta disponibilidade nem ensaio ponta a ponta em produção.
O código local inclui fluxo de entrega; isso não é evidência de serviço
implantado nem autoriza marcar requisitos como cumpridos sem validação real.
