import { Building2, ClipboardCheck, Wallet, Users2, ShieldCheck, ArrowRight, LogIn, AtSign } from "lucide-react";
import { Button } from "./components/ui/button";
import "./landing.css";

// Página pública institucional - carregada sozinha, sem puxar o app
// operacional (LegacyApp.jsx) para o bundle. Nenhum dado real de obra,
// cliente ou número é inventado aqui: é um rascunho de conteúdo genérico
// para o time da ARCD substituir pelos textos e fotos reais depois.
const INSTAGRAM_URL = "https://www.instagram.com/arcdconstrutech/";

const SERVICOS = [
  {
    icon: Building2,
    titulo: "Gestão de obras",
    descricao: "Planejamento, cronograma e acompanhamento técnico do canteiro do início à entrega.",
  },
  {
    icon: ClipboardCheck,
    titulo: "Suprimentos e compras",
    descricao: "Cotação, fornecedores homologados e controle de recebimento por obra.",
  },
  {
    icon: Wallet,
    titulo: "Controle financeiro",
    descricao: "Orçamento, medições, contas a pagar e a receber com rastreabilidade completa.",
  },
  {
    icon: Users2,
    titulo: "Equipe e terceiros",
    descricao: "Ponto, folha e contratos de terceirizados organizados por obra e por período.",
  },
];

const DIFERENCIAIS = [
  "Acompanhamento de obra em tempo real, obra por obra",
  "Gestão financeira integrada do orçamento ao pagamento",
  "Processos auditáveis, com histórico de cada decisão",
  "Tecnologia própria, feita sob medida para construção",
];

function NavBar({ onEntrar }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <span className="text-lg font-bold tracking-tight text-foreground">
          ARCD <span className="text-primary">Construtech</span>
        </span>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <a href="#servicos" className="cursor-pointer transition-colors hover:text-foreground">Serviços</a>
          <a href="#diferenciais" className="cursor-pointer transition-colors hover:text-foreground">Diferenciais</a>
          <a href="#contato" className="cursor-pointer transition-colors hover:text-foreground">Contato</a>
        </nav>
        <Button variant="outline" size="sm" onClick={onEntrar} className="gap-2">
          <LogIn className="h-4 w-4" aria-hidden="true"/>
          Entrar
        </Button>
      </div>
    </header>
  );
}

function Hero({ onEntrar }) {
  return (
    <section className="relative overflow-hidden bg-background px-5 py-20 sm:py-28">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
        <span className="landing-rise inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true"/>
          Gestão de obras com precisão
        </span>
        <h1 className="landing-rise landing-rise-delay-1 text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          Construção e gestão de obras com transparência do início ao fim
        </h1>
        <p className="landing-rise landing-rise-delay-2 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
          A ARCD Construtech acompanha cada etapa da sua obra — planejamento, suprimentos,
          financeiro e equipe — em um único processo auditável, do orçamento à entrega.
        </p>
        <div className="landing-rise landing-rise-delay-3 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" className="gap-2" asChild>
            <a href="#contato">
              Solicitar orçamento
              <ArrowRight className="h-4 w-4" aria-hidden="true"/>
            </a>
          </Button>
          <Button size="lg" variant="outline" className="gap-2" onClick={onEntrar}>
            <LogIn className="h-4 w-4" aria-hidden="true"/>
            Sou funcionário, entrar
          </Button>
        </div>
      </div>
    </section>
  );
}

function Servicos() {
  return (
    <section id="servicos" className="border-t border-border bg-card px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">O que fazemos</h2>
          <p className="mt-3 text-muted-foreground">
            Cada obra passa pelos mesmos processos, do primeiro orçamento à última medição.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICOS.map(({ icon: Icon, titulo, descricao }) => (
            <div key={titulo} className="rounded-lg border border-border bg-background p-6 transition-colors hover:border-primary">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true"/>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Diferenciais() {
  return (
    <section id="diferenciais" className="border-t border-border bg-background px-5 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Por que a ARCD</h2>
          <p className="mt-3 max-w-md text-muted-foreground">
            Um processo único de gestão de obras, pensado para dar visibilidade real a cada etapa.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {DIFERENCIAIS.map(item => (
            <li key={item} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true"/>
              <span className="text-sm leading-relaxed text-foreground">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ContatoCta() {
  return (
    <section id="contato" className="border-t border-border bg-card px-5 py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Vamos construir juntos</h2>
        <p className="max-w-xl text-muted-foreground">
          Fale com a gente pelo Instagram para conhecer nossos projetos e solicitar um orçamento.
        </p>
        <Button size="lg" className="gap-2" asChild>
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <AtSign className="h-4 w-4" aria-hidden="true"/>
            @arcdconstrutech
          </a>
        </Button>
      </div>
    </section>
  );
}

function Footer({ onEntrar }) {
  return (
    <footer className="border-t border-border bg-background px-5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} ARCD Construtech. Todos os direitos reservados.</span>
        <div className="flex items-center gap-5">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="cursor-pointer transition-colors hover:text-foreground">
            Instagram
          </a>
          <button type="button" onClick={onEntrar} className="cursor-pointer transition-colors hover:text-foreground">
            Área do funcionário
          </button>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage({ onEntrar }) {
  return (
    <div className="min-h-dvh bg-background font-sans">
      <NavBar onEntrar={onEntrar}/>
      <main>
        <Hero onEntrar={onEntrar}/>
        <Servicos/>
        <Diferenciais/>
        <ContatoCta/>
      </main>
      <Footer onEntrar={onEntrar}/>
    </div>
  );
}
