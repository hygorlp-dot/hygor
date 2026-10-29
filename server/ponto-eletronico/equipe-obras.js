import { montarEquipeObras, diaNoFuso } from "../../src/domains/ponto-eletronico/equipe-obras.js";
import { FUSO_OBRA } from "../../src/domains/ponto-eletronico/painel.js";

// Lotes por tabela, nunca uma consulta por funcionário. Falhar é preferível
// a exibir silenciosamente um retrato truncado pela paginação do PostgREST.
async function lerPaginas(criarConsulta, chave) {
  const linhas = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    const { data, error } = await criarConsulta().order(chave, { ascending: true }).range(offset, offset + 499);
    if (error) throw error;
    linhas.push(...(data || []));
    if ((data || []).length < 500) return linhas;
  }
  throw new Error("Volume de registros acima do limite de leitura do painel.");
}

export async function consultarEquipeObras({ db, company, usuario, dados, agora }) {
  const fuso = FUSO_OBRA; // Mesmo fuso da tela de ponto existente.
  const de = new Date(agora - 7 * 86400000).toISOString();
  const ate = new Date(agora).toISOString();
  const [eventos, legados] = await Promise.all([
    lerPaginas(() => db.from("ponto_eventos").select("event_id,employee_id,obra_id,marcado_em,hora_confiavel,relogio_alterado,tipo_registro,payload").eq("company_id", company).gte("marcado_em", de).lte("marcado_em", ate), "event_id"),
    lerPaginas(() => db.from("ponto_marcacoes").select("id,employee_id,obra_id,marcado_em,hora_confiavel,relogio_alterado,tipo_registro").eq("company_id", company).gte("marcado_em", de).lte("marcado_em", ate), "id"),
  ]);
  const marcacoes = [...eventos, ...legados].map(m => ({
    eventId: m.event_id || m.id, employeeId: m.employee_id, obraId: m.obra_id, marcadoEm: m.marcado_em,
    tipoRegistro: m.tipo_registro, tipoEvento: m.payload?.versaoJornada === 1 ? m.payload.tipoEvento : null,
    horaConfiavel: m.hora_confiavel, relogioAlterado: m.relogio_alterado,
  }));
  const restrita = String(usuario.obraId || "");
  const todasObras = dados.obras || [];
  const obras = todasObras.filter(o => !restrita || String(o.id) === restrita).map(o => ({ id: String(o.id), name: o.name, complemento: [o.client, o.condominio, o.lote, o.address].filter(v => typeof v === "string").join(" · "), fotoUrl: typeof o.capaUrl === "string" ? o.capaUrl : "" }));
  const ultimos = new Map();
  for (const m of [...marcacoes].sort((a, b) => Date.parse(a.marcadoEm) - Date.parse(b.marcadoEm))) ultimos.set(String(m.employeeId), m);
  // Computa a projeção antes de cortar o histórico: uma transferência para
  // outra obra não pode deixar presença fantasma na obra anterior.
  let pessoas = montarEquipeObras({ employees: dados.employees, obras: todasObras, marcacoes, attendance: dados.attendance, agora, fuso });
  if (restrita) pessoas = pessoas.filter(p => {
    const ultima = ultimos.get(p.id);
    return ultima ? String(ultima.obraId) === restrita : p.obraPrevistaId === restrita;
  }).map(p => ({ ...p, obraPrevistaId: p.obraPrevistaId === restrita ? restrita : "", obraRegistradaId: p.obraRegistradaId === restrita ? restrita : "", eventos: p.eventos.filter(m => String(m.obraId) === restrita) }));
  const ids = new Set(pessoas.map(p => p.id));
  const bios = await lerPaginas(() => db.from("ponto_biometrias").select("id,employee_id,fotos,criado_em").eq("company_id", company), "id");
  const fotos = new Map();
  for (const bio of bios.sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)))) if (ids.has(String(bio.employee_id)) && bio.fotos?.[0]?.caminho) fotos.set(String(bio.employee_id), bio.fotos[0].caminho);
  const caminhos = [...new Set(fotos.values())];
  const assinadas = new Map();
  for (let i = 0; i < caminhos.length; i += 100) {
    const { data, error } = await db.storage.from("ponto-obra").createSignedUrls(caminhos.slice(i, i + 100), 120);
    if (!error) for (const foto of data || []) if (foto.signedUrl && !foto.error) assinadas.set(foto.path, foto.signedUrl);
  }
  pessoas = pessoas.map(p => ({ ...p, fotoUrl: assinadas.get(fotos.get(p.id)) || p.fotoUrl }));
  return { pessoas, obras, dia: diaNoFuso(agora, fuso), fuso, servidorMs: agora, modo: "consulta_periodica", janelaDias: 7,
    limitacoes: ["Batidas antigas sem tipo de evento precisam de conferência.", "O cadastro atual não possui escala semanal, tolerância de entrada ou agenda de folgas, férias e afastamentos; ausência de batida não confirma falta.", "O painel considera os últimos 7 dias de registros recebidos pelo servidor."] };
}
