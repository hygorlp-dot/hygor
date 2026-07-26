import { MessageCircle } from "lucide-react";
import { whatsappHref } from "../data/contactInfo";

// CTA flutuante - fica no canto inferior direito, acima do conteúdo mas
// abaixo do modal de vídeo (z-30 < z-50), sem cobrir o rodapé graças à
// margem inferior generosa. Some silenciosamente se o número ainda não
// foi configurado, em vez de oferecer um link quebrado.
export default function FloatingWhatsApp() {
  const whatsapp = whatsappHref();
  if (!whatsapp) return null;

  return (
    <a
      href={whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-6 right-6 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <MessageCircle className="h-6 w-6" aria-hidden="true"/>
    </a>
  );
}
