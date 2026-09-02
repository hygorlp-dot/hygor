import { describe, expect, it } from "vitest";
import {
  applyEntriesToAttendance, attendanceObraBucket, attendanceObraKey,
  attendanceObraKeyPrefix, groupAttendanceEntriesByObra, groupObraDeparturesByBucket,
  mergeAttendanceObjects, NO_OBRA_BUCKET, obraBucketFromKey, tombstoneAttendanceEntries,
} from "./attendance-obra-routing.js";

describe("attendanceObraBucket", () => {
  it("usa o obraId como balde quando presente", () => {
    expect(attendanceObraBucket("obra-1")).toBe("obra-1");
  });
  it("cai no balde sem_obra para vazio/nulo/undefined", () => {
    expect(attendanceObraBucket("")).toBe(NO_OBRA_BUCKET);
    expect(attendanceObraBucket(null)).toBe(NO_OBRA_BUCKET);
    expect(attendanceObraBucket(undefined)).toBe(NO_OBRA_BUCKET);
  });
});

describe("attendanceObraKey / obraBucketFromKey", () => {
  it("é reversível - obraBucketFromKey desfaz attendanceObraKey", () => {
    const key = attendanceObraKey("arced_ponto_v1__ponto", "obra-42");
    expect(key).toBe("arced_ponto_v1__ponto__obra__obra-42");
    expect(obraBucketFromKey("arced_ponto_v1__ponto", key)).toBe("obra-42");
  });
  it("o prefixo bate com o usado para o filtro LIKE do banco", () => {
    expect(attendanceObraKeyPrefix("BASE")).toBe("BASE__obra__");
    expect(attendanceObraKey("BASE", "x")).toBe("BASE__obra__x");
  });
});

describe("mergeAttendanceObjects", () => {
  it("mescla funcionários distintos de fontes diferentes", () => {
    const merged = mergeAttendanceObjects(
      { e1: { "2026-08-01": { status: "P" } } },
      { e2: { "2026-08-01": { status: "F" } } },
    );
    expect(merged).toEqual({
      e1: { "2026-08-01": { status: "P" } },
      e2: { "2026-08-01": { status: "F" } },
    });
  });

  it("fontes posteriores vencem no mesmo (employeeId,date) - linha por obra prioriza sobre a legada", () => {
    const legado = { e1: { "2026-08-01": { status: "P", note: "antigo" } } };
    const daObra = { e1: { "2026-08-01": { status: "F", note: "novo" } } };
    expect(mergeAttendanceObjects(legado, daObra).e1["2026-08-01"]).toEqual({ status: "F", note: "novo" });
  });

  it("preserva dias de um mesmo funcionário vindos de fontes diferentes", () => {
    const merged = mergeAttendanceObjects(
      { e1: { "2026-08-01": { status: "P" } } },
      { e1: { "2026-08-02": { status: "F" } } },
    );
    expect(merged.e1).toEqual({ "2026-08-01": { status: "P" }, "2026-08-02": { status: "F" } });
  });

  it("devolve objeto vazio sem argumentos", () => {
    expect(mergeAttendanceObjects()).toEqual({});
  });

  it("achado de 25/08/2026: um tombstone (record:null) da linha de obra apaga o valor da cópia legada, em vez de deixá-lo ressuscitar", () => {
    // Reproduz o sintoma relatado: um funcionário com dias marcados "P" na
    // cópia legada (linha compartilhada de Ponto, de antes da Fase 1.5)
    // aparecia com esses dias de volta mesmo depois de limpos na tela,
    // porque a limpeza (delete da chave na linha de obra) não tinha como
    // vencer o valor antigo ainda presente na fonte legada.
    const legado = { alisson: {
      "2026-08-18": { status: "P" }, "2026-08-19": { status: "P" }, "2026-08-20": { status: "P" },
    } };
    const daObra = { alisson: { "2026-08-19": null } };   // "2026-08-19" foi limpo na obra
    const merged = mergeAttendanceObjects(legado, daObra);
    expect(merged.alisson).toEqual({
      "2026-08-18": { status: "P" }, "2026-08-20": { status: "P" },
    });
    expect(merged.alisson).not.toHaveProperty("2026-08-19");
  });

  it("remove o funcionário do resultado quando toda fonte para ele é tombstone", () => {
    const merged = mergeAttendanceObjects(
      { alisson: { "2026-08-19": { status: "P" } } },
      { alisson: { "2026-08-19": null } },
    );
    expect(merged).toEqual({});
  });
});

