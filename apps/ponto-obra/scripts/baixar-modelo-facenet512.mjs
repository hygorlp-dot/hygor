#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = path.join(APP, "assets/modelos/facenet_512.tflite");
const COMMIT = "e470d77beb64e4062792d7b0ff0d50127f089db4";
const URL = `https://raw.githubusercontent.com/aashup/face-auth/${COMMIT}/models/facenet_512.tflite`;
const SHA256 = "f0dede2fdf5fd10248aad1d85393d2d40e3494464440bd8fccb2c957baa430b7";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

if (existsSync(DESTINO) && hash(await readFile(DESTINO)) === SHA256) {
  process.stdout.write("ok  facenet_512.tflite\n");
  process.exit(0);
}
const parcial = `${DESTINO}.part`;
await rm(parcial, { force: true });
const resposta = await fetch(URL, { signal: AbortSignal.timeout(120_000) });
if (!resposta.ok) throw new Error(`Falha ao baixar FaceNet-512: HTTP ${resposta.status}`);
const bytes = Buffer.from(await resposta.arrayBuffer());
const calculado = hash(bytes);
if (calculado !== SHA256) throw new Error(`SHA-256 divergente no FaceNet-512: ${calculado}`);
await writeFile(parcial, bytes);
await rename(parcial, DESTINO);
process.stdout.write(`baixado  facenet_512.tflite  ${bytes.length} bytes\n`);
