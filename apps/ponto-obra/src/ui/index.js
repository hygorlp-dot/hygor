// ARCD Precision / Cupertino Industrial - componentes do Ponto de Obra.
// Telas montam com estes primitivos e os tokens (./tokens.js); nada de cor,
// raio, fonte ou espaço solto nas telas (há teste). Ver DESIGN.md do app.
//
// Regras que os componentes garantem:
// - uma ação primária por tela (Botao); o resto é BotaoSecundario/BotaoTexto;
// - todo controle com nome acessível e alvo >= 44 px;
// - estado sempre com ícone + texto + cor (Status, Mensagem, EstadoCentral);
// - movimento só com opacidade/escala/translação no driver nativo.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COR, COR_DO_TOM, ESPACO, MOVIMENTO, RAIO, TIPO, TOQUE } from "./tokens";

export * from "./tokens";

// ---------- Tipografia ----------
function estiloTipo(variante) {
  const { escalaMax, ...estilo } = TIPO[variante] || TIPO.corpo;
  return { estilo, escalaMax };
}

export function Texto({ variante = "corpo", cor = COR.texto, centro = false, style, children, ...props }) {
  const { estilo, escalaMax } = estiloTipo(variante);
  return <Text maxFontSizeMultiplier={escalaMax} {...props} style={[estilo, { color: cor }, centro && estilos.centro, style]}>{children}</Text>;
}
export const Titulo = props => <Texto variante="tituloPagina" accessibilityRole="header" {...props} />;
export const Hero = props => <Texto variante="hero" {...props} />;
export const TituloSecao = props => <Texto variante="tituloSecao" accessibilityRole="header" {...props} />;
export const Corpo = ({ secundario, ...props }) => <Texto variante="corpo" cor={secundario ? COR.textoSecundario : COR.texto} {...props} />;
export const Rotulo = ({ secundario, ...props }) => <Texto variante="rotulo" cor={secundario ? COR.textoSecundario : COR.texto} {...props} />;
export const Legenda = props => <Texto variante="legenda" cor={COR.textoSecundario} {...props} />;
export const Mono = props => <Texto variante="mono" {...props} />;

// ---------- Ícones (desenhados, uma família só; sempre decorativos) ----------
// O significado vem do texto ao lado: ícone nunca substitui rótulo.
export function Icone({ nome, cor = COR.texto, tamanho = 16 }) {
  const traco = Math.max(2, Math.round(tamanho * 0.12));
  const caixa = { width: tamanho, height: tamanho, alignItems: "center", justifyContent: "center" };
  const exclamacao = corTexto => (
    <Text allowFontScaling={false} style={{ color: corTexto, fontFamily: TIPO.botao.fontFamily, fontSize: Math.round(tamanho * 0.62), lineHeight: Math.round(tamanho * 0.8) }}>!</Text>
  );
  let desenho = null;
  if (nome === "ok") {
    desenho = <View style={{ width: tamanho * 0.32, height: tamanho * 0.6, borderRightWidth: traco, borderBottomWidth: traco, borderColor: cor, transform: [{ translateY: -tamanho * 0.06 }, { rotate: "45deg" }] }} />;
  } else if (nome === "chevron" || nome === "voltar") {
    desenho = <View style={{ width: tamanho * 0.5, height: tamanho * 0.5, borderTopWidth: traco, borderRightWidth: traco, borderColor: cor, transform: [{ translateX: nome === "chevron" ? -tamanho * 0.1 : tamanho * 0.1 }, { rotate: nome === "chevron" ? "45deg" : "-135deg" }] }} />;
  } else if (nome === "alerta") {
    desenho = <View style={[caixa, { borderRadius: RAIO.pilula, borderWidth: traco, borderColor: cor }]}>{exclamacao(cor)}</View>;
  } else if (nome === "erro") {
    desenho = <View style={[caixa, { borderRadius: RAIO.pilula, backgroundColor: cor }]}>{exclamacao(COR.fundo)}</View>;
  } else if (nome === "offline") {
    desenho = <View style={[caixa, { borderRadius: RAIO.pilula, borderWidth: traco, borderColor: cor }]} />;
  } else if (nome === "sincronizando") {
    desenho = <View style={[caixa, { borderRadius: RAIO.pilula, borderWidth: traco, borderColor: cor }]}>
      <View style={{ width: tamanho * 0.36, height: tamanho * 0.36, borderRadius: RAIO.pilula, backgroundColor: cor }} />
    </View>;
  } else {
    desenho = <View style={{ width: tamanho * 0.6, height: tamanho * 0.6, borderRadius: RAIO.pilula, backgroundColor: cor }} />;
  }
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={caixa}>{desenho}</View>;
}

