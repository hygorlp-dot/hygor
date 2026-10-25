# APK de homologação sem custo de nuvem

O APK é compilado no computador com Expo e Gradle. Não usa fila EAS, assinatura paga, teste pago ou publicação na Play Store.

## Ambiente usado

- API: `https://ponto-homologacao.vercel.app/api/data`.
- Pacote Android: `br.com.arcd.pontoobra.homologacao`.
- Versão visível: `1.1.1`; primeiro `versionCode` desta entrega: `5`.
- Faixa no app: **HOMOLOGAÇÃO — NÃO OFICIAL**.
- A instalação tem banco e sessão próprios, separados da produção.

Antes de compilar e parear, o cliente pede `ponto-ambiente`. Só continua quando o backend responde `ok: true` e `ambiente: "homologacao"`. O backend confirma o marcador do banco isolado. A URL sozinha não comprova isolamento.

Toda chamada do APK informa `ambienteApp`. O catálogo recebido também deve confirmar o ambiente. Se o backend deixar de confirmar, o envio para e as batidas locais ficam guardadas. Funcionários já pareados continuam podendo registrar localmente. Um APK sem configuração não usa a produção como alternativa.

## Preparar o computador

Use as versões já adotadas pelo projeto: Node 22.13 ou superior, Expo SDK 57 e React Native 0.86. O lockfile fixa as dependências; não rode atualização geral.

O Android precisa de JDK 17, plataforma Android 36, Build Tools 36.0.0, NDK 27.1.12297006 e CMake 3.22.1. O módulo SQLCipher também solicita NDK 27.0.12077973. Gradle 9.3.1 vem do wrapper e o script confere seu SHA256 oficial.

Configure `JAVA_HOME` e `ANDROID_HOME` apontando para essas ferramentas. Em máquinas com proxy, configure o proxy e certificados do Java/Gradle. Não desligue a verificação TLS.

Na pasta `apps/ponto-obra`:

```sh
npm ci
```

## Criar a chave uma única vez

A chave deve ficar em pasta privada fora do repositório. Ela não deve ir para logs, commits, artifacts públicos ou junto com o APK. Guarde cópia protegida da pasta; sem a mesma chave não será possível atualizar uma instalação existente.

```sh
node scripts/criar-chave-homologacao.mjs /caminho/privado/ponto-homologacao
```

O script cria uma chave própria, não substitui uma chave existente e não mostra senhas. O arquivo `signing.json` e o keystore ficam com permissão `600`.

## Compilar o APK 5

```sh
export PONTO_AMBIENTE=homologacao
export PONTO_API_URL=https://ponto-homologacao.vercel.app/api/data
export PONTO_SIGNING_FILE=/caminho/privado/ponto-homologacao/signing.json
node scripts/build-apk-homologacao.mjs --version-code 5 --output /caminho/entrega
```

O script confirma o backend, gera o Android, verifica módulos e permissões, compila release, verifica assinatura e confere pacote/versão. As permissões também são verificadas no APK final, depois da inclusão das bibliotecas. Isso impede que uma dependência reintroduza uma permissão bloqueada, como `READ_PHONE_STATE`. Usa até dois workers Gradle; em computador com pouca memória, configure `PONTO_GRADLE_WORKERS=1`. O diretório `android/` é gerado e não entra no Git.

A saída contém o APK, o SHA256 e um JSON com versão, certificado público, endereço, commit, impressão digital dos arquivos e estado da árvore. O JSON informa se havia alterações locais: não atribui essas mudanças a um commit que ainda não as contém. A chave privada nunca entra nessa saída.

## Compilar a atualização 7

Os builds 5 e 6 foram compilados antes da remoção da permissão de estado do telefone trazida pela biblioteca LiteRT. O build 7 incorpora esse bloqueio sem mudar o fluxo de captura.

Reutilize o mesmo `PONTO_SIGNING_FILE` e o mesmo endpoint:

```sh
node scripts/build-apk-homologacao.mjs --version-code 7 \
  --anterior /caminho/entrega/ponto-obra-homologacao-5.json \
  --output /caminho/entrega
```

O script exige o mesmo pacote, o mesmo certificado e um `versionCode` maior. Isso demonstra compatibilidade de assinatura; o teste de atualização no Android precisa ser feito separadamente.

## Resultado desta entrega — 25/10/2026

O APK final é `ponto-obra-homologacao-7.apk`, com 121.489.302 bytes e SHA256 `2a7b20d2329b731b8ac5c3aef19386fde07208a8ee8d1737fad0bf2c1c856014`. Foi compilado localmente, sem uso de build em nuvem. O APK 5 fica disponível somente para ensaiar a atualização.

