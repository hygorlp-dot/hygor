// Tela de batida (fica sempre aberta no aparelho da obra).
// Fluxo: foto de frente → reconhece entre os cadastrados da obra → pede para
// virar o rosto (prova de vida contra foto impressa) → registra com foto e
// GPS → mostra o comprovante. Se não reconhecer, o encarregado identifica:
// a batida nunca é impedida (Portaria 671/2021).
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { identificar, similaridadeCosseno } from "../logica/rosto";
import { PARAMETROS_FACIAIS as P } from "../logica/calibracao";
import { estadoPermissaoCamera, mensagemDeErro } from "../logica/falhas";
import { resumoCadastro } from "../logica/cadastro";
import { analisarFoto, apagarFotoLocal } from "../servicos/rosto-nativo";
import { Botao, COR, Mensagem, Painel, Texto, Titulo, estilos } from "../ui";

const esperar = ms => new Promise(r => setTimeout(r, ms));
const fmtHora = ms => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtData = ms => new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Recife", weekday: "long", day: "2-digit", month: "long" });

export default function TelaPonto({ obra, relogio, modelos, erroModelos, cadastro, registrar, situacao, abrirEncarregado }) {
  useKeepAwake();
  const camera = useRef(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [agora, setAgora] = useState(() => relogio.agora());
  const [fluxo, setFluxo] = useState({ etapa: "pronto" });
  const [erroCamera, setErroCamera] = useState("");
  const timerSucesso = useRef(null);
  const estadoCamera = estadoPermissaoCamera(permissao);

  useEffect(() => { const t = setInterval(() => setAgora(relogio.agora()), 1000); return () => clearInterval(t); }, [relogio]);
  useEffect(() => () => clearTimeout(timerSucesso.current), []);
  // Pede só uma vez sozinho; negada de vez, o Android não mostra mais o
  // pedido - aí o caminho é o botão das configurações (sem repetir em loop).
  const jaPediu = useRef(false);
  useEffect(() => {
    if (estadoCamera === "pedir" && !jaPediu.current) { jaPediu.current = true; pedirPermissao().catch(() => {}); }
  }, [estadoCamera, pedirPermissao]);

  // Obra recém-pareada: sem rosto cadastrado, "Bater ponto" só falharia.
  const { comRosto, totalFuncionarios, semRostos, temResponsavel } = resumoCadastro(cadastro);

  const falha = (mensagem, extra = {}) => setFluxo({ etapa: "falha", mensagem, ...extra });
  const foto = async () => {
    if (!camera.current) throw new Error("câmera não está pronta");
    return camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
  };

  const baterPonto = async () => {
    if (!modelos) return falha(erroModelos || "Reconhecimento facial indisponível neste aparelho. O encarregado pode registrar o ponto.", { podeEncarregado: true });
    let etapa = "camera";
    // Capturas cruas da câmera: apagadas no fim, aconteça o que acontecer (a
    // foto da batida é uma cópia preparada por registrar()).
    const cruas = [];
    try {
      setFluxo({ etapa: "analisando", texto: "Olhe para a câmera..." });
      const fotoFrente = await foto();
      cruas.push(fotoFrente.uri);
      etapa = "modelos";
      const frente = await analisarFoto(modelos, fotoFrente);
      if (frente.erro) return falha(frente.erro, { podeEncarregado: true });
      if (Math.abs(frente.giro) > P.giroMaximoDeFrente) return falha("Olhe de frente para a câmera e tente de novo.");
      const id = identificar(frente.vetor, cadastro?.biometrias || []);
      if (!id.reconhecido) return falha(id.motivo === "rosto não cadastrado nesta obra" ? "Não reconheci seu rosto. Se você ainda não tem cadastro, chame o encarregado." : "Não tenho certeza de quem é. Chame o encarregado.", { podeEncarregado: true });
      const funcionario = (cadastro.funcionarios || []).find(f => f.id === id.employeeId);
      if (!funcionario) return falha("Cadastro desatualizado neste aparelho. Chame o encarregado.", { podeEncarregado: true });

      setFluxo({ etapa: "analisando", texto: `${funcionario.nome.split(" ")[0]}, vire o rosto devagar para o lado` });
      await esperar(P.esperaAntesDaViradaMs);
      etapa = "camera";
      const fotoVirada = await foto();
      cruas.push(fotoVirada.uri);
      etapa = "modelos";
      const virado = await analisarFoto(modelos, fotoVirada);
      const vivo = !virado.erro && Math.abs(virado.giro) >= P.giroMinimoVirado && similaridadeCosseno(frente.vetor, virado.vetor) >= P.similaridadeMinimaVirado;
      if (!vivo) return falha("Não consegui confirmar. Tente de novo: olhe de frente e, quando pedir, vire o rosto devagar.", { podeEncarregado: true });

      setFluxo({ etapa: "analisando", texto: "Registrando..." });
      etapa = "batida";
      const comprovante = await registrar({ pessoa: { tipo: "funcionario", ...funcionario }, identificacao: { metodo: "facial", confianca: id.confianca }, foto: fotoFrente });
      setFluxo({ etapa: "sucesso", comprovante });
      clearTimeout(timerSucesso.current);
      timerSucesso.current = setTimeout(() => setFluxo(f => (f.etapa === "sucesso" ? { etapa: "pronto" } : f)), comprovante.avisoFoto ? 12000 : 7000);
    } catch (e) {
      falha(mensagemDeErro(etapa, e), { podeEncarregado: true });
    } finally {
      cruas.forEach(apagarFotoLocal);
    }
  };

  // Sem câmera o ponto NÃO fica impedido: o encarregado continua podendo
  // registrar (sem foto) pelo modo Encarregado.
  if (estadoCamera !== "concedida") {
    return <View style={[estilos.tela, { justifyContent: "center" }]}>
      <Titulo>Câmera necessária</Titulo>
      {estadoCamera === "configuracoes"
        ? <>
          <Texto apagado>A permissão da câmera foi negada neste aparelho. Abra as configurações do app, toque em "Permissões" e libere a "Câmera".</Texto>
          <Botao titulo="Abrir configurações do app" onPress={() => Linking.openSettings().catch(() => {})} />
        </>
        : <>
          <Texto apagado>O ponto é registrado pelo reconhecimento do rosto. Permita o uso da câmera.</Texto>
          <Botao titulo="Permitir câmera" onPress={() => pedirPermissao().catch(() => {})} carregando={estadoCamera === "carregando"} />
        </>}
      <Botao titulo="Encarregado registra o ponto" tipo="secundario" onPress={abrirEncarregado} />
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
        {!!situacao.aviso && situacao.online && <Text style={{ color: COR.laranja, fontSize: 13 }}>{situacao.aviso}</Text>}
        {!semRostos && comRosto < totalFuncionarios && <Text style={{ color: COR.apagado, fontSize: 14 }}>{comRosto} de {totalFuncionarios} funcionários com rosto cadastrado</Text>}
      </View>

      <View style={{ flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="front" mirror onMountError={() => setErroCamera("A câmera não abriu. Feche e abra o app; se continuar, o encarregado pode registrar o ponto.")} />
        {!!erroCamera && <View style={{ position: "absolute", left: 0, right: 0, top: 0, padding: 12 }}><Mensagem tipo="erro">{erroCamera}</Mensagem></View>}
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
      {semRostos && fluxo.etapa === "pronto" && <Painel>
        <Titulo style={{ fontSize: 22 }}>Cadastre os rostos da equipe</Titulo>
        <Texto apagado>{temResponsavel
          ? "Ninguém desta obra tem rosto cadastrado ainda. O encarregado entra com o PIN e cadastra cada funcionário; depois o ponto é batido olhando para a câmera."
          : "Primeiro cadastre o PIN do encarregado no ARCD (Ponto eletrônico (app) → Responsáveis com PIN do app). Depois toque abaixo e em \"Buscar no ARCD\"."}</Texto>
        <Botao titulo="Cadastrar rostos (encarregado)" grande onPress={abrirEncarregado} />
      </Painel>}
      {!semRostos && (fluxo.etapa === "pronto" || fluxo.etapa === "analisando") && <Botao titulo="Bater ponto" grande onPress={baterPonto} carregando={fluxo.etapa === "analisando"} />}

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
      {!!c.avisoFoto && <Text style={{ color: COR.laranja, fontSize: 14 }}>{c.avisoFoto}</Text>}
    </View>
  );
}
