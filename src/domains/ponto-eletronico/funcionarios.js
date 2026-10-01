// Base única de funcionários (pedido do usuário em 01/10/2026: "os dados dos
// funcionários serão compartilhados, base única"). O app da obra NÃO tem
// cadastro próprio: recebe do cadastro do ARCD (data.employees) só quem está
// ativo e alocado na obra do aparelho, com o mínimo para identificar e
// registrar - biometria e marcações apontam para o mesmo employee.id.

const ativo = e => e && e.active !== false && !e.endDate && String(e.status || "").toLowerCase() !== "desligado";
const soDigitos = v => String(v || "").replace(/\D/g, "");

export function funcionariosDaObra(employees, obraId) {
  return (employees || [])
    .filter(e => ativo(e) && String(e.obra || "") === String(obraId || ""))
    .map(e => ({
      id: String(e.id),
      nome: String(e.name || "").trim(),
      funcao: String(e.role || "").trim(),
      cpf: soDigitos(e.cpf),
      // O app mostra só o final do CPF; o completo vai para a marcação (AFD).
      cpfMascarado: soDigitos(e.cpf).length === 11 ? `***.***.${soDigitos(e.cpf).slice(6, 9)}-${soDigitos(e.cpf).slice(9)}` : "",
      telefone: soDigitos(e.phone),
      inicioJornada: String(e.workStart || ""),
      horasJornada: Number(e.workdayHours || 0) || null,
    }))
    .filter(f => f.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Terceirizados entram só como controle de acesso (fora do ponto CLT/AFD).
export function terceirizadosDaObra(terceirizados, obraId) {
  return (terceirizados || [])
    .filter(t => t && t.active !== false && String(t.obraId || "") === String(obraId || ""))
    .map(t => ({ id: String(t.id), nome: String(t.name || "").trim(), especialidade: String(t.specialty || "").trim() }))
    .filter(t => t.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
