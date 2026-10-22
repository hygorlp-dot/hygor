# Auditoria de segurança do aparelho - Ponto de Obra

Rodada de evolução de out/2026. Cada item diz **o que o código faz hoje**, **como
foi verificado** e o que fica pendente. Nada aqui foi verificado em aparelho
físico (ver [device-matrix.md](device-matrix.md)); o que depende de aparelho
está marcado.

| # | item | situação | como foi verificado | severidade do que falta |
|---|---|---|---|---|
| 1 | SQLCipher | banco local cifrado (`useSQLCipher: true`); chave aleatória de 32 bytes (`expo-crypto`) | `verificar-prebuild.mjs` (gradle.properties) + teste "transação do banco na conexão que tem a chave" | conferir `cipher_version` no aparelho (checklist) |
| 2 | SecureStore | guarda só a chave do banco e a sessão do pareamento (token do aparelho); nunca PIN, CPF ou vetor | leitura de `armazem-sqlite.js` e `conexao.js` | - |
| 3 | Backup | `allowBackup=false` no manifesto gerado: banco, fotos e SecureStore não vão para backup do Google | prebuild + `verificar-prebuild.mjs` | - |
| 4 | Screenshot | **sem `FLAG_SECURE`**: dá para tirar screenshot e a tela aparece no seletor de apps recentes | leitura do código (nenhum `preventScreenCapture`) | P2 - ver "Pendências" |
| 5 | Clipboard | o app não lê nem escreve na área de transferência; o campo de PIN é `secureTextEntry` (o Android não oferece copiar) | busca por `Clipboard` no código | - |
| 6 | Intents | uma atividade exportada (`MainActivity`, só `MAIN`/`LAUNCHER`); nenhum esquema de deep link, nenhum provider/receiver/service exportado. O `VIEW https` do manifesto está em `<queries>` (visibilidade para abrir as configurações/links), não é porta de entrada | prebuild real nesta rodada + gate `atividades-exportadas` do scorecard (conta `android:exported="true"` a cada release-check) | - |
| 7 | Armazenamento | banco cifrado na pasta interna do app; fotos das batidas em `Paths.document` (sandbox do app, **fora** do SQLCipher) até o OK do servidor; capturas temporárias apagadas após o uso; nada em armazenamento externo (`READ/WRITE_EXTERNAL_STORAGE` bloqueadas) | `rosto-nativo.js`, `verificar-prebuild.mjs` | P3 - foto da batida sem cifra adicional (ver privacidade-e-retencao.md) |
| 8 | Log | nenhum `console.*` no app (teste trava); diagnóstico com lista fechada sem token, PIN, CPF, vetor ou foto; calibração de campo guarda só métricas | testes "nenhum console.* no app", "nunca inclui token, PIN, CPF, vetor ou foto", "sessão de calibração guarda só métricas" | conferir `adb logcat` no aparelho (checklist) |
| 9 | Rede | só HTTPS para `apiUrl`; token do aparelho em `Authorization: Bearer`; servidor guarda só o hash do token | teste "só o hash do token vai para o banco" | - |
| 10 | Permissões | só câmera e localização; `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `WRITE_SETTINGS` e armazenamento externo removidas | `verificar-prebuild.mjs` | - |
| 11 | PIN do encarregado | conferido offline contra hash (nunca guardado em claro) | teste "PIN do encarregado confere offline contra o hash" | - |

## Pendências

- **P2 - screenshot / recentes (`FLAG_SECURE`).** Hoje um screenshot da tela do
  encarregado mostra nomes de funcionários e a situação do rosto; a câmera
  mostra o rosto ao vivo. O risco é baixo (aparelho de uso fixo na obra, sem
  dado biométrico na tela), mas o bloqueio exige um módulo nativo
  (`expo-screen-capture`). Não foi adicionado nesta rodada para não incluir
  dependência nativa sem teste em aparelho. **Decisão**: incluir no próximo
  build piloto e validar na matriz.
- **P3 - bancos arquivados sem limpeza** (já registrado em
  privacidade-e-retencao.md): guardam vetores antigos, cifrados.
- **P3 - foto da batida fora do SQLCipher**: protegida só pelo sandbox até o
  envio. Cifrar exigiria chave e formato próprios; registrado para a fase de
  homologação.

## Privacidade (revisão desta rodada)

Sem mudança no que é coletado. Esta rodada acrescentou:
- calibração de campo (`calibracao-campo.js`): só resultado, similaridades,
  tempos e luminância média - sem vetor, imagem, nome ou CPF; limite de 500
  amostras em memória, nada gravado em disco;
- avaliação facial sintética: vetores gerados por semente, nenhum dado real;
- diagnóstico com versões e metadados do build: sem segredo (o perfil e o ID
  do build EAS não são credenciais).

Questões abertas para o responsável jurídico continuam em
[privacidade-e-retencao.md](privacidade-e-retencao.md) (termo não alterado).
