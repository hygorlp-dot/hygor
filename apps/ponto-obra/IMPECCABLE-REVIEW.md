# Revisão Impeccable — Ponto de Obra (ARCD Precision / Cupertino Industrial)

- Data: 01/10/2026
- Base: `2917d33` (main)
- Escopo: `apps/ponto-obra` (UI, UX, design system e microinterações; nenhuma regra de negócio)
- Método: as 10 heurísticas de Nielsen; os antipadrões já apontados em
  `.impeccable/critique/` (side-tab, gradiente, sombra decorativa, excesso de
  cards, alvo < 44, controle sem rótulo, ação perigosa disputando atenção, fonte
  fora do sistema); detector automatizado; e revisão visual de 29 estados em 3
  tamanhos de tela.

## Como foi verificado

1. **Detector automatizado** (`src/ui/design-system.test.js`). É o equivalente
   React Native do detector do Impeccable usado no ERP. Ele barra cor solta,
   gradiente, sombra ou elevação, raio fora do token, espaço fora da grade de 4,
   fonte definida na tela, peso 800/900, `Pressable` sem papel ou nome
   acessível, componentes crus (`Text`, `TouchableOpacity`), animação de layout
   e emoji. Também confere o contraste WCAG dos pares de cor. Foi validado com
   um arquivo de violações plantadas: 7 de 7 regras falharam como esperado.
2. **Comportamento por estado** (`src/logica/apresentacao.test.js`): estado
   normal, analisando, falha de reconhecimento, falha real, sucesso, offline,
   câmera negada, modo Encarregado, cadastro guiado, pareamento e diagnóstico.
3. **Revisão visual**: as telas reais rodando com `react-native-web` no
   Chromium (câmera, reconhecimento e banco simulados), 29 cenas × 3 tamanhos
   (360×800, 412×915 e tablet 800×1280, já descontada a barra de status). Uma
   medição automática procurou estouro horizontal, rolagem lateral e botão menor
   que 44×44 e não encontrou nenhum caso. As 16 telas principais estão em
   `docs/ui/`.

`.impeccable/config.json` não ganhou nenhuma exceção.

## Notas por heurística

| # | Heurística | Antes (estimado na main) | Depois | Justificativa |
| --- | --- | --- | --- | --- |
| 1 | Visibility of System Status | 2 | **4** | A pílula de status (ícone, texto e cor) fica sempre visível. As fases do reconhecimento ("Olhe para a câmera" → "Continue olhando" → "João, vire um pouco o rosto" → "Identidade confirmada") mudam com a guia (neutra → ouro → verde). O sucesso ocupa a tela inteira e mostra a barra de tempo. Antes, o status era uma frase longa e laranja de 14 px, e "Analisando" era só um véu. |
| 2 | Match System / Real World | 3 | **3** | A linguagem é a da obra ("Bater ponto", "Registrar com encarregado", "Será enviado quando houver conexão"). Termos técnicos aparecem só onde são obrigatórios: NSR e código do registro no comprovante (Portaria), versionCode e commit no Diagnóstico (suporte). |
| 3 | User Control and Freedom | 3 | **3** | Há "‹ Voltar" nomeado e sempre no mesmo lugar, "Concluir" para sair do comprovante antes do tempo, "Cancelar" em todas as etapas do cadastro e "Não concorda - voltar" no termo. Falta interromper o reconhecimento já em andamento (P3). |
| 4 | Consistency and Standards | 2 | **4** | O design system é único (`src/ui/`), os tokens são garantidos por teste, cada tela tem uma ação primária e o padrão de Ajustes vale para todo o modo Encarregado. Antes havia sete botões de mesmo formato no menu e cores Carbon de outro contexto. |
| 5 | Error Prevention | 3 | **3** | O botão de pareamento só habilita com as 8 casas preenchidas, o PIN exige pelo menos 4 dígitos e a captura só começa depois do termo aceito. O botão desabilitado ficou neutro, sem parecer quebrado. |
| 6 | Recognition Rather Than Recall | 3 | **4** | O caminho no ARCD aparece no pareamento, "Foto 2 de 3" vem com ● ○ ○, "Cadastrar rosto · 2 de 4" e "Sincronização · 2 pendentes" ficam no próprio menu, e o "‹ Voltar" diz para onde volta. |
| 7 | Flexibility and Efficiency | 3 | **3** | A batida continua sendo um toque, e o comprovante volta sozinho. Para o encarregado, entrar em Sincronização agora custa um toque a mais. O cadastro ganhou uma tela de apresentação, como pedido. |
| 8 | Aesthetic and Minimalist Design | 2 | **4** | Ficaram hora, câmera e uma ação. As linhas agrupadas substituem os cards por item. Não há gradiente, sombra, side-tab nem borda colorida, e o ouro aparece só no CTA, no foco, na seleção, no progresso e no "Voltar". |
| 9 | Error Recovery | 3 | **4** | Rosto incerto vira mensagem neutra com "Tentar novamente" e o caminho do encarregado. Falha real usa vermelho e diz o que aconteceu com o ponto. Câmera negada leva às configurações. Offline tranquiliza. O detalhe técnico sai da tela do trabalhador e vai para o Diagnóstico. |
| 10 | Help and Documentation | 2 | **3** | Há dicas na própria tela (caminho no ARCD, como posicionar o rosto, o que fazer sem responsáveis). Não existe uma tela de ajuda dedicada, e para um quiosque de uma tarefa ela não é necessária. |
| | **Total** | **26/40** | **36/40** | |

