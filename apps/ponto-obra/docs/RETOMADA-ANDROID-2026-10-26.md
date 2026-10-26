# Android — retomada de 26/10/2026

## Contexto recuperado pelo relato do usuário

O emulador anterior foi iniciado na sessão Linux remota do ChatGPT, não em um serviço público nem neste Windows. O usuário informou:

- Android Emulator 35.3.11, AVD `marcell-aosp28`, Android 9/API 28, x86_64, emulação por software sem KVM.
- Diretório remoto: `/tmp/hygor-android-toolchain/alternative/avd/marcell-aosp28.avd`. Não é um caminho desta máquina.
- APK de homologação 8, versão 1.1.1, instalado por atualização sobre o APK 7, sem desinstalar ou limpar dados. A abertura chegou a “Vincular aparelho”.
- Pareamento não concluído: o certificado do proxy provocou `Trust anchor for certification path not found`. Validação TLS não foi desativada.
- O emulador foi encerrado preservando seu disco naquela sessão remota. Corte/sobreposição no cabeçalho ainda exigia captura estável.

Esses resultados são **relato recuperado**, não execução ou verificação independente desta sessão. O patch, os APKs e as capturas originais não foram disponibilizados no Windows; não há hash que vincule o APK 8 à árvore refeita aqui.

## Verificado nesta sessão

- A API pública de homologação respondeu HTTP 200 a `ponto-ambiente`, confirmando `homologacao`.
- Bundle Hermes compilado com identidade MARCELL e fontes Nimbus locais. Um bundle não comprova instalação ou funcionamento nativo.
- Transporte agora distingue timeout, falha de sessão e resposta inválida. “Sem internet” não é inferido de qualquer exceção de fetch. A mudança melhora o diagnóstico; **não corrige nem contorna a cadeia de certificados do proxy remoto**.
- Não há SDK/ADB/emulador instalado ou aparelho USB acessível nesta execução. Nenhum pareamento, batida, sincronização, câmera ou GPS foi testado nativamente aqui.

## Próximo ensaio

1. Disponibilizar um novo emulador/aparelho acessível pela sessão de teste. O AVD remoto anterior não foi transferido.
2. Usar a API isolada, com cadeia TLS válida no dispositivo; não desativar validação HTTPS nem introduzir exceção de certificados na produção.
3. Compilar novo APK com `PONTO_VERSION_CODE=9` ou superior e a mesma assinatura de homologação. O APK 8 anterior tem outra origem; não reutilizar seu número como identificação desta recuperação.
4. Atualizar sem desinstalar/limpar dados, capturar o cabeçalho de forma estável e conferir corte, sobreposição e acessibilidade.
5. Concluir pareamento, registrar offline, reiniciar e sincronizar sem duplicar. Confirmar fila, NSR e dados no ambiente isolado.

Sem aprovação de piloto, conformidade REP-P ou promoção para produção nesta retomada.
