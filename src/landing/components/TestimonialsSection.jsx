import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";
import MediaPlaceholder from "./MediaPlaceholder";
import VideoModal from "./VideoModal";
import { landingMedia } from "../data/landingMedia";

// Nomes e falas são placeholder deliberado - nenhum depoimento real foi
// informado, então não inventamos cliente, obra ou frase.
function TestimonialCard({ testimonial, onAbrir }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="relative">
        {testimonial.posterSource ? (
          <img src={testimonial.posterSource} alt="" aria-hidden="true" className="aspect-video w-full rounded-md object-cover"/>
        ) : (
          <MediaPlaceholder instagramUrl={testimonial.instagramUrl} label="Vídeo em breve" aspect="16 / 9" className="rounded-md"/>
        )}
        <button
          type="button"
          onClick={() => onAbrir(testimonial)}
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-md bg-black/20 transition-colors hover:bg-black/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Assistir depoimento em vídeo"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md">
            <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" aria-hidden="true"/>
          </span>
        </button>
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">Nome do cliente</p>
      <p className="text-sm text-muted-foreground">Projeto ou serviço realizado</p>
      <a
        href={testimonial.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Ver publicação no Instagram
        <ExternalLink className="h-3 w-3" aria-hidden="true"/>
      </a>
    </div>
  );
}

export default function TestimonialsSection() {
  const [aberto, setAberto] = useState(null);

  return (
    <section className="border-t border-border bg-card px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Quem já construiu com a ARCD</h2>
          <p className="mt-3 text-muted-foreground">Depoimentos em vídeo de projetos entregues.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {landingMedia.testimonials.map(testimonial => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} onAbrir={setAberto}/>
          ))}
        </div>
      </div>

      <VideoModal
        open={!!aberto}
        onClose={() => setAberto(null)}
        videoSource={aberto?.videoSource}
        posterSource={aberto?.posterSource}
        title="Depoimento em vídeo"
      />
    </section>
  );
}
