// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { C } from "../../legacy/palette.js";
import { textoUi, Modal, Btn, Inp, CampoCNPJ, Ic } from "../../legacy/ui.jsx";
import { fmt, fmtDate, rotuloRamo } from "../../legacy/format.js";
import { lazyWithCssRetry as lazy } from "../../lib/lazy-with-css-retry.js";
import { useState } from "react";
import { digitsOnly as soDigitos } from "../data/brazilian-documents";
import { pedidosComItensAtrasados } from "./delivery-schedule";
import { features } from "../../config/features";
import { Suspense } from "react";
import { useBreakpoint } from "../../hooks/useBreakpoint";
import { SUPPLIER_CATEGORIES as RAMOS_FORNECIMENTO } from "../suppliers/categories";


// O editor novo só é baixado se a flag local do piloto for habilitada. Com a
// flag desligada, o modal histórico continua sendo a única implementação.
export const LazySupplierEditor = lazy(() => import("../suppliers/SupplierEditor").then(module => ({ default: module.SupplierEditor })));


// ==============================================================
//  CNAE -> RAMO DE FORNECIMENTO
//  A Receita diz o que a empresa faz (CNAE principal + secundarios).
//  Isso e suficiente para deduzir o que ela fornece, poupando o
//  usuario de marcar na mao. Duas vias: o CODIGO (confiavel) e as
//  PALAVRAS da descricao (pega o que o codigo nao cobre). O que for
//  deduzido entra como sugestao - da para desmarcar.
// ==============================================================
export const CNAE_RAMOS = [
  { pre:["4744001","4672900"], ramos:["ferragens","ferramentas"] },
  { pre:["4744002","1610203","1610205"], ramos:["madeira"] },
  { pre:["4744003","2222600"], ramos:["hidraulico"] },
  { pre:["4744004"], ramos:["areia_brita","cobertura"] },
  { pre:["4744005","4744099","4679699","4679604"], ramos:["casa_construcao"] },
  { pre:["4744006","4679602","2391503"], ramos:["pedras"] },
  { pre:["4741500","4679601"], ramos:["tintas"] },
  { pre:["4742300","4673700"], ramos:["eletrico"] },
  { pre:["4743100","4679603","2512800","2511000"], ramos:["esquadrias"] },
  { pre:["4674500","2320600","2330305"], ramos:["cimento"] },
  { pre:["2330301","2330302","2330303","2330399"], ramos:["concreto"] },
  { pre:["2342701","2342702"], ramos:["porcelanato"] },
  { pre:["2441501","2451200","4685100","2599301"], ramos:["aco","metais"] },
  { pre:["7732201","7732202"], ramos:["locacao"] },
  { pre:["4649408","3292202"], ramos:["epi"] },
];

export const PALAVRAS_RAMO = [
  { termos:["ferragem","ferramenta","parafuso","fixacao"], ramos:["ferragens","ferramentas"] },
  { termos:["madeira","serraria","compensado","carpintaria"], ramos:["madeira"] },
  { termos:["hidraulic","tubo","conexao","pvc","saneamento"], ramos:["hidraulico"] },
  { termos:["areia","brita","pedra britada","tijolo","aterro"], ramos:["areia_brita"] },
  { termos:["telha","cobertura","calha"], ramos:["cobertura"] },
  { termos:["material de construcao","materiais de construcao","construcao em geral"], ramos:["casa_construcao"] },
  { termos:["marmore","granito","revestimento de pedra","rocha ornamental"], ramos:["pedras"] },
  { termos:["tinta","verniz","pintura","solvente"], ramos:["tintas"] },
  { termos:["eletric","fio e cabo","condutor","iluminacao","luminaria"], ramos:["eletrico"] },
  { termos:["vidro","espelho","esquadria","janela","porta de aluminio","serralheria"], ramos:["esquadrias"] },
  { termos:["cimento","argamassa","cal hidratada"], ramos:["cimento"] },
  { termos:["concreto","pre-moldado","premoldado","usinado"], ramos:["concreto"] },
  { termos:["ceramic","azulejo","porcelanato","piso e revestimento"], ramos:["porcelanato"] },
  { termos:["aco","siderurgic","metalurgic","vergalhao","ferro"], ramos:["aco"] },
  { termos:["metal sanitario","louca sanitaria","louca","metais sanitarios"], ramos:["louca_metal"] },
  { termos:["gesso","drywall","forro"], ramos:["gesso"] },
  { termos:["impermeabiliz","manta asfaltica"], ramos:["impermeabilizante"] },
  { termos:["aluguel de maquinas","locacao de maquinas","aluguel de andaimes","locacao de equipamentos"], ramos:["locacao"] },
  { termos:["equipamento de protecao","seguranca do trabalho"], ramos:["epi"] },
];


