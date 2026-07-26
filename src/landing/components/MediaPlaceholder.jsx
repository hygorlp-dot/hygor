import { ImageIcon, ExternalLink } from "lucide-react";

// Placeholder elegante para quando ainda não existe arquivo local em
// public/media/landing/. Nunca simula uma imagem real - mostra proporção
// correta, identificação discreta e link para a publicação de origem.
export default function MediaPlaceholder({ instagramUrl, label = "Imagem em breve", aspect = "4 / 3", className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 border border-dashed border-border bg-muted/40 p-6 text-center ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <ImageIcon className="h-8 w-8 text-muted-foreground/60" aria-hidden="true"/>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver publicação
          <ExternalLink className="h-3 w-3" aria-hidden="true"/>
        </a>
      )}
    </div>
  );
}
