// Modo encarregado: responsável da obra (PIN do app definido no ARCD).
// Tudo o que é feito aqui fica registrado com o id do responsável.
import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import RelogioConfiavel from "../../modules/relogio-confiavel";
import { proximaEsperaPin, verificarPinResponsavel } from "../logica/pin";
import { vetorDoCadastro } from "../logica/rosto";
import { PARAMETROS_FACIAIS as P } from "../logica/calibracao";
import { mensagemDeErro } from "../logica/falhas";
import { resumoCadastro } from "../logica/cadastro";
import { secoesDoDiagnostico } from "../logica/diagnostico";
import { PASSO_CADASTRO, passoDoCadastro, rotuloDaCaptura, secoesDoEncarregado } from "../logica/apresentacao";
import { analisarFoto, apagarFotoLocal, lerFotoBase64, prepararFotoDaBatida } from "../servicos/rosto-nativo";
import {
  Botao, BotaoSecundario, BotaoTexto, COR, COR_DO_TOM, Cabecalho, Campo, Corpo, ESPACO, EstadoCentral, Icone, LinhaAjuste,
  Mensagem, MolduraCamera, Passos, Rotulo, Secao, Superficie, TOQUE, Tela, Texto, Titulo,
} from "../ui";
import Comprovante from "./Comprovante";

const pbkdf2Hex = (pin, salt, iteracoes) => bytesToHex(pbkdf2(sha256, pin, salt, { c: iteracoes, dkLen: 32 }));
const INATIVIDADE_MS = 3 * 60_000;
const CAPTURAS_CADASTRO = P.capturasCadastro;

// Termo de consentimento (LGPD, dado biométrico). Versionado: a versão e o
// hash do texto vão junto com o cadastro. Revisar com o jurídico.
export const TERMO_VERSAO = "2026-10";
export const TERMO_TEXTO = "Autorizo a ARCD a usar a imagem do meu rosto para gerar um código biométrico usado SOMENTE para registrar o meu ponto nas obras da empresa. O código e as fotos ficam protegidos, não são compartilhados com terceiros e serão apagados quando eu deixar a empresa ou se eu pedir. Posso pedir a exclusão a qualquer momento; nesse caso meu ponto passa a ser registrado pelo encarregado.";

