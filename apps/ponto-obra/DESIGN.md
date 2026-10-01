# ARCD Precision / Cupertino Industrial — Ponto de Obra

## Família de sistemas visuais ARCD

| Sistema | Onde | Caráter |
| --- | --- | --- |
| **ARCD Carbon** (`/DESIGN.md`) | Web, ERP, desktop administrativo | Denso, estrutural, claro, grade de dados |
| **ARCD Precision** | Aplicativos mobile e quiosques | Uma tarefa por tela, alvos grandes, leitura a distância |
| **ARCD Precision / Cupertino Industrial** (este documento) | Ponto de Obra | Precision em tema escuro, para um aparelho fixo na obra |

Os três compartilham a mesma identidade: **ouro ARCD `#D4AF37` como única cor de
marca**, IBM Plex, verde, amarelo e vermelho só para estado, e nenhuma decoração
gratuita. O que muda entre eles é a densidade e o contexto de uso.

## Filosofia

Equipamento confiável instalado em uma obra de alto padrão. Clareza e
refinamento de produto premium, identidade ARCD e robustez de equipamento
industrial.

- **Uma tarefa por tela.** A tela de ponto é entendida em menos de 1 segundo:
  hora, câmera e uma ação.
- **Tipografia dominante, superfícies discretas.** A hierarquia vem do tamanho e
  do espaço, não de caixas, cores ou negrito.
- **Uma ação primária por tela.** As demais são secundárias (superfície) ou de
  texto. Ações administrativas ficam no modo Encarregado.
- **Movimento funcional.** O movimento só explica uma mudança de estado.
- **Calma.** Offline e reconhecimento incerto não são defeitos: o ponto continua
  funcionando, e a interface diz isso.

Não é fintech, dashboard SaaS, app Android genérico, ERP espremido no celular,
glassmorphism nem interface futurista ou gamer. Também não é cópia literal de
outra plataforma: não usa fontes, ícones nem componentes de terceiros, e a
palavra "iOS" não aparece na interface.

## Contexto de uso (restrições de projeto)

O aparelho fica na parede, sob luz forte, e é usado com pressa, às vezes com
luva ou sujeira, a 40–80 cm do rosto, em celular barato ou tablet intermediário.
Daí vêm os controles grandes, o alto contraste, os textos curtos, as poucas
decisões e a ausência de detalhes delicados.

## Tokens (`src/ui/tokens.js`)

Fonte única. As telas não definem cor, raio, fonte nem espaço próprios; o teste
`src/ui/design-system.test.js` barra qualquer exceção.

### Paleta

| Token | Valor | Uso |
| --- | --- | --- |
| `fundo` | `#0B0B0C` | Canvas |
| `superficie` | `#1C1C1E` | Grupos, mensagens, pílula de status |
| `superficieElevada` | `#242426` | Botão secundário, linha pressionada |
| `divisor` | `#38383A` | Linhas entre itens de um grupo |
| `borda` | `rgba(255,255,255,0.08)` | Borda discreta de superfície |
| `texto` | `#F5F5F7` | Texto principal |
| `textoSecundario` | `#A1A1A6` | Texto de apoio, legendas (≥ 4,5:1 em todas as superfícies) |
| `textoTerciario` | `#6E6E73` | Chevrons, placeholder, texto desabilitado. **Nunca** para legenda (3,9:1) |
| `ouro` | `#D4AF37` | CTA principal, foco, seleção, progresso ativo, "‹ Voltar" e detalhes de marca |
| `sucesso` | `#30D158` | Estado: confirmado, sincronizado |
| `atencao` | `#FFD60A` | Estado: hora não verificada, envio pendente, câmera sem permissão |
| `erro` | `#FF453A` | Estado: falha real (batida não gravada, câmera ou banco quebrado) |

O ouro não decora cards e não tem gradiente nem brilho. O verde não marca dado
neutro. Os tons `neutro` e `info` usam `textoSecundario`, nunca uma cor de estado.

### Tipografia

IBM Plex Sans para a interface e IBM Plex Mono para valores técnicos (CPF
mascarado, código do registro, versão, build, commit, contagens). As fontes vêm
embutidas no app pelo `expo-font` (sem dependência nativa nova); são só 6
arquivos, cerca de 1,1 MB. Se a fonte não carregar em até 3 s, o app segue com a
fonte do sistema.

