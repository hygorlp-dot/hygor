// Terminal autônomo de ponto.
// Tela apagada = Android dorme normalmente. Ao voltar para foreground,
// monta a câmera, captura uma foto e identifica 1:N sem botão intermediário.
// Depois do comprovante a câmera é desmontada; se ninguém usar, o próprio
// timeout do Android apaga a tela. Qualquer toque na área principal rearma
// uma nova tentativa. O modelo TFLite permanece carregado, mas sem inferência.
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { MOTIVO, identificar } from "../logica/rosto";
import { PARAMETROS_FACIAIS as P } from "../logica/calibracao";
import { estadoPermissaoCamera, mensagemParaTrabalhador } from "../logica/falhas";
import { resumoCadastro } from "../logica/cadastro";
import { FASE, falaDeConfirmacao, falhaNaTela, formatarData, formatarHora, fusoDoCadastro, guiaDaFase, instrucaoDaFase, statusDoAparelho, telaSemCamera } from "../logica/apresentacao";
import { analisarFoto, apagarFotoLocal } from "../servicos/rosto-nativo";
import { brilhoMaximo, brilhoNormal, falar, vibrar } from "../servicos/feedback";
import { RESULTADO as RESULTADO_CALIBRACAO } from "../logica/calibracao-campo";
import { Botao, BotaoTexto, COMPROVANTE_MS, COR, COR_DO_TOM, Corpo, ESPACO, Icone, Mensagem, MolduraCamera, RAIO, Rotulo, Status, Tela, Texto, TituloSecao } from "../ui";
import Comprovante from "./Comprovante";

const CAMERA_ESPERA_MAX_MS = 15_000;
const ATRASO_CAPTURA_AUTOMATICA_MS = 750;
const RELOGIO_TELA_MS = 30_000;

