import crypto from "crypto";
import { gzipSync, gunzipSync } from "zlib";

const FORMAT = "arcd-onedrive-backup-v1";

const stableJson = value => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

export const backupKeyFromEnv = value => {
  const key = Buffer.from(String(value || ""), "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY deve ser uma chave base64 de 32 bytes.");
  return key;
};

export const createBackupBundle = ({ companyId, rows, now = new Date().toISOString(), key }) => {
  const records = (rows || []).map(row => ({
    key: String(row.key || ""), updatedAt: row.updated_at || row.updatedAt || "", value: row.value,
  })).sort((a, b) => a.key.localeCompare(b.key));
  const manifest = {
    format: FORMAT, companyId: String(companyId), createdAt: now, recordCount: records.length,
    records: records.map(record => ({ key: record.key, updatedAt: record.updatedAt, sha256: hash(stableJson(record.value)) })),
  };
  manifest.sha256 = hash(stableJson(manifest.records));
  const plain = Buffer.from(stableJson({ format: FORMAT, companyId: String(companyId), createdAt: now, records }), "utf8");
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(gzipSync(plain, { level: 9 })), cipher.final()]);
  return { manifest, body: Buffer.concat([Buffer.from("ARCD-BACKUP-1\n", "utf8"), iv, cipher.getAuthTag(), encrypted]) };
};

export const verifyBackupBundle = ({ body, key, manifest }) => {
  const raw = Buffer.from(body);
  const header = Buffer.from("ARCD-BACKUP-1\n", "utf8");
  if (raw.length < header.length + 28 || !raw.subarray(0, header.length).equals(header)) throw new Error("Formato de backup inválido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(header.length, header.length + 12));
  decipher.setAuthTag(raw.subarray(header.length + 12, header.length + 28));
  const payload = JSON.parse(gunzipSync(Buffer.concat([decipher.update(raw.subarray(header.length + 28)), decipher.final()])).toString("utf8"));
  if (payload.format !== FORMAT || payload.companyId !== manifest.companyId || payload.records.length !== manifest.recordCount) throw new Error("Manifesto não confere com o backup.");
  const records = payload.records.map(record => ({ key: record.key, updatedAt: record.updatedAt, sha256: hash(stableJson(record.value)) }));
  if (hash(stableJson(records)) !== manifest.sha256 || stableJson(records) !== stableJson(manifest.records)) throw new Error("Integridade do backup não confere.");
  return { ok: true, recordCount: records.length, sha256: manifest.sha256, createdAt: payload.createdAt };
};
