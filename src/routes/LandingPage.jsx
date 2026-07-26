import { useEffect } from "react";
import LandingHeader from "../landing/components/LandingHeader";
import HeroSection from "../landing/components/HeroSection";
import ProjectsSection from "../landing/components/ProjectsSection";
import ServicesSection from "../landing/components/ServicesSection";
import ProcessSection from "../landing/components/ProcessSection";
import TestimonialsSection from "../landing/components/TestimonialsSection";
import AboutSection from "../landing/components/AboutSection";
import ContactSection from "../landing/components/ContactSection";
import LandingFooter from "../landing/components/LandingFooter";
import FloatingWhatsApp from "../landing/components/FloatingWhatsApp";
import { CONTACT_INFO } from "../landing/data/contactInfo";
import "../landing/landing.css";

const TITULO = "ARCD Construtech — Arquitetura, Engenharia e Gestão de Obras";
const DESCRICAO = "Do primeiro traço à entrega das chaves: arquitetura, engenharia e execução integradas para construir com precisão, beleza e tranquilidade.";

// Meta tags e dados estruturados básicos, aplicados só na rota pública -
// evita depender de uma lib de head management para duas rotas apenas.
// Só inclui no JSON-LD campos verificados (nome, logo, Instagram); campos
// sem dado confirmado (endereço, telefone) ficam de fora, nunca inventados.
function useLandingSeo() {
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = TITULO;

    const definirMeta = (attr, value, content) => {
      let tag = document.querySelector(`meta[${attr}="${value}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attr, value);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
      return tag;
    };

    const tags = [
      definirMeta("name", "description", DESCRICAO),
      definirMeta("property", "og:title", TITULO),
      definirMeta("property", "og:description", DESCRICAO),
      definirMeta("property", "og:type", "website"),
      definirMeta("property", "og:locale", "pt_BR"),
      definirMeta("name", "twitter:card", "summary_large_image"),
      definirMeta("name", "twitter:title", TITULO),
      definirMeta("name", "twitter:description", DESCRICAO),
    ];

    let canonical = document.querySelector('link[rel="canonical"]');
    const criouCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", window.location.origin + "/");

    const ldJson = document.createElement("script");
    ldJson.type = "application/ld+json";
    ldJson.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ARCD Construtech",
      url: window.location.origin,
      logo: `${window.location.origin}/logo-arcd.png`,
      sameAs: [CONTACT_INFO.instagramUrl].filter(Boolean),
    });
    document.head.appendChild(ldJson);

    return () => {
      document.title = tituloAnterior;
      tags.forEach(tag => tag.remove());
      if (criouCanonical) canonical.remove();
      ldJson.remove();
    };
  }, []);
}

export default function LandingPage() {
  useLandingSeo();

  return (
    <div lang="pt-BR" className="min-h-dvh bg-background font-sans">
      <LandingHeader/>
      <main>
        <HeroSection/>
        <ProjectsSection/>
        <ServicesSection/>
        <ProcessSection/>
        <TestimonialsSection/>
        <AboutSection/>
        <ContactSection/>
      </main>
      <LandingFooter/>
      <FloatingWhatsApp/>
    </div>
  );
}