Como no Android uma fonte carregada combinada com `fontWeight` gera negrito
falso, cada peso é uma família própria (`FAMILIA.leve`, `regular`, `media`,
`semi`, `mono`, `monoMedia`).

| Token | Tamanho / altura de linha | Peso | Uso |
| --- | --- | --- | --- |
| `relogio` | 80 / 88 | 300 | Hora da tela de ponto (algarismos tabulares) |
| `horaComprovante` | 56 / 64 | 300 | Hora do comprovante, com segundos |
| `hero` | 34 / 40 | 400 | Título de estado (Ponto registrado, Aparelho vinculado) |
| `tituloPagina` | 28 / 34 | 500 | Título de página |
| `tituloSecao` | 22 / 28 | 500 | Nome, instrução da câmera |
| `corpo` | 17 / 24 | 400 | Texto e linhas de ajuste |
| `botao` | 20 / 24 | 600 | Botão primário |
| `botaoSecundario` | 18 / 24 | 500 | Botão secundário e de texto |
| `rotulo` | 15 / 20 | 500 | Status, rótulos |
| `legenda` | 13 / 18 | 400 | Rodapés no modo Encarregado (nunca na tela de ponto) |
| `secao` | 13 / 18 | 500 | Cabeçalho de grupo em caixa alta curta (CADASTROS) |
| `mono` | 17 / 24 | 400 mono | Valores técnicos |
| `codigo` | 30 / 36 | 500 mono | Casas do código de pareamento |

Pesos 800 e 900 não são usados, e caixa alta fica restrita a cabeçalhos curtos.
Cada token tem `escalaMax` (o `maxFontSizeMultiplier`): o relógio e os botões
aceitam até 15–30% de aumento da fonte do sistema sem estourar a largura, e o
texto corrido escala até 60%.

### Espaço, raio e toque

- **Espaço:** grade de 4 com os valores `4 8 12 16 20 24 32 40 48`. A margem
  lateral da tela é 20.
- **Raio:** `pequeno 10` (casa de código), `controle 14` (campo, mensagem),
  `botao 18`, `painel 20` (grupos), `camera 24` e `pilula 999`. Não há outros
  valores.
- **Toque:** mínimo de 44; linha de ajuste 56; botão secundário 56; botão
  primário 66.

### Movimento (`MOVIMENTO`)

Só opacidade, escala e translação, sempre com o driver nativo. Não há animação
de largura, altura nem de layout.

- Toque: escala 1 → 0,98 em 120 ms, com luminosidade levemente menor.
- Entrada de estado (erro, atenção): 250 ms. Sucesso: 350 ms (opacidade, escala
  0,96 → 1 e subida de 8).
- Guia facial: um pulso de escala (1,04) quando muda de estado.
- Barra de tempo do comprovante: `scaleX` 1 → 0 pela duração da tela.

## Componentes (`src/ui/index.js`)

| Componente | Papel |
| --- | --- |
| `Tela` | Fundo plano, margens e respiro da barra de status |
| `Cabecalho` | "‹ Voltar" (ouro) sempre no mesmo lugar, título e subtítulo |
| `Texto`, `Titulo`, `Hero`, `TituloSecao`, `Corpo`, `Rotulo`, `Legenda`, `Mono` | Tipografia pelos tokens |
| `Botao` | Primário: ouro, 66, raio 18, 20/600. Desabilitado vira superfície neutra |
| `BotaoSecundario` | Superfície elevada com borda discreta, 56 |
| `BotaoTexto` | Ação discreta, com chevron opcional; mínimo de 44 |
| `Superficie` | Painel plano (borda 8% de branco, raio 20) |
| `Secao` + `LinhaAjuste` + `Divisor` | Grupo no estilo Ajustes: rótulo, valor, chevron e linha inteira clicável; valor longo vai para baixo |
| `Status` | Pílula de uma linha com ícone, texto e cor, anunciada ao mudar |
| `Mensagem` | Superfície neutra com ícone de tom (info, atenção, erro) e texto |
| `EstadoCentral` | Estado de tela inteira (selo, título, conteúdo, ações), rola se não couber |
| `BarraTempo` | Contagem regressiva do comprovante |
| `Passos` | ● ○ ○ com texto acessível ("1 de 3 concluídas") |
| `Campo`, `CampoCodigo` | Campo com foco em ouro; código em 8 casas (4 + 4) |
| `MolduraCamera` + `GuiaFacial` | Câmera com raio 24, fundo preto, guia circular e instrução integrada |
| `Icone` | Família única desenhada (ok, alerta, erro, offline, sincronizando, chevron, voltar), sempre decorativa: o significado vem do texto |

