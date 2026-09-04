import { describe, expect, it } from "vitest";
import {
  applyEntriesToAttendance, attendanceObraBucket, attendanceObraKey,
  attendanceObraKeyPrefix, groupAttendanceEntriesByObra, groupObraDeparturesByBucket,
  mergeAttendanceObjects, NO_OBRA_BUCKET, obraBucketFromKey, tombstoneAttendanceEntries,
  withAttendanceSyncedAt,
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

describe("mergeAttendanceObjects - sem bookkeeping (comportamento histórico)", () => {
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

describe("mergeAttendanceObjects - com bookkeeping (withAttendanceSyncedAt)", () => {
  // Achado de 04/09/2026 (ver docs/BLUEPRINT_CONCORRENCIA_TRAVA.md): o
  // `updated_at` de uma linha por obra é da LINHA inteira, compartilhado
  // por todo funcionário/dia que mora nela - uma gravação alheia (outro
  // funcionário, outra data) na MESMA obra "refresca" esse timestamp e faz
  // um tombstone antigo (de uma célula que já migrou para outra obra há
  // muito tempo) parecer mais recente que o valor correto numa OUTRA
  // linha. `withAttendanceSyncedAt` carimba cada célula com o instante em
  // que ela foi REALMENTE escrita (o `now` do próprio comando), imune a
  // esse "refresh" alheio.
  it("o carimbo por célula vence, não importa a ordem em que as fontes chegam", () => {
    const antiga = withAttendanceSyncedAt(
      { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } },
      { alisson: { "2026-08-21": "2026-09-04T14:07:08.000Z" } },
    );
    const nova = withAttendanceSyncedAt(
      { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } },
      { alisson: { "2026-08-21": "2026-09-04T14:07:26.000Z" } },
    );
    expect(mergeAttendanceObjects(antiga, nova).alisson["2026-08-21"].obraId).toBe("ca1-06");
    // Ordem invertida - o resultado não muda, porque agora é o carimbo por
    // célula que decide, não a posição no array.
    expect(mergeAttendanceObjects(nova, antiga).alisson["2026-08-21"].obraId).toBe("ca1-06");
  });

  // Reproduz o bug real de produção de 04/09/2026: um funcionário move um
  // dia de A -> B -> C. A tombstona corretamente quando sai (moveu para
  // B), mas o tombstone de A ficou parado com um carimbo ANTIGO. Depois, a
  // obra C recebe uma gravação de OUTRO funcionário/dia (não relacionada),
  // o que no esquema antigo bastava para "refrescar" o updated_at da linha
  // inteira - inclusive um tombstone de C que não tem nada a ver com essa
  // gravação alheia. Com o carimbo por célula, isso deixa de importar.
  it("um tombstone alheio numa obra C não apaga o valor correto que está na obra B, mesmo com a linha de C reescrita depois", () => {
    const obraA = withAttendanceSyncedAt(
      { func: { "2026-08-27": { status: "P", obraId: "obra-dados" } } },
      { func: { "2026-08-27": "2026-09-04T14:06:38.000Z" } },
    );
    const obraB = withAttendanceSyncedAt(
      { func: { "2026-08-27": { status: "P", obraId: "obra-b" } } },
      { func: { "2026-08-27": "2026-09-04T14:07:26.000Z" } },
    );
    // Tombstone de "func" na obra C, carimbado quando ele saiu de lá às
    // 14:07:08 - MUITO antes da obra B (14:07:26), que é o valor certo.
    const obraC = withAttendanceSyncedAt(
      { func: { "2026-08-27": null }, outroFuncionario: { "2026-09-04": { status: "P", obraId: "obra-c" } } },
      { func: { "2026-08-27": "2026-09-04T14:07:08.000Z" }, outroFuncionario: { "2026-09-04": "2026-09-04T14:07:41.000Z" } },
    );
    // Sem bookkeeping (esquema antigo), o "updated_at" físico da linha de C
    // seria 14:07:41 (a gravação alheia mais recente) - maior que o de B
    // (14:07:26) - e o tombstone de "func" venceria, apagando o valor
    // certo. Com o carimbo por célula, a comparação é 14:07:08 (tombstone
    // de func em C) vs. 14:07:26 (valor de func em B) - B vence.
    const merged = mergeAttendanceObjects(obraA, obraB, obraC);
    expect(merged.func["2026-08-27"]).toMatchObject({ status: "P", obraId: "obra-b" });
  });

  it("sem carimbo dos dois lados, cai no comportamento histórico (última fonte processada vence)", () => {
    const semCarimbo1 = { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } };
    const semCarimbo2 = { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } };
    expect(mergeAttendanceObjects(semCarimbo1, semCarimbo2).alisson["2026-08-21"].obraId).toBe("ca1-06");
  });

  it("uma fonte COM carimbo sempre vence uma SEM carimbo, mesmo processada antes dela", () => {
    const comCarimbo = withAttendanceSyncedAt(
      { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } },
      { alisson: { "2026-08-21": "2026-09-04T14:07:26.000Z" } },
    );
    const semCarimbo = { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } };
    // Achado ao revisar a própria correção: sem esta regra, uma fonte sem
    // carimbo processada DEPOIS de uma com carimbo apagava o valor certo -
    // reintroduzindo exatamente o bug que esta correção existe para fechar.
    expect(mergeAttendanceObjects(comCarimbo, semCarimbo).alisson["2026-08-21"].obraId).toBe("ca1-06");
    expect(mergeAttendanceObjects(semCarimbo, comCarimbo).alisson["2026-08-21"].obraId).toBe("ca1-06");
  });

  // Achado ao testar a própria correção (04/09/2026): uma troca de obra
  // carimba as DUAS pontas (tombstone da obra antiga e valor da obra nova)
  // com o MESMO `now` - o comando é um só. Sem uma regra de desempate
  // explícita, a ordem das linhas voltava a decidir exatamente esse caso
  // (o mais comum de todos: uma troca simples), reintroduzindo o bug que
  // esta correção existe para fechar.
  it("com carimbos EMPATADOS (mesma troca de obra), o valor real sempre vence o tombstone, em qualquer ordem", () => {
    const tombstoneObraAntiga = withAttendanceSyncedAt(
      { alisson: { "2026-08-21": null } },
      { alisson: { "2026-08-21": "2026-09-04T14:07:26.000Z" } },
    );
    const valorObraNova = withAttendanceSyncedAt(
      { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } },
      { alisson: { "2026-08-21": "2026-09-04T14:07:26.000Z" } },
    );
    expect(mergeAttendanceObjects(valorObraNova, tombstoneObraAntiga).alisson["2026-08-21"]).toMatchObject({ obraId: "ca1-06" });
    expect(mergeAttendanceObjects(tombstoneObraAntiga, valorObraNova).alisson["2026-08-21"]).toMatchObject({ obraId: "ca1-06" });
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
    expect(applyEntriesToAttendance(existing, entries, after).attendance).toEqual({
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
    expect(applyEntriesToAttendance(existing, entries, after).attendance).toEqual({
      e1: { "2026-08-01": { status: "P" }, "2026-08-02": null },
    });
  });

  it("mantém o funcionário com um tombstone quando o último dia dele é excluído", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    const after = {};
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after).attendance).toEqual({
      e1: { "2026-08-01": null },
    });
  });

  it("não toca em funcionários/dias fora da lista de entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } }, e2: { "2026-08-01": { status: "F" } } };
    const after = { e1: { "2026-08-01": { status: "M" } }, e2: { "2026-08-01": { status: "F" } } };
    const entries = [{ employeeId: "e1", date: "2026-08-01" }];
    expect(applyEntriesToAttendance(existing, entries, after).attendance.e2).toEqual({ "2026-08-01": { status: "F" } });
  });

  it("devolve cópia do existente quando não há entradas", () => {
    const existing = { e1: { "2026-08-01": { status: "P" } } };
    expect(applyEntriesToAttendance(existing, [], existing).attendance).toEqual(existing);
  });

  // Achado de 04/09/2026: `now` carimba a célula por célula em `syncedAt`
  // (mesma forma aninhada de `attendance`) - é isso que mergeAttendanceObjects
  // passa a comparar em vez do updated_at físico da linha.
  it("carimba syncedAt por célula com o `now` informado, preservando carimbos existentes de outras células", () => {
    const existing = {};
    const existingSynced = { e1: { "2026-08-01": "2026-09-01T00:00:00.000Z" } };
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    const after = { e1: { "2026-08-01": { status: "P" }, "2026-08-02": { status: "M" } } };
    const result = applyEntriesToAttendance(existing, entries, after, "2026-09-04T14:07:26.000Z", existingSynced);
    expect(result.syncedAt).toEqual({
      e1: { "2026-08-01": "2026-09-01T00:00:00.000Z", "2026-08-02": "2026-09-04T14:07:26.000Z" },
    });
  });

  it("sem `now`, não grava syncedAt algum (chamada antiga, compatível)", () => {
    const entries = [{ employeeId: "e1", date: "2026-08-02" }];
    const after = { e1: { "2026-08-02": { status: "M" } } };
    const result = applyEntriesToAttendance({}, entries, after);
    expect(result.syncedAt).toEqual({});
  });
});

