import { afterEach, expect, it, vi } from "vitest";
import { createCompanyBackup } from "./company-backup.js";
import { runWithCompany } from "./company-context.js";
import { getOrCreateFolder, graph, refresh, rootItem } from "./microsoft/graph.js";

vi.mock("./microsoft/graph.js", () => ({
  getOrCreateFolder: vi.fn(),
  graph: vi.fn(),
  refresh: vi.fn(),
  rootItem: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it("cria e verifica o backup da empresa no OneDrive simulado sem incluir a credencial de integração", async () => {
  vi.stubEnv("COMPANY_ISOLATION_ENABLED", "true");
  vi.stubEnv("BACKUP_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.mocked(refresh).mockResolvedValue({accessToken: "synthetic-token"});
  vi.mocked(rootItem).mockResolvedValue({id: "root", parentReference: {driveId: "drive"}});
  vi.mocked(getOrCreateFolder).mockResolvedValue({id: "folder"});
  const files = new Map();
  vi.mocked(graph).mockImplementation(async (_token, path, options) => {
    if (path.endsWith("createUploadSession")) {
      const {item} = JSON.parse(options.body);
      return {json: async () => ({uploadUrl: item.name})};
    }
    if (path.includes("/children?")) {
      return {json: async () => ({value: [...files].map(([name, body]) => ({
        id: name, name, file: {}, size: body.length,
      }))})};
    }
    const name = path.split("/").at(-2);
    return {arrayBuffer: async () => files.get(name)};
  });
  vi.stubGlobal("fetch", vi.fn(async (name, options) => {
    files.set(name, Buffer.from(options.body));
    return {ok: true};
  }));

  const range = vi.fn(async () => ({error: null, data: [
    {key: "core", value: {example: true}},
    {key: "onedrive_auth_v1", value: {example: "excluded"}},
  ]}));
  const eq = vi.fn(() => ({range}));
  const db = {from: vi.fn(() => ({select: () => ({eq})}))};
  const backup = createCompanyBackup(db);
  await runWithCompany("mrc", async () => {
    expect(backup.backupFolder()).toBe("00 - Backups MRC");
    const created = await backup.criarBackupOneDrive({}, "qa");
    expect(created).toMatchObject({ok: true, recordCount: 1});
    const manifest = JSON.parse(files.get(`${created.name}.manifest.json`).toString());
    expect(manifest.records.map(record => record.key)).toEqual(["core"]);
    expect(await backup.verificarBackupOneDrive({})).toMatchObject({
      ok: true, name: created.name, recordCount: 1, sha256: created.sha256,
    });
  });
  expect(eq).toHaveBeenCalledWith("company_id", "mrc");
  expect(range).toHaveBeenCalledWith(0, 999);
});
