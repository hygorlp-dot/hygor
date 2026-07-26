import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const assets = [
  "login-architectural-landscape",
  "login-projects-depth",
];

for (const asset of assets) {
  const input = resolve("src/assets", `${asset}.png`);
  const output = resolve("src/assets", `${asset}.webp`);
  await sharp(input)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82, smartSubsample: true })
    .toFile(output);
  const [source, optimized] = await Promise.all([stat(input), stat(output)]);
  const reduction = Math.round((1 - optimized.size / source.size) * 100);
  console.log(`${asset}: ${(source.size / 1024).toFixed(0)} kB -> ${(optimized.size / 1024).toFixed(0)} kB (${reduction}% menor)`);
}
