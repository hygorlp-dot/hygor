import { useEffect, useRef, useState } from "react";
import { Menu, X, MessageCircle, LogIn } from "lucide-react";
import { Button } from "../../components/ui/button";
import { whatsappHref } from "../data/contactInfo";

const NAV_LINKS = [
  { href: "#projetos", label: "Projetos" },
  { href: "#servicos", label: "Serviços" },
  { href: "#processo", label: "Como trabalhamos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#contato", label: "Contato" },
];

export default function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);
  const whatsapp = whatsappHref();

  useEffect(() => {
    const aoRolar = () => setScrolled(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  useEffect(() => {
    if (!menuAberto) return undefined;
    menuRef.current?.querySelector("a, button")?.focus();
    const aoTeclar = e => { if (e.key === "Escape") setMenuAberto(false); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [menuAberto]);

  const fecharMenu = () => setMenuAberto(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled || menuAberto ? "border-b border-border bg-background/95 backdrop-blur" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-20">
        <a href="/" className="flex cursor-pointer items-center gap-2" aria-label="ARCD Construtech, página inicial">
          <img src="/logo-arcd.png" alt="ARCD Construtech" className="h-9 w-auto sm:h-10" width={40} height={40} decoding="async"/>
        </a>

        <nav className="hidden items-center gap-7 text-sm font-medium text-foreground/80 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className="cursor-pointer transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <a href="/sistema"><LogIn className="h-4 w-4" aria-hidden="true"/>Entrar</a>
          </Button>
          <Button asChild>
            <a href="#contato">Solicitar orçamento</a>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuAberto(v => !v)}
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-foreground lg:hidden"
          aria-expanded={menuAberto}
          aria-controls="landing-mobile-menu"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
        >
          {menuAberto ? <X className="h-6 w-6" aria-hidden="true"/> : <Menu className="h-6 w-6" aria-hidden="true"/>}
        </button>
      </div>

      {menuAberto && (
        <div
          id="landing-mobile-menu"
          ref={menuRef}
          className="border-t border-border bg-background px-5 py-6 lg:hidden"
        >
          <nav className="flex flex-col gap-1" aria-label="Navegação móvel">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={fecharMenu}
                className="cursor-pointer rounded-md px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-3">
            <Button asChild onClick={fecharMenu}>
              <a href="#contato">Solicitar orçamento</a>
            </Button>
            <Button variant="outline" className="gap-2" asChild={!!whatsapp} aria-disabled={!whatsapp}>
              {whatsapp
                ? <a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" aria-hidden="true"/>Falar no WhatsApp</a>
                : <span><MessageCircle className="h-4 w-4" aria-hidden="true"/>WhatsApp em breve</span>}
            </Button>
            <Button variant="ghost" className="gap-2" asChild onClick={fecharMenu}>
              <a href="/sistema"><LogIn className="h-4 w-4" aria-hidden="true"/>Entrar (funcionário)</a>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
