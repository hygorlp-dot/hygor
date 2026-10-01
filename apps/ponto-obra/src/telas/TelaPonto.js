// Tela de batida (fica sempre aberta no aparelho da obra).
// Fluxo: foto de frente → reconhece entre os cadastrados da obra → pede para
// virar o rosto (prova de vida contra foto impressa) → registra com foto e
// GPS → mostra o comprovante. Se não reconhecer, o encarregado identifica:
// a batida nunca é impedida (Portaria 671/2021).
//
// Desenho (ARCD Cupertino Industrial): hora e câmera protagonistas, uma ação
// dominante ("Bater ponto"), status conciso no canto, detalhe técnico só no
// modo Encarregado. Fases e textos vêm de logica/apresentacao.js.
import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { identificar, similaridadeCosseno } from "../logica/rosto";
import { PARAMETROS_FACIAIS as P } from "../logica/calibracao";
import { estadoPermissaoCamera, mensagemParaTrabalhador } from "../logica/falhas";
import { resumoCadastro } from "../logica/cadastro";
import { FASE, emAndamento, falaDeConfirmacao, falhaNaTela, guiaDaFase, instrucaoDaFase, statusDoAparelho, telaSemCamera } from "../logica/apresentacao";
import { analisarFoto, apagarFotoLocal } from "../servicos/rosto-nativo";
import { brilhoMaximo, brilhoNormal, falar, vibrar } from "../servicos/feedback";
import { Botao, BotaoTexto, COMPROVANTE_MS, COR, COR_DO_TOM, Corpo, ESPACO, Icone, Mensagem, MolduraCamera, RAIO, Rotulo, Status, Tela, Texto, TituloSecao } from "../ui";
import Comprovante from "./Comprovante";

