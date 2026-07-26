import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { ExternalLink } from "lucide-react";
import { Button } from "../../components/ui/button";
import MediaPlaceholder from "./MediaPlaceholder";
import ResponsiveImage from "./ResponsiveImage";
import { landingMedia } from "../data/landingMedia";

function ProjectCard({ project, destaque }) {
  const reduceMotion = useReducedMotion();
  return (
    <m.article
      whileHover={reduceMotion ? undefined : { scale: 1.03 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-ring ${destaque ? "sm:col-span-2" : ""}`}
    >
      {project.localSource
        ? <ResponsiveImage src={project.localSource} alt={project.title} className={`w-full object-cover transition-opacity duration-300 group-hover:opacity-90 ${destaque ? "aspect-[16/9]" : "aspect-[4/3]"}`}/>
        : <MediaPlaceholder instagramUrl={project.instagramUrl} label="Imagem do projeto em breve" aspect={destaque ? "16 / 9" : "4 / 3"}/>}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{project.category}</p>
        <h3 className="mt-1 text-lg font-bold">{project.title}</h3>
        {project.city && <p className="text-sm text-white/80">{project.city}</p>}
        <div className="mt-3 flex items-center gap-4">
          <Button size="sm" variant="secondary" asChild>
            <a href={project.instagramUrl} target="_blank" rel="noopener noreferrer">Ver projeto</a>
          </Button>
          <a
            href={project.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-white/80 underline-offset-4 hover:underline"
          >
            Ver publicação no Instagram
            <ExternalLink className="h-3 w-3" aria-hidden="true"/>
          </a>
        </div>
      </div>
    </m.article>
  );
}

export default function ProjectsSection() {
  return (
    <LazyMotion features={domAnimation} strict>
      <section id="projetos" className="border-t border-border bg-background px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Projetos</h2>
            <p className="mt-3 text-muted-foreground">Uma seleção de obras que unem arquitetura, engenharia e execução.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {landingMedia.projects.map((project, i) => (
              <ProjectCard key={project.id} project={project} destaque={i === 0}/>
            ))}
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}