// Deduz os ramos a partir da lista de CNAEs devolvida pela Receita.
export const ramosDosCnaes = (cnaes) => {
  const semAcento = s => String(s || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const achados = new Set();
  (cnaes || []).forEach(c => {
    const cod = String(c.codigo || "").replace(/\D/g, "");
    CNAE_RAMOS.forEach(m => {
      if (m.pre.some(p => cod.startsWith(p))) m.ramos.forEach(r => achados.add(r));
    });
    const desc = semAcento(c.descricao);
    PALAVRAS_RAMO.forEach(m => {
      if (m.termos.some(t => desc.includes(t))) m.ramos.forEach(r => achados.add(r));
    });
  });
  return [...achados];
};


// Campo de CNPJ com busca automatica na Receita (BrasilAPI). Ao clicar em
// "Buscar" (ou sair do campo com 14 digitos), consulta e entrega os dados ao
// pai via onEncontrado. Mostra estado de carregando/erro sem travar o resto.
// Campo de CEP que preenche o endereco sozinho (ViaCEP). Mesmo padrao do
// CampoCNPJ: consulta ao sair do campo, avisa em vez de travar se falhar.
export function CampoCEP({ label = "CEP", value, onChange, onEncontrado }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const consultar = async () => {
    setErro("");
    const cep = soDigitos(value);
    if (cep.length !== 8) { if (cep.length) setErro("O CEP tem 8 dígitos."); return; }
    setCarregando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (j.erro) { setErro("CEP não encontrado."); return; }
      onEncontrado && onEncontrado({
        endereco: j.logradouro || "", bairro: j.bairro || "",
        cidade: j.localidade || "", uf: j.uf || "",
      });
    } catch (e) {
      setErro("Não foi possível consultar o CEP agora.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <label style={{ display:"flex", flexDirection:"column", gap:4 }}>
      {label && <span style={{ color:C.text, fontSize:"var(--arcd-type-caption)", fontWeight:600,
        letterSpacing:.1, fontFamily:"var(--arcd-font-sans)" }}>{textoUi(label)}</span>}
      <input value={value == null ? "" : value}
        onChange={e => { onChange(e.target.value); setErro(""); }}
        onBlur={consultar}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
        placeholder="00000-000"
        style={{ width:"100%", boxSizing:"border-box", background:C.bg, border:`1.5px solid ${C.border}`,
          color:C.text, padding:"8px 10px", borderRadius:7, fontSize:"var(--arcd-type-control)", outline:"none",
          fontFamily:"var(--arcd-font-sans)" }}/>
      {carregando && <span style={{ fontSize:"var(--arcd-type-label)", color:C.muted }}>Buscando endereço...</span>}
      {erro && <span style={{ fontSize:"var(--arcd-type-label)", color:C.orange }}>{erro}</span>}
    </label>
  );
}


// ==============================================================
//  COMPRAS AUTOMATIZADAS
//  Dado um conjunto de materiais, sugere fornecedores que os servem
//  (por categoria cadastrada + historico de compra) e gera a mensagem
//  de WhatsApp pronta - texto humano pedindo materiais, desconto e
//  forma de pagamento.
// ==============================================================

// Fornecedores que servem os materiais de um pedido, com score.
// Casa por: (a) categoria do material x categorias do fornecedor,
// (b) historico - ja comprei este material dele antes (mais forte).
export const fornecedoresParaMateriais = (data, materialIds) => {
  const mats = (data.materiais || []).filter(m => materialIds.includes(m.id));
  const catsNecessarias = [...new Set(mats.map(m => m.categoria).filter(Boolean))];
  const pedidos = data.pedidos || [];

  const scores = {};
  (data.fornecedores || []).filter(f => f.ativo !== false).forEach(forn => {
    let score = 0;
    const motivos = [];
    const catsAtende = (forn.categorias || []).filter(c => catsNecessarias.includes(c));
    if (catsAtende.length) {
      score += catsAtende.length * 20;
      motivos.push(`fornece ${catsAtende.length} categoria(s)`);
    }
    // Historico: ja recebi estes materiais deste fornecedor?
    let jaComprou = 0;
    materialIds.forEach(mid => {
      const comprou = pedidos.some(p => p.fornecedorId === forn.id && p.status !== "cancelado" &&
        (p.itens || []).some(i => i.materialId === mid && Number(i.qtdRecebida) > 0));
      if (comprou) jaComprou++;
    });
    if (jaComprou) {
      score += jaComprou * 35;
      motivos.push(`ja forneceu ${jaComprou} destes itens`);
    }
    if (score > 0) scores[forn.id] = { forn, score, motivos, jaComprou };
  });

  return Object.values(scores).sort((a, b) => b.score - a.score);
};


// Melhor preco historico de um material (menor preco ja pago e de quem).
// Recebe o historico JA calculado (ver historicoPreco/historicoPrecoTodos) -
// quem chama e responsavel por nao rescanear pedidos a cada render.
export const melhorPrecoHist = (h, fornecedores) => {
  if (!h || !h.length) return null;
  const menor = h.reduce((m, x) => !m || x.preco < m.preco ? x : m, null);
  const forn = (fornecedores || []).find(f => f.id === menor.fornecedorId);
  return { preco: menor.preco, fornecedor: forn?.nome || "", data: menor.data };
};


// Gera a mensagem de WhatsApp - texto humano, natural, de quem trabalha com
// obra. Pede os materiais, desconto e condicoes de pagamento. Recebe os itens
// ja resolvidos {descricao, qtd, unidade}.
export const mensagemWhatsAppCompra = ({ empresa, fornecedorNome, obraNome, itens, prazo, whatsappRetorno }) => {
  const saudacao = fornecedorNome ? `Ola, ${fornecedorNome.split(" ")[0]}! Tudo bem?` : "Ola! Tudo bem?";
  const linhas = itens.map(i => {
    const un = i.unidade ? ` ${i.unidade}` : "";
    return `- ${i.descricao}: ${i.qtd}${un}`;
  }).join("\n");
  const ass = empresa ? `\n\nObrigado!\n${empresa}` : "\n\nObrigado!";
  const retorno = whatsappRetorno ? `\n\nPode responder por aqui mesmo ou no nosso WhatsApp de Compras: ${whatsappRetorno}` : "";
  const obra = obraNome ? ` para a obra ${obraNome}` : "";
  const prazoTxt = prazo ? `\n\nPrecisamos${obra} com entrega ate ${prazo}. Da pra atender?`
                         : `\n\nMe informa por favor o prazo de entrega${obra}.`;
  return `${saudacao}\n\nGostaria de um orcamento dos seguintes materiais:\n\n${linhas}`
       + prazoTxt
       + `\n\nVoces conseguem algum desconto para pagamento a vista? E quais as formas de pagamento e prazos que trabalham?`
       + `\n\nFico no aguardo do melhor preco.${retorno}${ass}`;
};


// Monta o link wa.me a partir de um telefone brasileiro e do texto.
export const linkWhatsApp = (telefone, texto) => {
  const num = String(telefone || "").replace(/\D/g, "");
  // Assume Brasil: se nao tem 55 na frente e tem 10-11 digitos, adiciona.
  const full = num.length >= 12 ? num : (num.length >= 10 ? "55" + num : num);
  return `https://wa.me/${full}?text=${encodeURIComponent(texto)}`;
};


// ── Entregas atrasadas ─────────────────────────────────────────────
// Pedido enviado/parcial com previsao vencida e material ainda pendente.
// Devolve o que falta chegar de cada um, pronto para a cobranca.
// C2.2: o atraso olha cada item e cada remessa programada, não o pedido.
export const pedidosEmAtraso = (data, hoje) => pedidosComItensAtrasados(data, hoje);


// Mensagem de cobranca de entrega - firme e educada, citando o combinado.
export const mensagemWhatsAppCobranca = ({ empresa, fornecedorNome, obraNome, numero, previsao, diasAtraso, itens }) => {
  const saudacao = fornecedorNome ? `Ola, ${fornecedorNome.split(" ")[0]}! Tudo bem?` : "Ola! Tudo bem?";
  const linhas = (itens || []).map(i => {
    const un = i.unidade ? ` ${i.unidade}` : "";
    return `- ${i.descricao}: falta ${i.falta}${un}`;
  }).join("\n");
  const obra = obraNome ? ` da obra ${obraNome}` : "";
  const ass = empresa ? `\n\nObrigado!\n${empresa}` : "\n\nObrigado!";
  return `${saudacao}\n\nEstou acompanhando o pedido ${numero}${obra}, que tinha entrega combinada para ${previsao} - ja se passaram ${diasAtraso} dia(s).`
       + `\n\nAinda falta chegar:\n\n${linhas}`
       + `\n\nPreciso desses materiais para nao parar a frente de servico. Consegue me confirmar hoje a nova data de entrega?${ass}`;
};


// ── Guarda de preco ────────────────────────────────────────────────
// Chamada enquanto o comprador digita o preco unitario. Compara com o melhor
// preco ja pago e com a referencia SINAPI/ORSE do item, e devolve um veredito.
// O objetivo e pegar o vazamento NA HORA - a analise de Orcado x Comprado so
// denuncia depois que o dinheiro ja saiu.
// Recebe o historico JA calculado (ver historicoPreco/historicoPrecoTodos) -
// quem chama e responsavel por nao rescanear pedidos a cada render.
export const guardaPreco = (h, precoDigitado, fornecedores, precoRef) => {
  const preco = Number(precoDigitado || 0);
  if (!(preco > 0)) return null;

  const melhor = h && h.length ? h.reduce((m, x) => !m || x.preco < m.preco ? x : m, null) : null;
  const ref = Number(precoRef || 0);

  const avisos = [];
  if (melhor && melhor.preco > 0) {
    const dif = preco - melhor.preco;
    const pct = (dif / melhor.preco) * 100;
    const forn = (fornecedores || []).find(f => f.id === melhor.fornecedorId);
    if (pct > 5) {
      avisos.push({
        nivel: pct > 20 ? "alto" : "medio",
        texto: `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% acima do melhor que você já pagou (${fmt(melhor.preco)}${forn ? ` · ${forn.nome}` : ""}${melhor.data ? ` · ${fmtDate(melhor.data)}` : ""})`,
      });
    } else if (pct < -5) {
      avisos.push({ nivel: "bom", texto: `melhor preço já pago para este material (antes: ${fmt(melhor.preco)})` });
    }
  }
  if (ref > 0) {
    const pctRef = ((preco - ref) / ref) * 100;
    if (pctRef > 10) avisos.push({ nivel: pctRef > 30 ? "alto" : "medio", texto: `${pctRef.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% acima da referência (${fmt(ref)})` });
  }

  const nivel = avisos.some(a => a.nivel === "alto") ? "alto"
    : avisos.some(a => a.nivel === "medio") ? "medio"
    : avisos.some(a => a.nivel === "bom") ? "bom" : null;

  return { nivel, avisos, melhor, compras: h ? h.length : 0 };
};


// ── SLA das solicitacoes ───────────────────────────────────────────
// Solicitacao parada e obra parada. Urgente tem 2 dias uteis de tolerancia;
// normal, 5. O relogio conta desde o envio ate a analise (nao ate o pedido):
// o que se mede aqui e o tempo de RESPOSTA do setor de Compras.
export const SLA_DIAS = { urgente: 2, normal: 5 };


export const slaSolicitacao = (sol, hoje) => {
  if (!["enviada", "em_analise"].includes(sol.status)) return null;
  const criada = String(sol.criadoEm || "").slice(0, 10);
  if (!criada) return null;
  const dias = Math.max(0, Math.round((new Date(hoje + "T00:00:00") - new Date(criada + "T00:00:00")) / 86400000));
  const limite = SLA_DIAS[sol.prioridade === "urgente" ? "urgente" : "normal"];
  const restante = limite - dias;
  return {
    dias, limite, restante,
    status: restante < 0 ? "estourado" : restante === 0 ? "no_limite" : "ok",
  };
};


// ── Consolidacao multi-obra ────────────────────────────────────────
// Com uma dezena de obras, o mesmo cimento e pedido por tres delas em semanas
// proximas e comprado tres vezes, sem volume. Aqui procuramos o mesmo material
// (pela descricao normalizada) em solicitacoes ABERTAS de obras DIFERENTES
// dentro de uma janela de dias, e sugerimos a compra unica.
export const normDesc = (s) => String(s || "").toUpperCase().replace(/\s+/g, " ").trim();


export const oportunidadesConsolidacao = (data, hoje, janelaDias = 10) => {
  const abertas = (data.solicitacoesCompra || [])
    .filter(s => ["enviada", "em_analise"].includes(s.status) && s.criadoEm);
  if (abertas.length < 2) return [];

  const limite = new Date(hoje + "T00:00:00").getTime() - janelaDias * 86400000;
  const porMaterial = new Map();

  abertas.forEach(sol => {
    const quando = new Date(String(sol.criadoEm).slice(0, 10) + "T00:00:00").getTime();
    if (quando < limite) return;   // fora da janela: consolidar nao faz sentido
    (sol.itens || []).forEach(item => {
      const chave = `${normDesc(item.descricaoRef)}|${normDesc(item.unidadeRef)}`;
      if (!chave.replace("|", "").trim()) return;
      const reg = porMaterial.get(chave) || {
        descricao: normDesc(item.descricaoRef), unidade: normDesc(item.unidadeRef),
        total: 0, obras: new Map(),
      };
      reg.total += Number(item.quantidade || 0);
      const obraNome = (data.obras || []).find(o => o.id === sol.obraId)?.name || "Obra";
      const jaObra = reg.obras.get(sol.obraId) || { obraId: sol.obraId, obraNome, qtd: 0, solicitacoes: new Set() };
      jaObra.qtd += Number(item.quantidade || 0);
      jaObra.solicitacoes.add(sol.numero);
      reg.obras.set(sol.obraId, jaObra);
      porMaterial.set(chave, reg);
    });
  });

  return [...porMaterial.values()]
    .filter(r => r.obras.size >= 2)   // so vale consolidar entre obras distintas
    .map(r => ({
      descricao: r.descricao, unidade: r.unidade, total: r.total,
      obras: [...r.obras.values()].map(o => ({ ...o, solicitacoes: [...o.solicitacoes] }))
        .sort((a, b) => b.qtd - a.qtd),
    }))
    .sort((a, b) => b.obras.length - a.obras.length || b.total - a.total);
};


//
// ESTOQUE - controle FÍSICO
//
// Não gera lançamento financeiro. O custo do material já entrou no DRE pela
// Conciliação, no momento da compra (regime de caixa). Lançar de novo na
// baixa contaria o mesmo saco de cimento duas vezes.
//

//
// UNIDADES DE MEDIDA
//
// Antes era texto livre. Alguém digitava "sc", outro "SC", outro "saco" -
// e o sistema tratava como três coisas diferentes. Soma errada, curva ABC
// errada, composição que não baixa. Erro silencioso, o pior tipo.
//
// Agora é uma lista. Estas são as unidades SINAPI mais usadas; você
// acrescenta as suas.
export const UNIDADES_PADRAO = [
  { sigla:"un",   nome:"Unidade" },
  { sigla:"m",    nome:"Metro linear" },
  { sigla:"m2",   nome:"Metro quadrado" },
  { sigla:"m3",   nome:"Metro cúbico" },
  { sigla:"kg",   nome:"Quilograma" },
  { sigla:"t",    nome:"Tonelada" },
  { sigla:"sc",   nome:"Saco" },
  { sigla:"l",    nome:"Litro" },
  { sigla:"gl",   nome:"Galão" },
  { sigla:"pc",   nome:"Peça" },
  { sigla:"cj",   nome:"Conjunto" },
  { sigla:"br",   nome:"Barra" },
  { sigla:"rl",   nome:"Rolo" },
  { sigla:"cx",   nome:"Caixa" },
  { sigla:"mlh",  nome:"Milheiro" },
  { sigla:"h",    nome:"Hora" },
  { sigla:"dia",  nome:"Diária" },
  { sigla:"vb",   nome:"Verba" },
];


export const CATS_MATERIAL = [
  { v:"estrutural",  l:"Estrutural (cimento, aço, brita)" },
  { v:"alvenaria",   l:"Alvenaria e argamassa" },
  { v:"eletrico",    l:"Elétrico" },
  { v:"hidraulico",  l:"Hidráulico" },
  { v:"acabamento",  l:"Acabamento (revestimento, tinta)" },
  { v:"cobertura",   l:"Cobertura e impermeabilização" },
  { v:"esquadria",   l:"Esquadrias" },
  { v:"ferramenta",  l:"Ferramentas e EPI" },
  { v:"outros",      l:"Outros" },
];



// ============================================================================
//  SUPRIMENTOS - Curva de necessidade de materiais + comparação de preços +
//  alertas de pesquisa por curva ABC + sugestão de fornecedor.
// ============================================================================
// Modal compartilhado: dispara pedido de orcamento por WhatsApp, um link por
// fornecedor, com a lista completa de itens. Fornecedores que ja venderam
// algum item da lista aparecem primeiro.
export function ModalCotacaoWhatsApp({ titulo, itens, obraNome, prazo, fornecedores, pedidos, materiais, data, onClose, onContato }) {
  const jaVendeu = new Set();
  (pedidos || []).filter(p => p.status !== "cancelado").forEach(p => (p.itens || []).forEach(i => {
    const mat = (materiais || []).find(m => m.id === i.materialId);
    if (mat && itens.some(it => String(it.descricao || "").toUpperCase() === String(mat.descricao || "").toUpperCase())) jaVendeu.add(p.fornecedorId);
  }));
  const lista = [...(fornecedores || [])].filter(f => f.ativo !== false && f.telefone)
    .sort((a, b) => Number(jaVendeu.has(b.id)) - Number(jaVendeu.has(a.id)) || a.nome.localeCompare(b.nome));
  return <Modal title={titulo || "Cotação por WhatsApp"} onClose={onClose}>
    <p style={{ fontSize:"var(--arcd-type-label)", color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
      {itens.length} item(ns) na lista. Toque em cada fornecedor para abrir o WhatsApp com o pedido de orçamento completo. Quando as respostas chegarem, registre os preços em Cotações ou Suprimentos.
    </p>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", marginBottom: 10, maxHeight: 120, overflow: "auto" }}>
      {itens.map((i, ix) => <p key={ix} style={{ fontSize:"var(--arcd-type-label)", color: C.muted }}>• {i.descricao} — <b style={{ color: C.text }}>{i.qtd} {i.unidade}</b></p>)}
    </div>
    {!lista.length && <p style={{ fontSize: "var(--arcd-type-body)", color: C.muted, textAlign: "center", padding: 12 }}>Nenhum fornecedor com telefone cadastrado.</p>}
    {lista.map(f => {
      const texto = mensagemWhatsAppCompra({
        empresa: data?.config?.companyName || "MARCELL Obras",
        whatsappRetorno: data?.config?.whatsappCompras || "",
        fornecedorNome: f.nome, obraNome: obraNome || "", prazo: prazo || "", itens,
      });
      return <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.line}`, padding: "8px 0" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "var(--arcd-type-body)", fontWeight:600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nome}</p>
          {jaVendeu.has(f.id) && <p style={{ fontSize:"var(--arcd-type-caption)", color: C.green, fontWeight:600 }}>já forneceu itens desta lista</p>}
        </div>
        <a href={linkWhatsApp(f.telefone, texto)} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flexShrink: 0 }}
           onClick={() => onContato?.(f.id, f.nome)}>
          <Btn size="sm" v="success">WhatsApp</Btn>
        </a>
      </div>;
    })}
  </Modal>;
}


export function FornecedorEditorPilot({ form, setForm, onSave }) {
  if (!features.newSupplierEditor) return <ModalFornecedor form={form} setForm={setForm} onSave={onSave} />;
  return <Suspense fallback={<Modal title="Carregando fornecedor" onClose={()=>setForm(null)}><p style={{fontSize:"var(--arcd-type-label)",color:C.muted}}>Preparando editor…</p></Modal>}>
    <LazySupplierEditor open supplier={form} onOpenChange={open=>!open&&setForm(null)} onSave={onSave}/>
  </Suspense>;
}


export function ModalFornecedor({ form, setForm, onSave }) {

  const { formGrid } = useBreakpoint();
  const F = k => v => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={form.id ? "Editar fornecedor" : "Novo fornecedor"} onClose={()=>setForm(null)} wide>
      <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:11}}>
        <Inp label="Nome *" value={form.nome} onChange={F("nome")} placeholder="Depósito Caruaru"/>
        <CampoCNPJ value={form.cnpj} onChange={F("cnpj")} onEncontrado={d=>setForm(f=>{
          // O CNPJ preenche o que estiver vazio: nome, contato, endereco. E,
          // pelo CNAE, ja sugere os ramos que a empresa fornece - o usuario
          // confere e ajusta. Nada que ele digitou e sobrescrito.
          const sugeridos = ramosDosCnaes(d.cnaes);
          const jaTinha = f.categorias || [];
          return {
            ...f,
            nome:       f.nome       || d.nome,
            razaoSocial:f.razaoSocial|| d.razaoSocial,
            nomeFantasia:f.nomeFantasia||d.nomeFantasia,
            telefone:   f.telefone   || d.telefone,
            email:      f.email      || d.email,
            cep:        f.cep        || d.cep,
            endereco:   f.endereco   || d.logradouro,
            numero:     f.numero     || d.numero,
            complemento:f.complemento|| d.complemento,
            bairro:     f.bairro     || d.bairro,
            cidade:     f.cidade     || d.cidade,
            uf:         f.uf         || d.uf,
            // Une o que ja estava marcado com o que veio do CNAE (sem duplicar).
            categorias: [...new Set([...jaTinha, ...sugeridos])],
            // Guarda a atividade para o usuario conferir de onde veio a sugestao.
            atividadeCnae: d.atividade || f.atividadeCnae || "",
            situacaoCadastral: d.situacao || f.situacaoCadastral || "",
            dataAbertura: d.abertura || f.dataAbertura || "",
            ramosSugeridos: sugeridos,
          };
        })}/>
        <Inp label="Razão social" value={form.razaoSocial} onChange={F("razaoSocial")} placeholder="Preenchida pelo CNPJ"/>
        <Inp label="Nome fantasia" value={form.nomeFantasia} onChange={F("nomeFantasia")} placeholder="Preenchido pelo CNPJ"/>
        <Inp label="Contato" value={form.contato} onChange={F("contato")} placeholder="Nome do vendedor"/>
        <Inp label="Telefone" value={form.telefone} onChange={F("telefone")} placeholder="(81) 9...."/>
        <div style={{gridColumn:"1/-1"}}>
          <Inp label="E-mail" value={form.email} onChange={F("email")} placeholder="vendas@..."/>
        </div>

        {/* O QUE ELE FORNECE - alimenta a sugestao de fornecedor nos pedidos */}
        <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,
                     borderRadius:9,padding:"11px 13px"}}>
          <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text,marginBottom:3}}>O que fornece</p>
          <p style={{fontSize:"var(--arcd-type-label)",color:C.muted,marginBottom:9,lineHeight:1.45}}>
            Marque todos os ramos. Uma casa de construção atende vários; uma serralheria, só metais.
            O sistema usa isso para sugerir de quem comprar cada material.
          </p>
          {(form.ramosSugeridos||[]).length > 0 && (
            <div style={{background:`${C.blue}0A`,border:`1px solid ${C.blue}44`,borderRadius:8,
                         padding:"8px 10px",marginBottom:9}}>
              <p style={{fontSize:"var(--arcd-type-label)",color:C.blue,fontWeight:600,lineHeight:1.45}}>
                Marcado automaticamente pelo CNPJ: {(form.ramosSugeridos||[]).map(rotuloRamo).join(", ")}.
              </p>
              {form.atividadeCnae && (
                <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>
                  Atividade na Receita: {form.atividadeCnae}
                </p>
              )}
              <p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:3}}>Confira e ajuste se precisar.</p>
            </div>
          )}
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {RAMOS_FORNECIMENTO.map(r=>{
              const marcado = (form.categorias||[]).includes(r.v);
              return (
                <button key={r.v} type="button"
                  onClick={()=>setForm(f=>({...f, categorias: marcado
                    ? (f.categorias||[]).filter(x=>x!==r.v)
                    : [...(f.categorias||[]), r.v]}))}
                  style={{padding:"6px 11px",borderRadius:99,cursor:"pointer",
                    border:`1.5px solid ${marcado?C.yellowD:C.border}`,
                    background:marcado?`${C.yellow}1E`:C.bg,
                    color:marcado?C.yellowD:C.muted,
                    fontSize:"var(--arcd-type-control)",fontWeight:marcado?600:500,
                    fontFamily:"var(--arcd-font-sans)"}}>
                  {r.l}
                </button>
              );
            })}
          </div>
          {(form.categorias||[]).length===0 && (
            <p style={{fontSize:"var(--arcd-type-label)",color:C.orange,marginTop:8}}>
              Sem ramo marcado, ele não aparece nas sugestões de compra.
            </p>
          )}
        </div>

        {/* ENDERECO - frete, retirada e proximidade da obra */}
        <div style={{gridColumn:"1/-1",background:C.surface,border:`1px solid ${C.border}`,
                     borderRadius:9,padding:"11px 13px"}}>
          <p style={{fontSize:"var(--arcd-type-label)",fontWeight:600,color:C.text,marginBottom:9}}>Endereço</p>
          <div style={{display:"grid",gridTemplateColumns:formGrid(2),gap:9}}>
            <CampoCEP value={form.cep} onChange={F("cep")}
              onEncontrado={d=>setForm(f=>({...f,
                endereco: d.endereco || f.endereco,
                bairro:   d.bairro   || f.bairro,
                cidade:   d.cidade   || f.cidade,
                uf:       d.uf       || f.uf,
              }))}/>
            <Inp label="Número" value={form.numero} onChange={F("numero")} placeholder="123"/>
            <div style={{gridColumn:"1/-1"}}>
              <Inp label="Logradouro" value={form.endereco} onChange={F("endereco")} placeholder="Rua, avenida..."/>
            </div>
            <Inp label="Complemento" value={form.complemento} onChange={F("complemento")} placeholder="Sala, loja, galpão..."/>
            <Inp label="Bairro" value={form.bairro} onChange={F("bairro")}/>
            <Inp label="Cidade" value={form.cidade} onChange={F("cidade")}/>
            <Inp label="UF" value={form.uf} onChange={F("uf")} placeholder="PE"/>
          </div>
          {(form.situacaoCadastral||form.dataAbertura)&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:8}}>
            Receita Federal: {form.situacaoCadastral||"situação não informada"}{form.dataAbertura?` · aberta em ${fmtDate(form.dataAbertura)}`:""}
          </p>}
        </div>

        <div style={{gridColumn:"1/-1"}}>
          <Inp label="Observações" value={form.obs} onChange={F("obs")}
               placeholder="Prazo de entrega, condições de pagamento, histórico..." multiline/>
        </div>

        <div style={{gridColumn:"1/-1",display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setForm(null)} full>Cancelar</Btn>
          <Btn onClick={()=>onSave(form)} full><Ic n="check"/> Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}