// Selo grande dos estados centrais (sucesso, atenção, erro).
function Selo({ tom = "sucesso", tamanho = 72 }) {
  const cor = COR_DO_TOM[tom] || COR.texto;
  const icone = tom === "sucesso" ? "ok" : tom === "erro" ? "erro" : "alerta";
  if (icone !== "ok") return <Icone nome={icone} cor={cor} tamanho={tamanho} />;
  return <View accessible={false} style={{ width: tamanho, height: tamanho, borderRadius: RAIO.pilula, borderWidth: 2, borderColor: cor, alignItems: "center", justifyContent: "center" }}>
    <Icone nome="ok" cor={cor} tamanho={tamanho * 0.5} />
  </View>;
}

// ---------- Estrutura ----------
// Fundo plano; margem lateral de 20. Android 16 desenha de ponta a ponta
// (edge-to-edge obrigatório no SDK 57): as margens somam a área exata das
// barras do sistema (safe area), seja navegação por gestos ou por botões.
export function Tela({ children, centro = false, style, ...props }) {
  const borda = useSafeAreaInsets();
  return <View {...props} style={[estilos.tela, { paddingTop: borda.top + ESPACO.lg, paddingBottom: borda.bottom + ESPACO.xl }, centro && estilos.telaCentro, style]}>{children}</View>;
}

// Subtela do modo Encarregado: "‹ Voltar" sempre no mesmo lugar + título.
export function Cabecalho({ titulo, subtitulo, voltar, rotuloVoltar = "Voltar" }) {
  return <View style={estilos.cabecalho}>
    {!!voltar && <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel={rotuloVoltar} hitSlop={ESPACO.sm}
      style={({ pressed }) => [estilos.voltar, pressed && estilos.pressionadoTexto]}>
      <Icone nome="voltar" cor={COR.ouro} tamanho={18} />
      <Texto variante="botaoSecundario" cor={COR.ouro}>{rotuloVoltar}</Texto>
    </Pressable>}
    {!!titulo && <Titulo>{titulo}</Titulo>}
    {!!subtitulo && <Corpo secundario>{subtitulo}</Corpo>}
  </View>;
}

export function Superficie({ children, style }) {
  return <View style={[estilos.superficie, style]}>{children}</View>;
}

export const Divisor = ({ recuo = ESPACO.lg }) => <View style={[estilos.divisor, { marginLeft: recuo }]} />;

// Grupo de linhas (Ajustes). Divisores entre as linhas, não cards por item.
export function Secao({ titulo, rodape, children }) {
  const linhas = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return <View style={estilos.secao}>
    {!!titulo && <Texto variante="secao" cor={COR.textoSecundario} accessibilityRole="header" style={estilos.secaoTitulo}>{titulo.toUpperCase()}</Texto>}
    <View style={estilos.grupo}>
      {linhas.map((linha, i) => <View key={linha.key ?? i}>{i > 0 && <Divisor />}{linha}</View>)}
    </View>
    {!!rodape && <Legenda style={estilos.secaoRodape}>{rodape}</Legenda>}
  </View>;
}

// Linha de Ajustes: rótulo, valor opcional, chevron; a linha inteira é o alvo.
// Sem onPress é linha de informação (Diagnóstico). Valor longo vai para baixo.
export function LinhaAjuste({ rotulo, valor = "", onPress, chevron = !!onPress, mono = false, tom = null, rotuloAcessivel, desabilitado = false }) {
  const longo = String(valor).length > 22;
  const corValor = tom ? COR_DO_TOM[tom] : COR.textoSecundario;
  const conteudo = <>
    <View style={[estilos.linhaCorpo, longo && estilos.linhaEmpilhada]}>
      <Texto variante="corpo" style={longo ? null : estilos.linhaRotulo}>{rotulo}</Texto>
      {!!valor && <View style={[estilos.linhaValor, longo && estilos.linhaValorEmpilhado]}>
        {!!tom && <Icone nome={tom === "erro" ? "erro" : "alerta"} cor={corValor} tamanho={16} />}
        <Texto variante={mono ? "mono" : "corpo"} cor={corValor} selectable={!onPress} style={longo ? null : estilos.textoDireita}>{valor}</Texto>
      </View>}
    </View>
    {chevron && <Icone nome="chevron" cor={COR.textoTerciario} tamanho={16} />}
  </>;
  if (!onPress) return <View accessible accessibilityLabel={rotuloAcessivel || `${rotulo}: ${valor}`} style={estilos.linha}>{conteudo}</View>;
  return <Pressable onPress={onPress} disabled={desabilitado} accessibilityRole="button" accessibilityLabel={rotuloAcessivel || (valor ? `${rotulo}, ${valor}` : rotulo)}
    accessibilityState={{ disabled: desabilitado }}
    style={({ pressed }) => [estilos.linha, pressed && estilos.linhaPressionada, desabilitado && estilos.desabilitado]}>{conteudo}</Pressable>;
}