describe("groupAttendanceEntriesByObra", () => {
  it("agrupa entradas por obra, mantendo a ordem de chegada", () => {
    const entries = [
      { employeeId: "e1", date: "2026-08-01", obraId: "obra-a" },
      { employeeId: "e2", date: "2026-08-01", obraId: "obra-b" },
      { employeeId: "e3", date: "2026-08-01", obraId: "obra-a" },
    ];
    const grouped = groupAttendanceEntriesByObra(entries);
    expect([...grouped.keys()]).toEqual(["obra-a", "obra-b"]);
    expect(grouped.get("obra-a")).toHaveLength(2);
    expect(grouped.get("obra-b")).toHaveLength(1);
  });

  it("agrupa entradas sem obra no balde sem_obra", () => {
    const grouped = groupAttendanceEntriesByObra([{ employeeId: "e1", date: "2026-08-01", obraId: "" }]);
    expect([...grouped.keys()]).toEqual([NO_OBRA_BUCKET]);
  });

  it("devolve mapa vazio para lista vazia/ausente", () => {
    expect(groupAttendanceEntriesByObra([]).size).toBe(0);
    expect(groupAttendanceEntriesByObra(undefined).size).toBe(0);
  });
});

describe("applyEntriesToAttendance", () => {
  it("adiciona/atualiza um registro usando o valor final de fullAttendanceAfter", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    const after = { e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({
      e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } },
    });
  });

  it("grava um tombstone (record:null) quando fullAttendanceAfter não tem mais essa data (exclusão)", () => {
    // Não é mais `delete days[date]`: a exclusão precisa ficar registrada
    // NESTA linha de obra para vencer, na leitura (mergeAttendanceObjects),
    // qualquer cópia antiga que ainda sobre na linha compartilhada de Ponto
    // - ver o achado de 25/08/2026 no topo de mergeAttendanceObjects.
    const existing = { e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } } };
    const after = { e1: { "2026-08-01": { status: "P" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({
      e1: { "2026-08-01": { status: "P" }, "2026-08-02": null },
    });
  });

  it("mantém o funcionário com um tombstone quando o último dia dele é excluído", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    const after = {};
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after)).toEqual({
      e1: { "2026-08-01": null },
    });
  });

  it("não toca em funcionários/dias fora da lista de entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } }, e2: { "2026-08-01": { status: "F" } } };
    const after = { e1: { "2026-08-01": { status: "M" } }, e2: { "2026-08-01": { status: "F" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after).e2).toEqual({ "2026-08-01": { status: "F" } });
  });

  it("devolve cópia do existente quando não há entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    expect(applyEntriesToAttendance(existing, [], existing)).toEqual(existing);
  });
});

describe("groupObraDeparturesByBucket", () => {
  // Achado de 02/09/2026: reproduz o bug real de produção - trocar a obra
  // do dia de um funcionário (ex.: P1-08 -> CA1-06) só gravava a linha da
  // obra NOVA; a cópia na linha da obra ANTIGA nunca era apagada e sobrava
  // como fantasma, podendo vencer a cópia nova ao reconstruir `attendance`
  // na leitura (mergeAttendanceObjects escolhe pela ORDEM em que as linhas
  // voltam do banco - não garantida). Esta função identifica quais pares
  // (employeeId,date) precisam de tombstone em qual obra ANTIGA.
  it("agrupa por obra ANTIGA quando previousObraId difere de obraId", () => {
    const entries = [
      { employeeId: "alisson", date: "2026-08-21", obraId: "ca1-06", previousObraId: "p1-08" },
    ];
    const partidas = groupObraDeparturesByBucket(entries);
    expect([...partidas.keys()]).toEqual(["p1-08"]);
    expect(partidas.get("p1-08")).toEqual([{ employeeId: "alisson", date: "2026-08-21" }]);
  });

  it("ignora entradas sem mudança de obra (previousObraId === obraId)", () => {
    const entries = [{ employeeId: "e1", date: "2026-08-21", obraId: "p1-08", previousObraId: "p1-08" }];
    expect(groupObraDeparturesByBucket(entries).size).toBe(0);
  });

  it("ignora entradas sem previousObraId (primeiro lançamento do dia, nada para apagar)", () => {
    const entries = [{ employeeId: "e1", date: "2026-08-21", obraId: "p1-08" }];
    expect(groupObraDeparturesByBucket(entries).size).toBe(0);
  });

  it("resolve o balde sem_obra tanto para a obra antiga quanto para a nova", () => {
    const entries = [{ employeeId: "e1", date: "2026-08-21", obraId: "p1-08", previousObraId: "" }];
    const partidas = groupObraDeparturesByBucket(entries);
    expect([...partidas.keys()]).toEqual([NO_OBRA_BUCKET]);
  });

  it("agrupa várias partidas da mesma obra antiga e mantém partidas distintas separadas", () => {
    const entries = [
      { employeeId: "e1", date: "2026-08-21", obraId: "ca1-06", previousObraId: "p1-08" },
      { employeeId: "e2", date: "2026-08-22", obraId: "k1-04", previousObraId: "p1-08" },
      { employeeId: "e3", date: "2026-08-21", obraId: "p1-08", previousObraId: "ca1-06" },
    ];
    const partidas = groupObraDeparturesByBucket(entries);
    expect(partidas.get("p1-08")).toHaveLength(2);
    expect(partidas.get("ca1-06")).toEqual([{ employeeId: "e3", date: "2026-08-21" }]);
  });

  it("devolve mapa vazio para lista vazia/ausente", () => {
    expect(groupObraDeparturesByBucket([]).size).toBe(0);
    expect(groupObraDeparturesByBucket(undefined).size).toBe(0);
  });
});

