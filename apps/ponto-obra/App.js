// App "Ponto de Obra" (REP-P, Portaria 671/2021) - aparelho dedicado a uma
// obra. Liga: armazém criptografado, relógio confiável, modelos de rosto,
// sincronização com o ARCD a cada minuto e as telas.
//
// Máquina de estados simples (sem roteador):
//   carregando → parear | ponto ⇄ encarregado
//   erro (banco/sessão), revogado (aparelho desativado no ARCD)
// Nenhuma falha de rede, GPS, câmera ou reconhecimento apaga batida guardada.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
// Só os 6 pesos usados (importar a raiz do pacote embutiria as 30 variantes).
import { IBMPlexSans_300Light } from "@expo-google-fonts/ibm-plex-sans/300Light";
import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { StatusBar } from "expo-status-bar";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { abrirArmazem, arquivarBanco } from "./src/dados/armazem-sqlite";
import { registrarBatida } from "./src/logica/terminal";
import { gpsRecente, montarCorpoSincronizacao, rodadaDeSincronizacao } from "./src/logica/sincronizacao";
import { classificarResposta, mensagemDeErro } from "./src/logica/falhas";
import { montarDiagnostico } from "./src/logica/diagnostico";
import { estadoDaReferencia } from "../../src/domains/ponto-eletronico/relogio.js";
import { apagarSessao, criarApi, criarRelogio, infoDoAparelho, infoDoApp, lerSessao, salvarSessao } from "./src/servicos/conexao";
import { apagarFotoLocal, carregarModelos, lerFotoBase64, prepararFotoDaBatida } from "./src/servicos/rosto-nativo";
import TelaEncarregado from "./src/telas/TelaEncarregado";
import TelaPareamento from "./src/telas/TelaPareamento";
import TelaPonto from "./src/telas/TelaPonto";
import { Botao, BotaoSecundario, COR, Corpo, ESPACO, EstadoCentral, Mensagem, Tela, Texto } from "./src/ui";

const SINCRONIZAR_A_CADA_MS = 60_000;
const CADASTRO_A_CADA_MS = 5 * 60_000;
// IBM Plex (identidade ARCD) embutida no app: abre offline. Se a fonte não
// carregar, o app segue com a do sistema - nunca fica preso esperando.
const FONTES = { IBMPlexSans_300Light, IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexMono_400Regular, IBMPlexMono_500Medium };
const ESPERA_MAXIMA_FONTES_MS = 3000;
const sha256Texto = texto => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto);