describe("groupObraDeparturesByBucket", () => {
  // Achado de 02/09/2026: reproduz o bug real de produção - trocar a obra
  // do dia de um funcionário (ex.: P1-08 -> CA1-06) só gravava a linha da
  // obra NOVA; a cópia na linha da obra ANTIGA nunca era apagada e sobrava
  // como fantasma. Esta função identifica quais pares (employeeId,date)
  // precisam de tombstone em qual obra ANTIGA.
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
    expect(next.attendance.alisson).toEqual({ "2026-08-21": null, "2026-08-22": { status: "P" } });
  });

  it("nunca copia o registro atual - sempre grava null, mesmo se o par ainda não existir na linha", () => {
    const next = tombstoneAttendanceEntries({}, [{ employeeId: "alisson", date: "2026-08-21" }]);
    expect(next.attendance).toEqual({ alisson: { "2026-08-21": null } });
  });

  it("não toca em outros funcionários", () => {
    const existing = { alisson: { "2026-08-21": { status: "P" } }, outro: { "2026-08-21": { status: "F" } } };
    const next = tombstoneAttendanceEntries(existing, [{ employeeId: "alisson", date: "2026-08-21" }]);
    expect(next.attendance.outro).toEqual({ "2026-08-21": { status: "F" } });
  });

  it("devolve cópia do existente sem pares", () => {
    const existing = { alisson: { "2026-08-21": { status: "P" } } };
    expect(tombstoneAttendanceEntries(existing, []).attendance).toEqual(existing);
  });

  it("carimba syncedAt do tombstone com o `now` informado", () => {
    const result = tombstoneAttendanceEntries(
      { alisson: { "2026-08-21": { status: "P" } } },
      [{ employeeId: "alisson", date: "2026-08-21" }],
      "2026-09-04T14:07:08.000Z",
    );
    expect(result.syncedAt).toEqual({ alisson: { "2026-08-21": "2026-09-04T14:07:08.000Z" } });
  });
});

