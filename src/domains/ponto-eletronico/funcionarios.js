// Base única de funcionários (pedido do usuário em 01/10/2026: "os dados dos
// funcionários serão compartilhados, base única"). O app da obra NÃO tem
// cadastro próprio: recebe do cadastro do ARCD (data.employees).
//
// FUNCIONÁRIO É GLOBAL DA EMPRESA (01/10/2026): ele pode trabalhar em várias
// obras e mudar de obra no mesmo dia. Por isso qualquer funcionário ATIVO
// pode cadastrar o rosto e bater ponto em QUALQUER aparelho da empresa.
// Três "obras" diferentes - não confundir (docs/REP-P-ARQUITETURA.md):
//   - lotação administrativa: employee.obra (RH). Só informação; NÃO decide
//     quem pode bater em qual aparelho;
//   - obra de CAPTURA: a obra do aparelho onde a batida aconteceu
//     (ponto_eventos.obra_id). Gravada na ARP, imutável;
//   - obra APROPRIADA: a que recebe o período de trabalho no tratamento do
//     ponto (ponto_apropriacoes). Fora da ARP, corrigível com auditoria.

const ativo = e => e && e.active !== false && !e.endDate && String(e.status || "").toLowerCase() !== "desligado";
const soDigitos = v => String(v || "").replace(/\D/g, "");

const paraOPonto = e => ({
  id: String(e.id),
  nome: String(e.name || "").trim(),
  funcao: String(e.role || "").trim(),
  cpf: soDigitos(e.cpf),
  // O app mostra só o final do CPF; o completo vai para a marcação (AFD).
  cpfMascarado: soDigitos(e.cpf).length === 11 ? `***.***.${soDigitos(e.cpf).slice(6, 9)}-${soDigitos(e.cpf).slice(9)}` : "",
  telefone: soDigitos(e.phone),
  inicioJornada: String(e.workStart || ""),
  horasJornada: Number(e.workdayHours || 0) || null,
  // Lotação ADMINISTRATIVA atual (informativa - não restringe a batida).
  lotacaoObraId: String(e.obra || ""),
});
const porNome = (a, b) => a.nome.localeCompare(b.nome, "pt-BR");

// Todos os funcionários ativos da empresa - quem pode bater ponto e
// cadastrar o rosto em qualquer aparelho.
export function funcionariosAtivos(employees) {
  return (employees || []).filter(ativo).map(paraOPonto).filter(f => f.nome).sort(porNome);
}

// Funcionários LOTADOS (administrativamente) numa obra. Uso só de exibição
// (ex.: a equipe da obra na tela do ARCD). Nunca usar para decidir quem pode
// bater ponto num aparelho.
export function funcionariosDaObra(employees, obraId) {
  return funcionariosAtivos(employees).filter(f => f.lotacaoObraId === String(obraId || ""));
}

// Terceirizados entram só como controle de acesso (fora do ponto CLT/AFD) e
// continuam POR OBRA - a regra global desta data vale para funcionários.
export function terceirizadosDaObra(terceirizados, obraId) {
  return (terceirizados || [])
    .filter(t => t && t.active !== false && String(t.obraId || "") === String(obraId || ""))
    .map(t => ({ id: String(t.id), nome: String(t.name || "").trim(), especialidade: String(t.specialty || "").trim() }))
    .filter(t => t.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