export default function App() {
  const [fontesProntas, erroFontes] = useFonts(FONTES);
  const [fontesDesistiu, setFontesDesistiu] = useState(false);
  useEffect(() => { const t = setTimeout(() => setFontesDesistiu(true), ESPERA_MAXIMA_FONTES_MS); return () => clearTimeout(t); }, []);
  const [fase, setFase] = useState("carregando");       // carregando | parear | ponto | encarregado | erro | revogado
  const [erroFatal, setErroFatal] = useState({ texto: "", bancoIlegivel: false });
  const [tentativa, setTentativa] = useState(0);
  const [cadastro, setCadastro] = useState(null);
  const [modelos, setModelos] = useState(null);
  const [estadoModelos, setEstadoModelos] = useState({ estado: "carregando", erro: "" });
  const [situacao, setSituacao] = useState({ online: false, pendentes: 0, fotos: 0, fotosComProblema: 0, aviso: "" });
  const ref = useRef({ armazem: null, relogio: null, sessao: null, gps: null, gpsEstado: "aguardando", ultimoCadastro: 0, sincronizando: false, pedirDeNovo: null });
  const api = useRef(criarApi(() => ref.current.sessao?.token)).current;

  const atualizarSituacao = useCallback(async (extra = {}) => {
    if (!ref.current.armazem) return;
    try {
      const c = await ref.current.armazem.contagem();
      setSituacao(s => ({ ...s, ...extra, ...c }));
    } catch { /* contagem é só para a tela */ }
  }, []);

  // Uma rodada: cadastro/hora (a cada 5 min ou quando pedido), batidas, fotos.
  // Pedido durante outra rodada não se perde: roda logo depois.
  const sincronizar = useCallback(async ({ forcarCadastro = false } = {}) => {
    const { armazem, relogio } = ref.current;
    if (!armazem || !ref.current.sessao) return;
    if (ref.current.sincronizando) { ref.current.pedirDeNovo = { forcarCadastro: forcarCadastro || !!ref.current.pedirDeNovo?.forcarCadastro }; return; }
    ref.current.sincronizando = true;
    const anterior = await armazem.lerEstado("ultima_sincronizacao").catch(() => null);
    try {
      const r = await rodadaDeSincronizacao({
        armazem, api, monotonico: () => relogio.monotonico(),
        corpo: montarCorpoSincronizacao({ app: infoDoApp(), aparelho: infoDoAparelho(), gps: ref.current.gps, agoraMs: Date.now() }),
        cadastroVencido: forcarCadastro || Date.now() - ref.current.ultimoCadastro > CADASTRO_A_CADA_MS,
        lerFotoBase64, aposEnviarFoto: item => apagarFotoLocal(item.caminhoFoto),
      });
      if (r.revogado || r.desconhecido) {
        // Sessão sai; banco e batidas ficam (registro legal) - ver aoParear.
        await apagarSessao().catch(() => {});
        ref.current.sessao = null;
        setFase(r.revogado ? "revogado" : "parear");
      }
      if (r.cadastroAtualizado) { ref.current.ultimoCadastro = Date.now(); await relogio.carregar(); setCadastro(await armazem.cadastro()); }
      const ok = !r.erro;
      await armazem.gravarEstado("ultima_sincronizacao", {
        em: Date.now(), ok, erro: ok ? null : String(r.erro).slice(0, 120), ultimoOkEm: ok ? Date.now() : anterior?.ultimoOkEm ?? null,
        aguardandoEstabelecimento: !!r.aguardandoEstabelecimento, cadeiaDivergente: !!r.cadeiaDivergente,
      });
      const aviso = r.aguardandoEstabelecimento
        ? "A obra deste aparelho ainda não está ligada a um estabelecimento no ARCD. As batidas ficam guardadas aqui e são enviadas quando o vínculo for feito."
        : ok ? "" : classificarResposta({ ok: false, status: r.online ? r.status || 500 : 0, error: r.erro }).mensagem;
      await atualizarSituacao({ online: r.online, aviso });
    } catch (e) {
      // Falha inesperada (banco, arquivo...): nada foi apagado; tenta na próxima rodada.
      await armazem.gravarEstado("ultima_sincronizacao", { em: Date.now(), ok: false, erro: String(e?.message || e).slice(0, 120), ultimoOkEm: anterior?.ultimoOkEm ?? null }).catch(() => {});
      await atualizarSituacao({ aviso: mensagemDeErro("sincronizacao", e) });
    } finally {
      ref.current.sincronizando = false;
      const pendente = ref.current.pedirDeNovo;
      ref.current.pedirDeNovo = null;
      if (pendente) sincronizar(pendente);
    }
  }, [api, atualizarSituacao]);

  // Inicialização: tudo local - o app abre e bate ponto sem internet.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const armazem = await abrirArmazem();
        const relogio = criarRelogio(armazem);
        await relogio.carregar();
        let sessao = null;
        try { sessao = await lerSessao(); } catch { sessao = null; }
        // Bancos de antes desta versão: guarda de qual aparelho são as batidas.
        if (sessao && !(await armazem.lerEstado("dispositivo_id"))) await armazem.gravarEstado("dispositivo_id", sessao.dispositivoId);
        if (cancelado) return;
        Object.assign(ref.current, { armazem, relogio, sessao });
        setCadastro(await armazem.cadastro());
        await atualizarSituacao();
        setFase(sessao ? "ponto" : "parear");
      } catch (e) {
        if (cancelado) return;
        setErroFatal({ texto: mensagemDeErro("banco", e), bancoIlegivel: e?.tipo === "ilegivel" });
        setFase("erro");
      }
    })();
    return () => { cancelado = true; };
  }, [atualizarSituacao, tentativa]);

  // Modelos de rosto: independentes do banco; falha só desliga o facial.
  useEffect(() => {
    carregarModelos()
      .then(m => { setModelos(m); setEstadoModelos({ estado: "ok", erro: "" }); })
      .catch(e => setEstadoModelos({ estado: "erro", erro: mensagemDeErro("modelos", e) }));
  }, []);

  // Sincronização periódica e posição (registrada na batida, nunca a impede).
  const ativo = fase === "ponto" || fase === "encarregado";
  useEffect(() => {
    if (!ativo) return undefined;
    sincronizar();
    const t = setInterval(() => { sincronizar(); }, SINCRONIZAR_A_CADA_MS);
    let assinatura = null, encerrado = false;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) { ref.current.gpsEstado = "permissão negada (a batida segue sem GPS)"; return; }
        // distanceInterval 0: aparelho parado na parede também recebe posição nova.
        const a = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 60_000, distanceInterval: 0 },
          p => { ref.current.gps = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null, em: Date.now() }; ref.current.gpsEstado = "ok"; });
        if (encerrado) a.remove(); else { assinatura = a; ref.current.gpsEstado = ref.current.gps ? "ok" : "aguardando sinal"; }
      } catch {
        ref.current.gpsEstado = "localização desligada no aparelho (a batida segue sem GPS)";
      }
    })();
    return () => { encerrado = true; clearInterval(t); try { assinatura?.remove?.(); } catch { /* já removida */ } };
  }, [ativo, sincronizar]);

  // Batida: foto primeiro (o hash dela entra na batida). Se a foto não puder
  // ser guardada, a batida é registrada SEM foto e o aviso aparece - a batida
  // nunca depende da foto. Se a própria batida falhar, o erro sobe para a tela.
  const registrar = useCallback(async ({ pessoa, identificacao, foto }) => {
    const { armazem, relogio, sessao } = ref.current;
    let preparada = null, avisoFoto = "";
    if (foto?.uri) {
      try { preparada = await prepararFotoDaBatida(foto.uri, foto.width); }
      catch { avisoFoto = "A foto não pôde ser guardada no aparelho (armazenamento cheio?). A batida foi registrada sem foto."; }
    } else if (foto?.falhou) {
      avisoFoto = "A câmera não tirou a foto. A batida foi registrada sem foto.";
    }
    let m;
    try {
      // Estabelecimento que o aparelho já conhece (pode não haver: a ARP resolve).
      const estabelecimentoId = (await armazem.cadastro().catch(() => null))?.estabelecimento?.id || null;
      m = await registrarBatida({
        armazem, relogio, sha256: sha256Texto, gerarId: Crypto.randomUUID, dispositivoId: sessao.dispositivoId, estabelecimentoId,
        pessoa, identificacao, gps: gpsRecente(ref.current.gps, Date.now()), fotoSha256: preparada?.sha256, caminhoFoto: preparada?.uri,
      });
    } catch (e) {
      if (preparada) apagarFotoLocal(preparada.uri);   // foto sem batida não serve para nada
      throw e;
    }
    sincronizar();
    // Sem NSR aqui: o NSR fiscal só existe depois que a ARP grava o evento.
    return { nome: pessoa.nome, cpfMascarado: pessoa.cpfMascarado, marcadoEm: m.marcadoEm, localSequence: m.localSequence, eventId: m.eventId, hash: m.localHash, horaConfiavel: m.horaConfiavel, avisoFoto };
  }, [sincronizar]);

  // Pareamento. Banco com batidas de OUTRO aparelho (pareado de novo depois
  // de revogado): o banco antigo é preservado com outro nome e um novo começa
  // - as batidas antigas não podem ir com o token novo.
  const aoParear = async sessao => {
    let { armazem } = ref.current;
    const dono = await armazem.dispositivoDoBanco();
    if (dono && dono !== sessao.dispositivoId) {
      await armazem.fechar();
      await arquivarBanco("pareamento-anterior");
      armazem = await abrirArmazem();
      ref.current.relogio.trocarArmazem(armazem);
      ref.current.armazem = armazem;
      ref.current.ultimoCadastro = 0;
    }
    await armazem.gravarEstado("dispositivo_id", sessao.dispositivoId);
    await salvarSessao(sessao);
    ref.current.sessao = sessao;
    await sincronizar({ forcarCadastro: true });
    setCadastro(await armazem.cadastro());
    setFase("ponto");
  };

  const diagnostico = async () => {
    const { armazem, relogio, sessao } = ref.current;
    const cad = await armazem.cadastro().catch(() => null);
    const mono = relogio.monotonico();
    const referencia = estadoDaReferencia({ referencia: await armazem.referenciaHora().catch(() => null), monotonicoMs: mono.ms, bootId: mono.bootId });
    return montarDiagnostico({
      referencia,
      app: infoDoApp(), aparelho: infoDoAparelho(), sessao,
      contagem: await armazem.contagem().catch(() => ({})),
      ultimaSincronizacao: await armazem.lerEstado("ultima_sincronizacao").catch(() => null),
      modelos: estadoModelos, hora: relogio.agora(), gps: { estado: ref.current.gpsEstado },
      fiscal: {
        estabelecimento: cad?.estabelecimento?.nome || null,
        ultimaSequenciaLocal: (await armazem.ultimoEventoGlobal().catch(() => null))?.localSequence ?? null,
        ultimoNsr: await armazem.ultimoNsrRecebido().catch(() => null),
        fonteHora: cad?.tempo?.source || null, statusHora: cad?.tempo?.status || null,
      },
    });
  };

  // Banco novo = cadeia local nova: o aparelho precisa ser pareado de novo
  // (vira outro dispositivo no ARCD). Assim a sequência local nunca recomeça
  // dentro do mesmo dispositivo e nada precisa ser renumerado.
  const recomecarBancoIlegivel = () => Alert.alert(
    "Começar um banco novo?",
    "O arquivo atual NÃO será apagado: fica guardado no aparelho com outro nome para o suporte. Batidas que estavam nele e ainda não tinham sido enviadas não poderão ser enviadas por este aparelho. O aparelho precisará ser pareado de novo com um código do ARCD.",
    [{ text: "Cancelar", style: "cancel" }, {
      text: "Começar banco novo", style: "destructive",
      onPress: async () => {
        try { await arquivarBanco("ilegivel"); } catch { /* tenta abrir mesmo assim */ }
        try { await apagarSessao(); } catch { /* sem sessão o app pede pareamento */ }
        setFase("carregando"); setTentativa(n => n + 1);
      },
    }],
  );

  let conteudo;
  if (!fontesProntas && !erroFontes && !fontesDesistiu) conteudo = null;
  else if (fase === "carregando") conteudo = <Tela centro>
    <View style={estilos.abertura} accessible accessibilityLabel="Abrindo o Ponto de Obra">
      <Texto variante="secao" cor={COR.ouro}>PONTO DE OBRA</Texto>
      <ActivityIndicator size="large" color={COR.textoSecundario} />
    </View>
  </Tela>;
  else if (fase === "erro") conteudo = <Tela>
    <EstadoCentral tom="erro" titulo="O app não abriu" acoes={<>
      <Botao titulo="Tentar de novo" onPress={() => { setFase("carregando"); setTentativa(n => n + 1); }} />
      {erroFatal.bancoIlegivel && <BotaoSecundario titulo="Guardar banco atual e começar outro" onPress={recomecarBancoIlegivel} />}
    </>}>
      <Mensagem tom="erro">{erroFatal.texto}</Mensagem>
    </EstadoCentral>
  </Tela>;
  else if (fase === "revogado") conteudo = <Tela>
    <EstadoCentral tom="atencao" titulo="Aparelho desativado" acoes={<Botao titulo="Parear de novo" onPress={() => setFase("parear")} />}>
      <Corpo secundario centro>Este aparelho foi desativado no ARCD. Nenhuma batida foi apagada: {situacao.pendentes} ainda não {situacao.pendentes === 1 ? "enviada continua guardada" : "enviadas continuam guardadas"} nele. Para voltar a usar, gere um código novo no ARCD.</Corpo>
    </EstadoCentral>
  </Tela>;
  else if (fase === "parear") conteudo = <TelaPareamento api={api} aoParear={aoParear} />;
  else if (fase === "encarregado") conteudo = <TelaEncarregado cadastro={cadastro} modelos={modelos} registrar={registrar} api={api} obra={ref.current.sessao?.obra}
    situacao={situacao} sincronizarAgora={() => sincronizar({ forcarCadastro: true })} fechar={() => setFase("ponto")} diagnostico={diagnostico} />;
  else conteudo = <TelaPonto obra={ref.current.sessao?.obra} relogio={ref.current.relogio} modelos={modelos}
    cadastro={cadastro} registrar={registrar} situacao={situacao} abrirEncarregado={() => setFase("encarregado")} />;

  return <View style={estilos.raiz}>
    <StatusBar style="light" />
    {conteudo}
  </View>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COR.fundo },
  abertura: { alignItems: "center", gap: ESPACO.xxl },
});
