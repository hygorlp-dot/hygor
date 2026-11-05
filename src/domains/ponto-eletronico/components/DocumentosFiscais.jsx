import { useEffect, useRef, useState } from "react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { chamarPontoEletronico } from "../../../api";

export default function DocumentosFiscais({ estabelecimentoId, eventId, dia }) {
  const [consulta, setConsulta] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const mounted = useRef(true), lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const verificar = async () => {
    if (lock.current || !estabelecimentoId) return;
    lock.current = true; setOcupado(true); setErro(""); setConsulta(null);
    try {
      const result = await chamarPontoEletronico("ponto-fiscal", { tipo: "prontidao", estabelecimentoId });
      if (mounted.current) {
        if (result.error || !Array.isArray(result.prontidao?.requisitos)) setErro(result.error || "A consulta não retornou os requisitos. Tente novamente.");
        else setConsulta(result.prontidao);
      }
    } catch { if (mounted.current) setErro("Não foi possível verificar os requisitos. Tente novamente."); }
    finally { lock.current = false; if (mounted.current) setOcupado(false); }
  };
  const emitir = async () => {
    if (lock.current || !eventId) return;
    lock.current = true; setOcupado(true); setErro("");
    try {
      const result = await chamarPontoEletronico("ponto-fiscal", { tipo: "comprovante", assinado: true, estabelecimentoId, eventId, de: dia, ate: dia });
      if (!mounted.current) return;
      const file = result.arquivo;
      if (result.error || file?.mime !== "application/pdf" || file.manifesto?.status !== "assinado_validado" || !/^[\w-]+\.pdf$/.test(file.nome || "")) {
        setErro(result.error || "O comprovante assinado não foi liberado. Confira os requisitos e o serviço de assinatura."); return;
      }
      const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw Error("PDF inválido");
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const link = document.createElement("a"); link.href = url; link.download = file.nome; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (mounted.current) setErro("Não foi possível emitir o PDF assinado. Nenhum registro original foi alterado."); }
    finally { lock.current = false; if (mounted.current) setOcupado(false); }
  };
  const assinaturaDisponivel = consulta?.requisitos.some(r => r.codigo === "ASSINATURA" && r.status === "evidencia_informada");
  return <section className="pe-disclosure-body" aria-label="Documentos fiscais do ponto">
    <h2>Documentos fiscais e Portaria 671</h2>
    <p>Confira registro no INPI, integridade, assinaturas e acesso do trabalhador. Evidências informadas não certificam o sistema.</p>
    {!estabelecimentoId && <p>Vincule a obra ao estabelecimento fiscal para consultar os requisitos.</p>}
    <div className="pe-actions">
      <Button variant="outline" size="sm" onClick={verificar} disabled={!estabelecimentoId || ocupado}> {ocupado ? "Aguarde…" : "Verificar requisitos fiscais"}</Button>
      {eventId && <Button size="sm" onClick={emitir} disabled={ocupado || !consulta?.podePrepararEmissao || !assinaturaDisponivel}>Emitir PDF assinado</Button>}
    </div>
    {erro && <p role="alert" className="pe-warning">{erro}</p>}
    {consulta && <div className="pe-help-copy" role="status">
      <p>Pendências encontradas: {consulta.requisitos.filter(r => r.status === "pendente").length}. O sistema permanece sem declaração de conformidade.</p>
      <ul className="pe-help-copy">{consulta.requisitos.map(item => <li key={item.codigo}><strong>{item.titulo}</strong>: {item.status === "pendente" ? "Pendente" : "Evidência informada"}. {item.acao}</li>)}</ul>
      {eventId && <p>O PDF só será liberado após conferir a marcação original e validar assinatura, certificado e cadeia ICP-Brasil. Texto de WhatsApp não substitui o comprovante.</p>}
    </div>}
  </section>;
}