describe("integração: troca de obra - o carimbo por célula sobrevive à ordem das linhas e a gravações alheias", () => {
  it("achado de 02/09/2026: sem bookkeeping, a ordem das fontes decide (bug histórico, ainda reproduzível sem withAttendanceSyncedAt)", () => {
    const linhaAntiga = { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } };   // fantasma, nunca apagado
    const linhaNova = { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } };
    expect(mergeAttendanceObjects(linhaAntiga, linhaNova).alisson["2026-08-21"].obraId).toBe("ca1-06");
    expect(mergeAttendanceObjects(linhaNova, linhaAntiga).alisson["2026-08-21"].obraId).toBe("p1-08");
  });

  it("achado de 04/09/2026: com bookkeeping, o resultado é o mesmo em qualquer ordem, mesmo com a obra antiga tombstonada DEPOIS da obra nova ganhar um carimbo mais recente por coincidência de linha", () => {
    const antiga=tombstoneAttendanceEntries(
      { alisson: { "2026-08-21": { status: "P", obraId: "p1-08" } } },
      [{ employeeId: "alisson", date: "2026-08-21" }],
      "2026-09-04T14:07:08.000Z",
    );
    const novaEntries=applyEntriesToAttendance(
      {}, [{ employeeId: "alisson", date: "2026-08-21" }],
      { alisson: { "2026-08-21": { status: "P", obraId: "ca1-06" } } },
      "2026-09-04T14:07:26.000Z",
    );
    const fonteAntiga=withAttendanceSyncedAt(antiga.attendance, antiga.syncedAt);
    const fonteNova=withAttendanceSyncedAt(novaEntries.attendance, novaEntries.syncedAt);
    expect(mergeAttendanceObjects(fonteAntiga, fonteNova).alisson["2026-08-21"].obraId).toBe("ca1-06");
    expect(mergeAttendanceObjects(fonteNova, fonteAntiga).alisson["2026-08-21"].obraId).toBe("ca1-06");
  });
});