## Achados

### P0 (bloqueia o uso)

Nenhum.

### P1 (prejudica muito)

Nenhum em aberto. Encontrados e corrigidos durante a rodada:

- **Ações embaixo da barra de navegação.** O SDK 57 torna o edge-to-edge
  obrigatório no Android, e a `main` tinha só 20 px de margem inferior: o link
  "Encarregado" e o botão primário podiam ficar sob a barra de 3 botões.
  Correção: margem inferior de 48 (altura dessa barra) em toda `Tela`, e topo
  com `StatusBar.currentHeight`. Na rodada 2, substituída pela safe area exata.
- **Mensagem técnica para o trabalhador.** A tela de ponto mostrava
  `mensagemDeErro()` com "(detalhe: …)" vindo do TFLite ou da câmera. Agora usa
  `mensagemParaTrabalhador()`, e o detalhe continua no Diagnóstico.
- **Incerteza tratada como erro.** "Não reconheci seu rosto" aparecia numa
  caixa de borda vermelha. Agora é uma mensagem neutra, e o vermelho ficou só
  para falha real.

### P2 (corrigidos na rodada)

- Data com cada palavra capitalizada ("1 De Outubro") → só a primeira letra.
- Botão primário desabilitado em ouro apagado (parecia defeito) → superfície
  neutra.
- A pílula de status em duas linhas fazia o relógio pular quando a conexão
  caía → uma linha só, e o aviso de hora não carrega a fila.
- Importar a raiz dos pacotes de fonte embutia as 30 variantes (+6 MB) → só os
  6 pesos usados (+1,2 MB).

### Rodada 2 (01/10/2026, mesmo APK)

Fechados: **safe area exata** (`react-native-safe-area-context` no lugar dos
48 px fixos), **haptics**, **confirmação por voz** (pode ser desligada),
**brilho máximo durante a captura**, **saudação e marcações do dia** no
comprovante e **ícone/splash ARCD** no lugar do ícone padrão do template do
Expo.

### P2 (pendências)

- **Validação em aparelho real.** A revisão visual foi feita com
  `react-native-web`. Antes do piloto, conferir no aparelho a imagem real da
  câmera, a renderização do IBM Plex no Android, o edge-to-edge e o aumento de
  fonte do sistema (os limites estão em `escalaMax`, mas não foram testados em
  Android).
- **Voz depende do motor TTS do aparelho.** Sem voz pt-BR instalada, o app
  segue em silêncio. Conferir no aparelho do piloto.

### P3 (menores)

- **Sem "cancelar" durante o reconhecimento.** O fluxo leva cerca de 3 s e,
  enquanto isso, o botão "Encarregado" fica desabilitado de propósito: sair
  dessa tela no meio desmontaria a câmera durante a captura.
- **Item "Funcionários" do menu pedido não foi criado.** Seria uma tela nova,
  ou seja, funcionalidade nova. A lista de funcionários, com status do rosto,
  já existe dentro de "Cadastrar rosto".
- **"Banco local: Protegido" não entrou no Diagnóstico.** A lista do
  diagnóstico é fechada por decisão de privacidade (`diagnostico.js`).
  Acrescentar um campo é uma decisão de produto, não de UI.
- **Câmera alta no tablet.** Em retrato, a moldura fica bem alta. Ela é
  proporcional e não distorce, mas uma largura máxima pode ser avaliada no
  piloto em tablet.

## Exceções justificadas

- **Caixa alta** em "TERRAS ALPHA", "PONTO DE OBRA" e nos cabeçalhos de grupo
  (CADASTROS, SISTEMA). São rótulos curtos, como o DESIGN.md do ERP permite.
- **Legenda de 13 px** só no modo Encarregado e no pareamento, que são de uso
  próximo, nunca na tela de ponto. Na tela de ponto, o menor texto é 15.
- **Ouro no "‹ Voltar".** É navegação (foco e seleção), não decoração.
- **Linha "Fixar aplicativo na tela" sem chevron.** É uma ação imediata, não
  navegação, e mostra uma confirmação em texto.

## Mudanças de comportamento visíveis (sem mudança de regra)

- O comprovante volta em 6 s (antes 7 s) e em 10 s quando há aviso de foto ou
  de hora (antes 12 s, e só para foto). Ganhou o botão "Concluir".
- O botão "Encarregado" fica desabilitado durante o reconhecimento.
- O pareamento mostra "Aparelho vinculado" enquanto a sessão é guardada. A
  ordem das operações é a mesma.
- O cadastro facial ganhou a tela de apresentação antes do termo.
- "Sincronizar agora" foi para Encarregado → Sincronização.

Nada mudou em ARP, NSR, `localSequence`, hashes, migrations, fila,
sincronização, API, SQLCipher, SecureStore, reconhecimento, prova de vida,
limiares (`calibracao.js`), fotos, fonte de hora, idempotência ou no texto do
termo (`TERMO_TEXTO`). No diff, `src/logica` só tem acréscimos (+32 linhas e
nenhuma removida), e `src/dados`, `src/servicos`, `src/domains` e `server` não
foram alterados.