describe("tombstoneAttendanceEntries", () => {
  it("apaga (record:null) os pares informados, preservando o resto do funcionário", () => {
    const existing = { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" }, "2026-08-22": { status: "P" } } };
    const next = tombstoneAttendanceEntries(existing, [{ employeeId: "alisson", date: "2026-08-21" }]);
    expect(next.alisson).toEqual({ "2026-08-21": null, "2026-08-22": { status: "P" } });
  });

  it("nunca copia o registro atual - sempre grava null, mesmo se o par ainda não existir na linha", () => {
    const next = tombstoneAttendanceEntries({}, [{ employeeId: "alisson", date: "2026-08-21" }]);
    expect(next).toEqual({ alisson: { "2026-08-21": null } });
  });

  it("não toca em outros funcionários", () => {
    const existing = { alisson: { "2026-08-21": { status: "P" } }, outro: { "2026-08-21": { status: "F" } } };
    const next = tombstoneAttendanceEntries(existing, [{ employeeId: "alisson", date: "2026-08-21" }]);
    expect(next.outro).toEqual({ "2026-08-21": { status: "F" } });
  });

  it("devolve cópia do existente sem pares", () => {
    const existing = { alisson: { "2026-08-21": { status: "P" } } };
    expect(tombstoneAttendanceEntries(existing, [])).toEqual(existing);
  });
});

describe("integração: uma troca de obra some da leitura sem o tombstone, e não some com ele", () => {
  // Reproduz de ponta a ponta o sintoma relatado. `mergeAttendanceObjects`
  // sempre deixa a ÚLTIMA fonte da lista vencer para uma mesma chave - api/
  // data.js (lerLinha) ordena as linhas por obra por updated_at ASCENDENTE,
  // então "última fonte" = linha gravada por último. Duas garantias juntas
  // fecham o bug: (1) o tombstone da obra antiga entra na lista de fontes
  // ANTES do valor da obra nova (api/data.js grava as duas obras na mesma
  // transação, tombstone primeiro - clock_timestamp() avança dentro dela),
  // e (2) um tombstone (record:null) sempre vence uma fonte ANTERIOR, nunca
  // uma posterior. Sem o tombstone, o fantasma na obra antiga preserva sua
  // própria obraId como uma fonte independente - e a ordem de retorno do
  // banco (não garantida antes desta correção) decide sozinha qual das duas
  // obras "vence", mesmo sem nenhum clique novo do usuário.
  it("sem tombstonear a obra antiga, a ordem das fontes decide (bug real)", () => {
    const linhaAntiga = { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } };   // fantasma, nunca apagado
    const linhaNova = { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } };
    expect(mergeAttendanceObjects(linhaAntiga, linhaNova).alisson["2026-08-21"].obraId).toBe("ca1-06");
    // Só a ordem das fontes muda (equivalente a inverter updated_at) - o
    // valor "vencedor" muda junto. Este é o bug relatado.
    expect(mergeAttendanceObjects(linhaNova, linhaAntiga).alisson["2026-08-21"].obraId).toBe("p1-08");
  });

  it("tombstoneando a obra antiga E gravando-a ANTES da obra nova (ordem que api/data.js garante), a obra nova sempre vence", () => {
    const linhaAntigaComTombstone = tombstoneAttendanceEntries(
      { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } },
      [{ employeeId: "alisson", date: "2026-08-21" }],
    );
    const linhaNova = { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } };
    // Tombstone primeiro, valor novo por último - a ordem que api/data.js
    // sempre produz (bloco de tombstones de partidas roda antes do bloco de
    // gravação das obras novas, de propósito).
    expect(mergeAttendanceObjects(linhaAntigaComTombstone, linhaNova).alisson["2026-08-21"].obraId).toBe("ca1-06");
  });
});
