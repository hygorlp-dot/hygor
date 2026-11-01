// Declarações extraídas literalmente da entrada legada; não importar LegacyApp aqui.
import { C, semanticToneFromLegacyColor } from "./palette.js";
import { compactNumber } from "./format.js";
import { digitsOnly as soDigitos } from "../domains/data/brazilian-documents";
import { consultarCNPJReceita } from "../api";
import { Children } from "react";
import { Button as SharedUiButton } from "../components/ui/button.jsx";
import { legacyButtonRole } from "../design-system/primitives/button-contract.js";
import { Textarea as SharedTextarea } from "../design-system/primitives/Textarea.jsx";
import { Input as DesignSystemInput } from "../design-system/primitives/Input.jsx";
import { useState } from "react";
import { Select as DesignSystemSelect } from "../design-system/primitives/Select.jsx";
import { useRef } from "react";
import { useEffect } from "react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useVisualViewportBounds } from "../lib/useVisualViewportBounds.js";


// Consulta pública de CNPJ (BrasilAPI - gratuita, sem chave). Devolve os campos
// já normalizados para o app, ou lança erro com mensagem amigável. Não guarda
// nada; é só leitura da base pública da Receita.
export const buscarCNPJ = async (cnpjBruto) => {
  const cnpj = soDigitos(cnpjBruto);
  if (cnpj.length !== 14) throw new Error("CNPJ deve ter 14 dígitos.");
  const resp = await consultarCNPJReceita(cnpj);
  if (!resp.ok) throw new Error(resp.error || "Não consegui consultar o CNPJ agora. Tente novamente.");
  const d = resp.data || {};
  const cidade = d.municipio || "";
  const uf = d.uf || "";
  const enderecoPartes = [d.descricao_tipo_de_logradouro, d.logradouro, d.numero].filter(Boolean).join(" ");
  const bairro = d.bairro ? `, ${d.bairro}` : "";
  const cidadeUf = [cidade, uf].filter(Boolean).join(" - ");
  // CNAEs: o principal e os secundarios. E daqui que da pra deduzir o ramo
  // de fornecimento sem o usuario marcar na mao.
  const cnaes = [
    { codigo: String(d.cnae_fiscal || ""), descricao: d.cnae_fiscal_descricao || "" },
    ...(Array.isArray(d.cnaes_secundarios) ? d.cnaes_secundarios.map(c => ({
      codigo: String(c.codigo || ""), descricao: c.descricao || "",
    })) : []),
  ].filter(c => c.codigo || c.descricao);

  return {
    razaoSocial: d.razao_social || "",
    nomeFantasia: d.nome_fantasia || "",
    // Nome de exibição: fantasia se houver, senão razão social.
    nome: d.nome_fantasia || d.razao_social || "",
    telefone: d.ddd_telefone_1 || "",
    email: d.email || "",
    cidade, uf, cidadeUf,
    endereco: [enderecoPartes + bairro, cidadeUf, d.cep ? `CEP ${d.cep}` : ""].filter(Boolean).join(", "),
    // Partes separadas do endereco, para preencher campo a campo.
    logradouro: [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(" ").trim(),
    numero: d.numero || "",
    complemento: d.complemento || "",
    bairro: d.bairro || "",
    cep: d.cep || "",
    situacao: d.descricao_situacao_cadastral || "",
    atividade: d.cnae_fiscal_descricao || "",
    cnaes,
    abertura: d.data_inicio_atividade || "",
  };
};


//
// UI base
//

export function Ic({ n, s = 16, color }) {
  // Icones em SVG (feather-style). Antes eram emojis, que o build do Vercel
  // apaga - por isso sumiam na tela. SVG e ASCII puro: aparece sempre, tem
  // contraste, herda a cor via --ic-color ou a prop color.
  const P = {
    // --- Navegação e objetos principais ---
    home:     "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",  // casa (dashboard/painel)
    building: "M3 21h18 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16 M9 7h1 M9 11h1 M9 15h1 M14 7h1 M14 11h1 M14 15h1", // prédio (obras)
    users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75", // várias pessoas (equipe)
    user:     "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", // uma pessoa (cliente/lead)
    handshake:"M11 17l2 2a1 1 0 0 0 3-3 M14 14l2.5 2.5a1 1 0 0 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 0 1-1.41 0l-2.12-2.12a1 1 0 0 0-1.41 0L3 12 M18 3l3 3-3 3 M3 21l3-3", // parceria (parceiros)
    clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
    more:     "M3.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M10.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M17.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0", // três pontos (menu "Mais ações")
    smartphone:"M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M12 18h.01", // celular (app de ponto da obra)
    refresh:  "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    // --- Gráficos e dados ---
    chart:    "M18 20V10 M12 20V4 M6 20v-6",           // barras (dashboard)
    funnel:   "M3 4h18l-7 8v7l-4 2v-9z",               // funil (funil de vendas)
    trending: "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",     // linha subindo (metas/KPIs/relatórios)
    target:   "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", // alvo (medição/metas)
    ruler:    "M3 15l6-6 M6 12l2 2 M9 9l2 2 M16 3l5 5L8 21l-5-5z", // régua/trena (medição de obra)
    // --- Dinheiro ---
    dollar:   "M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", // cifrão (financeiro)
    wallet:   "M20 12V8H6a2 2 0 0 1 0-4h12v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0 0 4h4v-4z", // carteira (folha/caixa)
    receipt:  "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z M8 7h8 M8 11h8 M8 15h5", // recibo (pagamento/conciliação)
    // --- Documentos ---
    file:     "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7",       // arquivo (documento genérico)
    folder:   "M3 5h6l2 2h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
    fileText: "M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M8 13h8 M8 17h8 M8 9h2", // documento com texto (orçamento/proposta/contrato)
    clipboard:"M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M9 13l2 2 4-4", // prancheta com check (diário de obra/tarefas)
    box:      "M21 8l-9-5-9 5 9 5 9-5z M3 8v8l9 5 9-5V8 M12 13v8", // caixa (estoque)
    cart:     "M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6", // carrinho (compras)
    // --- Ações ---
    plus:     "M12 5v14 M5 12h14",
    edit:     "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z",
    trash:    "M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M10 11v6 M14 11v6",
    x:        "M18 6L6 18 M6 6l12 12",
    check:    "M20 6L9 17l-5-5",
    mail:     "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6",
    lock:     "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4",
    unlock:   "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 9.9-1",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
    copy:     "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z M5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
    search:   "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
    calendar: "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18",
    alert:    "M12 2 1 21h22L12 2z M12 9v4 M12 17h.01",
    info:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 10v7 M12 7h.01",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    phone:    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
    ia:       "M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3v1a3 3 0 0 0 0 6v1a3 3 0 0 0 3 3 3 3 0 0 0 6 0 3 3 0 0 0 3-3v-1a3 3 0 0 0 0-6V8a3 3 0 0 0-3-3 3 3 0 0 0-3-3z M12 2v20", // cérebro (IA)
    briefcase:"M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M2 13h20", // maleta (rescisão/comercial)
    wrench:   "M14.7 6.3a4 4 0 0 1-5.4 5.4l-6 6a2 2 0 1 0 3 3l6-6a4 4 0 0 1 5.4-5.4l-2.7 2.7 1.4 1.4 2.7-2.7", // chave (equipamentos)
    chevL:    "M15 18l-6-6 6-6",
    chevR:    "M9 18l6-6-6-6",
    chevron:  "M6 9l6 6 6-6",
    chevUp:   "M18 15l-6-6-6 6",
    cornerDownRight: "M15 10l5 5-5 5 M4 4v7a4 4 0 0 0 4 4h12", // seta que desce e vira à direita (criar subnível)
    star:     "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01z", // favorito
    // --- Clima (resumo diário) ---
    sun:      "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 1L12 3 M12 21L12 23 M4.22 4.22L5.64 5.64 M18.36 18.36L19.78 19.78 M1 12L3 12 M21 12L23 12 M4.22 19.78L5.64 18.36 M18.36 5.64L19.78 4.22",
    cloud:    "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
    cloudRain:"M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25 M16 13L16 21 M8 13L8 21 M12 15L12 23",
    zap:      "M13 2L3 14L12 14L11 22L21 10L12 10L13 2Z",
    attach:   "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48", // clipe de papel (anexar arquivo no chat)
  };
  // Aliases: nomes antigos que apontam para glifos do catálogo, para não quebrar
  // usos espalhados. money/pay = cifrão; brain = ia; terc = users; week = agenda;
  // medicoes = régua (medição de obra).
  P.money = P.dollar; P.pay = P.dollar; P.brain = P.ia; P.robot = P.ia;
  P.terc = P.users; P.week = P.calendar; P.medicoes = P.ruler;
  const d = P[n];
  if (!d) {
    // fallback discreto: um ponto, nao um traco solto
    return (
      <span aria-hidden="true" style={{
        width:s+4, height:s+4, display:"inline-flex", alignItems:"center",
        justifyContent:"center", color: color || `var(--ic-color, ${C.yellow})`,
      }}>
        <svg width={s*0.4} height={s*0.4} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="currentColor"/></svg>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="arcd-icon" data-icon-size={s<=13?"sm":s>=20?"lg":"md"} style={{
      width:s+4, height:s+4, display:"inline-flex", alignItems:"center",
      justifyContent:"center", color: color || `var(--ic-color, ${C.yellow})`,
      flexShrink:0,
    }}>
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        {d.split(" M").map((seg, i) => (
          <path key={i} d={i === 0 ? seg : "M" + seg}/>
        ))}
      </svg>
    </span>
  );
}


export const SIGLAS_UI = new Set([
  "MARCELL", "BDI", "CBO", "CLT", "CEP", "CFO", "CNPJ", "CPF", "CUB", "DRE", "EBITDA", "FGTS", "IRRF",
  "FVM", "FVS", "IA", "INSS", "ISS", "MO", "NFS-E", "ORSE", "PDF",
  "PIN", "RDO", "RG", "SINAPI", "SLA", "UF", "URL", "VR", "VT",
]);


export function textoUi(valor) {
  if (typeof valor !== "string") return valor;
  const letras = valor.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g);
  if (!letras?.length || !letras.every(letra => letra === letra.toUpperCase())) return valor;

  let primeiraPalavra = true;
  return valor.toLowerCase().replace(/[A-Za-zÀ-ÖØ-öø-ÿ]+(?:-[A-Za-zÀ-ÖØ-öø-ÿ]+)*/g, palavra => {
    const sigla = palavra.toUpperCase();
    if (SIGLAS_UI.has(sigla)) return sigla;
    if (primeiraPalavra) {
      primeiraPalavra = false;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }
    return palavra;
  });
}


export function conteudoUi(children) {
  return Children.map(children, child => typeof child === "string" ? textoUi(child) : child);
}


export function Btn({ children, onClick, v = "primary", size = "md", full = false, disabled = false, loading = false, iconOnly = false, type = "button", style = {}, className = "", title, ariaLabel, ...props }) {
  return <SharedUiButton {...props} type={type} variant={legacyButtonRole(v)} size={iconOnly?"icon":size}
    className={`arcd-btn ${className}`.trim()} data-variant={v} data-size={size} data-icon-only={iconOnly}
    title={title} aria-label={ariaLabel||props['aria-label']||title} disabled={disabled} loading={loading}
    loadingLabel={typeof loading==="string"?textoUi(loading):"Processando…"} onClick={onClick}
    style={{width:full?"100%":"auto","--ic-color":"currentColor",...style}}>{conteudoUi(children)}</SharedUiButton>;
}


export function Inp({ label, value, onChange, type = "text", placeholder = "", max, min, disabled = false, multiline = false, inputRef = null, error = "" }) {
  const Control=multiline?SharedTextarea:DesignSystemInput;
  return <Control fieldClassName="arcd-legacy-field" className="arcd-field-control" label={label?textoUi(label):undefined}
    ref={inputRef} type={multiline?undefined:type} value={value??""} onChange={event=>onChange(event.target.value)}
    placeholder={placeholder} max={max} min={min} disabled={disabled} rows={multiline?3:undefined} error={error}/>;
}


export function CampoCNPJ({ label = "CNPJ", value, onChange, onEncontrado, disabled = false }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);

  const consultar = async () => {
    setErro(""); setOk(false);
    if (soDigitos(value).length !== 14) { setErro("Digite os 14 digitos do CNPJ."); return; }
    setCarregando(true);
    try {
      const dados = await buscarCNPJ(value);
      onEncontrado && onEncontrado(dados);
      setOk(true);
      if (dados.situacao && dados.situacao.toUpperCase() !== "ATIVA")
        setErro(`Atencao: situacao cadastral "${dados.situacao}".`);
    } catch (e) {
      setErro(e.message || "Nao foi possivel consultar.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <span style={{
        color: C.text, fontSize:"var(--arcd-type-caption)", fontWeight:600,
        letterSpacing: 0.1, fontFamily: "var(--arcd-font-sans)",
      }}>{textoUi(label)}</span>}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value == null ? "" : value}
          onChange={e => { onChange(e.target.value); setOk(false); setErro(""); }}
          onBlur={() => { if (soDigitos(value).length === 14) consultar(); }}
          placeholder="00.000.000/0001-00"
          disabled={disabled || carregando}
          style={{
            flex: 1, background: disabled ? C.surface : C.bg,
            border: `1.5px solid ${ok ? C.green : erro ? C.orange : C.line}`,
            color: C.text, padding: "8px 10px", outline: "none", fontSize: "var(--arcd-type-control)",
            borderRadius: 7, fontFamily: "var(--arcd-font-sans)",
          }}
        />
        <button type="button" onMouseDown={e=>e.preventDefault()} onClick={consultar} disabled={carregando || disabled}
          style={{
            flexShrink: 0, border: `1.5px solid ${C.blue}`, background: `${C.blue}10`,
            color: C.blue, borderRadius: 7, padding: "0 10px", cursor: carregando ? "default" : "pointer",
            fontSize:"var(--arcd-type-control)", fontWeight:600, whiteSpace: "nowrap",
          }}>
          {carregando ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {erro && <span style={{ fontSize:"var(--arcd-type-label)", color: erro.startsWith("Atencao") ? C.orange : C.red }}>{erro}</span>}
      {ok && !erro && <span style={{ fontSize:"var(--arcd-type-label)", color: C.green }}>Dados preenchidos pela Receita.</span>}
    </label>
  );
}


