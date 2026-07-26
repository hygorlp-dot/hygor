// Dados institucionais de contato. Nenhum valor aqui foi inventado - os
// campos vazios/placeholder ficam marcados explicitamente e devem ser
// preenchidos pelo cliente antes da publicação.
export const CONTACT_INFO = {
  // Preencha com o número real em formato internacional, ex.: "5581999999999".
  whatsappNumber: "",
  whatsappMessage: "Olá! Vim pelo site da ARCD Construtech e gostaria de solicitar um orçamento.",
  instagramUrl: "https://www.instagram.com/arcdconstrutech/",
  // "" = placeholder pendente do cliente (não inventar endereço/telefone/e-mail).
  email: "",
  city: "",
};

export const whatsappHref = (message = CONTACT_INFO.whatsappMessage) =>
  CONTACT_INFO.whatsappNumber
    ? `https://wa.me/${CONTACT_INFO.whatsappNumber}?text=${encodeURIComponent(message)}`
    : "";