Não fazem parte do sistema: card dentro de card, sombra, elevação, gradiente,
side-tab, borda colorida de destaque, emoji e botão só com ícone.

## Estados e mensagens

Todo estado tem **ícone + texto + cor**.

| Nível | Cor | Exemplos |
| --- | --- | --- |
| Informação | neutra | Offline, enviando, rosto não confirmado, "Olhe de frente" |
| Atenção | amarelo | Hora não verificada, envio pendente, câmera sem permissão, cadastro desatualizado |
| Erro crítico | vermelho | O ponto não foi registrado, a câmera não abriu, o app não abriu |
| Sucesso | verde | Sincronizado, identidade confirmada, ponto registrado |

As mensagens ficam em superfície neutra; o tom aparece no ícone, nunca numa
caixa com borda colorida. O texto técnico (exceção, modelo, TFLite) nunca chega
ao trabalhador: `mensagemParaTrabalhador()` entrega só o que fazer, e o detalhe
fica no Diagnóstico.

### Status da tela de ponto

O status é conciso. O detalhe fica em Encarregado → Sincronização ou Diagnóstico.

```
✓ Sincronizado            ○ Offline · 2 pendentes
◉ Enviando · 3 pendentes  ! Envio pendente · 3 pendentes
! Hora não verificada
```

Offline é informação, não alarme: o ponto continua funcionando.

## Tela de ponto

```
TERRAS ALPHA                  ✓ Sincronizado

                07:42
         Quinta-feira, 1 de outubro

     ┌───────────────────────────────┐
     │             ◯                 │   guia: neutra → ouro → verde
     │      Olhe para a câmera       │   instrução integrada
     └───────────────────────────────┘
     [         Bater ponto           ]
                           Encarregado ›
```

Fases do reconhecimento (`logica/apresentacao.js`):

| Fase | Instrução | Guia | Botão |
| --- | --- | --- | --- |
| olhar | Olhe para a câmera | neutra | Aguarde |
| analisar | Continue olhando | neutra | Aguarde |
| virar | João, vire um pouco o rosto | ouro | Aguarde |
| confirmado | Identidade confirmada | verde | Registrando ponto |

