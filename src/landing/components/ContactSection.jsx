import { useRef, useState } from "react";
import { Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { sendContactLead } from "../data/sendContactLead";
import { whatsappHref } from "../data/contactInfo";

const TIPOS_SERVICO = [
  { value: "", label: "Selecione o tipo de serviço" },
  { value: "projeto_arquitetonico", label: "Projeto arquitetônico" },
  { value: "interiores", label: "Interiores" },
  { value: "construcao_completa", label: "Construção completa" },
  { value: "reforma", label: "Reforma" },
  { value: "gestao_de_obra", label: "Gestão de obra" },
  { value: "outro", label: "Outro" },
];

const CAMPOS_VAZIOS = { nome: "", telefone: "", email: "", cidade: "", tipoServico: "", mensagem: "" };

const validar = campos => {
  const erros = {};
  if (!campos.nome.trim() || campos.nome.trim().length < 2) erros.nome = "Informe seu nome completo.";
  if (!/^[\d\s()+-]{8,}$/.test(campos.telefone.trim())) erros.telefone = "Informe um telefone válido, com DDD.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.email.trim())) erros.email = "Informe um e-mail válido.";
  if (!campos.tipoServico) erros.tipoServico = "Selecione o tipo de serviço.";
  if (!campos.mensagem.trim() || campos.mensagem.trim().length < 10) erros.mensagem = "Conte um pouco mais sobre o seu projeto.";
  return erros;
};

export default function ContactSection() {
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [erros, setErros] = useState({});
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const enviandoRef = useRef(false);
  const primeiroCampoInvalidoRef = useRef(null);
  const whatsapp = whatsappHref();

  const atualizar = campo => e => setCampos(c => ({ ...c, [campo]: e.target.value }));

  const aoEnviar = async e => {
    e.preventDefault();
    if (enviandoRef.current) return; // proteção simples contra duplo envio
    const proximosErros = validar(campos);
    setErros(proximosErros);
    if (Object.keys(proximosErros).length > 0) {
      primeiroCampoInvalidoRef.current?.focus();
      return;
    }
    enviandoRef.current = true;
    setStatus("loading");
    try {
      await sendContactLead(campos);
      setStatus("success");
      setCampos(CAMPOS_VAZIOS);
    } catch {
      setStatus("error");
    } finally {
      enviandoRef.current = false;
    }
  };

  return (
    <section id="contato" className="border-t border-border bg-card px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Seu projeto pode começar com uma boa conversa.
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Preencha o formulário ou fale direto com a gente pelo WhatsApp.
          </p>
          <Button size="lg" variant="outline" className="mt-6 gap-2" asChild={!!whatsapp} aria-disabled={!whatsapp}>
            {whatsapp
              ? <a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true"/>Falar no WhatsApp</a>
              : <span><MessageCircle className="h-4 w-4" aria-hidden="true"/>WhatsApp em breve</span>}
          </Button>
        </div>

        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4" aria-label="Formulário de contato">
          {status === "success" ? (
            <div role="status" className="flex flex-col items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true"/>
              <p className="font-semibold text-foreground">Mensagem enviada!</p>
              <p className="text-sm text-muted-foreground">Em breve alguém do nosso time entra em contato.</p>
              <Button variant="outline" onClick={() => setStatus("idle")}>Enviar outra mensagem</Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="contato-nome">Nome</Label>
                <Input
                  id="contato-nome" value={campos.nome} onChange={atualizar("nome")}
                  ref={erros.nome ? primeiroCampoInvalidoRef : undefined}
                  aria-invalid={!!erros.nome} aria-describedby={erros.nome ? "erro-nome" : undefined}
                  autoComplete="name" className="mt-1.5"
                />
                {erros.nome && <p id="erro-nome" role="alert" className="mt-1 text-xs text-destructive">{erros.nome}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contato-telefone">Telefone</Label>
                  <Input
                    id="contato-telefone" type="tel" value={campos.telefone} onChange={atualizar("telefone")}
                    aria-invalid={!!erros.telefone} aria-describedby={erros.telefone ? "erro-telefone" : undefined}
                    autoComplete="tel" className="mt-1.5"
                  />
                  {erros.telefone && <p id="erro-telefone" role="alert" className="mt-1 text-xs text-destructive">{erros.telefone}</p>}
                </div>
                <div>
                  <Label htmlFor="contato-email">E-mail</Label>
                  <Input
                    id="contato-email" type="email" value={campos.email} onChange={atualizar("email")}
                    aria-invalid={!!erros.email} aria-describedby={erros.email ? "erro-email" : undefined}
                    autoComplete="email" className="mt-1.5"
                  />
                  {erros.email && <p id="erro-email" role="alert" className="mt-1 text-xs text-destructive">{erros.email}</p>}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="contato-cidade">Cidade</Label>
                  <Input id="contato-cidade" value={campos.cidade} onChange={atualizar("cidade")} autoComplete="address-level2" className="mt-1.5"/>
                </div>
                <div>
                  <Label htmlFor="contato-tipo-servico">Tipo de serviço</Label>
                  <select
                    id="contato-tipo-servico" value={campos.tipoServico} onChange={atualizar("tipoServico")}
                    aria-invalid={!!erros.tipoServico} aria-describedby={erros.tipoServico ? "erro-tipo-servico" : undefined}
                    className="mt-1.5 flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {TIPOS_SERVICO.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
                  </select>
                  {erros.tipoServico && <p id="erro-tipo-servico" role="alert" className="mt-1 text-xs text-destructive">{erros.tipoServico}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="contato-mensagem">Mensagem</Label>
                <textarea
                  id="contato-mensagem" value={campos.mensagem} onChange={atualizar("mensagem")} rows={4}
                  aria-invalid={!!erros.mensagem} aria-describedby={erros.mensagem ? "erro-mensagem" : undefined}
                  className="mt-1.5 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                {erros.mensagem && <p id="erro-mensagem" role="alert" className="mt-1 text-xs text-destructive">{erros.mensagem}</p>}
              </div>

              {status === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível enviar sua mensagem agora. Tente novamente em instantes.
                </p>
              )}

              <Button type="submit" size="lg" disabled={status === "loading"} className="gap-2">
                {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true"/>}
                {status === "loading" ? "Enviando..." : "Enviar mensagem"}
              </Button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
