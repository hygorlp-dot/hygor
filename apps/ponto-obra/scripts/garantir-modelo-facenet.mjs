#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(APP, "assets/modelos/facenet_512.tflite");
const TMP = DEST + ".tmp";
const SHA256 = "f0dede2fdf5fd10248aad1d85393d2d40e3494464440bd8fccb2c957baa430b7";
const COMMIT = "e470d77beb64e4062792d7b0ff0d50127f089db4";
const URL = `https://raw.githubusercontent.com/aashup/face-auth/${COMMIT}/models/facenet_512.tflite`;

const sha = p => createHash("sha256").update(readFileSync(p)).digest("hex");
if (existsSync(DEST) && sha(DEST) === SHA256) {
  process.stdout.write(`FaceNet-512 OK: ${SHA256}\n`);
  process.exit(0);
}
mkdirSync(path.dirname(DEST), { recursive: true });
rmSync(TMP, { force: true });
const r = await fetch(URL, { redirect: "error", signal: AbortSignal.timeout(120000) });
if (!r.ok || !r.body) throw new Error(`Falha ao baixar FaceNet-512 (HTTP ${r.status}).`);
await pipeline(r.body, createWriteStream(TMP, { mode: 0o644 }));
const got = sha(TMP);
if (got !== SHA256) {
  rmSync(TMP, { force: true });
  throw new Error(`FaceNet-512 com SHA inesperado: ${got}`);
}
renameSync(TMP, DEST);
process.stdout.write(`FaceNet-512 baixado e conferido: ${SHA256}\n`);
