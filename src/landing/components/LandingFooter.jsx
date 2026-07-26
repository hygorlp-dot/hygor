import { CONTACT_INFO } from "../data/contactInfo";

const NAV_LINKS = [
  { href: "#projetos", label: "Projetos" },
  { href: "#servicos", label: "Serviços" },
  { href: "#processo", label: "Como trabalhamos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#contato", label: "Contato" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background px-5 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <img src="/logo-arcd.png" alt="ARCD Construtech" className="h-9 w-auto" width={40} height={40} decoding="async"/>
          <p className="max-w-xs text-sm text-muted-foreground">
            {CONTACT_INFO.city || "Cidade a definir"} · Arquitetura, engenharia e execução integradas.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" aria-label="Links do rodapé">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="cursor-pointer transition-colors hover:text-foreground">{link.label}</a>
          ))}
          <a href={CONTACT_INFO.instagramUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer transition-colors hover:text-foreground">
            Instagram
          </a>
          <a href="/sistema" className="cursor-pointer transition-colors hover:text-foreground">Área do funcionário</a>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs text-muted-foreground">
        © {new Date().getFullYear()} ARCD Construtech. Todos os direitos reservados.
      </p>
    </footer>
  );
}