Quando o rosto não é confirmado, a tela mostra uma mensagem neutra ("Não consegui
confirmar seu rosto" e o que fazer), o botão **Tentar novamente** e o link
**Registrar com encarregado ›**. O vermelho fica reservado para falha real.

Sem câmera ou sem rosto cadastrado, um painel com o mesmo raio ocupa o lugar da
câmera, com uma ação primária (permitir câmera, abrir configurações ou cadastrar
rostos) e o caminho do encarregado. A batida nunca fica impedida.

## Feedback de sucesso (comprovante)

É uma tela inteira: selo verde, **Ponto registrado**, saudação com o nome ("Bom
dia, João Silva"), hora com segundos, obra, número do registro local, as
marcações da pessoa no dia neste aparelho ("Hoje: 06:58 · 07:42", lidas do banco
local, sem classificar entrada ou saída) e a pílula de envio ("Enviando ao ARCD" ou "Será
enviado quando houver conexão."). Embaixo, em hierarquia menor, ficam o CPF
mascarado, o código do registro e "NSR: atribuído pelo ARCD após o envio". O app
nunca mostra um NSR que a ARP não devolveu. Avisos de hora ou foto aparecem como
mensagem de atenção.

A tela volta sozinha em 6 s (10 s quando há aviso), com a barra de tempo em ouro,
e o botão **Concluir** permite voltar antes.

## Fluxo do encarregado

O PIN é pedido em duas etapas: a lista de responsáveis (linhas) e depois o PIN em
campo grande. O menu segue o estilo Ajustes:

```
Encarregado
Arthur Pinheiro · Terras Alpha

CADASTROS   Cadastrar rosto            2 de 4  ›
REGISTROS   Registrar funcionário              ›
            Acesso de terceirizado             ›
SISTEMA     Sincronização         2 pendentes  ›
            Diagnóstico                        ›
            Fixar aplicativo na tela

            Sair do modo encarregado
```

Cada subtela tem "‹ Encarregado" no mesmo lugar. A Sincronização mostra conexão,
aviso, fila e a ação "Sincronizar agora". O Diagnóstico agrupa a lista fechada
em seções (Aplicativo, Aparelho, Ponto, Registro fiscal, Hora, Segurança), com
valores técnicos em mono e problemas sinalizados com ícone e texto.

### Cadastro facial guiado

1. **Funcionários:** busca e lista, com "✓ Cadastrado" ou "○ Sem rosto".
2. **Apresentação:** nome e para que serve o cadastro → Continuar.
3. **Termo de consentimento:** o texto jurídico (`TERMO_TEXTO`, inalterado),
   rolável → "O funcionário concorda" ou "Não concorda - voltar".
4. **Posicione o rosto:** câmera com guia, "Foto 1 de 3" e ● ○ ○ → Tirar foto
   (3×) → Salvar cadastro.
5. **Cadastro concluído:** "João já pode registrar ponto." A tela volta sozinha.

## Pareamento

"PONTO DE OBRA" (detalhe em ouro), **Vincular aparelho**, a frase "Digite o
código exibido no ARCD.", 8 casas (4 + 4) com a casa ativa em ouro, o caminho no
ARCD como legenda e o botão primário. Após o OK do ARCD, a tela mostra ✓
**Aparelho vinculado**, a obra e "Preparando o aparelho" enquanto a sessão é
guardada e o cadastro baixado. A ordem das operações não mudou.

## Câmera

Moldura com raio 24, fundo preto e a câmera preenchendo o espaço disponível. A
guia é um círculo com 58% da largura (máximo de 320), com borda de 2 em repouso e
3 quando ativa. A instrução fica integrada, num véu escuro na base da moldura. Um
erro de câmera aparece como mensagem no topo da moldura.

## Acessibilidade

- O alvo mínimo é 44×44; o teste visual mede todos os botões em 360, 412 e
  tablet.
- Contraste conferido por teste (WCAG): texto ≥ 7:1, texto secundário ≥ 4,5:1,
  cores de estado e ouro ≥ 3:1 em todas as superfícies, texto sobre ouro ≥ 7:1.
- Todo `Pressable` tem papel e nome acessível (há teste). Os ícones são
  decorativos e escondidos do leitor de tela, porque o texto ao lado carrega o
  significado.
- Status, mensagens e instruções da câmera são anunciados ao mudar
  (`accessibilityLiveRegion`).
- O app aceita o aumento de fonte do sistema com limites por token. Não há
  gesto oculto: toda ação é um botão visível.

## Feedback físico (`src/servicos/feedback.js`)

Melhor esforço: aparelho sem vibrador, sem voz em português ou que recuse o
brilho segue normalmente, e nada disso pode impedir a batida.

- **Vibração** (`expo-haptics`): leve quando o rosto é reconhecido (fase
  "virar"), sucesso quando o ponto é gravado e alerta só em falha real. A
  incerteza do rosto não vibra.
- **Voz** (`expo-speech`, pt-BR): "Bom dia, João. Ponto registrado." Diz só o
  primeiro nome e pode ser desligada em Encarregado → Confirmação por voz.
- **Brilho** (`expo-brightness`): máximo só na janela do app durante a captura
  (sol forte, rosto escuro), depois volta ao do sistema. Não usa
  `WRITE_SETTINGS`, que está bloqueada.

## Safe area

`react-native-safe-area-context`: cada `Tela` soma a área exata das barras do
sistema (status, gestos ou 3 botões) às margens de 16 em cima e 20 embaixo.

## Ícone e splash

A marca é um mostrador fino em ouro sobre grafite `#0B0B0C`: um anel (que é ao
mesmo tempo a guia facial e o relógio), a marcação das 12 h e os ponteiros. Os
arquivos ficam em `assets/`: ícone, ícone adaptativo (fundo, primeiro plano na
zona segura e versão monocromática para o ícone temático do Android 13+),
splash e favicon. Substituem o ícone padrão do template do Expo.

## Fases futuras

- **Tema claro:** não implementado. A direção inicial é escura (luz forte,
  aparelho fixo). Para um tema claro, os tokens de `COR` ganhariam uma variante;
  componentes e telas já não têm cor própria.
- **Captura automática** com detecção de rosto em tempo real (sem toque, para
  uso com luva): exige mexer no pipeline da câmera, então precisa de decisão e
  de uma rodada própria.
