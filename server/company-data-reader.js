import { currentCompany } from "./company-context.js";
import { decodeAppData, encodeAppData, isEncodedAppData } from "./data-codec.js";
import { DOMAIN_ROW, mergeDomainRows } from "./domain-row-routing.js";
import {
  attendanceObraKeyPrefix, mergeAttendanceObjects, obraBucketFromKey, withAttendanceSyncedAt,
} from "./attendance-obra-routing.js";

export function createCompanyDataReader({
  db, coreKey: KEY, attendanceKey: PONTO_KEY, splitRowKeys: SPLIT_ROW_KEYS,
}) {
  const PONTO_OBRA_KEY_PREFIX = attendanceObraKeyPrefix(PONTO_KEY);

  // Consultas à base. Ficam separadas para que a autenticação leia SÓ a linha
  // core (onde moram os `usuarios`) e deixe as demais linhas para depois de a
  // sessão ser aceita. Uma chamada sem sessão válida não precisa baixar nem
  // decodificar o resto do dataset - ver lerNucleo/completarLinha e o handler.
  const splitEntries = Object.entries(SPLIT_ROW_KEYS);
  const consultarNucleo = () => db.from("company_app_data").select("value, updated_at")
    .eq("company_id", currentCompany()).eq("key", KEY).maybeSingle();
  const consultarLinhasAuxiliares = () => Promise.all([
    db.from("company_app_data").select("key, value, updated_at")
      .eq("company_id", currentCompany()).in("key", splitEntries.map(([, key]) => key)),
    // Achado de 04/09/2026 (ver server/attendance-obra-routing.js): ordenar
    // por updated_at aqui já não é mais o que garante a correção - esse
    // campo é da LINHA inteira (compartilhado por todo funcionário/dia que
    // mora nela) e pode ser "refrescado" por uma gravação totalmente alheia
    // na mesma obra. mergeAttendanceObjects agora compara um carimbo POR
    // CÉLULA (withAttendanceSyncedAt, abaixo) - o `.order()` aqui fica só
    // como reforço inofensivo para dados antigos sem esse carimbo.
    // A busca usa LIKE (padrão de chave), não um .in() de lista fixa, porque o
    // número de obras muda com o tempo - ver server/attendance-obra-routing.js.
    db.from("company_app_data").select("key, value, updated_at")
      .eq("company_id", currentCompany()).like("key", `${PONTO_OBRA_KEY_PREFIX}%`)
      .order("updated_at", { ascending: true }),
  ]);

  const decodificarNucleo = async data => {
    const payload = decodeAppData(data.value);
    // Migração transparente: preserva o mesmo updated_at para não criar um
    // falso conflito nos navegadores que já estavam editando. Se outra gravação
    // vencer durante a migração, a condição impede qualquer sobrescrita.
    if(!isEncodedAppData(data.value)){
      const encoded=encodeAppData(payload);
      if(isEncodedAppData(encoded)){
        const migrated=await db.from("company_app_data").update({value:encoded})
          .eq("company_id",currentCompany()).eq("key",KEY).eq("updated_at",data.updated_at);
        if(migrated.error)console.error("Não foi possível compactar o dataset:",migrated.error.message);
      }
    }
    return payload;
  };

  const montarLinha = ({ data, payload, splitRows, pontoObraRows }) => {
    const rowVersions = { [DOMAIN_ROW.CORE]: data.updated_at || null };
    const rowPayloadsByDomain = {};
    for (const [domain, key] of splitEntries) {
      const row = (splitRows || []).find(item => item.key === key);
      rowVersions[domain] = row?.updated_at || null;
      if (row) rowPayloadsByDomain[domain] = decodeAppData(row.value);
    }
    let merged = mergeDomainRows(payload, rowPayloadsByDomain);

    // A cópia de `attendance` que sobrar em `merged` até aqui vem da linha
    // "meta" de Ponto (ou, se essa também não existir ainda, da própria
    // core) - é o fallback correto para qualquer obra que ainda não ganhou
    // linha própria. Uma linha por obra, quando existe, sempre VENCE esse
    // fallback (mergeAttendanceObjects: fontes posteriores vencem).
    const rowVersionsPontoObra = {};
    const attendanceSources = [merged.attendance || {}];
    for (const row of pontoObraRows || []) {
      rowVersionsPontoObra[obraBucketFromKey(PONTO_KEY, row.key)] = row.updated_at || null;
      const decodedObraRow = decodeAppData(row.value);
      attendanceSources.push(withAttendanceSyncedAt(decodedObraRow?.attendance, decodedObraRow?.attendanceSyncedAt));
    }
    merged = { ...merged, attendance: mergeAttendanceObjects(...attendanceSources) };

    // `linhasBrutas`: o que cada linha guarda, já decodificado e ANTES do merge.
    // A transação de várias linhas reaproveita estas fatias quando o carimbo
    // travado confirma que a linha não mudou (ver executarMutacaoMultiLinha).
    const linhasBrutas = { [DOMAIN_ROW.CORE]: payload, ...rowPayloadsByDomain };
    return { payload: merged, updatedAt: data.updated_at || null, rowVersions, rowVersionsPontoObra, linhasBrutas };
  };

  const lerLinha = async () => {
    // Achado de 21/08/2026: as três leituras (linha core, linhas separadas de
    // domínio fixo, linhas de Ponto por obra) são independentes - não há motivo
    // para uma esperar a outra terminar. Rodá-las em paralelo tira round-trips
    // inteiros de rede do caminho crítico de toda gravação.
    const [{ data, error }, [{ data: splitRows, error: splitError }, { data: pontoObraRows, error: pontoObraError }]] = await Promise.all([
      consultarNucleo(), consultarLinhasAuxiliares(),
    ]);
    if (error) throw error;
    if (!data) return { payload: null, updatedAt: null, rowVersions: {}, rowVersionsPontoObra: {} };
    if (splitError) throw splitError;
    if (pontoObraError) throw pontoObraError;
    return montarLinha({ data, payload: await decodificarNucleo(data), splitRows, pontoObraRows });
  };

  // Leitura em duas etapas, para autenticar antes de baixar o resto: lerNucleo()
  // traz só a linha core (suficiente para conferir PIN ou vincular o token a um
  // usuário) e completarLinha() devolve o MESMO resultado de lerLinha(), reaproveitando
  // a core já decodificada. Só quem foi autenticado paga a segunda etapa.
  const lerNucleo = async () => {
    const { data, error } = await consultarNucleo();
    if (error) throw error;
    if (!data) return { data: null, payload: null, updatedAt: null };
    return { data, payload: await decodificarNucleo(data), updatedAt: data.updated_at || null };
  };
  const completarLinha = async nucleo => {
    if (!nucleo.data) return { payload: null, updatedAt: null, rowVersions: {}, rowVersionsPontoObra: {} };
    const [{ data: splitRows, error: splitError }, { data: pontoObraRows, error: pontoObraError }] = await consultarLinhasAuxiliares();
    if (splitError) throw splitError;
    if (pontoObraError) throw pontoObraError;
    return montarLinha({ data: nucleo.data, payload: nucleo.payload, splitRows, pontoObraRows });
  };

  return { lerNucleo, completarLinha, lerLinha };
}