// ---------- Botões ----------
function useEscalaDeToque() {
  const escala = useRef(new Animated.Value(1)).current;
  const ir = valor => Animated.timing(escala, { toValue: valor, duration: MOVIMENTO.toque, useNativeDriver: true }).start();
  return { escala, aoApertar: () => ir(MOVIMENTO.escalaToque), aoSoltar: () => ir(1) };
}

function BotaoBase({ titulo, onPress, desabilitado = false, carregando = false, rotuloAcessivel, estiloCaixa, estiloPressionado, estiloDesabilitado = estilos.desabilitado, variante, corTexto, corDesabilitado = corTexto }) {
  const { escala, aoApertar, aoSoltar } = useEscalaDeToque();
  const inativo = desabilitado || carregando;
  return <Animated.View style={{ transform: [{ scale: escala }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel || titulo} accessibilityState={{ disabled: inativo, busy: carregando }}
      disabled={inativo} onPress={onPress} onPressIn={aoApertar} onPressOut={aoSoltar}
      style={({ pressed }) => [estiloCaixa, pressed && estiloPressionado, desabilitado && estiloDesabilitado]}>
      {carregando && <ActivityIndicator color={corTexto} />}
      <Texto variante={variante} cor={desabilitado ? corDesabilitado : corTexto} numberOfLines={2} centro>{titulo}</Texto>
    </Pressable>
  </Animated.View>;
}

// Primário: a única ação dominante da tela. Desabilitado vira superfície
// neutra (ouro apagado parece defeito, não "ainda não").
export const Botao = props => <BotaoBase {...props} variante="botao" corTexto={COR.sobreOuro} corDesabilitado={COR.textoTerciario}
  estiloCaixa={estilos.botaoPrimario} estiloPressionado={estilos.primarioPressionado} estiloDesabilitado={estilos.primarioDesabilitado} />;
export const BotaoSecundario = props => <BotaoBase {...props} variante="botaoSecundario" corTexto={COR.texto} estiloCaixa={estilos.botaoSecundario} estiloPressionado={estilos.secundarioPressionado} />;

// Ação discreta (texto). `marca` = ouro (navegação); padrão = cinza.
export function BotaoTexto({ titulo, onPress, chevron = false, marca = false, alinhar = "center", rotuloAcessivel, desabilitado = false }) {
  const cor = marca ? COR.ouro : COR.textoSecundario;
  return <Pressable onPress={onPress} disabled={desabilitado} accessibilityRole="button" accessibilityLabel={rotuloAcessivel || titulo} accessibilityState={{ disabled: desabilitado }}
    hitSlop={ESPACO.xs}
    style={({ pressed }) => [estilos.botaoTexto, { alignSelf: alinhar === "center" ? "center" : alinhar === "end" ? "flex-end" : "flex-start" }, pressed && estilos.pressionadoTexto, desabilitado && estilos.desabilitado]}>
    <Texto variante="botaoSecundario" cor={cor}>{titulo}</Texto>
    {chevron && <Icone nome="chevron" cor={cor} tamanho={16} />}
  </Pressable>;
}

// ---------- Estados ----------
// Status conciso: ícone + texto + cor, numa linha só (a altura não muda
// quando o estado muda - o relógio embaixo não pula). Anunciado ao mudar.
export function Status({ tom = "neutro", icone = "ponto", texto, detalhe = "", rotuloAcessivel }) {
  const cor = COR_DO_TOM[tom] || COR.textoSecundario;
  return <View accessible accessibilityLabel={rotuloAcessivel || `${texto}${detalhe ? `, ${detalhe}` : ""}`} accessibilityLiveRegion="polite" style={estilos.status}>
    <Icone nome={icone} cor={cor} tamanho={14} />
    <Texto variante="rotulo" numberOfLines={1} style={estilos.statusTexto}>
      {texto}{!!detalhe && <Texto variante="rotulo" cor={COR.textoSecundario}>{` · ${detalhe}`}</Texto>}
    </Texto>
  </View>;
}

// Mensagem em superfície neutra; o tom fica no ícone e no título.
// info = neutra · atencao = amarelo · erro = vermelho (só falha real).
export function Mensagem({ tom = "info", titulo, children }) {
  const cor = COR_DO_TOM[tom] || COR.textoSecundario;
  const icone = tom === "erro" ? "erro" : tom === "sucesso" ? "ok" : "alerta";
  return <View style={estilos.mensagem} accessible accessibilityLiveRegion="polite">
    <Icone nome={icone} cor={cor} tamanho={20} />
    <View style={estilos.mensagemTexto}>
      {!!titulo && <Rotulo>{titulo}</Rotulo>}
      {typeof children === "string" ? <Corpo secundario={!!titulo}>{children}</Corpo> : children}
    </View>
  </View>;
}

// Entrada de estado (sucesso, erro): opacidade + escala + leve subida.
function useEntrada(duracao = MOVIMENTO.sucesso) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: duracao, useNativeDriver: true }).start(); }, [v, duracao]);
  return {
    opacity: v,
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [ESPACO.sm, 0] }) }],
  };
}

