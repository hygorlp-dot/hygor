// Primeira tela do aparelho: vincula o celular a uma obra com o código de 8
// números gerado no ARCD (aba Ponto eletrônico → Parear aparelho).
// Depois do OK do ARCD, mostra "Aparelho vinculado" enquanto o App guarda a
// sessão e baixa o cadastro (aoParear) - a ordem das operações não mudou.
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { classificarResposta, mensagemDeErro } from "../logica/falhas";
import { casasDoCodigo } from "../logica/apresentacao";
import { infoDoAparelho, infoDoApp } from "../servicos/conexao";
import { Botao, COR, CampoCodigo, Corpo, ESPACO, EstadoCentral, Legenda, Mensagem, Tela, Texto, Titulo } from "../ui";

export default function TelaPareamento({ api, aoParear }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [vinculado, setVinculado] = useState(null);   // { obra } depois do OK

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
      setVinculado({ obra: r.obra });
      await aoParear({ token: r.token, dispositivoId: r.dispositivoId, obra: r.obra, nome: r.nome });
    } catch (e) {
      setVinculado(null);
      setErro(mensagemDeErro("pareamento", e));
    } finally {
      setEnviando(false);
    }
  };

  if (vinculado) return <Tela>
    <EstadoCentral tom="sucesso" titulo="Aparelho vinculado">
      {!!vinculado.obra?.nome && <Texto variante="tituloSecao" cor={COR.textoSecundario} centro>{vinculado.obra.nome}</Texto>}
      <View style={estilos.preparando} accessible accessibilityLabel="Preparando o aparelho">
        <ActivityIndicator color={COR.textoSecundario} />
        <Corpo secundario>Preparando o aparelho</Corpo>
      </View>
    </EstadoCentral>
  </Tela>;

  return (
    <KeyboardAvoidingView behavior="height" style={estilos.teclado}>
      <Tela centro>
        <View style={estilos.cabeca}>
          <Texto variante="secao" cor={COR.ouro}>PONTO DE OBRA</Texto>
          <Titulo>Vincular aparelho</Titulo>
          <Corpo secundario>Digite o código exibido no ARCD.</Corpo>
        </View>
        <CampoCodigo casas={casasDoCodigo(codigo)} valor={codigo} rotulo="Código de pareamento, 8 números"
          aoMudar={v => { setCodigo(v.replace(/\D/g, "").slice(0, 8)); if (erro) setErro(""); }} />
        <Legenda>No ARCD: Recursos humanos → Ponto eletrônico (app) → Parear aparelho.</Legenda>
        {!!erro && <Mensagem tom="erro" titulo="Não foi possível vincular">{erro}</Mensagem>}
        <Botao titulo="Vincular aparelho" onPress={parear} carregando={enviando} desabilitado={codigo.length !== 8} />
      </Tela>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  teclado: { flex: 1, backgroundColor: COR.fundo },
  cabeca: { gap: ESPACO.sm },
  preparando: { flexDirection: "row", alignItems: "center", gap: ESPACO.sm, paddingTop: ESPACO.lg },
});