export default function TelaEncarregado({ cadastro, modelos, registrar, sincronizarAgora, situacao, fechar, api, obra, diagnostico }) {
  const [responsavel, setResponsavel] = useState(null);   // { userId, nome } depois do PIN
  const [tela, setTela] = useState("menu");
  const [fixar, setFixar] = useState("");
  const ultimoToque = useRef(Date.now());
  const tocar = () => { ultimoToque.current = Date.now(); };
  useEffect(() => {
    const t = setInterval(() => { if (Date.now() - ultimoToque.current > INATIVIDADE_MS) fechar(); }, 15_000);
    return () => clearInterval(t);
  }, [fechar]);

  if (!responsavel) return <EntrarComPin responsaveis={cadastro?.responsaveis || []} aoEntrar={setResponsavel} fechar={fechar} sincronizarAgora={sincronizarAgora} />;

  const voltar = () => setTela("menu");
  const abrir = id => {
    if (id !== "fixar") { setTela(id); return; }
    try { RelogioConfiavel.fixarNaTela(); setFixar("Pedido enviado: o aplicativo fica fixado na tela. Para soltar, siga a instrução do Android."); }
    catch { setFixar("Este aparelho não permite fixar o aplicativo."); }
  };
  const secoes = secoesDoEncarregado({ resumo: resumoCadastro(cadastro), situacao });
  return (
    <View style={estilos.raiz} onTouchStart={tocar}>
      {tela === "menu" && <Tela>
        <ScrollView contentContainerStyle={estilos.rolagem}>
          <View style={estilos.cabecaMenu}>
            <Titulo>Encarregado</Titulo>
            <Corpo secundario>{responsavel.nome}{obra?.nome ? ` · ${obra.nome}` : ""}</Corpo>
          </View>
          {secoes.map(secao => <Secao key={secao.titulo} titulo={secao.titulo}>
            {secao.linhas.map(l => <LinhaAjuste key={l.id} rotulo={l.rotulo} valor={l.valor} tom={l.tom} chevron={!l.acao} onPress={() => abrir(l.id)} />)}
          </Secao>)}
          {!!fixar && <Mensagem tom="info">{fixar}</Mensagem>}
          <BotaoTexto titulo="Sair do modo encarregado" onPress={fechar} />
        </ScrollView>
      </Tela>}
      {tela === "cadastro" && <CadastroFacial cadastro={cadastro} modelos={modelos} api={api} responsavel={responsavel} aoTerminar={async () => { await sincronizarAgora(); voltar(); }} voltar={voltar} />}
      {tela === "sincronizacao" && <Sincronizacao cadastro={cadastro} situacao={situacao} sincronizarAgora={sincronizarAgora} voltar={voltar} />}
      {tela === "diagnostico" && <Diagnostico diagnostico={diagnostico} voltar={voltar} />}
      {tela === "manual" && <RegistroPeloEncarregado pessoas={(cadastro?.funcionarios || []).map(f => ({ ...f, tipo: "funcionario" }))} titulo="Registrar funcionário" registrar={registrar} responsavel={responsavel} voltar={voltar} obra={obra} online={situacao.online} />}
      {tela === "terceiro" && <RegistroPeloEncarregado pessoas={(cadastro?.terceirizados || []).map(t => ({ ...t, tipo: "terceiro" }))} titulo="Acesso de terceirizado" registrar={registrar} responsavel={responsavel} voltar={voltar} obra={obra} online={situacao.online} />}
    </View>
  );
}

