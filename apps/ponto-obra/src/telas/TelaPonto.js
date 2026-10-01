// Tela de batida (fica sempre aberta no aparelho da obra).
// Fluxo: foto de frente → reconhece entre os cadastrados da obra → pede para
// virar o rosto (prova de vida contra foto impressa) → registra com foto e
// GPS → mostra o comprovante. Se não reconhecer, o encarregado identifica:
// a batida nunca é impedida (Portaria 671/2021).
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { identificar, similaridadeCosseno } from "../logica/rosto";
import { analisarFoto } from "../servicos/rosto-nativo";
import { Botao, COR, Mensagem, Texto, Titulo, estilos } from "../ui";

const GIRO_FRENTE = 0.15, GIRO_VIRADO = 0.2, MESMA_PESSOA_VIRADA = 0.35;
const esperar = ms => new Promise(r => setTimeout(r, ms));
const fmtHora = ms => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtData = ms => new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Recife", weekday: "long", day: "2-digit", month: "long" });

export default function TelaPonto({ obra, relogio, modelos, erroModelos, cadastro, registrar, situacao, abrirEncarregado }) {
  useKeepAwake();
  const camera = useRef(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [agora, setAgora] = useState(() => relogio.agora());
  const [fluxo, setFluxo] = useState({ etapa: "pronto" });

  useEffect(() => { const t = setInterval(() => setAgora(relogio.agora()), 1000); return () => clearInterval(t); }, [relogio]);
  useEffect(() => { if (permissao && !permissao.granted && permissao.canAskAgain) pedirPermissao(); }, [permissao, pedirPermissao]);

  const falha = (mensagem, extra = {}) => setFluxo({ etapa: "falha", mensagem, ...extra });
  const foto = () => camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });

  const baterPonto = async () => {
    if (!modelos) return falha(erroModelos || "Reconhecimento facial indisponível neste aparelho.", { podeEncarregado: true });
    try {
      setFluxo({ etapa: "analisando", texto: "Olhe para a câmera..." });
      const fotoFrente = await foto();
      const frente = await analisarFoto(modelos, fotoFrente);
      if (frente.erro) return falha(frente.erro, { podeEncarregado: true });
      if (Math.abs(frente.giro) > GIRO_FRENTE) return falha("Olhe de frente para a câmera e tente de novo.");
      const id = identificar(frente.vetor, cadastro?.biometrias || []);
      if (!id.reconhecido) return falha(id.motivo === "rosto não cadastrado nesta obra" ? "Não reconheci seu rosto. Se você ainda não tem cadastro, chame o encarregado." : "Não tenho certeza de quem é. Chame o encarregado.", { podeEncarregado: true });
      const funcionario = (cadastro.funcionarios || []).find(f => f.id === id.employeeId);
      if (!funcionario) return falha("Cadastro desatualizado neste aparelho. Chame o encarregado.", { podeEncarregado: true });

      setFluxo({ etapa: "analisando", texto: `${funcionario.nome.split(" ")[0]}, vire o rosto devagar para o lado` });
      await esperar(1300);
      const virado = await analisarFoto(modelos, await foto());
      const vivo = !virado.erro && Math.abs(virado.giro) >= GIRO_VIRADO && similaridadeCosseno(frente.vetor, virado.vetor) >= MESMA_PESSOA_VIRADA;
      if (!vivo) return falha("Não consegui confirmar. Tente de novo: olhe de frente e, quando pedir, vire o rosto devagar.", { podeEncarregado: true });

      setFluxo({ etapa: "analisando", texto: "Registrando..." });
      const comprovante = await registrar({ pessoa: { tipo: "funcionario", ...funcionario }, identificacao: { metodo: "facial", confianca: id.confianca }, fotoUri: fotoFrente.uri });
      setFluxo({ etapa: "sucesso", comprovante });
      setTimeout(() => setFluxo(f => (f.etapa === "sucesso" ? { etapa: "pronto" } : f)), 7000);
    } catch (e) {
      falha(`Erro no reconhecimento: ${e?.message || e}`, { podeEncarregado: true });
    }
  };

  if (!permissao?.granted) {
    return <View style={[estilos.tela, { justifyContent: "center" }]}>
      <Titulo>Câmera necessária</Titulo>
      <Texto apagado>O ponto é registrado pelo reconhecimento do rosto. Permita o uso da câmera.</Texto>
      <Botao titulo="Permitir câmera" onPress={pedirPermissao} />
    </View>;
  }

  return (
    <View style={estilos.tela}>
      <View>
        <Text style={{ color: COR.apagado, fontSize: 16 }}>{obra?.nome || "Obra"}</Text>
        <Text accessibilityLabel={`Hora ${fmtHora(agora.marcadoEmMs)}`} style={{ color: COR.texto, fontSize: 64, fontWeight: "300", fontVariant: ["tabular-nums"] }}>{fmtHora(agora.marcadoEmMs)}</Text>
        <Text style={{ color: COR.apagado, fontSize: 16, textTransform: "capitalize" }}>{fmtData(agora.marcadoEmMs)}</Text>
        <Text style={{ color: situacao.online ? COR.verde : COR.laranja, fontSize: 14, marginTop: 4 }}>
          {situacao.online ? "Conectado ao ARCD" : "Sem internet - as batidas ficam guardadas"}{situacao.pendentes ? ` · ${situacao.pendentes} a enviar` : ""}{!agora.horaConfiavel ? " · hora aguardando sincronização" : ""}
        </Text>
      </View>

      <View style={{ flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="front" mirror />
        {fluxo.etapa === "analisando" && <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: "rgba(22,22,22,0.85)" }}>
          <Text style={{ color: COR.texto, fontSize: 22, textAlign: "center" }}>{fluxo.texto}</Text>
        </View>}
      </View>

      {fluxo.etapa === "sucesso" && <Comprovante c={fluxo.comprovante} obra={obra} />}
      {fluxo.etapa === "falha" && <View style={{ gap: 10 }}>
        <Mensagem tipo="erro">{fluxo.mensagem}</Mensagem>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Botao titulo="Tentar de novo" onPress={baterPonto} /></View>
          {fluxo.podeEncarregado && <View style={{ flex: 1 }}><Botao titulo="Chamar encarregado" tipo="secundario" onPress={() => { setFluxo({ etapa: "pronto" }); abrirEncarregado(); }} /></View>}
        </View>
      </View>}
      {(fluxo.etapa === "pronto" || fluxo.etapa === "analisando") && <Botao titulo="Bater ponto" grande onPress={baterPonto} carregando={fluxo.etapa === "analisando"} />}

      <Pressable onPress={abrirEncarregado} accessibilityRole="button" style={{ alignSelf: "flex-end", padding: 10 }}>
        <Text style={{ color: COR.apagado, fontSize: 15 }}>Encarregado</Text>
      </Pressable>
    </View>
  );
}

// Comprovante na tela (a Portaria exige acesso do trabalhador ao registro).
export function Comprovante({ c, obra }) {
  return (
    <View style={{ backgroundColor: COR.painel, borderRadius: 8, padding: 16, gap: 4, borderWidth: 1, borderColor: COR.verde }}>
      <Text style={{ color: COR.verde, fontSize: 18, fontWeight: "600" }}>Ponto registrado</Text>
      <Text style={{ color: COR.texto, fontSize: 22 }}>{c.nome}</Text>
      <Text style={{ color: COR.texto, fontSize: 30, fontVariant: ["tabular-nums"] }}>{fmtHora(Date.parse(c.marcadoEm))}</Text>
      <Text style={{ color: COR.apagado, fontSize: 14 }}>{obra?.nome} · NSR {c.nsr} · {c.cpfMascarado || "CPF não informado"}</Text>
      <Text style={{ color: COR.apagado, fontSize: 12 }}>Código do registro: {c.hash.slice(0, 16)}{c.horaConfiavel ? "" : " · hora do aparelho (será conferida)"}</Text>
    </View>
  );
}