const esperar = ms => new Promise(r => setTimeout(r, ms));
const fmtHora = ms => new Date(ms).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
// "quinta-feira, 1 de outubro" → só a primeira letra maiúscula.
const fmtData = ms => { const d = new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Recife", weekday: "long", day: "numeric", month: "long" }); return d.charAt(0).toUpperCase() + d.slice(1); };

export default function TelaPonto({ obra, relogio, modelos, cadastro, registrar, situacao, abrirEncarregado, voz = true }) {
  useKeepAwake();
  const camera = useRef(null);
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [agora, setAgora] = useState(() => relogio.agora());
  // etapa: pronto | analisando (com fase) | falha | sucesso
  const [fluxo, setFluxo] = useState({ etapa: "pronto", fase: FASE.PRONTO });
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
  const { semRostos, temResponsavel } = resumoCadastro(cadastro);

  const fase = (f, nome = "") => setFluxo({ etapa: "analisando", fase: f, nome });
  // Vibração de alerta só em falha real (incerteza do rosto não assusta).
  const falha = f => { if (f.tipo === "erro") vibrar("falha"); setFluxo({ etapa: "falha", fase: FASE.PRONTO, falha: falhaNaTela(f) }); };
  const voltarAoInicio = () => { clearTimeout(timerSucesso.current); setFluxo({ etapa: "pronto", fase: FASE.PRONTO }); };
  const foto = async () => {
    if (!camera.current) throw new Error("câmera não está pronta");
    return camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
  };

  const baterPonto = async () => {
    if (!modelos) return falha({ tipo: "erro", contexto: "modelos", mensagem: mensagemParaTrabalhador("modelos"), podeEncarregado: true });
    let etapa = "camera";
    // Capturas cruas da câmera: apagadas no fim, aconteça o que acontecer (a
    // foto da batida é uma cópia preparada por registrar()).
    const cruas = [];
    // Tela no brilho máximo durante a captura (sol forte, rosto escuro).
    brilhoMaximo();
    try {
      fase(FASE.OLHAR);
      const fotoFrente = await foto();
      cruas.push(fotoFrente.uri);
      etapa = "modelos";
      fase(FASE.ANALISAR);
      const frente = await analisarFoto(modelos, fotoFrente);
      if (frente.erro) return falha({ mensagem: frente.erro, podeEncarregado: true });
      if (Math.abs(frente.giro) > P.giroMaximoDeFrente) return falha({ mensagem: "Olhe de frente para a câmera e tente de novo." });
      const id = identificar(frente.vetor, cadastro?.biometrias || []);
      if (!id.reconhecido) return falha({ mensagem: id.motivo === "rosto não cadastrado nesta obra" ? "Se você ainda não tem cadastro, chame o encarregado." : "Olhe de frente e tente novamente.", podeEncarregado: true });
      const funcionario = (cadastro.funcionarios || []).find(f => f.id === id.employeeId);
      if (!funcionario) return falha({ tipo: "atencao", contexto: "cadastro", mensagem: "O cadastro deste aparelho está desatualizado. Chame o encarregado.", podeEncarregado: true });

      fase(FASE.VIRAR, funcionario.nome);
      vibrar("leve");
      await esperar(P.esperaAntesDaViradaMs);
      etapa = "camera";
      const fotoVirada = await foto();
      cruas.push(fotoVirada.uri);
      etapa = "modelos";
      const virado = await analisarFoto(modelos, fotoVirada);
      const vivo = !virado.erro && Math.abs(virado.giro) >= P.giroMinimoVirado && similaridadeCosseno(frente.vetor, virado.vetor) >= P.similaridadeMinimaVirado;
      if (!vivo) return falha({ mensagem: "Olhe de frente e, quando pedir, vire o rosto devagar.", podeEncarregado: true });

      fase(FASE.CONFIRMADO, funcionario.nome);
      etapa = "batida";
      const comprovante = await registrar({ pessoa: { tipo: "funcionario", ...funcionario }, identificacao: { metodo: "facial", confianca: id.confianca }, foto: fotoFrente });
      setFluxo({ etapa: "sucesso", fase: FASE.PRONTO, comprovante });
      vibrar("registro");
      if (voz) falar(falaDeConfirmacao(comprovante.nome, Date.parse(comprovante.marcadoEm)));
      clearTimeout(timerSucesso.current);
      timerSucesso.current = setTimeout(() => setFluxo(f => (f.etapa === "sucesso" ? { etapa: "pronto", fase: FASE.PRONTO } : f)), duracaoDoComprovante(comprovante));
    } catch {
      falha({ tipo: "erro", contexto: etapa, mensagem: mensagemParaTrabalhador(etapa), podeEncarregado: true });
    } finally {
      cruas.forEach(apagarFotoLocal);
      brilhoNormal();
    }
  };

  if (fluxo.etapa === "sucesso") {
    return <Comprovante c={fluxo.comprovante} obra={obra} online={situacao.online} duracaoMs={duracaoDoComprovante(fluxo.comprovante)} aoConcluir={voltarAoInicio} />;
  }

  const status = statusDoAparelho(situacao, agora);
  const hora = fmtHora(agora.marcadoEmMs);
  const topo = <>
    <View style={estilos.topo}>
      <Rotulo secundario numberOfLines={2} style={estilos.obra}>{obra?.nome || "Obra"}</Rotulo>
      <Status {...status} />
    </View>
    <View style={estilos.relogio}>
      <Texto variante="relogio" centro accessibilityRole="header" accessibilityLabel={`Agora são ${hora}`} style={estilos.numeros}>{hora}</Texto>
      <Corpo secundario centro>{fmtData(agora.marcadoEmMs)}</Corpo>
    </View>
  </>;

  // Sem câmera o ponto NÃO fica impedido: o encarregado continua podendo
  // registrar (sem foto) pelo modo Encarregado.
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
          ? "Ninguém desta obra tem rosto cadastrado. O encarregado entra com o PIN e cadastra cada funcionário."
          : "Primeiro cadastre o PIN do encarregado no ARCD: Ponto eletrônico (app) → Responsáveis com PIN do app. Depois toque abaixo e em \"Buscar no ARCD\"."}</Corpo>
      </Painel>
      <Botao titulo="Cadastrar rostos" onPress={abrirEncarregado} rotuloAcessivel="Cadastrar rostos, abre o modo Encarregado" />
    </Tela>;
  }

  const analisando = fluxo.etapa === "analisando";
  const f = fluxo.falha;
  return (
    <Tela>
      {topo}
      <MolduraCamera
        guia={guiaDaFase(fluxo.fase)}
        instrucao={fluxo.etapa === "falha" ? "" : instrucaoDaFase(fluxo.fase, fluxo.nome)}
        aviso={erroCamera ? <Mensagem tom="erro" titulo="A câmera não abriu">{erroCamera}</Mensagem> : null}>
        <CameraView ref={camera} style={estilos.camera} facing="front" mirror
          onMountError={() => setErroCamera("Feche e abra o app. Se continuar, o encarregado pode registrar o ponto.")} />
      </MolduraCamera>

      {f
        ? <>
          <Mensagem tom={f.tom === "neutro" ? "info" : f.tom} titulo={f.titulo}>{f.mensagem}</Mensagem>
          <Botao titulo="Tentar novamente" onPress={baterPonto} />
          <BotaoTexto titulo={f.podeEncarregado ? "Registrar com encarregado" : "Encarregado"} chevron alinhar="end"
            onPress={() => { voltarAoInicio(); abrirEncarregado(); }} />
        </>
        : <>
          <Botao titulo={fluxo.fase === FASE.CONFIRMADO ? "Registrando ponto" : analisando ? "Aguarde" : "Bater ponto"}
            onPress={baterPonto} carregando={emAndamento(fluxo.fase)} />
          <BotaoTexto titulo="Encarregado" chevron alinhar="end" onPress={abrirEncarregado} desabilitado={analisando} />
        </>}
    </Tela>
  );
}

const duracaoDoComprovante = c => (c?.avisoFoto || c?.horaConfiavel === false ? COMPROVANTE_MS.comAviso : COMPROVANTE_MS.normal);

// Ocupa o lugar da câmera quando ela não pode ser usada (mesma moldura).
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
  painel: {
    flex: 1, borderRadius: RAIO.camera, backgroundColor: COR.superficie, borderWidth: 1, borderColor: COR.borda,
    alignItems: "center", justifyContent: "center", gap: ESPACO.lg, padding: ESPACO.xxl,
  },
});