export function Sel({ label, value, onChange, options = [], disabled = false, error = "" }) {
  return <DesignSystemSelect fieldClassName="arcd-legacy-field" className="arcd-field-control" label={label?textoUi(label):undefined}
    aria-label={label?textoUi(label):undefined} value={value??""} onChange={event=>onChange(event.target.value)} disabled={disabled} error={error}>
    {options.map(option=><option key={String(option.v)} value={option.v} disabled={option.disabled}>{option.l}</option>)}
  </DesignSystemSelect>;
}


// Botão que abre um menu de opções, para listas longas onde o <select> nativo
// fica pouco legível (ex.: etapas do funil comercial).
export function SelBtn({ label, value, onChange, options = [], disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const aoClicarFora = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [open]);
  const atual = options.find(o => String(o.v) === String(value ?? ""));
  return (
    <div ref={ref} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <span className="arcd-field__label" style={{
        color: C.text, fontSize:"var(--arcd-type-label)", fontWeight:600, letterSpacing: 0.1,
        fontFamily: "var(--arcd-font-sans)",
      }}>{textoUi(label)}</span>}
      <button type="button" disabled={disabled} onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          background: disabled ? C.surface : C.bg, border: `1.5px solid ${C.line}`, color: C.text,
          padding: "8px 10px", borderRadius: 7, fontSize: "var(--arcd-type-control)", cursor: disabled ? "default" : "pointer",
          fontFamily: "var(--arcd-font-sans)", textAlign: "left",
        }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{atual?.l || "Selecione"}</span>
        <Ic n="chevron" s={12} color={C.muted}/>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: "0 6px 18px rgba(18,18,18,.14)", maxHeight: 260, overflowY: "auto", padding: 4,
        }}>
          {options.map(o => {
            const selecionada = String(o.v) === String(value ?? "");
            return (
              <button key={String(o.v)} type="button" onClick={() => { onChange(o.v); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 6, border: 0,
                  background: selecionada ? `${C.blue}14` : "transparent",
                  color: selecionada ? C.blue : C.text, fontWeight: selecionada ? 600 : 500,
                  fontSize: "var(--arcd-type-control)", cursor: "pointer", fontFamily: "var(--arcd-font-sans)",
                }}>
                {o.l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


export function Badge({ children, color = C.yellow }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 10px",
      border: 0,
      background: `${color}1F`,
      color,
      fontSize:"var(--arcd-type-caption)",
      fontWeight:400,
      letterSpacing: 0,
      marginTop: 2,
      marginRight: 3,
      borderRadius: 999,
    }}>
      {conteudoUi(children)}
    </span>
  );
}


export function ArcdChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      minWidth:160, padding:"10px 12px", background:"rgba(18,18,18,.94)",
      color:"#fff", border:`1px solid ${C.yellow}66`, borderRadius:10,
      boxShadow:"0 14px 38px rgba(18,18,18,.2)", backdropFilter:"blur(12px)",
    }}>
      <p style={{fontSize:"var(--arcd-type-caption)",fontWeight:600,letterSpacing:.9,textTransform:"uppercase",color:C.cinza,marginBottom:7}}>{label}</p>
      {payload.filter(p=>p.value!==undefined).map((p,i)=><div key={`${p.dataKey}-${i}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:18,marginTop:i?5:0}}>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:"var(--arcd-type-label)",color:"#E9E7E1"}}><i style={{width:7,height:7,borderRadius:2,background:p.color||p.fill,display:"block"}}/>{p.name}</span>
        <b style={{fontSize:"var(--arcd-type-label)",color:"#fff"}}>{formatter?formatter(p.value,p.name):compactNumber(p.value)}</b>
      </div>)}
    </div>
  );
}


export function ChartLegend({ items=[] }) {
  return <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>{items.map(i=><span key={i.label} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:"var(--arcd-type-caption)",color:C.muted,fontWeight:600}}><i style={{width:14,height:3,borderRadius:99,background:i.color,display:"block"}}/>{i.label}</span>)}</div>;
}


export function ChartPanel({ eyebrow="Análise visual", title, subtitle, legend=[], action, children, height=240 }) {
  return <section className="arcd-chart-panel" style={{
    position:"relative",overflow:"hidden",background:C.card,border:`1px solid ${C.line}`,
    borderRadius:14,boxShadow:"0 10px 30px rgba(18,18,18,.045)",
  }}>

    <header style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,padding:"14px 16px 11px",borderBottom:`1px solid ${C.line}`,background:"rgba(255,255,255,.86)",backdropFilter:"blur(8px)"}}>
      <div style={{minWidth:0}}><h3 style={{fontFamily:"var(--arcd-font-sans)",fontSize:"var(--arcd-type-body)",fontWeight:600,color:C.text,letterSpacing:-.2,marginTop:2}}>{title}</h3>{subtitle&&<p style={{fontSize:"var(--arcd-type-caption)",color:C.muted,marginTop:2}}>{subtitle}</p>}</div>
      {action&&<div className="no-print" style={{flexShrink:0}}>{action}</div>}
    </header>
    {!!legend.length&&<div style={{position:"relative",padding:"9px 16px 0"}}><ChartLegend items={legend}/></div>}
    <div style={{position:"relative",height,padding:"8px 8px 10px 2px"}}>{children}</div>
  </section>;
}


// Cabeçalho padrão de tela: substitui os heroes "artesanais" de cada módulo
// (gradiente escuro, cor e padding diferentes por tela) por um único
// componente flat, no mesmo sistema Carbon do dashboard. Sem alterar o
// conteúdo de cada tela — só o invólucro visual.
export function PageHero({title,description,alert,stats,actions,headingLevel=1}){
  const Heading=headingLevel===3?"h3":headingLevel===2?"h2":"h1";
  return <section className="page-hero mrc-screen-header">
    <div className="page-hero__main">
      <div className="page-hero__copy">

        <Heading className="page-hero__title" data-heading-level={headingLevel}>{title}</Heading>
        {description&&<p className="page-hero__description">{description}</p>}
        {alert&&<div className="page-hero__alert" data-tone={alert.tone||"danger"}><Ic n={alert.tone==="success"?"check":"alert"} s={13}/>{alert.text}</div>}
      </div>
      {actions&&<div className="page-hero-actions">{actions}</div>}
    </div>
    {!!stats?.length&&<div className="page-hero__stats">
      {stats.map(s=><div key={s.label} className="page-hero__stat">
        <p className="page-hero__stat-label">{s.label}</p>
        <p className="page-hero__stat-value" data-tone={semanticToneFromLegacyColor(s.color)}>{s.value}</p>
        {s.detail&&<p className="page-hero__stat-detail">{s.detail}</p>}
      </div>)}
    </div>}
  </section>;
}


// Barra de abas internas (troca de visão dentro de uma mesma tela) - um único
// padrão de tipografia/tamanho/espaçamento para os ~16 lugares do app que
// antes reinventavam essa mesma peça com fontSize/fontWeight próprios.
// tabs aceita duas formas por item:
//   - array [value, label] ou [value, label, extra], onde extra é uma string
//     (subtítulo, ex.: DRE) ou um número (badge de contagem, ex.: Compras);
//   - objeto {v, l, icon, detail, count} quando também precisa de ícone.
// equal=true usa colunas de largura igual (poucas abas, rótulos parecidos);
// o padrão (false) é uma fileira que rola na horizontal sem quebrar linha -
// evita o efeito "serrilhado" de abas com rótulos de tamanhos muito diferentes.
export function TabRow({ tabs, active, onChange, equal = false, label = "Selecionar visão" }) {
  const itens = tabs.map(t => Array.isArray(t)
    ? { v:t[0], l:t[1], detail: typeof t[2]==="string" ? t[2] : null, count: typeof t[2]==="number" ? t[2] : null }
    : t);
  return (
    <div className="tab-row" data-equal={equal} style={equal ? { "--arcd-tab-count": itens.length } : undefined}>
      <label className="tab-row__mobile"><span>{label}</span><select aria-label={label} value={itens.some(item=>item.v===active)?active:""} onChange={event=>onChange(event.target.value)}>{!itens.some(item=>item.v===active)&&<option value="" disabled>Selecione uma tela</option>}{itens.map(({v,l,count})=><option key={v} value={v}>{l}{count>0?` · ${count}`:""}</option>)}</select></label>
      {itens.map(({v,l,icon,detail,count}) => {
        const isActive = active === v;
        return (
            <SharedUiButton key={v} variant="ghost" type="button" className="tab-row__tab" data-active={isActive} data-detail={Boolean(detail)} aria-pressed={isActive} onClick={() => onChange(v)}>
            <span className="tab-row__label">
              {icon && <Ic n={icon} s={13}/>}
              {l}
              {count>0 && <b className="tab-row__count">{count}</b>}
            </span>
            {detail && <small className="tab-row__detail">{detail}</small>}
            </SharedUiButton>
        );
      })}
    </div>
  );
}


export function Divider() {
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.line}, transparent)`, margin: "12px 0" }} />;
}