As verificações do arquivo final confirmaram assinatura própria de homologação, pacote separado, versão 7, endpoint isolado, modelos faciais e ausência de `READ_PHONE_STATE`. Os APKs 5 e 7 têm o mesmo certificado e o mesmo pacote; o bundle JavaScript e as bibliotecas nativas são idênticos entre eles. A mudança no 7 remove a permissão desnecessária.

O manifesto `fontes-moveis-7.json` confere 63 arquivos, incluindo as dependências fixadas, com `fontesSha256` igual a `316884caba0bca7dc1676f0ce3322e0e40fcbdd41aad1d17fcc3a072781b1dc7`. O grafo do Metro registra 793 módulos e 36 fontes locais comparadas, sem divergência. O build foi feito sobre o commit-base com alterações locais; esses hashes vinculam o APK às fontes efetivamente compiladas. A associação a um commit posterior deve repetir essa conferência.

### Limite da verificação em emulador

O computador de compilação não oferece `/dev/kvm`. Foram tentadas imagens oficiais Android 35 e AOSP Android 30 com emulação por software e recursos limitados. O Android 35 não manteve os serviços do sistema prontos para a instalação. No AOSP 30, `sys.boot_completed` chegou a `1` às 20:49 UTC, mas o próprio `system_server` e o serviço de rede falharam em seguida. O instalador terminou às 20:50:44 UTC com `Can't find service: package`.

O emulador foi encerrado às 20:51 UTC. O aplicativo não chegou a abrir; nenhum pareamento ou ponto foi criado por esse ensaio. A evidência detalhada está em `teste-emulador-5-7.json`, junto dos arquivos de entrega. Esse resultado limita o teste neste computador e não comprova um defeito de execução do APK, que não chegou a ser instalado.

**Ainda falta executar em Android estável:** instalação e abertura, pareamento, batida offline, fechamento e reabertura, atualização 5→7 preservando dados, sincronização única, câmera e GPS. A compatibilidade da assinatura está comprovada; a atualização instalada e a persistência da fila ainda dependem desse ensaio. O roteiro abaixo deve ser cumprido antes de usar o app na obra real.

## Conferir no Android

1. Instale o APK 5. Confira a faixa de homologação e a versão.
2. Gere o código de pareamento na obra de simulação e vincule o aparelho.
3. Confira Fulano e Siclano no catálogo. Use identificação pelo encarregado; biometria não é obrigatória.
4. Desligue a internet, registre a batida e feche/abra o app. O registro deve continuar pendente.
5. Instale o APK 7 por atualização, sem desinstalar e sem limpar dados. O pareamento e a batida pendente devem continuar presentes.
6. Religue a internet. A mesma batida deve sincronizar uma única vez e aparecer no painel da obra correta.
7. Confira as permissões negadas: câmera/GPS indisponíveis devem deixar a alternativa pelo encarregado funcionar.

Com ADB, a atualização é `adb install -r ponto-obra-homologacao-7.apk`. A instalação real, reinício, fila offline, câmera e identificação precisam de evidência própria; build e testes de JavaScript não substituem esses resultados.

## Vincular o APK às fontes revisadas

O JSON do build distingue o commit-base das alterações locais. Para comparar as fontes móveis com um commit posterior que as incorpore, gere e confira um manifesto dos arquivos reais:

```sh
node scripts/conferir-fontes-apk.mjs --saida /caminho/entrega/fontes-moveis-7.json
node scripts/conferir-fontes-apk.mjs --conferir /caminho/entrega/fontes-moveis-7.json
```

Esse manifesto registra hashes de runtime, configuração, módulos nativos, recursos e lockfiles. A revisão do commit precisa confirmar esses mesmos arquivos; mudar apenas a etiqueta do commit no relatório não comprova a origem do APK.

Não execute `mobile:release-check` junto com uma compilação: essa verificação apaga o Android temporário. A verificação de qualidade usa um domínio `.invalid` quando não recebe endpoint; ela não gera um APK distribuível. O script de APK recusa esse domínio.

## Referências oficiais

- [Build local de produção Expo](https://docs.expo.dev/guides/local-app-production/).
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/).
- [Assinatura e atualização Android](https://developer.android.com/studio/publish/app-signing).
- [Emulador e instalação por ADB](https://developer.android.com/studio/run/emulator-commandline).

EAS continua disponível para uso futuro, mas não foi necessário para este caminho. O perfil `homologacao` exige endpoint explícito. O perfil `producao` mantém o pacote de produção e não deve receber dados de simulação.
