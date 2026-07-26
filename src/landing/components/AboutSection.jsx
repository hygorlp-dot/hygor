import { useState } from "react";
import { Play } from "lucide-react";
import MediaPlaceholder from "./MediaPlaceholder";
import VideoModal from "./VideoModal";
import { landingMedia } from "../data/landingMedia";

export default function AboutSection() {
  const [aberto, setAberto] = useState(false);
  const { office } = landingMedia;

  return (
    <section id="sobre" className="border-t border-border bg-background px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Arquitetura que funciona. Engenharia que entrega.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Trabalhamos com um único método, do desenho à execução: arquitetura, engenharia e gestão de obra
            integradas em um mesmo time, com acompanhamento próximo em cada etapa do projeto.
          </p>
          <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
            Cada decisão técnica é tomada pensando na obra real - prazo, orçamento e qualidade de execução
            caminhando juntos, do primeiro traço à entrega das chaves.
          </p>
        </div>

        <div className="relative">
          {office.posterSource ? (
            <img src={office.posterSource} alt="" aria-hidden="true" className="aspect-video w-full rounded-lg object-cover"/>
          ) : (
            <MediaPlaceholder instagramUrl={office.instagramUrl} label="Vídeo de apresentação em breve" aspect="16 / 9" className="rounded-lg"/>
          )}
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/20 transition-colors hover:bg-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Assistir vídeo de apresentação da ARCD"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md">
              <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" aria-hidden="true"/>
            </span>
          </button>
        </div>
      </div>

      <VideoModal
        open={aberto}
        onClose={() => setAberto(false)}
        videoSource={office.videoSource}
        posterSource={office.posterSource}
        title="Apresentação da ARCD Construtech"
      />
    </section>
  );
}
