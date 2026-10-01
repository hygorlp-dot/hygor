// Modo encarregado: responsável da obra (PIN do app definido no ARCD).
// Tudo o que é feito aqui fica registrado com o id do responsável.
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView } from "expo-camera";
import { pbkdf2 } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import RelogioConfiavel from "../../modules/relogio-confiavel";
import { proximaEsperaPin, verificarPinResponsavel } from "../logica/pin";
import { vetorDoCadastro } from "../logica/rosto";
import { analisarFoto, apagarFotoLocal, lerFotoBase64, prepararFotoDaBatida } from "../servicos/rosto-nativo";
import { Botao, COR, Mensagem, Painel, Texto, Titulo, estilos } from "../ui";
import { Comprovante } from "./TelaPonto";

const pbkdf2Hex = (pin, salt, iteracoes) => bytesToHex(pbkdf2(sha256, pin, salt, { c: iteracoes, dkLen: 32 }));
const INATIVIDADE_MS = 3 * 60_000;
const CAPTURAS_CADASTRO = 3;

// Termo de consentimento (LGPD, dado biométrico). Versionado: a versão e o
// hash do texto vão junto com o cadastro. Revisar com o jurídico.
export const TERMO_VERSAO = "2026-10";
export const TERMO_TEXTO = "Autorizo a ARCD a usar a imagem do meu rosto para gerar um código biométrico usado SOMENTE para registrar o meu ponto nas obras da empresa. O código e as fotos ficam protegidos, não são compartilhados com terceiros e serão apagados quando eu deixar a empresa ou se eu pedir. Posso pedir a exclusão a qualquer momento; nesse caso meu ponto passa a ser registrado pelo encarregado.";

export default function TelaEncarregado({ cadastro, modelos, registrar, sincronizarAgora, situacao, fechar, api, obra }) {
  const [responsavel, setResponsavel] = useState(null);   // { userId, nome } depois do PIN
  const [tela, setTela] = useState("menu");
  const ultimoToque = useRef(Date.now());
  const tocar = () => { ultimoToque.current = Date.now(); };
  useEffect(() => {
    const t = setInterval(() => { if (Date.now() - ultimoToque.current > INATIVIDADE_MS) fechar(); }, 15_000);
    return () => clearInterval(t);
  }, [fechar]);

  if (!responsavel) return <EntrarComPin responsaveis={cadastro?.responsaveis || []} aoEntrar={setResponsavel} fechar={fechar} />;

  const voltar = () => setTela("menu");
  return (
    <View style={estilos.tela} onTouchStart={tocar}>
      {tela === "menu" && <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Titulo>Encarregado</Titulo>
        <Texto apagado>{responsavel.nome} · {obra?.nome}</Texto>
        <Botao titulo="Cadastrar rosto de funcionário" onPress={() => setTela("cadastro")} />
        <Botao titulo="Registrar ponto de um funcionário" tipo="secundario" onPress={() => setTela("manual")} />
        <Botao titulo="Acesso de terceirizado" tipo="secundario" onPress={() => setTela("terceiro")} />
        <Painel>
          <Texto>Batidas a enviar: {situacao.pendentes} · fotos: {situacao.fotos}</Texto>
          <Texto apagado>Última sincronização: {cadastro?.sincronizadoEm ? new Date(cadastro.sincronizadoEm).toLocaleString("pt-BR") : "nunca"}</Texto>
          <Botao titulo="Sincronizar agora" tipo="secundario" onPress={sincronizarAgora} />
        </Painel>
        <Botao titulo="Fixar o app na tela" tipo="secundario" onPress={() => RelogioConfiavel.fixarNaTela()} />
        <Botao titulo="Sair do modo encarregado" tipo="secundario" onPress={fechar} />
      </ScrollView>}
      {tela === "cadastro" && <CadastroFacial cadastro={cadastro} modelos={modelos} api={api} responsavel={responsavel} aoTerminar={async () => { await sincronizarAgora(); voltar(); }} voltar={voltar} />}
      {tela === "manual" && <RegistroPeloEncarregado pessoas={(cadastro?.funcionarios || []).map(f => ({ ...f, tipo: "funcionario" }))} titulo="Registrar ponto de um funcionário" registrar={registrar} responsavel={responsavel} voltar={voltar} obra={obra} />}
      {tela === "terceiro" && <RegistroPeloEncarregado pessoas={(cadastro?.terceirizados || []).map(t => ({ ...t, tipo: "terceiro" }))} titulo="Acesso de terceirizado" registrar={registrar} responsavel={responsavel} voltar={voltar} obra={obra} />}
    </View>
  );
}

