import { useEffect, useRef, useState } from "react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { ModuleLayout } from "../../../design-system/patterns/ModuleLayout.jsx";
import { PageHeader } from "../../../design-system/patterns/PageHeader.jsx";
import "./ponto-eletronico.css";

export default function MeusComprovantes() {
  const [prova, setProva] = useState(() => window.location.hash.slice(1));
  const [itens, setItens] = useState(null), [erro, setErro] = useState("");
  const [proximo, setProximo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; window.history.replaceState(null,"",window.location.pathname);
    return () => { mounted.current = false; }; }, []);
  const consultar = async (eventId, mais = false) => {
    if (lock.current) return;
    lock.current = true; setOcupado(true); setErro("");
    try {
      const response = await fetch("/api/data", { method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(45000), headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ponto-comprovantes-individuais", operacao: eventId ? "baixar" : "listar", prova, ...(eventId ? { eventId } : {}), ...(mais ? { antes: proximo } : {}) }) });
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok || result.error) throw Error(result.error || "Acesso indisponível.");
      if (!eventId) {
        if (!Array.isArray(result.comprovantes)) throw Error("Não foi possível consultar os comprovantes.");
        setItens(anteriores => mais ? [...anteriores, ...result.comprovantes] : result.comprovantes); setProximo(result.proximo || null);
      } else {
        const file = result.arquivo;
        if (file?.manifesto?.status !== "assinado_validado" || file.manifesto.eventId !== eventId
          || file.mime !== "application/pdf" || !/^comprovante-\d{1,9}\.pdf$/.test(file.nome)) throw Error("Comprovante indisponível.");
        const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(x => x.toString(16).padStart(2,"0")).join("");
        if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-" || hash !== file.manifesto.sha256) throw Error("A integridade do arquivo não pôde ser confirmada.");
        if (!mounted.current) return;
        const url = URL.createObjectURL(new Blob([bytes],{ type:"application/pdf" }));
        const a = document.createElement("a"); a.href = url; a.download = file.nome; a.click();
        setTimeout(() => URL.revokeObjectURL(url),1000);
      }
    } catch (error) { if (mounted.current) setErro(error.message || "Não foi possível acessar o comprovante. Procure o RH."); }
    finally { lock.current = false; if (mounted.current) setOcupado(false); }
  };
  return <ModuleLayout className="pe-page" header={<PageHeader title="Meus comprovantes de ponto" breadcrumb={["MARCELL", "Acesso do trabalhador"]} description="Consulte suas marcações e baixe o PDF assinado. Este acesso é pessoal." />}><section className="arcd-form-section pe-disclosure-body" aria-label="Comprovantes do trabalhador">
    <p>Se faltarem comprovantes, procure o RH. Nenhum horário será reconstruído.</p>
    <Input label="Código de acesso individual" type="password" autoComplete="off" value={prova} disabled={ocupado} onChange={e => { setProva(e.target.value); setItens(null); setProximo(null); setErro(""); }} />
    <div className="pe-actions"><Button disabled={ocupado || !/^[A-Za-z0-9_-]{43}$/.test(prova)} onClick={() => consultar()}>{ocupado ? "Aguarde…" : "Consultar meus comprovantes"}</Button>
      <Button variant="outline" disabled={ocupado} onClick={() => { setProva(""); setItens(null); setProximo(null); setErro(""); }}>Sair deste acesso</Button></div>
    {erro && <p role="alert" className="pe-warning">{erro}</p>}
    {itens && <div role="status"><p>{itens.length ? (itens.length === 1 ? "1 comprovante disponível." : `${itens.length} comprovantes disponíveis.`) : "Nenhum comprovante assinado disponível. Consulte o RH sobre as pendências de emissão."}</p>
      <ul className="pe-record-list">{itens.map(item => <li key={item.eventId} className="pe-record"><p>Marcação: {new Date(item.marcadoEm).toLocaleString("pt-BR",{ timeZone:item.timezone || "UTC" })} ({item.timezone || "UTC"}) · NSR {item.nsr}</p>
        <Button variant="outline" size="sm" disabled={ocupado} onClick={() => consultar(item.eventId)}>Baixar PDF · NSR {item.nsr}</Button></li>)}</ul></div>}
    {proximo && <Button variant="outline" disabled={ocupado} onClick={() => consultar(null,true)}>Carregar comprovantes anteriores</Button>}
  </section></ModuleLayout>;
}
