import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const targets = ['src/LegacyApp.jsx', 'api/data.js', 'src/index.css'];

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const count = (text, re) => [...text.matchAll(re)].length;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += countFiles(full);
    else if (entry.isFile()) total += 1;
  }
  return total;
}

const files = {};
for (const relative of targets) {
  const full = path.join(root, relative);
  const text = read(relative);
  files[relative] = {
    bytes: fs.statSync(full).size,
    lines: text.split(/\r?\n/).length,
    useState: count(text, /\buseState\b/g),
    useEffect: count(text, /\buseEffect\b/g),
    supabase: count(text, /\bsupabase\b/gi),
    dexie: count(text, /\bdexie\b/gi)
  };
}

const inventory = {
  schemaVersion: 1,
  repository: 'hygorlp-dot/hygor',
  headSha: git('rev-parse', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  files,
  domainFileCount: countFiles(path.join(root, 'src/domains')),
  generatedAt: new Date().toISOString()
};

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
if (outIndex !== -1) {
  const out = args[outIndex + 1];
  if (!out) throw new Error('--out requires a path');
  const fullOut = path.join(root, out);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });
  fs.writeFileSync(fullOut, `${JSON.stringify(inventory, null, 2)}\n`);
}

process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
