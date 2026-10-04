# Checklist manual em aparelho físico

Usar o APK gerado pelo `npm run mobile:release-check` + build EAS `piloto` do
mesmo commit. Anotar o resultado na [matriz de dispositivos](device-matrix.md).
Um item que falha = status "reprovado" com o motivo; não marcar "aprovado"
com item pulado.

## 1. Instalação e pareamento
- [ ] Instala sobre versão anterior sem perder batidas (se houver).
- [ ] Pareamento com código de 8 dígitos; código expirado mostra a mensagem certa.
- [ ] Diagnóstico mostra versão do app, versão REP, versionCode, commit e perfil do build.

## 2. Banco e segurança
- [ ] Diagnóstico → Aparelho: SQLCipher ativo.
- [ ] `adb backup` não leva o banco (allowBackup=false).
- [ ] Nenhum dado pessoal no `adb logcat` durante uma batida.

## 3. Reconhecimento
- [ ] Modelos carregam (Diagnóstico → Modelos), tempo de carga anotado.
- [ ] Cadastro guiado de 3 capturas conclui.
- [ ] 10 batidas da mesma pessoa: tempo mediano anotado (Diagnóstico → Desempenho).
- [ ] Pessoa não cadastrada não vira batida.
- [ ] Foto impressa e foto na tela de outro celular: registrar o resultado em docs/anti-spoof.md (sem imagem).

## 4. Offline, reboot e hora
- [ ] Modo avião: 20 batidas, comprovante "Salvo no aparelho".
- [ ] Fechar o app pelo gerenciador de tarefas e reabrir: as 20 continuam na fila.
- [ ] Reiniciar o aparelho: a próxima batida sai com hora sinalizada até sincronizar.
- [ ] Rede de volta: todas recebem NSR (Diagnóstico → REP-P).

## 5. Permissões
- [ ] Câmera negada de vez: tela leva às configurações; encarregado registra sem foto.
- [ ] GPS desligado: batida registrada sem localização.

## 6. Validação visual
- [ ] Ao sol, a 50 cm: status e botão legíveis.
- [ ] Fonte do sistema no maior tamanho: nada corta na tela de ponto e no comprovante.
- [ ] TalkBack lê o status e o botão de bater o ponto.
