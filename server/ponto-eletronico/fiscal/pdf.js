// O HTML é produzido pelo domínio; renderer pode ser um worker privado.
// Não permitir HTML/URL arbitrários do navegador ou carregar recursos remotos.
export function comprovanteParaAssinaturaHtml(model) {
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de Registro de Ponto do Trabalhador</title></head><body>'
    + '<h1>Comprovante de Registro de Ponto do Trabalhador</h1><p>Registro original da marcação - REP-P</p><table><tbody>'
    + model.fields.map(([label, value]) => '<tr><th scope="row">' + escape(label) + '</th><td>' + escape(value).replace(/([a-f0-9]{32})(?=[a-f0-9])/g, "$1<wbr>") + '</td></tr>').join("")
    + '</tbody></table><p>A assinatura digital é incorporada ao arquivo PDF. Consulte sua validade no serviço VALIDAR do ITI: https://validar.iti.gov.br.</p>'
    + '<p>Este comprovante registra a marcação original e não representa aprovação de horas extras ou saldo de banco de horas.</p></body></html>';
}
