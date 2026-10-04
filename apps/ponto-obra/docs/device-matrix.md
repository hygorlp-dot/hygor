# Matriz de dispositivos - ARCD Ponto de Obra

Registro dos aparelhos físicos em que o app foi testado. **Só entra
"aprovado" na coluna status quem passou pelo [checklist manual](checklist-aparelho.md)
inteiro, no aparelho, com o APK do commit indicado.** Linha sem teste fica
"pendente"; nada aqui é preenchido a partir de emulador ou de teste automatizado.

O scorecard (`scripts/mobile-quality-score.mjs`) lê esta tabela: a nota de
Robustez Android tem teto 9,3 enquanto houver menos de 3 aparelhos
"aprovado", e as notas de UI têm teto 9,0 enquanto nenhuma linha tiver
"ok" em "validação visual".

Colunas:

- **SQLCipher**: banco abre com a chave e `PRAGMA cipher_version` responde (Diagnóstico → Aparelho).
- **TFLite**: os dois modelos carregam (Diagnóstico → Modelos) - anote o tempo de carga.
- **tempo facial**: do toque até o comprovante, mediana de 10 batidas (Diagnóstico → Desempenho).
- **offline**: 20 batidas em modo avião, reabre o app, liga a rede, todas com NSR.
- **reboot**: reinicia o aparelho com batidas pendentes; nada se perde, hora sinalizada até sincronizar.
- **GPS**: GPS desligado não impede a batida.
- **validação visual**: telas conferidas no aparelho (texto não corta, alvos alcançáveis, contraste ao sol).

| modelo | android | ram | câmera | sqlcipher | tflite | tempo facial | offline | reboot | gps | validação visual | commit | data | status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Samsung Galaxy A15 (SM-A155M) - alvo do piloto | 14 | 4 GB | frontal 13 MP | não testado | não testado | não medido | não testado | não testado | não testado | não testado | - | - | pendente |
| Aparelho de entrada com 3 GB (a definir) | - | 3 GB | - | não testado | não testado | não medido | não testado | não testado | não testado | não testado | - | - | pendente |
| Tablet do canteiro (a definir) | - | - | - | não testado | não testado | não medido | não testado | não testado | não testado | não testado | - | - | pendente |

## Situação

Nenhum aparelho físico foi validado nesta rodada (o ambiente de
desenvolvimento não tem aparelho). As verificações automatizadas que
substituem parte disso - reabertura do banco real, rede, 500, timeout, GPS e
câmera indisponíveis - estão em `src/logica/robustez-fisica.test.js`,
`src/dados/armazem-sqlite.test.js` e `src/logica/regressao.test.js`, e
**não** contam como aparelho aprovado.