export function Modal({ title, children, onClose, wide = false, panelClass = "", footer = null }) {
  const { isDesktop } = useBreakpoint();
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  useVisualViewportBounds(overlayRef);
  const previousFocusRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    document.body.classList.add("no-scroll");
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      // A primeira interação pode acontecer antes deste timer. Preservar o
      // foco do campo evita fechar buscas e apagar a digitação por blur.
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);
    const handleKeyDown = event => {
      const panels = [...document.querySelectorAll(".arcd-modal-panel")];
      if (panels.at(-1) !== panelRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => element.offsetParent !== null);
      if (!focusable.length) { event.preventDefault(); panelRef.current.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current || !panelRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      if (!document.querySelector(".arcd-modal-panel")) document.body.classList.remove("no-scroll");
      if(previousFocusRef.current?.isConnected&&previousFocusRef.current!==document.body&&previousFocusRef.current!==document.documentElement)previousFocusRef.current.focus();
      else {const fallback=document.querySelector(".arcd-modal-panel")||document.querySelector(".arcd-main h1,.arcd-main h2");if(fallback){if(!fallback.hasAttribute("tabindex"))fallback.setAttribute("tabindex","-1");fallback.focus({preventScroll:true});}}
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="no-print arcd-modal-overlay"
      style={{
        position:"fixed", inset:0, zIndex:999,
        background:"var(--arcd-surface-overlay)",
        backdropFilter:"none",
        display:"flex", alignItems:"center", justifyContent:"center", padding:"var(--arcd-space-4)",
      }}
      onMouseDown={e => { if(e.target===e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={textoUi(title)}
        tabIndex={-1}
        className={`animUp arcd-modal-panel ${panelClass}`.trim()}
        style={{
        width:"100%", maxWidth: wide ? (isDesktop?860:720) : (isDesktop?520:460),
        maxHeight:"min(92dvh, 900px)", overflowY:"auto",
        background:"var(--arcd-surface-card)",
        border:"1px solid var(--arcd-border-default)",
        borderRadius:"var(--arcd-radius-lg)",
      }}>
        <div className="arcd-modal-header" style={{
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"var(--arcd-space-3) var(--arcd-space-4)",
          borderBottom:"1px solid var(--arcd-border-default)",
          background:"var(--arcd-surface-card)",
          borderRadius:"var(--arcd-radius-lg) var(--arcd-radius-lg) 0 0",
        }}>
          <h3 className="arcd-dialog__title">{textoUi(title)}</h3>
          <Btn v="ghost" size="sm" iconOnly onClick={onClose} title="Fechar" ariaLabel="Fechar">
            <Ic n="x" s={13}/>
          </Btn>
        </div>
        <div className="arcd-modal-notice" />
        <div className="arcd-modal-body" style={{padding:"var(--arcd-panel-padding)"}}>{children}</div>
        {footer&&<div className="arcd-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// A tela de Planejamento (Gantt editável, com QuestionarioPlanejamento,
// CurvaSGrafico, MiniFF, ModalTarefa, ModalCalendario, ModalMarco) foi
// extraída para src/domains/planejamento/components/PlanejamentoView.jsx
// em 2026-08-16 - importada como `Planejamento` abaixo, mesmo nome de
// sempre. MiniKpi continua aqui porque é usado por vários outros módulos.

export function MiniKpi({ label, value, cor, sub }) {
  return (
    <div className="mrc-mini-kpi" data-tone={semanticToneFromLegacyColor(cor)} style={{ background: C.card, border: `1px solid ${C.border}`,
                  borderTop: `3px solid ${cor}`, borderRadius: 8, padding: "10px 12px" }}>
      <p style={{ fontSize:"var(--arcd-type-caption)", fontWeight:600, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>{label}</p>
      <p style={{ fontSize: "var(--arcd-type-section-title)", fontWeight:600, color: cor, marginTop: 3,
                  fontFamily: "var(--arcd-font-sans)" }}>{value}</p>
      {sub && <p style={{ fontSize:"var(--arcd-type-caption)", color: C.muted, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}



// Bloco visual reutilizado no diario.
export function Bloco({ id, titulo, acao, children }) {
  return (
    <section id={id} className="rdo-block mrc-form-section">
      <div className="mrc-section-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2>{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}