function EntrarComPin({ responsaveis, aoEntrar, fechar }) {
  const [escolhido, setEscolhido] = useState(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [erros, setErros] = useState(0);
  const [bloqueadoAte, setBloqueadoAte] = useState(0);
  const [conferindo, setConferindo] = useState(false);

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

  if (!responsaveis.length) return <View style={[estilos.tela, { justifyContent: "center" }]}>
    <Titulo>Sem responsáveis</Titulo>
    <Texto apagado>Nenhum responsável com PIN do app para esta obra. No ARCD: Ponto eletrônico (app) → Responsáveis com PIN do app. Depois sincronize o aparelho.</Texto>
    <Botao titulo="Voltar" tipo="secundario" onPress={fechar} />
  </View>;

  return (
    <View style={[estilos.tela, { justifyContent: "center" }]}>
      <Titulo>{escolhido ? escolhido.nome : "Quem é o responsável?"}</Titulo>
      {!escolhido
        ? responsaveis.map(r => <Botao key={r.userId} titulo={r.nome} tipo="secundario" onPress={() => setEscolhido(r)} />)
        : <>
          <TextInput value={pin} onChangeText={v => setPin(v.replace(/\D/g, "").slice(0, 8))} keyboardType="number-pad" secureTextEntry autoFocus
            accessibilityLabel="PIN do app" placeholder="PIN" placeholderTextColor={COR.linha}
            style={{ fontSize: 36, letterSpacing: 10, color: COR.texto, textAlign: "center", borderBottomWidth: 2, borderColor: COR.ouro, paddingVertical: 8 }} />
          {!!erro && <Mensagem tipo="erro">{erro}</Mensagem>}
          <Botao titulo="Entrar" onPress={entrar} carregando={conferindo} desabilitado={pin.length < 4} />
          <Botao titulo="Trocar responsável" tipo="secundario" onPress={() => { setEscolhido(null); setPin(""); setErro(""); }} />
        </>}
      <Botao titulo="Cancelar" tipo="secundario" onPress={fechar} />
    </View>
  );
}

function ListaPessoas({ pessoas, aoEscolher, marcador }) {
  const [busca, setBusca] = useState("");
  const filtradas = pessoas.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  return <>
    <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar pelo nome" placeholderTextColor={COR.apagado}
      style={{ fontSize: 18, color: COR.texto, borderWidth: 1, borderColor: COR.linha, borderRadius: 8, padding: 12 }} />
    <FlatList data={filtradas} keyExtractor={p => p.id} style={{ flex: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: COR.linha }} />}
      renderItem={({ item }) => <Pressable onPress={() => aoEscolher(item)} accessibilityRole="button" style={{ paddingVertical: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: COR.texto, fontSize: 18, flex: 1 }}>{item.nome}{item.funcao ? <Text style={{ color: COR.apagado }}> · {item.funcao}</Text> : null}</Text>
        {marcador?.(item)}
      </Pressable>} />
  </>;
}