// Estado que ocupa a tela: selo, título, conteúdo e ações embaixo.
// Rola só se não couber (tela pequena ou fonte do sistema aumentada).
export function EstadoCentral({ tom = "sucesso", titulo, children, acoes, selo = true }) {
  const entrada = useEntrada(tom === "sucesso" ? MOVIMENTO.sucesso : MOVIMENTO.lento);
  return <Animated.View style={[estilos.estadoCentral, entrada]}>
    <ScrollView style={estilos.estadoRolagem} contentContainerStyle={estilos.estadoMiolo}>
      <View style={estilos.estadoCabeca} accessible accessibilityLiveRegion="assertive">
        {selo && <Selo tom={tom} />}
        <Hero centro accessibilityRole="header">{titulo}</Hero>
      </View>
      {children}
    </ScrollView>
    {!!acoes && <View style={estilos.acoes}>{acoes}</View>}
  </Animated.View>;
}

// Barra de tempo do comprovante (escala horizontal, não largura).
export function BarraTempo({ duracaoMs }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.timing(v, { toValue: 0, duration: duracaoMs, useNativeDriver: true }).start(); }, [v, duracaoMs]);
  return <View style={estilos.barraTrilho} accessible={false}>
    <Animated.View style={[estilos.barra, { transform: [{ scaleX: v }] }]} />
  </View>;
}

// Progresso de passos (● ○ ○) com texto acessível.
export function Passos({ total, feitos }) {
  return <View accessible accessibilityLabel={`${feitos} de ${total} concluídas`} style={estilos.passos}>
    {Array.from({ length: total }, (_, i) => <View key={i} style={[estilos.passo, i < feitos && estilos.passoFeito]} />)}
  </View>;
}

// ---------- Campos ----------
export function Campo({ rotulo, grande = false, mono = false, style, ...props }) {
  const [foco, setFoco] = useState(false);
  const tipo = TIPO[grande ? "codigo" : mono ? "mono" : "corpo"];
  return <TextInput accessibilityLabel={rotulo} placeholderTextColor={COR.textoTerciario} selectionColor={COR.ouro} maxFontSizeMultiplier={tipo.escalaMax}
    {...props}
    onFocus={e => { setFoco(true); props.onFocus?.(e); }} onBlur={e => { setFoco(false); props.onBlur?.(e); }}
    style={[estilos.campo, { fontFamily: tipo.fontFamily, fontSize: tipo.fontSize }, grande && estilos.campoGrande, foco && estilos.campoFoco, style]} />;
}

