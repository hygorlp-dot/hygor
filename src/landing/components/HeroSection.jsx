import { LazyMotion, domAnimation, m, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "../../components/ui/button";
import MediaPlaceholder from "./MediaPlaceholder";
import ResponsiveImage from "./ResponsiveImage";
import { landingMedia } from "../data/landingMedia";

const CONFIANCA = [
  "Arquitetura + Engenharia",
  "Gestão completa da obra",
  "Projetos personalizados",
  "Entrega integrada",
];

export default function HeroSection() {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 48]);
  const { hero } = landingMedia;

  return (
    <LazyMotion features={domAnimation} strict>
      <section ref={ref} className="relative flex min-h-[90vh] items-center overflow-hidden bg-background px-5 pt-24 sm:pt-28">
        <m.div
          style={{ y: parallaxY }}
          className="pointer-events-none absolute inset-0 -z-10"
        >
          {hero.localSource
            ? <ResponsiveImage src={hero.localSource} alt={hero.alt} className="h-full w-full object-cover opacity-15"/>
            : <div className="h-full w-full bg-gradient-to-b from-muted/60 to-background"/>}
        </m.div>

        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <m.h1
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              Do primeiro traço à entrega das chaves.
            </m.h1>
            <m.p
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 max-w-xl text-balance text-lg leading-relaxed text-muted-foreground"
            >
              Arquitetura, engenharia e execução integradas para construir com precisão, beleza e tranquilidade.
            </m.p>
            <m.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Button size="lg" className="gap-2" asChild>
                <a href="#projetos">
                  Conheça nossos projetos
                  <ArrowRight className="h-4 w-4" aria-hidden="true"/>
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#contato">Fale com um especialista</a>
              </Button>
            </m.div>

            <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-6 sm:grid-cols-4">
              {CONFIANCA.map(item => (
                <li key={item} className="text-sm font-medium text-muted-foreground">{item}</li>
              ))}
            </ul>
          </div>

          <div className="hidden lg:block">
            {hero.localSource
              ? <ResponsiveImage src={hero.localSource} alt={hero.alt} className="aspect-[4/5] w-full rounded-lg object-cover"/>
              : <MediaPlaceholder instagramUrl={hero.instagramUrl} label="Imagem do projeto em breve" aspect="4 / 5" className="rounded-lg"/>}
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