function CadastroFacial({ cadastro, modelos, api, responsavel, aoTerminar, voltar }) {
  const camera = useRef(null);
  const [pessoa, setPessoa] = useState(null);
  const [aceitoEm, setAceitoEm] = useState(null);
  const [capturas, setCapturas] = useState([]);
  const [fotoBase64, setFotoBase64] = useState(null);
  const [mensagem, setMensagem] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const comBiometria = new Set((cadastro?.biometrias || []).map(b => b.employeeId));

  if (!pessoa) return <>
    <Titulo>Cadastrar rosto</Titulo>
    <ListaPessoas pessoas={cadastro?.funcionarios || []} aoEscolher={setPessoa}
      marcador={p => <Text style={{ color: comBiometria.has(p.id) ? COR.verde : COR.laranja }}>{comBiometria.has(p.id) ? "cadastrado" : "pendente"}</Text>} />
    <Botao titulo="Voltar" tipo="secundario" onPress={voltar} />
  </>;

  if (!aceitoEm) return <ScrollView contentContainerStyle={{ gap: 14 }}>
    <Titulo>{pessoa.nome}</Titulo>
    <Texto apagado>Leia (ou leia para o funcionário) o termo abaixo. O cadastro só continua com a concordância dele.</Texto>
    <Painel><Texto>{TERMO_TEXTO}</Texto></Painel>
    <Botao titulo="O funcionário concorda" onPress={() => setAceitoEm(new Date().toISOString())} />
    <Botao titulo="Não concorda - voltar" tipo="secundario" onPress={() => setPessoa(null)} />
  </ScrollView>;

  const capturar = async () => {
    setOcupado(true); setMensagem(null);
    try {
      const foto = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      const a = await analisarFoto(modelos, foto);
      if (a.erro) { setMensagem({ tipo: "erro", texto: a.erro }); return; }
      if (Math.abs(a.giro) > 0.15) { setMensagem({ tipo: "erro", texto: "Peça para olhar de frente para a câmera." }); return; }
      if (!fotoBase64) {
        const preparada = await prepararFotoDaBatida(foto.uri);
        setFotoBase64(await lerFotoBase64(preparada.uri));
        apagarFotoLocal(preparada.uri);
      }
      setCapturas(c => [...c, a.vetor]);
    } catch (e) {
      setMensagem({ tipo: "erro", texto: `Falha na captura: ${e?.message || e}` });
    } finally { setOcupado(false); }
  };

  const enviar = async () => {
    setOcupado(true);
    const textoSha256 = bytesToHex(sha256(new TextEncoder().encode(TERMO_TEXTO)));
    const r = await api("ponto-cadastrar-biometria", {
      employeeId: pessoa.id, modelo: modelos.modelo, vetor: vetorDoCadastro(capturas), fotos: fotoBase64 ? [fotoBase64] : [],
      consentimento: { termoVersao: TERMO_VERSAO, aceitoEm, textoSha256 }, responsavelId: responsavel.userId,
    });
    setOcupado(false);
    if (!r.ok) { setMensagem({ tipo: "erro", texto: r.status === 0 ? "O cadastro do rosto precisa de internet. Tente quando o aparelho estiver conectado." : (r.error || "Falha ao cadastrar.") }); return; }
    setMensagem({ tipo: "sucesso", texto: `Rosto de ${pessoa.nome} cadastrado.` });
    setTimeout(aoTerminar, 1500);
  };

  return <>
    <Titulo>{pessoa.nome}</Titulo>
    <Texto apagado>Foto {Math.min(capturas.length + 1, CAPTURAS_CADASTRO)} de {CAPTURAS_CADASTRO}: rosto de frente, bem iluminado, sem boné e sem óculos escuros.</Texto>
    <View style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}><CameraView ref={camera} style={{ flex: 1 }} facing="front" mirror /></View>
    {mensagem && <Mensagem tipo={mensagem.tipo}>{mensagem.texto}</Mensagem>}
    {capturas.length < CAPTURAS_CADASTRO
      ? <Botao titulo="Tirar foto" grande onPress={capturar} carregando={ocupado} />
      : <Botao titulo="Salvar cadastro" grande onPress={enviar} carregando={ocupado} />}
    <Botao titulo="Cancelar" tipo="secundario" onPress={voltar} />
  </>;
}

function RegistroPeloEncarregado({ pessoas, titulo, registrar, responsavel, voltar, obra }) {
  const camera = useRef(null);
  const [pessoa, setPessoa] = useState(null);
  const [comprovante, setComprovante] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  if (comprovante) return <>
    <Comprovante c={comprovante} obra={obra} />
    <Botao titulo="Concluir" onPress={voltar} />
  </>;
  if (!pessoa) return <>
    <Titulo>{titulo}</Titulo>
    <ListaPessoas pessoas={pessoas} aoEscolher={setPessoa} />
    <Botao titulo="Voltar" tipo="secundario" onPress={voltar} />
  </>;

  const confirmar = async () => {
    setOcupado(true); setErro("");
    try {
      // A foto é a evidência de quem estava na frente do aparelho.
      const foto = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      setComprovante(await registrar({ pessoa, identificacao: { metodo: "encarregado", encarregadoId: responsavel.userId }, fotoUri: foto.uri }));
    } catch (e) { setErro(`Não foi possível registrar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };

  return <>
    <Titulo>{pessoa.nome}</Titulo>
    <Texto apagado>A foto da pessoa fica junto da batida. Identificado por {responsavel.nome}.</Texto>
    <View style={{ flex: 1, borderRadius: 12, overflow: "hidden" }}><CameraView ref={camera} style={{ flex: 1 }} facing="front" mirror /></View>
    {!!erro && <Mensagem tipo="erro">{erro}</Mensagem>}
    <Botao titulo="Registrar com foto" grande onPress={confirmar} carregando={ocupado} />
    <Botao titulo="Voltar" tipo="secundario" onPress={() => setPessoa(null)} />
  </>;
}