export default function TelaPonto({ obra, relogio, modelos, cadastro, registrar, situacao, abrirEncarregado, voz = true, medir = () => {}, calibrar = null }) {
  const camera = useRef(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [agora, setAgora] = useState(() => relogio.agora());
  const [fluxo, setFluxo] = useState({ etapa: "pronto", fase: FASE.PRONTO });
  const fluxoRef = useRef(fluxo);
  const [terminalAtivo, setTerminalAtivo] = useState(() => AppState.currentState === "active");
  const [erroCamera, setErroCamera] = useState("");
  const timerSucesso = useRef(null);
  const timerCamera = useRef(null);
  const timerAuto = useRef(null);
  const autoDisparou = useRef(false);
  const estadoApp = useRef(AppState.currentState);
  const estadoCamera = estadoPermissaoCamera(permissao);

  useEffect(() => { fluxoRef.current = fluxo; }, [fluxo]);
  useEffect(() => {
    const t = setInterval(() => setAgora(relogio.agora()), RELOGIO_TELA_MS);
    return () => clearInterval(t);
  }, [relogio]);
  useEffect(() => () => {
    clearTimeout(timerSucesso.current);
    clearTimeout(timerCamera.current);
    clearTimeout(timerAuto.current);
  }, []);

  const ativarTerminal = useCallback(() => {
    const etapa = fluxoRef.current?.etapa;
    if (etapa === "analisando" || etapa === "sucesso") return;
    clearTimeout(timerCamera.current);
    clearTimeout(timerAuto.current);
    autoDisparou.current = false;
    setErroCamera("");
    if (etapa === "falha") setFluxo({ etapa: "pronto", fase: FASE.PRONTO });
    setTerminalAtivo(true);
  }, []);

  // Tela apagada / app em background: câmera desmontada. Ao voltar para
  // foreground (inclusive ao acordar o telefone no piloto), o terminal arma
  // sozinho. AppState é suficiente para o piloto físico; o teste no Samsung
  // valida se o firmware do aparelho entrega a transição em todos os wakes.
  useEffect(() => {
    const sub = AppState.addEventListener("change", next => {
      const anterior = estadoApp.current;
      estadoApp.current = next;
      if (next !== "active") {
        clearTimeout(timerCamera.current);
        clearTimeout(timerAuto.current);
        autoDisparou.current = false;
        setTerminalAtivo(false);
        brilhoNormal();
        return;
      }
      if (anterior !== "active") ativarTerminal();
    });
    return () => sub.remove();
  }, [ativarTerminal]);

  // Se o app abriu antes de terminar a carga do FaceNet, arma assim que os
  // modelos ficarem prontos.
  useEffect(() => {
    if (modelos && AppState.currentState === "active" && fluxoRef.current?.etapa === "pronto") ativarTerminal();
  }, [modelos, ativarTerminal]);

  // Câmera nunca fica esperando indefinidamente.
  useEffect(() => {
    if (!terminalAtivo || fluxo.etapa !== "pronto") return undefined;
    clearTimeout(timerCamera.current);
    timerCamera.current = setTimeout(() => {
      autoDisparou.current = false;
      setTerminalAtivo(false);
      brilhoNormal();
    }, CAMERA_ESPERA_MAX_MS);
    return () => clearTimeout(timerCamera.current);
  }, [terminalAtivo, fluxo.etapa]);

  // Pede só uma vez sozinho; negada de vez, o Android não mostra mais o
  // pedido - aí o caminho é o botão das configurações.
  const jaPediu = useRef(false);
  useEffect(() => {
    if (estadoCamera === "pedir" && !jaPediu.current) {
      jaPediu.current = true;
      pedirPermissao().catch(() => {});
    }
  }, [estadoCamera, pedirPermissao]);

  const resumo = resumoCadastro(cadastro);
  const biometriasCompativeis = modelos
    ? (cadastro?.biometrias || []).filter(b => b?.modelo === modelos.modelo && Array.isArray(b?.vetor)).length
    : null;
  const semRostos = biometriasCompativeis === null ? resumo.semRostos : biometriasCompativeis === 0;
  const temResponsavel = resumo.temResponsavel;
  const fuso = fusoDoCadastro(cadastro);

  const fase = (f, nome = "") => setFluxo({ etapa: "analisando", fase: f, nome });
  const falha = f => {
    clearTimeout(timerCamera.current);
    clearTimeout(timerAuto.current);
    autoDisparou.current = false;
    setTerminalAtivo(false);
    if (f.tipo === "erro") vibrar("falha");
    setFluxo({ etapa: "falha", fase: FASE.PRONTO, falha: falhaNaTela(f) });
  };
  const voltarAoInicio = () => {
    clearTimeout(timerSucesso.current);
    clearTimeout(timerCamera.current);
    clearTimeout(timerAuto.current);
    autoDisparou.current = false;
    setTerminalAtivo(false);
    setFluxo({ etapa: "pronto", fase: FASE.PRONTO });
  };
  const foto = async () => {
    if (!camera.current) throw new Error("câmera não está pronta");
    return camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
  };

  const baterPonto = async () => {
    if (fluxoRef.current?.etapa === "analisando") return;
    if (!modelos) return falha({ tipo: "erro", contexto: "modelos", mensagem: mensagemParaTrabalhador("modelos"), podeEncarregado: true });
    let etapa = "camera";
    const cruas = [];
    const inicio = Date.now();
    const anotar = (resultado, a = {}, id = null) => calibrar?.({
      resultado, duracaoMs: Date.now() - inicio, confiancaDeteccao: a.confiancaDeteccao, larguraRosto: a.larguraRosto, luminancia: a.luminancia,
      top1: id?.melhor?.similaridade, top2: id?.segundo?.similaridade, capturasUsadas: a.capturasUsadas,
    });
    clearTimeout(timerCamera.current);
    brilhoMaximo();
    try {
      fase(FASE.OLHAR);
      const fotoFrente = await foto();
      cruas.push(fotoFrente.uri);
      etapa = "modelos";
      fase(FASE.ANALISAR);
      const frente = await analisarFoto(modelos, fotoFrente);
      if (frente.erro) {
        anotar(RESULTADO_CALIBRACAO.SEM_ROSTO);
        return falha({ mensagem: frente.erro, podeEncarregado: true });
      }
      if (Math.abs(frente.giro) > P.giroMaximoDeFrente) {
        anotar(RESULTADO_CALIBRACAO.FORA_DE_POSE, frente);
        return falha({ mensagem: "Olhe de frente para a câmera e tente de novo.", podeEncarregado: true });
      }
      const tId = Date.now();
      const compativeis = (cadastro?.biometrias || []).filter(b =>
        b?.modelo === modelos.modelo && Array.isArray(b?.vetor) && b.vetor.length === frente.vetor.length);
      const id = identificar(frente.vetor, compativeis);
      medir({ identificacaoMs: Date.now() - tId });
      if (!id.reconhecido) {
        anotar(id.motivo === MOTIVO.AMBIGUO ? RESULTADO_CALIBRACAO.AMBIGUO : RESULTADO_CALIBRACAO.NAO_CADASTRADO, frente, id);
        return falha({
          mensagem: compativeis.length
            ? (id.motivo === MOTIVO.NAO_CADASTRADO ? "Rosto não reconhecido. Toque na tela e olhe de frente para tentar novamente." : "Rosto ambíguo. Chame o encarregado.")
            : "Este aparelho ainda não tem biometria compatível. Recadastre o rosto com esta versão.",
          podeEncarregado: true,
        });
      }
      const funcionario = (cadastro.funcionarios || []).find(f => f.id === id.employeeId);
      if (!funcionario) return falha({ tipo: "atencao", contexto: "cadastro", mensagem: "O cadastro deste aparelho está desatualizado. Chame o encarregado.", podeEncarregado: true });

      anotar(RESULTADO_CALIBRACAO.RECONHECIDO, frente, id);
      fase(FASE.CONFIRMADO, funcionario.nome);
      etapa = "batida";
      const comprovante = await registrar({ pessoa: { tipo: "funcionario", ...funcionario }, identificacao: { metodo: "facial", confianca: id.confianca }, foto: fotoFrente });
      setTerminalAtivo(false);
      setFluxo({ etapa: "sucesso", fase: FASE.PRONTO, comprovante });
      medir({ batidaMs: Date.now() - inicio });
      vibrar("registro");
      if (voz) falar(falaDeConfirmacao(comprovante.nome, Date.parse(comprovante.marcadoEm), fuso));
      clearTimeout(timerSucesso.current);
      timerSucesso.current = setTimeout(voltarAoInicio, duracaoDoComprovante(comprovante));
    } catch {
      anotar(RESULTADO_CALIBRACAO.ERRO);
      falha({ tipo: "erro", contexto: etapa, mensagem: mensagemParaTrabalhador(etapa), podeEncarregado: true });
    } finally {
      cruas.forEach(apagarFotoLocal);
      brilhoNormal();
    }
  };

  const aoCameraPronta = () => {
    if (!terminalAtivo || autoDisparou.current || fluxoRef.current?.etapa !== "pronto") return;
    autoDisparou.current = true;
    clearTimeout(timerAuto.current);
    timerAuto.current = setTimeout(() => {
      if (AppState.currentState === "active" && camera.current && fluxoRef.current?.etapa === "pronto") baterPonto();
    }, ATRASO_CAPTURA_AUTOMATICA_MS);
  };

  if (fluxo.etapa === "sucesso") {
    return <Comprovante c={fluxo.comprovante} obra={obra} online={situacao.online} fuso={fuso} duracaoMs={duracaoDoComprovante(fluxo.comprovante)} aoConcluir={voltarAoInicio} />;
  }

  const status = statusDoAparelho(situacao, agora);
  const hora = formatarHora(agora.marcadoEmMs, fuso);
  const topo = <>
    <View style={estilos.topo}>
      <Rotulo secundario numberOfLines={2} style={estilos.obra}>{obra?.nome || "Obra"}</Rotulo>
      <Status {...status} />
    </View>
    <View style={estilos.relogio}>
      <Texto variante="relogio" centro accessibilityRole="header" accessibilityLabel={`Agora são ${hora}`} style={estilos.numeros}>{hora}</Texto>
      <Corpo secundario centro>{formatarData(agora.marcadoEmMs, fuso)}</Corpo>
    </View>
  </>;

  if (estadoCamera !== "concedida") {
    const t = telaSemCamera(estadoCamera);
    return <Tela>
      {topo}
      <Painel tom="atencao" titulo={t.titulo}><Corpo secundario centro>{t.texto}</Corpo></Painel>
      {t.acao === "abrir_configuracoes"
        ? <Botao titulo={t.rotuloAcao} onPress={() => Linking.openSettings().catch(() => {})} />
        : <Botao titulo={t.rotuloAcao} onPress={() => pedirPermissao().catch(() => {})} carregando={estadoCamera === "carregando"} />}
      <BotaoTexto titulo={t.alternativa} chevron alinhar="end" onPress={abrirEncarregado} />
    </Tela>;
  }

  if (semRostos) {
    return <Tela>
      {topo}
      <Painel tom="info" titulo="Cadastre os rostos da equipe">
        <Corpo secundario centro>{temResponsavel
          ? (biometriasCompativeis === 0 && (cadastro?.biometrias || []).length ? "A biometria deste aparelho usa outro motor. Recadastre os rostos uma vez nesta versão." : "Nenhum funcionário ativo da empresa tem rosto compatível cadastrado ainda. O encarregado pode cadastrar qualquer funcionário, independentemente da obra de lotação.")
          : "Primeiro cadastre o PIN do encarregado no MARCELL: Ponto eletrônico (app) → Responsáveis com PIN do app. Depois toque abaixo e em \"Buscar no MARCELL\"."}</Corpo>
      </Painel>
      <Botao titulo="Cadastrar rostos" onPress={abrirEncarregado} rotuloAcessivel="Cadastrar rostos, abre o modo Encarregado" />
    </Tela>;
  }

  const f = fluxo.falha;
  const cameraLigada = terminalAtivo && !!modelos && !f;

  return (
    <Tela onTouchStart={() => { if (!terminalAtivo && fluxoRef.current?.etapa !== "analisando") ativarTerminal(); }}>
      {topo}

      {cameraLigada
        ? <MolduraCamera
            guia={guiaDaFase(fluxo.fase)}
            instrucao={instrucaoDaFase(fluxo.fase, fluxo.nome)}
            aviso={erroCamera ? <Mensagem tom="erro" titulo="A câmera não abriu">{erroCamera}</Mensagem> : null}>
            <CameraView ref={camera} style={estilos.camera} facing="front" mirror
              onCameraReady={aoCameraPronta}
              onMountError={() => falha({ tipo: "erro", contexto: "camera", mensagem: "A câmera não abriu. Toque na tela para tentar novamente ou chame o encarregado.", podeEncarregado: true })} />
          </MolduraCamera>
        : <View style={estilos.espera} accessible accessibilityRole="button" accessibilityLabel="Terminal pronto. Toque em qualquer lugar para registrar ponto.">
            <Icone nome={f ? "alerta" : "camera"} cor={f ? COR_DO_TOM[f.tom === "neutro" ? "info" : f.tom] : COR.ouro} tamanho={44} />
            <TituloSecao centro>{f?.titulo || (modelos ? "Pronto para registrar" : "Preparando reconhecimento")}</TituloSecao>
            <Corpo secundario centro>{f?.mensagem || (modelos ? "Acorde a tela e olhe para a câmera. Se ela já estiver acesa, toque em qualquer lugar." : "O FaceNet está carregando. O terminal inicia sozinho quando estiver pronto.")}</Corpo>
            {f && <Rotulo secundario>TOQUE EM QUALQUER LUGAR PARA TENTAR NOVAMENTE</Rotulo>}
          </View>}

      <BotaoTexto titulo={f?.podeEncarregado ? "Registrar com encarregado" : "Encarregado"} chevron alinhar="end"
        onPress={() => { voltarAoInicio(); abrirEncarregado(); }} />
    </Tela>
  );
}

const duracaoDoComprovante = c => (c?.avisoFoto || c?.horaConfiavel === false ? COMPROVANTE_MS.comAviso : COMPROVANTE_MS.normal);

function Painel({ tom, titulo, children }) {
  return <View style={estilos.painel}>
    <Icone nome="alerta" cor={COR_DO_TOM[tom]} tamanho={40} />
    <TituloSecao centro>{titulo}</TituloSecao>
    {children}
  </View>;
}

const estilos = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: ESPACO.md },
  obra: { flexShrink: 1, textTransform: "uppercase", letterSpacing: 0.6 },
  relogio: { alignItems: "center" },
  numeros: { fontVariant: ["tabular-nums"] },
  camera: { flex: 1 },
  espera: {
    flex: 1, borderRadius: RAIO.camera, backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.borda,
    alignItems: "center", justifyContent: "center", gap: ESPACO.lg, padding: ESPACO.xxl,
  },
  painel: {
    flex: 1, borderRadius: RAIO.camera, backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.borda,
    alignItems: "center", justifyContent: "center", gap: ESPACO.lg, padding: ESPACO.xxl,
  },
});
