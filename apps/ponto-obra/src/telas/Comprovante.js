// Comprovante na tela (a Portaria exige acesso do trabalhador ao registro).
// É um estado completo: confirma de longe ("Ponto registrado" + nome + hora)
// e guarda embaixo, em hierarquia menor, o que o comprovante sempre mostrou
// (registro local, CPF mascarado, código, aviso de hora/foto). Sem NSR: ele
// só existe depois que a ARP grava o evento.
import { StyleSheet, View } from "react-native";
import { linhasDoComprovante } from "../logica/apresentacao";
import { BarraTempo, BotaoSecundario, COR, Corpo, ESPACO, EstadoCentral, Mensagem, Rotulo, Status, Tela, Texto, TituloSecao } from "../ui";

export default function Comprovante({ c, obra, online, fuso, aoConcluir, duracaoMs = 0 }) {
  const l = linhasDoComprovante(c, { obra, online, fuso });
  const hora = l.hora;
  return <Tela>
    <EstadoCentral tom="sucesso" titulo={l.titulo} acoes={<>
      {duracaoMs > 0 && <BarraTempo duracaoMs={duracaoMs} />}
      <BotaoSecundario titulo="Concluir" onPress={aoConcluir} />
    </>}>
      <TituloSecao centro>{l.saudacao}</TituloSecao>
      <Texto variante="horaComprovante" centro accessibilityLabel={`Registrado às ${hora}`} style={estilo.numeros}>{hora}</Texto>
      {!!l.obra && <Corpo secundario centro>{l.obra}</Corpo>}
      <Corpo secundario centro accessibilityLabel={l.registro}>Registro local nº <Texto variante="corpo" cor={COR.texto} style={estilo.numeros}>{l.numeroRegistro}</Texto></Corpo>
      {l.batidasHoje.length > 0 && <Rotulo secundario centro accessibilityLabel={`Marcações de hoje: ${l.batidasHoje.join(", ")}`}>
        Hoje: <Texto variante="rotulo" cor={COR.texto} style={estilo.numeros}>{l.batidasHoje.join("  ·  ")}</Texto>
      </Rotulo>}
      <Status {...l.envio} detalhe="" rotuloAcessivel={[l.envio.texto, l.envio.detalhe].filter(Boolean).join(". ")} />
      {!!l.envio.detalhe && <Rotulo secundario centro>{l.envio.detalhe}</Rotulo>}
      <View style={estilo.detalhes}>
        {l.detalhes.map(d => <Rotulo key={d.rotulo} secundario centro>{d.rotulo}: <Texto variante={d.mono ? "mono" : "rotulo"} cor={COR.textoSecundario}>{d.valor}</Texto></Rotulo>)}
      </View>
      {l.avisos.map(a => <Mensagem key={a} tom="atencao">{a}</Mensagem>)}
    </EstadoCentral>
  </Tela>;
}

const estilo = StyleSheet.create({
  numeros: { fontVariant: ["tabular-nums"] },
  detalhes: { alignItems: "center", gap: ESPACO.xs, paddingTop: ESPACO.sm },
});
