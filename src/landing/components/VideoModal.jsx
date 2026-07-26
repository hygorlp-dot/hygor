import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Modal de vídeo acessível: foco preso dentro do modal, Escape fecha,
// vídeo só é montado (e baixado) enquanto o modal está aberto - nada de
// autoplay com áudio, o visitante decide quando dar play.
export default function VideoModal({ open, onClose, videoSource, posterSource, title = "Vídeo" }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();

    const aoTeclar = e => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focaveis = dialogRef.current?.querySelectorAll('button, a[href], video, [tabindex]:not([tabindex="-1"])');
      if (!focaveis?.length) return;
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener("keydown", aoTeclar);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.classList.remove("no-scroll");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-3xl rounded-lg bg-background p-3 shadow-xl"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar vídeo"
          className="absolute -top-3 -right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-md"
        >
          <X className="h-5 w-5" aria-hidden="true"/>
        </button>
        {videoSource ? (
          <video
            controls
            preload="metadata"
            poster={posterSource || undefined}
            playsInline
            className="aspect-video w-full rounded-md bg-black"
          >
            <source src={videoSource} type="video/mp4"/>
            Seu navegador não suporta reprodução de vídeo.
          </video>
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
            Vídeo em breve.
          </div>
        )}
      </div>
    </div>
  );
}
