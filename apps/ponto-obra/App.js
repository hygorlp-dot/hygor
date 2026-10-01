// App "Ponto de Obra" (REP-P, Portaria 671/2021) - aparelho dedicado a uma
// obra. Liga: armazém criptografado, relógio confiável, modelos de rosto,
// sincronização com o ARCD a cada minuto e as telas.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { abrirArmazem } from "./src/dados/armazem-sqlite";
import { registrarBatida } from "./src/logica/terminal";
import { enviarFotos, enviarPendentes, sincronizarCadastro } from "./src/logica/sincronizacao";
import { apagarSessao, criarApi, criarRelogio, lerSessao, salvarSessao } from "./src/servicos/conexao";
import { apagarFotoLocal, carregarModelos, lerFotoBase64, prepararFotoDaBatida } from "./src/servicos/rosto-nativo";
import TelaEncarregado from "./src/telas/TelaEncarregado";
import TelaPareamento from "./src/telas/TelaPareamento";
import TelaPonto from "./src/telas/TelaPonto";
import { Botao, COR, Mensagem, Titulo, estilos } from "./src/ui";

const SINCRONIZAR_A_CADA_MS = 60_000;
const CADASTRO_A_CADA_MS = 5 * 60_000;
const sha256Texto = texto => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, texto);

export default function App() {
  const [fase, setFase] = useState("carregando");       // carregando | parear | ponto | encarregado | erro
  const [erroFatal, setErroFatal] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [cadastro, setCadastro] = useState(null);
  const [modelos, setModelos] = useState(null);
  const [erroModelos, setErroModelos] = useState("");
  const [situacao, setSituacao] = useState({ online: false, pendentes: 0, fotos: 0 });
  const ref = useRef({ armazem: null, relogio: null, sessao: null, gps: null, ultimoCadastro: 0, sincronizando: false });
  const api = useRef(criarApi(() => ref.current.sessao?.token)).current;

  const atualizarSituacao = useCallback(async online => {
    const c = await ref.current.armazem.contagem();
    setSituacao(s => ({ online: online ?? s.online, ...c }));
  }, []);

  // Uma rodada: cadastro/hora (a cada 5 min ou quando pedido), batidas, fotos.
  const sincronizar = useCallback(async ({ forcarCadastro = false } = {}) => {
    const { armazem, relogio } = ref.current;
    if (!armazem || !ref.current.sessao || ref.current.sincronizando) return;
    ref.current.sincronizando = true;
    try {
      let online = true;
      if (forcarCadastro || Date.now() - ref.current.ultimoCadastro > CADASTRO_A_CADA_MS) {
        const s = await sincronizarCadastro({ armazem, api, monotonico: () => relogio.monotonico(), sha256: sha256Texto });
        if (s.codigo === "APARELHO_REVOGADO" || s.codigo === "APARELHO_DESCONHECIDO") {
          await apagarSessao(); ref.current.sessao = null; setFase("parear"); return;
        }
        online = s.ok;
        if (s.ok) { ref.current.ultimoCadastro = Date.now(); await relogio.carregar(); setCadastro(await armazem.cadastro()); }
      }
      const envio = await enviarPendentes({ armazem, api });
      if (envio.semRede) online = false;
      if (online) await enviarFotos({ armazem, api, lerFotoBase64, aposEnviar: item => apagarFotoLocal(item.caminhoFoto) });
      await atualizarSituacao(online);
    } finally {
      ref.current.sincronizando = false;
    }
  }, [api, atualizarSituacao]);

  useEffect(() => {
    (async () => {
      try {
        const armazem = await abrirArmazem();
        const relogio = criarRelogio(armazem);
        await relogio.carregar();
        Object.assign(ref.current, { armazem, relogio, sessao: await lerSessao() });
        setCadastro(await armazem.cadastro());
        await atualizarSituacao();
        carregarModelos().then(setModelos).catch(e => setErroModelos(e?.message || String(e)));
        setFase(ref.current.sessao ? "ponto" : "parear");
      } catch (e) {
        setErroFatal(e?.message || String(e)); setFase("erro");
      }
    })();
  }, [atualizarSituacao, tentativa]);

  // Sincronização periódica e posição (registrada na batida, nunca a impede).
  useEffect(() => {
    if (fase !== "ponto" && fase !== "encarregado") return undefined;
    sincronizar();
    const t = setInterval(() => sincronizar(), SINCRONIZAR_A_CADA_MS);
    let assinatura = null;
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return;
      assinatura = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 120_000, distanceInterval: 25 },
        p => { ref.current.gps = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy ?? null }; });
    })();
    return () => { clearInterval(t); assinatura?.remove?.(); };
  }, [fase, sincronizar]);

  const registrar = useCallback(async ({ pessoa, identificacao, fotoUri }) => {
    const { armazem, relogio, sessao } = ref.current;
    const foto = fotoUri ? await prepararFotoDaBatida(fotoUri) : null;
    const m = await registrarBatida({
      armazem, relogio, sha256: sha256Texto, gerarId: Crypto.randomUUID, dispositivoId: sessao.dispositivoId,
      pessoa, identificacao, gps: ref.current.gps, fotoSha256: foto?.sha256,
    });
    if (foto) await armazem.anexarCaminhoFoto(m.id, foto.uri);
    sincronizar();
    return { nome: pessoa.nome, cpfMascarado: pessoa.cpfMascarado, marcadoEm: m.marcadoEm, nsr: m.nsr, hash: m.hash, horaConfiavel: m.horaConfiavel };
  }, [sincronizar]);

  const aoParear = async sessao => {
    await salvarSessao(sessao);
    ref.current.sessao = sessao;
    await sincronizar({ forcarCadastro: true });
    setFase("ponto");
  };

  let conteudo;
  if (fase === "carregando") conteudo = <View style={[estilos.tela, { justifyContent: "center" }]}><ActivityIndicator size="large" color={COR.ouro} /></View>;
  else if (fase === "erro") conteudo = <View style={[estilos.tela, { justifyContent: "center" }]}>
    <Titulo>O app não abriu</Titulo>
    <Mensagem tipo="erro">{erroFatal}</Mensagem>
    <Botao titulo="Tentar de novo" onPress={() => { setFase("carregando"); setTentativa(n => n + 1); }} />
  </View>;
  else if (fase === "parear") conteudo = <TelaPareamento api={api} aoParear={aoParear} />;
  else if (fase === "encarregado") conteudo = <TelaEncarregado cadastro={cadastro} modelos={modelos} registrar={registrar} api={api} obra={ref.current.sessao?.obra}
    situacao={situacao} sincronizarAgora={() => sincronizar({ forcarCadastro: true })} fechar={() => setFase("ponto")} />;
  else conteudo = <TelaPonto obra={ref.current.sessao?.obra} relogio={ref.current.relogio} modelos={modelos} erroModelos={erroModelos}
    cadastro={cadastro} registrar={registrar} situacao={situacao} abrirEncarregado={() => setFase("encarregado")} />;

  return <View style={{ flex: 1, backgroundColor: COR.fundo }}>
    <StatusBar style="light" />
    {conteudo}
  </View>;
}
