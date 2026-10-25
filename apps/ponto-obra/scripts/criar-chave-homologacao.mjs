#!/usr/bin/env node
// Uma vez por equipe. Guarde a pasta em local privado e mantenha a mesma
// chave em todas as atualizações; não publique como artifact de CI.
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pasta = process.argv[2] && path.resolve(process.argv[2]);
if (!pasta || pasta === raiz || pasta.startsWith(raiz + path.sep)) throw new Error("Informe uma pasta privada FORA do repositório para guardar a chave.");
const config = path.join(pasta, "signing.json");
const keystore = path.join(pasta, "homologacao.jks");
if (existsSync(config) || existsSync(keystore)) throw new Error("Já existe chave nesta pasta. Reutilize-a; não substitua a identidade dos APKs instalados.");
mkdirSync(pasta, { recursive: true, mode: 0o700 });
chmodSync(pasta, 0o700);
const password = randomBytes(32).toString("base64url");
const alias = "ponto-homologacao";
const keytool = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin/keytool") : "keytool";
const r = spawnSync(keytool, ["-genkeypair", "-keystore", keystore, "-storetype", "JKS", "-alias", alias,
  "-storepass:env", "PONTO_KEYSTORE_PASSWORD", "-keypass:env", "PONTO_KEY_PASSWORD",
  "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000", "-dname", "CN=Ponto de Obra Homologacao,OU=Simulacao,O=Hygor,C=BR"],
{ env: { ...process.env, PONTO_KEYSTORE_PASSWORD: password, PONTO_KEY_PASSWORD: password }, encoding: "utf8", stdio: "pipe" });
if (r.status !== 0) throw new Error("Não foi possível criar a chave; confira JAVA_HOME e a pasta privada.");
chmodSync(keystore, 0o600);
writeFileSync(config, JSON.stringify({ path: keystore, alias, password, keyPassword: password }) + "\n", { mode: 0o600, flag: "wx" });
process.stdout.write("Chave exclusiva criada. Preserve a pasta privada; nenhuma senha foi exibida. Use PONTO_SIGNING_FILE apontando para signing.json.\n");
