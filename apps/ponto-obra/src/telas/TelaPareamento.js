// Primeira tela do aparelho: vincula o celular a uma obra com o código de 8
// números gerado no ARCD (aba Ponto eletrônico → Parear aparelho).
import { useState } from "react";
import { TextInput, View } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import { Botao, COR, Mensagem, Texto, Titulo, estilos } from "../ui";

export default function TelaPareamento({ api, aoParear }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const parear = async () => {
    setEnviando(true); setErro("");
    const r = await api("ponto-parear", {
      codigo,
      appVersao: Application.nativeApplicationVersion || "",
      aparelho: { marca: Device.brand, modelo: Device.modelName, android: Device.osVersion },
    });
    setEnviando(false);
    if (!r.ok) { setErro(r.error || "Não foi possível parear."); return; }
    await aoParear({ token: r.token, dispositivoId: r.dispositivoId, obra: r.obra, nome: r.nome });
  };

  return (
    <View style={[estilos.tela, { justifyContent: "center" }]}>
      <Titulo>Ponto de Obra</Titulo>
      <Texto apagado>No ARCD, abra Recursos humanos → Ponto eletrônico (app) → Parear aparelho, e digite aqui o código de 8 números.</Texto>
      <TextInput
        value={codigo}
        onChangeText={v => setCodigo(v.replace(/\D/g, "").slice(0, 8))}
        keyboardType="number-pad"
        maxLength={8}
        placeholder="0000 0000"
        placeholderTextColor={COR.linha}
        accessibilityLabel="Código de pareamento"
        style={{ fontSize: 40, letterSpacing: 8, color: COR.texto, textAlign: "center", borderBottomWidth: 2, borderColor: COR.ouro, paddingVertical: 10 }}
      />
      {!!erro && <Mensagem tipo="erro">{erro}</Mensagem>}
      <Botao titulo="Parear este aparelho" grande onPress={parear} carregando={enviando} desabilitado={codigo.length !== 8} />
    </View>
  );
}
