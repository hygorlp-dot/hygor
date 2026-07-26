// Envio do formulário de contato da landing page. Propositalmente
// desacoplado do sistema operacional: a landing NUNCA deve falar
// diretamente com o Supabase/banco de dados operacional (dados
// financeiros, PINs, tokens etc. ficam isolados em LegacyApp.jsx).
//
// INTEGRAÇÃO PENDENTE: escolha uma das opções abaixo e substitua o corpo
// desta função - hoje ela só resolve com sucesso, sem enviar nada.
//   1) Função serverless própria (ex.: Vercel/Netlify Function ou rota
//      isolada de API) que grava o lead numa tabela separada de leads,
//      não na base operacional.
//   2) Serviço de formulário terceirizado (ex.: Formspree, Basin) - troque
//      o corpo por um fetch(POST) para o endpoint fornecido pelo serviço.
//   3) Serviço de e-mail transacional (ex.: Resend, SendGrid) chamado a
//      partir de uma função serverless.
//
// Em qualquer caso: nunca exponha aqui chave de service_role, PIN ou
// qualquer segredo operacional - o formulário deve usar uma credencial
// própria, com escopo mínimo, específica para leads.
export async function sendContactLead(lead) {
  // Exemplo de integração via função serverless própria:
  // const response = await fetch("/api/leads", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(lead),
  // });
  // if (!response.ok) throw new Error("Não foi possível enviar seu contato agora.");
  // return response.json();

  return Promise.resolve({ ok: true, lead });
}