// Código de 8 casas (pareamento). Um TextInput invisível sobre as casas
// recebe o teclado; as casas só desenham. Casa ativa em ouro (foco).
export function CampoCodigo({ casas, valor, aoMudar, rotulo, total = 8 }) {
  const entrada = useRef(null);
  const [foco, setFoco] = useState(false);
  const metade = Math.ceil(total / 2);
  const grupo = lista => <View style={estilos.casasGrupo}>
    {lista.map((c, i) => <View key={i} style={[estilos.casa, foco && c.ativa && estilos.casaAtiva]}>
      <Texto variante="codigo" centro>{c.digito}</Texto>
    </View>)}
  </View>;
  return <Pressable onPress={() => entrada.current?.focus()} accessible={false} style={estilos.casas}>
    {grupo(casas.slice(0, metade))}
    {grupo(casas.slice(metade))}
    <TextInput ref={entrada} value={valor} onChangeText={aoMudar} keyboardType="number-pad" maxLength={total} autoFocus
      accessibilityLabel={rotulo} onFocus={() => setFoco(true)} onBlur={() => setFoco(false)} caretHidden
      style={estilos.entradaInvisivel} />
  </Pressable>;
}

// ---------- Câmera ----------
// Moldura desenhada: raio 24, fundo preto, guia facial e instrução integrada.
// estado da guia: "neutro" | "detectado" (ouro) | "confirmado" (verde).
export function GuiaFacial({ estado = "neutro" }) {
  const cor = estado === "confirmado" ? COR.sucesso : estado === "detectado" ? COR.ouro : COR.guiaNeutra;
  const pulso = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (estado === "neutro") return;
    Animated.sequence([
      Animated.timing(pulso, { toValue: 1.04, duration: MOVIMENTO.rapido, useNativeDriver: true }),
      Animated.timing(pulso, { toValue: 1, duration: MOVIMENTO.lento, useNativeDriver: true }),
    ]).start();
  }, [estado, pulso]);
  return <View pointerEvents="none" accessible={false} style={estilos.guiaCamada}>
    <Animated.View style={[estilos.guia, { borderColor: cor, borderWidth: estado === "neutro" ? 2 : 3, transform: [{ scale: pulso }] }]} />
  </View>;
}

export function MolduraCamera({ children, guia, instrucao, aviso, style }) {
  return <View style={[estilos.moldura, style]}>
    {children}
    {!!guia && <GuiaFacial estado={guia} />}
    {!!instrucao && <View pointerEvents="none" style={estilos.instrucaoCamera}>
      <Texto variante="tituloSecao" centro accessibilityLiveRegion="polite">{instrucao}</Texto>
    </View>}
    {!!aviso && <View style={estilos.avisoCamera}>{aviso}</View>}
  </View>;
}

