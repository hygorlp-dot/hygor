import { useEffect, useRef, useState } from "react";
import { Button } from "../../../design-system/primitives/Button.jsx";
import { Input } from "../../../design-system/primitives/Input.jsx";
import { Select } from "../../../design-system/primitives/Select.jsx";
import { chamarPontoEletronico } from "../../../api";

export default function AcessoComprovantes({ employees = [] }) {
  const [employeeId, setEmployee] = useState("");
  const [telefone, setTelefone] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false), versao = useRef(0);
  useEffect(() => () => { versao.current++; }, []);
  const mudar = e => {
    const id = e.target.value;
    const cadastro = employees.find(employee => String(employee.id) === id);
    const numero = String(cadastro?.phone || "").replace(/\D/g, "");
    const sugestao = numero.length === 10 || numero.length === 11 ? `55${numero}` : numero;
    versao.current++; setEmployee(id); setTelefone(sugestao); setLink(""); setMensagem("");
  };
  const executar = async operacao => {
    if (lock.current || (operacao !== "situacao" && !employeeId)) return;
    const atual = versao.current;
    lock.current = true; setOcupado(true); setMensagem(""); setLink("");
    try {
      const result = await chamarPontoEletronico("ponto-comprovantes-gestao", { operacao, employeeId,
        ...(operacao === "contato" ? { telefone: telefone.replace(/\D/g, ""), confirmado: true } : {}) });
      if (atual !== versao.current) return;
      if (result.error) { setMensagem(result.error); return; }
      if (operacao === "acesso" && /^[A-Za-z0-9_-]{43}$/.test(result.token || "")) {
        setLink(window.location.origin + "/meu-ponto#" + result.token);
        setMensagem("Acesso individual criado por 90 dias. Entregue somente a este funcionário; o acesso anterior foi revogado.");
      } else if (operacao === "situacao" && result.emissao && result.envios) {
        setMensagem("Emissão: " + Object.entries(result.emissao || {}).map(([k,v]) => `${k}: ${v}`).join("; ")
          + ". Envios: " + Object.entries(result.envios || {}).map(([k,v]) => `${k}: ${v}`).join("; ") + ". Nenhum item significa que ainda não há processamento registrado.");
      } else if (operacao === "revogar" && result.revogado === true) setMensagem("Acesso individual revogado.");
      else if (operacao === "contato" && result.confirmado === true) setMensagem("Número confirmado pelo RH para os próximos comprovantes. O envio depende da configuração do serviço.");
      else setMensagem("A operação não foi confirmada pelo serviço. Consulte o RH responsável.");
    } catch { if (atual === versao.current) setMensagem("Serviço indisponível. Tente novamente."); }
    finally { lock.current = false; setOcupado(false); }
  };
  return <section className="pe-disclosure-body" aria-label="Acesso individual aos comprovantes">
    <h3>Entrega dos comprovantes</h3>
    <p>O funcionário consulta e baixa seus próprios PDFs. Confirme o WhatsApp diretamente com ele antes de habilitar o envio. Nunca compartilhe o acesso entre funcionários.</p>
    <Select label="Funcionário dos comprovantes" value={employeeId} onChange={mudar} disabled={ocupado} placeholder="Selecione o funcionário"
      options={employees.map(e => ({ value: String(e.id), label: e.name }))} />
    <Input label="WhatsApp confirmado com o funcionário" description="O telefone do cadastro é sugerido ao selecionar o funcionário. Confira ou corrija o número com ele e clique em Confirmar WhatsApp. Preencher não habilita o envio. Use 55 + DDD + número." value={telefone} onChange={e => { setTelefone(e.target.value); setMensagem(""); }} type="tel" autoComplete="off" disabled={ocupado} />
    <div className="pe-actions">
      <Button size="sm" disabled={ocupado || !employeeId} onClick={() => executar("acesso")}>Criar acesso individual</Button>
      <Button variant="outline" size="sm" disabled={ocupado || !employeeId} onClick={() => executar("revogar")}>Revogar acesso</Button>
      <Button variant="outline" size="sm" disabled={ocupado || !employeeId || !/^55[1-9][0-9]{9,10}$/.test(telefone.replace(/\D/g,""))} onClick={() => executar("contato")}>Confirmar WhatsApp</Button>
      <Button variant="outline" size="sm" disabled={ocupado} onClick={() => executar("situacao")}>Consultar processamento</Button>
    </div>
    {mensagem && <p role="status">{mensagem}</p>}
    {link && <Input label="Acesso privado — entregue somente ao funcionário selecionado" value={link} readOnly onFocus={e => e.target.select()} />}
  </section>;
}
