// Primeira tela do aparelho: vincula o celular a uma obra com o código de 8
// números gerado no ARCD (aba Ponto eletrônico → Parear aparelho).
import { useState } from "react";
import { TextInput, View } from "react-native";
import { classificarResposta, mensagemDeErro } from "../logica/falhas";
import { infoDoAparelho, infoDoApp } from "../servicos/conexao";
import { Botao, COR, Mensagem, Texto, Titulo, estilos } from "../ui";

export default function TelaPareamento({ api, aoParear }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const parear = async () => {
    setEnviando(true); setErro("");
    try {
      const app = infoDoApp(), aparelho = infoDoAparelho();
      const r = await api("ponto-parear", {
        codigo,
        appVersao: app.build ? `${app.versao} (${app.build})` : app.versao,
        aparelho: { marca: aparelho.marca, modelo: aparelho.modelo, android: aparelho.android, build: app.build, commit: app.commit },
      });
      if (!r.ok) {
        const c = classificarResposta(r);
        setErro(c.tipo === "sem_rede" ? "Sem internet. O pareamento precisa de conexão; depois disso o app funciona sem internet." : c.mensagem);
        return;
      }
      await aoParear({ token: r.token, dispositivoId: r.dispositivoId, obra: r.obra, nome: r.nome });
    } catch (e) {
      setErro(mensagemDeErro("pareamento", e));
    } finally {
      setEnviando(false);
    }
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
