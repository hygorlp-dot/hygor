import { decodeAppData } from "../data-codec.js";
import { DOMAIN_ROW, mergeDomainRows } from "../domain-row-routing.js";
import { attendanceObraKeyPrefix, mergeAttendanceObjects, withAttendanceSyncedAt } from "../attendance-obra-routing.js";

// A equipe usa apenas cadastro e ponto, não orçamento, RDO, equipamentos etc.
// Não filtrar por obra nesta etapa: transferências e tombstones entre obras
// precisam ser resolvidos antes da projeção autorizada de consultarEquipeObras.
// Sem cache: cada atualização lê o estado atual, inclusive remoções/correções.
export async function lerDadosEquipe({ db, company, coreKey, pontoKey }) {
  const cadastro = db.from("company_app_data").select("key,value")
    .eq("company_id", company).in("key", [coreKey, pontoKey]);
  const porObra = async () => {
    const linhas = [];
    for (let inicio = 0; inicio < 100000; inicio += 1000) {
      const { data, error } = await db.from("company_app_data").select("key,value,updated_at")
        .eq("company_id", company).like("key", `${attendanceObraKeyPrefix(pontoKey)}%`)
        .order("updated_at", { ascending: true }).order("key", { ascending: true })
        .range(inicio, inicio + 999);
      if (error) throw error;
      linhas.push(...(data || []));
      if ((data || []).length < 1000) return linhas;
    }
    throw new Error("Volume de linhas de ponto acima do limite de leitura da equipe.");
  };
  const [{ data, error }, obras] = await Promise.all([cadastro, porObra()]);
  if (error) throw error;
  const core = data?.find(linha => linha.key === coreKey);
  if (!core) return {};
  const meta = data?.find(linha => linha.key === pontoKey);
  const merged = mergeDomainRows(decodeAppData(core.value), meta ? { [DOMAIN_ROW.PONTO]: decodeAppData(meta.value) } : {});
  const fontes = [merged.attendance || {}];
  for (const linha of obras) {
    const valor = decodeAppData(linha.value);
    fontes.push(withAttendanceSyncedAt(valor?.attendance, valor?.attendanceSyncedAt));
  }
  return { employees: merged.employees || [], obras: merged.obras || [], attendance: mergeAttendanceObjects(...fontes) };
}