const estilos = StyleSheet.create({
  centro: { textAlign: "center" },
  tela: {
    flex: 1, backgroundColor: COR.fundo, gap: ESPACO.lg,
    paddingHorizontal: ESPACO.xl,
  },
  telaCentro: { justifyContent: "center" },
  cabecalho: { gap: ESPACO.sm },
  voltar: { flexDirection: "row", alignItems: "center", gap: ESPACO.xs, minHeight: TOQUE.minimo, alignSelf: "flex-start", paddingRight: ESPACO.md },
  superficie: { backgroundColor: COR.superficie, borderRadius: RAIO.painel, borderWidth: 1, borderColor: COR.borda, padding: ESPACO.xl, gap: ESPACO.md },
  divisor: { height: StyleSheet.hairlineWidth, backgroundColor: COR.divisor },
  secao: { gap: ESPACO.sm },
  secaoTitulo: { paddingHorizontal: ESPACO.lg },
  secaoRodape: { paddingHorizontal: ESPACO.lg },
  grupo: { backgroundColor: COR.superficie, borderRadius: RAIO.painel, borderWidth: 1, borderColor: COR.borda, overflow: "hidden" },
  linha: { minHeight: TOQUE.linha, paddingHorizontal: ESPACO.lg, paddingVertical: ESPACO.md, flexDirection: "row", alignItems: "center", gap: ESPACO.md },
  linhaPressionada: { backgroundColor: COR.superficieElevada },
  linhaCorpo: { flex: 1, flexDirection: "row", alignItems: "center", gap: ESPACO.md },
  linhaEmpilhada: { flexDirection: "column", alignItems: "flex-start", gap: ESPACO.xs },
  linhaRotulo: { flexShrink: 1 },
  linhaValor: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: ESPACO.sm },
  linhaValorEmpilhado: { justifyContent: "flex-start" },
  textoDireita: { textAlign: "right", flexShrink: 1 },
  botaoPrimario: {
    minHeight: TOQUE.primario, borderRadius: RAIO.botao, backgroundColor: COR.ouro,
    paddingHorizontal: ESPACO.xxl, paddingVertical: ESPACO.md, flexDirection: "row", gap: ESPACO.md, alignItems: "center", justifyContent: "center",
  },
  primarioPressionado: { opacity: 0.88 },
  primarioDesabilitado: { backgroundColor: COR.superficieElevada, borderWidth: 1, borderColor: COR.borda },
  botaoSecundario: {
    minHeight: TOQUE.secundario, borderRadius: RAIO.botao, backgroundColor: COR.superficieElevada, borderWidth: 1, borderColor: COR.borda,
    paddingHorizontal: ESPACO.xl, paddingVertical: ESPACO.md, flexDirection: "row", gap: ESPACO.md, alignItems: "center", justifyContent: "center",
  },
  secundarioPressionado: { backgroundColor: COR.superficie },
  botaoTexto: { minHeight: TOQUE.minimo, flexDirection: "row", alignItems: "center", gap: ESPACO.xs, paddingHorizontal: ESPACO.sm },
  pressionadoTexto: { opacity: 0.6 },
  desabilitado: { opacity: 0.4 },
  status: {
    flexDirection: "row", alignItems: "center", gap: ESPACO.sm, backgroundColor: COR.superficie, borderRadius: RAIO.pilula, flexShrink: 1,
    borderWidth: 1, borderColor: COR.borda, paddingHorizontal: ESPACO.md, paddingVertical: ESPACO.xs, minHeight: TOQUE.minimo - ESPACO.md,
  },
  statusTexto: { flexShrink: 1 },
  mensagem: { flexDirection: "row", gap: ESPACO.md, backgroundColor: COR.superficie, borderRadius: RAIO.controle, padding: ESPACO.lg, alignItems: "flex-start" },
  mensagemTexto: { flex: 1, gap: ESPACO.xs },
  estadoCentral: { flex: 1, justifyContent: "space-between", gap: ESPACO.xxl },
  estadoRolagem: { flex: 1 },
  estadoMiolo: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: ESPACO.md },
  estadoCabeca: { alignItems: "center", gap: ESPACO.lg },
  acoes: { gap: ESPACO.sm },
  barraTrilho: { height: 2, backgroundColor: COR.divisor, borderRadius: RAIO.pilula, overflow: "hidden" },
  barra: { height: 2, backgroundColor: COR.ouro, transformOrigin: "left" },
  passos: { flexDirection: "row", gap: ESPACO.sm, justifyContent: "center" },
  passo: { width: ESPACO.md, height: ESPACO.md, borderRadius: RAIO.pilula, borderWidth: 2, borderColor: COR.textoSecundario },
  passoFeito: { backgroundColor: COR.ouro, borderColor: COR.ouro },
  campo: {
    minHeight: TOQUE.secundario, borderRadius: RAIO.controle, backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.borda,
    color: COR.texto, paddingHorizontal: ESPACO.lg, paddingVertical: ESPACO.md,
  },
  campoGrande: { minHeight: TOQUE.primario, textAlign: "center", letterSpacing: ESPACO.sm },
  campoFoco: { borderColor: COR.ouro, borderWidth: 2 },
  casas: { flexDirection: "row", justifyContent: "center", gap: ESPACO.lg },
  casasGrupo: { flexDirection: "row", gap: ESPACO.xs },
  casa: {
    width: ESPACO.x3, height: TOQUE.secundario, borderRadius: RAIO.pequeno, backgroundColor: COR.superficie,
    borderWidth: 1, borderColor: COR.borda, alignItems: "center", justifyContent: "center",
  },
  casaAtiva: { borderColor: COR.ouro, borderWidth: 2 },
  entradaInvisivel: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  moldura: { flex: 1, borderRadius: RAIO.camera, overflow: "hidden", backgroundColor: COR.camera },
  guiaCamada: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  guia: { width: "58%", maxWidth: 320, aspectRatio: 1, borderRadius: RAIO.pilula },
  instrucaoCamera: { position: "absolute", left: 0, right: 0, bottom: 0, paddingVertical: ESPACO.lg, paddingHorizontal: ESPACO.xl, backgroundColor: COR.veu },
  avisoCamera: { position: "absolute", left: 0, right: 0, top: 0, padding: ESPACO.md },
});
