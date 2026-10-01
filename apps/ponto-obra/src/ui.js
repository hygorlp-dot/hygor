// Componentes visuais do app (identidade ARCD: grafite, ouro como destaque,
// verde/vermelho só para resultado). Aparelho de parede: letra e alvo de
// toque grandes.
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

export const COR = {
  fundo: "#161616", painel: "#262626", linha: "#393939", texto: "#F4F4F4", apagado: "#A8A8A8",
  ouro: "#D4AF37", verde: "#24A148", vermelho: "#DA1E28", laranja: "#F1C21B",
};

export function Botao({ titulo, onPress, tipo = "principal", desabilitado = false, carregando = false, grande = false }) {
  const cor = { principal: COR.ouro, perigo: COR.vermelho, secundario: COR.painel }[tipo] || COR.ouro;
  const corTexto = tipo === "principal" ? COR.fundo : COR.texto;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desabilitado || carregando }}
      disabled={desabilitado || carregando}
      onPress={onPress}
      style={({ pressed }) => [estilos.botao, grande && estilos.botaoGrande, { backgroundColor: cor, opacity: desabilitado ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        tipo === "secundario" && { borderWidth: 1, borderColor: COR.linha }]}>
      {carregando ? <ActivityIndicator color={corTexto} /> : <Text style={[estilos.textoBotao, grande && estilos.textoBotaoGrande, { color: corTexto }]}>{titulo}</Text>}
    </Pressable>
  );
}

export const Titulo = ({ children, style }) => <Text style={[estilos.titulo, style]}>{children}</Text>;
export const Texto = ({ children, apagado, style }) => <Text style={[estilos.texto, apagado && { color: COR.apagado }, style]}>{children}</Text>;
export const Painel = ({ children, style }) => <View style={[estilos.painel, style]}>{children}</View>;

export function Mensagem({ tipo = "info", children }) {
  const cor = { erro: COR.vermelho, sucesso: COR.verde, aviso: COR.laranja, info: COR.linha }[tipo];
  return <View style={[estilos.mensagem, { borderColor: cor }]}><Text style={estilos.texto}>{children}</Text></View>;
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo, padding: 20, gap: 14 },
  botao: { minHeight: 56, borderRadius: 8, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  botaoGrande: { minHeight: 76 },
  textoBotao: { fontSize: 18, fontWeight: "600" },
  textoBotaoGrande: { fontSize: 24 },
  titulo: { fontSize: 26, fontWeight: "400", color: COR.texto },
  texto: { fontSize: 17, color: COR.texto, lineHeight: 24 },
  painel: { backgroundColor: COR.painel, borderRadius: 8, padding: 16, gap: 10 },
  mensagem: { borderWidth: 1, borderRadius: 8, padding: 14 },
});