function EntrarComPin({ responsaveis, aoEntrar, fechar, sincronizarAgora }) {
  const [escolhido, setEscolhido] = useState(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState(0);
  const [conferindo, setConferindo] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const entrar = () => {
    if (Date.now() < bloqueadoAte) { setErro(`Aguarde ${Math.ceil((bloqueadoAte - Date.now()) / 1000)} s para tentar de novo.`); return; }
    setConferindo(true);
    // PBKDF2 leva cerca de 1 s no aparelho: deixa a tela mostrar o carregando.
    setTimeout(() => {
      const ok = verificarPinResponsavel(pin, [escolhido], pbkdf2Hex);
      setConferindo(false);
      if (ok) { aoEntrar(ok); return; }
      const n = erros + 1;
      setErros(n); setPin("");
      const espera = proximaEsperaPin(n);
      if (espera) setBloqueadoAte(Date.now() + espera);
      setErro(espera ? `PIN incorreto. Aguarde ${Math.round(espera / 1000)} s.` : "PIN incorreto.");
    }, 50);
  };

  if (!responsaveis.length) return <Tela>
    <EstadoCentral tom="atencao" titulo="Sem responsáveis" acoes={<>
      {/* Só baixa o cadastro da obra: não precisa de PIN e é o único jeito de sair daqui. */}
      <Botao titulo="Buscar no ARCD" carregando={buscando} onPress={async () => { setBuscando(true); try { await sincronizarAgora(); } finally { setBuscando(false); } }} />
      <BotaoTexto titulo="Voltar" onPress={fechar} />
    </>}>
      <Corpo secundario centro>Nenhum responsável com PIN do app nesta obra. No ARCD: Ponto eletrônico (app) → Responsáveis com PIN do app. Depois toque em "Buscar no ARCD".</Corpo>
    </EstadoCentral>
  </Tela>;

  if (!escolhido) return <Tela>
    <ScrollView contentContainerStyle={estilos.rolagem}>
      <Cabecalho voltar={fechar} rotuloVoltar="Ponto" titulo="Quem é o responsável?" />
      <Secao>
        {responsaveis.map(r => <LinhaAjuste key={r.userId} rotulo={r.nome} onPress={() => setEscolhido(r)} />)}
      </Secao>
    </ScrollView>
  </Tela>;

  return (
    <KeyboardAvoidingView behavior="height" style={estilos.raiz}>
      <Tela>
        <Cabecalho voltar={() => { setEscolhido(null); setPin(""); setErro(""); }} rotuloVoltar="Responsáveis" titulo={escolhido.nome} subtitulo="Digite o PIN do app." />
        <Campo value={pin} onChangeText={v => setPin(v.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" secureTextEntry autoFocus
          rotulo="PIN do app" placeholder="PIN" grande />
        {!!erro && <Mensagem tom="atencao">{erro}</Mensagem>}
        <Botao titulo="Entrar" onPress={entrar} carregando={conferindo} desabilitado={pin.length < 4} />
        <BotaoTexto titulo="Cancelar" onPress={fechar} />
      </Tela>
    </KeyboardAvoidingView>
  );
}

function ListaPessoas({ pessoas, aoEscolher, marcador }) {
  const [busca, setBusca] = useState("");
  const filtradas = pessoas.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  return <>
    <Campo value={busca} onChangeText={setBusca} rotulo="Buscar pelo nome" placeholder="Buscar pelo nome" />
    <FlatList data={filtradas} keyExtractor={p => p.id} style={estilos.lista} contentContainerStyle={estilos.listaConteudo}
      ListEmptyComponent={<Corpo secundario centro>{busca ? "Ninguém com esse nome." : "Ninguém cadastrado nesta obra."}</Corpo>}
      ItemSeparatorComponent={() => <View style={estilos.separador} />}
      renderItem={({ item }) => <Pressable onPress={() => aoEscolher(item)} accessibilityRole="button"
        accessibilityLabel={`${item.nome}${item.funcao ? `, ${item.funcao}` : ""}${marcador ? `, ${marcador(item).texto}` : ""}`}
        style={({ pressed }) => [estilos.pessoa, pressed && estilos.pessoaPressionada]}>
        <View style={estilos.pessoaTexto}>
          <Texto variante="corpo">{item.nome}</Texto>
          {!!item.funcao && <Rotulo secundario>{item.funcao}</Rotulo>}
        </View>
        {marcador && <Marcador {...marcador(item)} />}
        <Icone nome="chevron" cor={COR.textoTerciario} tamanho={16} />
      </Pressable>} />
  </>;
}

const Marcador = ({ tom, icone, texto }) => <View style={estilos.marcador}>
  <Icone nome={icone} cor={COR_DO_TOM[tom]} tamanho={14} />
  <Rotulo secundario>{texto}</Rotulo>
</View>;

// Cadastro guiado: pessoa → apresentação → termo → 3 fotos → concluído.
// A captura, a análise e o envio são os mesmos de antes; só o percurso mudou.
function CadastroFacial({ cadastro, modelos, api, responsavel, aoTerminar, voltar }) {
  const camera = useRef(null);
  const [pessoa, setPessoa] = useState(null);
  const [introVista, setIntroVista] = useState(false);
  const [aceitoEm, setAceitoEm] = useState(null);
  const [capturas, setCapturas] = useState([]);
  const [fotoBase64, setFotoBase64] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const comBiometria = new Set((cadastro?.biometrias || []).map(b => b.employeeId));
  const recomecar = () => { setPessoa(null); setIntroVista(false); setAceitoEm(null); setCapturas([]); setFotoBase64(null); setMensagem(null); };
  const passo = passoDoCadastro({ pessoa, introVista, aceitoEm, concluido });
  const primeiroNome = pessoa?.nome?.split(" ")[0] || "";

  if (passo === PASSO_CADASTRO.PESSOA) return <Tela>
    <Cabecalho voltar={voltar} rotuloVoltar="Encarregado" titulo="Cadastrar rosto" />
    <ListaPessoas pessoas={cadastro?.funcionarios || []} aoEscolher={setPessoa}
      marcador={p => comBiometria.has(p.id) ? { tom: "sucesso", icone: "ok", texto: "Cadastrado" } : { tom: "neutro", icone: "offline", texto: "Sem rosto" }} />
  </Tela>;

  if (passo === PASSO_CADASTRO.INTRO) return <Tela>
    <Cabecalho voltar={recomecar} rotuloVoltar="Funcionários" />
    <EstadoCentral tom="info" selo={false} titulo={pessoa.nome} acoes={<Botao titulo="Continuar" onPress={() => setIntroVista(true)} />}>
      <Corpo secundario centro>Cadastrar o rosto para registrar o ponto olhando para a câmera. O cadastro poderá ser usado nos aparelhos das obras da empresa.</Corpo>
      {comBiometria.has(pessoa.id) && <Mensagem tom="info">Já existe um rosto cadastrado. O novo cadastro substitui o anterior.</Mensagem>}
    </EstadoCentral>
  </Tela>;

  if (passo === PASSO_CADASTRO.TERMO) return <Tela>
    <Cabecalho voltar={() => setIntroVista(false)} titulo="Termo de consentimento" subtitulo="Leia (ou leia para o funcionário). O cadastro só continua com a concordância dele." />
    <ScrollView style={estilos.termo} contentContainerStyle={estilos.termoConteudo}>
      <Superficie><Corpo>{TERMO_TEXTO}</Corpo></Superficie>
    </ScrollView>
    <Botao titulo="O funcionário concorda" onPress={() => setAceitoEm(new Date().toISOString())} />
    <BotaoTexto titulo="Não concorda - voltar" onPress={recomecar} />
  </Tela>;

  if (passo === PASSO_CADASTRO.CONCLUIDO) return <Tela>
    <EstadoCentral tom="sucesso" titulo="Cadastro concluído">
      <Corpo secundario centro>{primeiroNome} já pode registrar ponto.</Corpo>
    </EstadoCentral>
  </Tela>;

  const capturar = async () => {
    setOcupado(true); setMensagem(null);
    let crua = null;
    try {
      if (!modelos) { setMensagem({ tom: "erro", texto: mensagemDeErro("modelos") }); return; }
      if (!camera.current) throw new Error("câmera não está pronta");
      const foto = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      crua = foto.uri;
      const a = await analisarFoto(modelos, foto);
      if (a.erro) { setMensagem({ tom: "info", texto: a.erro }); return; }
      if (Math.abs(a.giro) > P.giroMaximoDeFrente) { setMensagem({ tom: "info", texto: "Peça para olhar de frente para a câmera." }); return; }
      if (!fotoBase64) {
        const preparada = await prepararFotoDaBatida(foto.uri, foto.width);
        try { setFotoBase64(await lerFotoBase64(preparada.uri)); } finally { apagarFotoLocal(preparada.uri); }
      }
      setCapturas(c => [...c, a.vetor]);
    } catch (e) {
      setMensagem({ tom: "erro", texto: mensagemDeErro("camera", e) });
    } finally { apagarFotoLocal(crua); setOcupado(false); }
  };

  const enviar = async () => {
    setOcupado(true);
    let r;
    try {
      const textoSha256 = bytesToHex(sha256(new TextEncoder().encode(TERMO_TEXTO)));
      r = await api("ponto-cadastrar-biometria", {
        employeeId: pessoa.id, modelo: modelos.modelo, vetor: vetorDoCadastro(capturas), fotos: fotoBase64 ? [fotoBase64] : [],
        consentimento: { termoVersao: TERMO_VERSAO, aceitoEm, textoSha256 }, responsavelId: responsavel.userId,
      });
    } catch (e) {
      setMensagem({ tom: "erro", texto: mensagemDeErro("cadastro", e) }); return;
    } finally { setOcupado(false); }
    if (!r.ok) { setMensagem({ tom: r.status === 0 ? "atencao" : "erro", texto: r.status === 0 ? "O cadastro do rosto precisa de internet. Tente quando o aparelho estiver conectado." : r.status >= 500 ? "O ARCD está temporariamente indisponível. Tente de novo em alguns minutos." : (r.error || "Falha ao cadastrar.") }); return; }
    setConcluido(true);
    setTimeout(aoTerminar, 2000);
  };

  const completas = capturas.length >= CAPTURAS_CADASTRO;
  return <Tela>
    <Cabecalho titulo={completas ? "Fotos prontas" : "Posicione o rosto"} subtitulo={completas ? `Salve o cadastro de ${primeiroNome}.` : "De frente, bem iluminado, sem boné e sem óculos escuros."} />
    <MolduraCamera guia={completas ? "confirmado" : capturas.length ? "detectado" : "neutro"}
      instrucao={completas ? "" : `Foto ${rotuloDaCaptura(capturas.length, CAPTURAS_CADASTRO)}`}>
      <CameraView ref={camera} style={estilos.camera} facing="front" mirror />
    </MolduraCamera>
    <Passos total={CAPTURAS_CADASTRO} feitos={capturas.length} />
    {mensagem && <Mensagem tom={mensagem.tom}>{mensagem.texto}</Mensagem>}
    {completas
      ? <Botao titulo="Salvar cadastro" onPress={enviar} carregando={ocupado} />
      : <Botao titulo="Tirar foto" onPress={capturar} carregando={ocupado} />}
    <BotaoTexto titulo="Cancelar" onPress={voltar} />
  </Tela>;
}

function RegistroPeloEncarregado({ pessoas, titulo, registrar, responsavel, voltar, obra, online }) {
  const camera = useRef(null);
  const [permissao] = useCameraPermissions();
  const comCamera = !!permissao?.granted;
  const [pessoa, setPessoa] = useState(null);
  const [comprovante, setComprovante] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  if (comprovante) return <Comprovante c={comprovante} obra={obra} online={online} aoConcluir={voltar} />;
  if (!pessoa) return <Tela>
    <Cabecalho voltar={voltar} rotuloVoltar="Encarregado" titulo={titulo} />
    <ListaPessoas pessoas={pessoas} aoEscolher={setPessoa} />
  </Tela>;

  const confirmar = async () => {
    setOcupado(true); setErro("");
    // A foto é a evidência de quem estava na frente do aparelho - mas câmera
    // com problema não impede a batida: registra sem foto e avisa.
    let foto = { falhou: true };
    if (comCamera && camera.current) {
      try { foto = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false }); } catch { foto = { falhou: true }; }
    }
    try {
      setComprovante(await registrar({ pessoa, identificacao: { metodo: "encarregado", encarregadoId: responsavel.userId }, foto }));
    } catch (e) { setErro(mensagemDeErro("batida", e)); }
    finally { apagarFotoLocal(foto.uri); setOcupado(false); }
  };

  return <Tela>
    <Cabecalho voltar={() => setPessoa(null)} rotuloVoltar={titulo} titulo={pessoa.nome} subtitulo={`Identificado por ${responsavel.nome}. A foto fica junto da batida.`} />
    {comCamera
      ? <MolduraCamera guia="neutro"><CameraView ref={camera} style={estilos.camera} facing="front" mirror /></MolduraCamera>
      : <View style={estilos.espaco}><Mensagem tom="atencao" titulo="Câmera sem permissão">A batida será registrada sem foto.</Mensagem></View>}
    {!!erro && <Mensagem tom="erro" titulo="O ponto não foi registrado">{erro}</Mensagem>}
    <Botao titulo={comCamera ? "Registrar com foto" : "Registrar sem foto"} onPress={confirmar} carregando={ocupado} />
  </Tela>;
}

// Fila e envio: o que estava no painel do menu, numa página própria.
function Sincronizacao({ cadastro, situacao, sincronizarAgora, voltar }) {
  const [enviando, setEnviando] = useState(false);
  const ultima = cadastro?.sincronizadoEm ? new Date(cadastro.sincronizadoEm).toLocaleString("pt-BR", { timeZone: "America/Recife" }) : "nunca";
  return <Tela>
    <ScrollView contentContainerStyle={estilos.rolagem}>
      <Cabecalho voltar={voltar} rotuloVoltar="Encarregado" titulo="Sincronização" />
      <Mensagem tom={situacao.online ? "sucesso" : "info"} titulo={situacao.online ? "Conectado ao ARCD" : "Offline"}>
        {situacao.online ? "As batidas são enviadas automaticamente a cada minuto." : "O ponto continua funcionando. As batidas ficam guardadas e são enviadas quando a conexão voltar."}
      </Mensagem>
      {!!situacao.aviso && <Mensagem tom="atencao" titulo="Envio pendente">{situacao.aviso}</Mensagem>}
      <Secao titulo="Fila">
        <LinhaAjuste rotulo="Batidas a enviar" valor={String(situacao.pendentes || 0)} mono />
        <LinhaAjuste rotulo="Fotos a enviar" valor={String(situacao.fotos || 0)} mono />
        {!!situacao.fotosComProblema && <LinhaAjuste rotulo="Fotos com problema" valor={String(situacao.fotosComProblema)} mono tom="atencao" />}
      </Secao>
      <Secao titulo="Cadastro da obra">
        <LinhaAjuste rotulo="Última atualização" valor={ultima} />
      </Secao>
    </ScrollView>
    <BotaoSecundario titulo="Sincronizar agora" carregando={enviando}
      onPress={async () => { setEnviando(true); try { await sincronizarAgora(); } finally { setEnviando(false); } }} />
  </Tela>;
}

// Diagnóstico do aparelho para o suporte - sem dado pessoal ou biométrico
// (lista fechada em src/logica/diagnostico.js), em seções de leitura.
function Diagnostico({ diagnostico, voltar }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = () => { setErro(""); diagnostico().then(setItens).catch(() => setErro("Não foi possível ler o diagnóstico.")); };
  useEffect(carregar, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Tela>
    <ScrollView contentContainerStyle={estilos.rolagem}>
      <Cabecalho voltar={voltar} rotuloVoltar="Encarregado" titulo="Diagnóstico" />
      {!!erro && <Mensagem tom="erro">{erro}</Mensagem>}
      {!itens && !erro && <Corpo secundario>Lendo...</Corpo>}
      {itens && secoesDoDiagnostico(itens).map(s => <Secao key={s.titulo} titulo={s.titulo}>
        {s.itens.map(i => <LinhaAjuste key={i.rotulo} rotulo={i.rotulo} valor={i.valor} mono={i.mono} tom={i.atencao ? "atencao" : null} />)}
      </Secao>)}
    </ScrollView>
    <BotaoSecundario titulo="Atualizar" onPress={carregar} />
  </Tela>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: COR.fundo },
  rolagem: { gap: ESPACO.xxl, paddingBottom: ESPACO.lg },
  cabecaMenu: { gap: ESPACO.xs },
  lista: { flex: 1 },
  listaConteudo: { paddingBottom: ESPACO.lg },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: COR.divisor },
  pessoa: { minHeight: TOQUE.linha, paddingVertical: ESPACO.md, flexDirection: "row", alignItems: "center", gap: ESPACO.md },
  pessoaPressionada: { opacity: 0.6 },
  pessoaTexto: { flex: 1, gap: ESPACO.xs },
  marcador: { flexDirection: "row", alignItems: "center", gap: ESPACO.xs },
  termo: { flex: 1 },
  termoConteudo: { paddingBottom: ESPACO.sm },
  camera: { flex: 1 },
  espaco: { flex: 1, justifyContent: "center" },
});
