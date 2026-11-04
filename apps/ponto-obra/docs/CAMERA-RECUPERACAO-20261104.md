# Recuperação da câmera do piloto Android

Escopo: correção local em `codex/ponto-camera-flicker-20261104`, checkout `C:/dev/releases/ponto-camera-flicker-20261104`, sobre `402e400d` da branch `release/ponto-h204-piloto-producao-d9`. Essa branch contém o terminal autônomo com os textos presentes no vídeo e no APK 17 disponível no computador. Não usar essa base antiga para publicar o site ERP. A versão efetivamente instalada e o modelo do aparelho ainda precisam de confirmação do usuário.

## Evidência e reprodução

O vídeo mostra alternância entre a câmera e Pronto para registrar, sem comprovante. A revisão encontrou dois problemas reproduzíveis na lógica do piloto: qualquer mudança transitória de AppState desligava imediatamente a câmera antes da captura; `takePictureAsync` era aguardado sem prazo tanto no facial quanto no registro por encarregado.

O teste `camera-lifecycle.test.js` executa os hooks e callbacks reais da TelaPonto, omitindo apenas o JSX e substituindo os módulos nativos por câmeras/relógio controlados. Antes da correção, duas verificações falharam: a câmera era desmontada em uma interrupção de 100 ms e a captura pendurada permanecia em Analisando. Também foi reproduzido o adiamento indefinido da captura por interrupções curtas repetidas. Esses ensaios demonstram caminhos compatíveis com o sintoma; não substituem logs ou teste no aparelho do vídeo.

## Correção

- Pequenas interrupções recebem uma margem de 500 ms antes de desmontar a preview. Não há captura enquanto AppState estiver fora de active.
- Ao voltar de uma interrupção curta, a câmera já pronta é reutilizada e espera somente o restante dos 750 ms de enquadramento. Interrupções repetidas não reiniciam essa espera inteira.
- Background persistente desliga a câmera. Ao voltar dessa suspensão, exige-se um novo onCameraReady.
- O estado da tentativa é atualizado de forma síncrona no ref, evitando duas entradas concorrentes na captura. Falha ou comprovante concluído não são rearmados por uma oscilação transitória do Android.
- A espera da foto é limitada a oito segundos. Falha facial exige nova tentativa ou identificação pelo encarregado; não se cria batida facial sem identificação válida. A identificação autorizada pelo responsável pode seguir sem foto, como já previa o fluxo existente.
- Imagem recebida depois do prazo é descartada; não é analisada nem reutilizada para gerar outra batida.

Não mudam modelos, vetores, limiares biométricos, prova de identificação, PIN, criptografia, pareamento, fila, registro fiscal, NSR, sincronização ou pagamentos. Nenhum dado de produção foi lido ou gravado para estes ensaios.

## Validação e entrega

Logs de reprodução: `C:/Users/hygor/ponto-camera-red.log` e `ponto-camera-starvation-red.log`. Testes focais: `ponto-camera-focused.log` e `ponto-camera-starvation-green.log`. A suíte móvel e a sintaxe JSX são verificadas novamente na entrega. O checklist físico foi atualizado.

Entrega local: 244 testes aprovados em 25 arquivos (`C:/Users/hygor/ponto-camera-delivery-tests.log`), incluindo oito cenários dos hooks reais de câmera e três do prazo da foto. As duas telas alteradas passaram pelo parser JSX, e o lint da base passou (`ponto-camera-delivery-lint.log`). Não houve bundle nativo, emulador ou validação com CameraX e hardware real nesta sessão.

Esta alteração ainda não chegou ao aparelho: sem novo APK compilado, instalado ou teste físico. Não houve push, build remoto, deploy da Vercel ou alteração do APK 17 original. Uma publicação do site não atualiza esse código Android.

Para atualizar a instalação preservando o banco local, é necessário manter pacote e certificado de assinatura. O workflow histórico do APK 17 gera uma chave efêmera no runner; portanto não se deve pressupor que uma chave nova permita atualizar a instalação atual. O material de assinatura original precisa ser confirmado antes de produzir uma atualização instalável. Não remover a instalação nem limpar seus dados para contornar a assinatura.

## Entrega paralela autorizada — APK 18

O usuário confirmou Samsung SM-A057M, Android 15, APK 17 (1.1.2), sequência local 38. O SHA256 do arquivo original é 8299637650527347e90fbd7592b38c423ea859c1b4de810fe2cd4c5da9c8ebfa, igual ao build 40598263505 de 402e400d. A chave efêmera original não foi localizada.

Foi autorizada uma instalação ao lado da atual, com novo pareamento. Configuração: pacote br.com.arcd.pontoobra.piloto.h204fix, versão 1.1.3 (18), nome MARCELL Ponto · Câmera corrigida, produção no endpoint existente. Não desinstalar APK 17 nem limpar seu armazenamento. Não migrar ou reescrever sua cadeia local de batidas.

A chave nova foi criada e guardada fora do repositório, em diretório privado com ACL exclusiva do usuário, e configurada em segredos do GitHub Actions. Ela deve ser preservada para atualizar o APK 18 futuramente. O workflow específico não exporta chave ou senha nos artefatos. A branch de compilação é build/ponto-h204-camera-fix-apk18; o deploy Vercel está desabilitado nessa branch e a suíte web geral não é disparada. A compilação móvel executa os 244 testes e as verificações nativas do script existente.

Antes do build: 244 testes em 25 arquivos aprovados novamente (ponto-camera-apk18-tests.log), configuração do novo pacote validada, actionlint e git diff --check aprovados. Compilação e teste físico ainda pendentes neste checkpoint. Nenhuma operação em pagamentos, ponto de produção ou pareamento foi executada.

Limite da suíte ERP: o hook genérico tentou rodar todos os testes do site nesta base de outubro. Após cerca de seis minutos, oito workers próprios continuavam consumindo CPU sem concluir; a execução foi encerrada, sem tocar nos testes de outras conversas. Lint e fronteiras arquiteturais haviam passado, mas não se afirma aprovação da suíte ERP nem de seu build. Para a branch exclusivamente móvel, com deploy web bloqueado, usa-se a suíte completa Android (244 testes já aprovados), repetida no workflow nativo. O push de compilação dispensa somente esse hook genérico; não dispensa testes móveis, validação de assinatura, pacote, modelos, permissões ou endpoint.
