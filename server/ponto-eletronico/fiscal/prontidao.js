import { identificacao, inpi, sha256 } from "./campos.js";

// Evidências vêm da configuração privada do servidor. Nunca aceitar flags de
// conformidade, certificados ou números fiscais enviados pelo navegador.
export function avaliarProntidaoFiscal(snapshot, auditoria, { assinadorDisponivel = false } = {}) {
  const config = snapshot.config || {};
  const items = [];
  const add = (codigo, titulo, ok, acao) => items.push({ codigo, titulo, status: ok ? "evidencia_informada" : "pendente", acao });
  const documento = value => !!value && /^[a-f0-9]{64}$/.test(value.sha256 || "")
    && typeof value.responsavel === "string" && value.responsavel.trim().length > 0
    && Number.isFinite(Date.parse(value.conferidoEm));
  let registro = false, desenvolvedor = false;
  try { inpi(config.rep?.inpi); registro = documento(config.registroInpi) && config.registroInpi.numero === config.rep.inpi; } catch { /* Pendente. */ }
  try { identificacao(config.rep?.desenvolvedor); desenvolvedor = true; } catch { /* Pendente. */ }
  add("INPI", "Certificado de registro do programa no INPI", registro, "Registrar a versão e conferir o certificado real; informar número, hash do documento e responsável.");
  add("DESENVOLVEDOR", "Identificação da empresa ou pessoa desenvolvedora", desenvolvedor, "Conferir CPF/CNPJ do desenvolvedor e titularidade do programa.");
  add("ASSINATURA", "Assinatura e validação ICP-Brasil", assinadorDisponivel, "Configurar o serviço privado com certificado válido, cadeia confiável e verificação de revogação.");
  add("ATESTADO", "Atestado Técnico e Termo de Responsabilidade", documento(config.atestadoTecnico), "Obter o PDF PAdES assinado pelos responsáveis técnico e legal; conservar para fiscalização.");
  add("INTEGRIDADE", "Integridade do histórico original", auditoria.integridadeValida, "Investigar a origem de divergências; não reconstruir NSR nem alterar batidas originais.");
  add("AFD", "Dados completos para AFD", auditoria.aptoParaGeracao.afd, "Resolver os códigos da auditoria, incluindo captura online/offline e histórico administrativo.");
  add("AEJ", "Dados completos para AEJ", auditoria.aptoParaGeracao.aej, "Conferir tratamentos explícitos por evento e referências do cadastro.");
  add("ACESSO_TRABALHADOR", "Comprovantes após cada marcação e últimas 48 horas", documento(config.evidencias?.acessoTrabalhador), "Validar a entrega e o acesso individual sem depender do WhatsApp ou de solicitação ao RH.");
  add("HLB", "Sincronismo com a Hora Legal Brasileira", documento(config.evidencias?.horaLegal), "Registrar ensaio de sincronismo, falha de referência e limite de 30 segundos.");
  add("ARP", "Retenção, redundância e disponibilidade da ARP", documento(config.evidencias?.armazenamento), "Validar retenção imutável, restauração, redundância e disponibilidade da infraestrutura.");
  add("COLETOR", "Coletor, captura offline e sincronização", documento(config.evidencias?.coletor), "Validar relógio com segundos, identificação, fila offline e sincronização; preservar o APK18.");
  return { conforme: false, estado: items.some(i => i.status === "pendente") ? "adequacao_pendente" : "aguarda_validacao_formal",
    observacao: "Evidência informada não é certificação. A validade das assinaturas é verificada em cada emissão.",
    requisitos: items, evidenciasSha256: sha256(JSON.stringify({ rep: config.rep, registroInpi: config.registroInpi, atestadoTecnico: config.atestadoTecnico, evidencias: config.evidencias })),
    podePrepararEmissao: registro && desenvolvedor && documento(config.atestadoTecnico) && auditoria.integridadeValida && auditoria.aptoParaGeracao.afd };
}
