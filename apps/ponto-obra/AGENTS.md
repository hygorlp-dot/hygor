# Ponto de Obra — guia para agentes

App **Android** de registro de ponto (REP-P, Portaria MTP 671/2021) da ARCD:
um aparelho dedicado por obra, reconhecimento facial no próprio aparelho,
funcionamento offline e envio ao ARCD (`/api/data`, ações `ponto-*`).

## Expo mudou — não confie na memória

Projeto em **Expo SDK 57 / React Native 0.86 / React 19.2** (arquitetura nova
apenas). Antes de mexer em API do Expo/EAS/RN, leia a documentação da versão:
`https://docs.expo.dev/versions/v57.0.0/` e `https://docs.expo.dev/llms.txt`.
Exemplo real desta base: no SDK 57 `File.move()` é **assíncrono** — sem
`await`, o caminho guardado da foto apontava para o cache.

Não faça upgrade de major (Expo/RN) sem decisão explícita.

## Arquitetura real

- **Navegação: máquina de estados em `App.js`** (`carregando → parear | ponto ⇄
  encarregado`, mais `erro` e `revogado`). **Não há Expo Router** e ele não
  deve ser introduzido sem decisão arquitetural explícita.
- **Telas** em `src/telas/` (Pareamento, Ponto, Encarregado com Diagnóstico).
- **Lógica pura** (testada no Node) em `src/logica/`: batida (`terminal.js`),
  sincronização e fila (`sincronizacao.js`), contrato do armazém
  (`armazem-memoria.js`), rosto (`rosto.js`), **parâmetros de calibração
  facial** (`calibracao.js` — o único lugar com limiares), relatório de
  calibração, foto dentro do limite, falhas → mensagens, diagnóstico.
- **Banco local**: SQLite com **SQLCipher** (`expo-sqlite`, plugin
  `useSQLCipher`), chave aleatória no **SecureStore**. O SQL fica em
  `src/dados/armazem-sqlite-nucleo.js` (testado contra SQLite real);
  `armazem-sqlite.js` liga Expo, chave e arquivo.
  - **Nunca** use o `withExclusiveTransactionAsync` do expo-sqlite direto: ele
    abre conexão nova sem o `PRAGMA key` e o banco cifrado não abre. Use o
    `serializarBanco` (transação na mesma conexão, fila em JS).
- **Reconhecimento facial**: `react-native-fast-tflite` (Nitro,
  `react-native-nitro-modules`) com BlazeFace + MobileFaceNet em
  `assets/modelos/*.tflite` (Apache-2.0, ver `NOTICE`). Os modelos são
  carregados **pela cópia `file://` do `expo-asset`** (`{ url: asset.localUri }`)
  com SHA-256 conferido — `require()` direto vira recurso interno no APK e
  quebra (`MalformedURLException`). Há teste travando isso.
- **Módulo Kotlin local** `modules/relogio-confiavel` (autolinkado): relógio
  monotônico (`elapsedRealtime`) + `BOOT_COUNT` para a hora confiável, e
  `fixarNaTela()` (modo quiosque).
- **Regras compartilhadas com o servidor**: o app importa
  `../../src/domains/ponto-eletronico` (marcação, hash encadeado, relógio,
  contrato da foto). `metro.config.js` inclui essa pasta em `watchFolders`.
  Mudou regra ali? Ela vale para app **e** servidor.
- **CNG/EAS**: `android/` e `ios/` são gerados pelo prebuild e **não são
  versionados**. Configuração nativa só por `app.json`/`app.config.js` e
  plugins. Build na nuvem EAS (`eas.json`: `piloto` = APK interno,
  `producao` = AAB para a trilha interna da Play).

## Invariantes (não quebrar)

- Batida **nunca** é impedida por falta de internet, GPS, câmera, foto ou
  reconhecimento: sai sinalizada (`horaConfiavel=false`, `metodo=encarregado`,
  sem foto, sem GPS). A Portaria veda restringir a marcação.
- NSR sequencial por aparelho, hash encadeado, marcação append-only. Só
  batidas que **nunca saíram** do aparelho podem ser renumeradas
  (realinhamento), dentro de uma transação.
- Batida só sai da fila quando o servidor confirma um topo de cadeia que
  confere com o hash local. Foto só é apagada depois do OK do upload.
- Foto: JPEG ≤ `LIMITE_FOTO_BYTES` (contrato compartilhado); o SHA-256 da
  batida é o dos bytes exatos do arquivo que será enviado.

## Segurança e privacidade

- **Nenhum `console.*`** no app (há teste). Nunca registrar em log: vetor
  facial, foto, PIN, token do aparelho, CPF completo, chave do SQLCipher.
- Diagnóstico (modo Encarregado) tem lista fechada de campos sem dado
  pessoal/biométrico (`src/logica/diagnostico.js`).
- `android.allowBackup=false` (o banco cifrado não pode ir para a nuvem sem a
  chave). Permissões só câmera e localização.
- Texto do termo de consentimento (`TERMO_TEXTO`) é jurídico: não alterar sem
  decisão do responsável. Ver `docs/privacidade-e-retencao.md`.

## Comandos de validação (a partir de `apps/ponto-obra`)

```bash
npm ci                                  # instalação limpa
npx expo-doctor                         # versões do SDK, config, autolinking
npx expo export --platform android --output-dir dist-ci   # bundle Android
npx expo prebuild --platform android --no-install --clean # projeto nativo descartável
node scripts/verificar-prebuild.mjs     # SQLCipher, permissões, autolinking
```

Testes (rodam pelo Vitest da **raiz** do repositório):

```bash
npx vitest run apps/ponto-obra src/domains/ponto-eletronico server/ponto-eletronico
```

Depois do prebuild local, apague `android/` (não é versionado). A CI repete
tudo isso no job `mobile-ponto-obra` e **não** publica APK.

Use `npx expo install <pacote>` para dependências (versão compatível com o
SDK). Biblioteca com código nativo exige novo build (não roda no Expo Go).

## Build piloto

```bash
npx eas-cli build -p android --profile piloto
```
