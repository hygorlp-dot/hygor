// Primeira tela do aparelho: vincula o celular a uma obra com o código de 8
// números gerado no ARCD (aba Ponto eletrônico → Parear aparelho).
// Depois do OK do ARCD, mostra "Aparelho vinculado" enquanto o App guarda a
// sessão e baixa o cadastro (aoParear) - a ordem das operações não mudou.
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, StyleSheet, View } from "react-native";
import { classificarResposta, mensagemDeErro } from "../logica/falhas";
import { casasDoCodigo } from "../logica/apresentacao";
import { AMBIENTE, conferirAmbiente, infoDoAparelho, infoDoApp, infoDoServidor } from "../servicos/conexao";
import { rotuloDoServidor } from "../logica/diagnostico";
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
      // 1) Ambiente do servidor antes de gastar o código. Servidor antigo (sem a
      //    ação) responde 400 sem "ambiente" = produção.
      const amb = await api("ponto-ambiente");
      if (!amb.ok && (amb.status === 0 || amb.status === -1 || amb.code === "AMBIENTE_NAO_CONFIRMADO")) {
        const c = classificarResposta(amb);
        setErro(c.tipo === "sem_rede" ? "Sem internet. O pareamento precisa de conexão; depois disso o app funciona sem internet." : c.mensagem);
        return;
      }
      const antes = conferirAmbiente(AMBIENTE, amb.ambiente);
      if (!antes.ok) { setErro(antes.mensagem); return; }
      const r = await api("ponto-parear", {
        codigo,
        appVersao: app.build ? `${app.versao} (${app.build})` : app.versao,
        aparelho: { marca: aparelho.marca, modelo: aparelho.modelo, android: aparelho.android, build: app.build, commit: app.commit, ambiente: app.ambiente },
      });
      if (!r.ok) {
        const c = classificarResposta(r);
        setErro(c.tipo === "sem_rede" ? "Sem internet. O pareamento precisa de conexão; depois disso o app funciona sem internet." : c.mensagem);
        return;
      }
      // 2) Confere de novo na resposta (o servidor também recusa divergência sem criar o aparelho).
      const depois = conferirAmbiente(AMBIENTE, r.ambiente);
      if (!depois.ok) { setErro(depois.mensagem); return; }
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
        {/* Antes de digitar o código: em qual ARCD este aparelho vai gravar. */}
        {infoDoServidor().bloqueado
          ? <Mensagem tom="erro" titulo="Aplicativo sem servidor">Este build não tem servidor configurado (ou a homologação apontaria para a produção). Nada pode ser vinculado.</Mensagem>
          : AMBIENTE === "homologacao"
            ? <Mensagem tom="atencao" titulo="HOMOLOGAÇÃO — NÃO OFICIAL">Aparelho de teste: vincule só a um ARCD de homologação. Batidas aqui não são registro oficial.</Mensagem>
            : null}
        <Legenda>Servidor: {rotuloDoServidor(infoDoServidor())}</Legenda>
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
