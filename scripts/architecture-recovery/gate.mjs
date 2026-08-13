import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const configPath = path.join(root, 'config/architecture-recovery-agent-cell.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const base = process.env.ARCH_RATCHET_BASE || config.ratchetBaseSha;
const failures = [];

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  git('cat-file', '-e', `${base}^{commit}`);
} catch {
  failures.push(`ratchet base commit is unavailable: ${base}`);
}

for (const [relative, policy] of Object.entries(config.hotspotBaselines)) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) {
    failures.push(`hotspot disappeared without explicit baseline migration: ${relative}`);
    continue;
  }
  const bytes = fs.statSync(full).size;
  if (bytes > policy.maxBytes) {
    failures.push(`${relative} grew from max ${policy.maxBytes} bytes to ${bytes} bytes`);
  }
}

let diff = '';
if (failures.length === 0) {
  try {
    diff = git('diff', '--unified=0', '--no-color', `${base}...HEAD`);
    git('diff', '--check', `${base}...HEAD`);
  } catch (error) {
    failures.push(`git diff gate failed: ${String(error.stderr || error.message).trim()}`);
  }
}

let currentFile = '';
const domainForbidden = config.addedLinePolicies.domainForbiddenDependencies;
const isTestFile = (file) => /(^|\/)(tests?|e2e)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const importLike = (line) => /^\s*(import\b|export\b.*\bfrom\b|const\s+.+?=\s*require\s*\(|require\s*\()/.test(line);

for (const raw of diff.split(/\r?\n/)) {
  if (raw.startsWith('+++ b/')) {
    currentFile = raw.slice(6);
    continue;
  }
  if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
  const line = raw.slice(1);

  if (currentFile.startsWith('src/domains/') && importLike(line)) {
    const lower = line.toLowerCase();
    for (const forbidden of domainForbidden) {
      if (lower.includes(forbidden.toLowerCase())) {
        failures.push(`${currentFile}: new domain dependency is forbidden: ${forbidden}`);
      }
    }
  }

  if (!isTestFile(currentFile) && importLike(line) && /(\.test\.|\.spec\.|\/tests?\/|\/e2e\/)/i.test(line)) {
    failures.push(`${currentFile}: production code imports test/spec code`);
  }

  if (isTestFile(currentFile) && /(\b(?:test|it|describe)\.(?:skip|only)\s*\(|\.(?:skip|only)\s*\()/i.test(line)) {
    failures.push(`${currentFile}: new skipped/only test is forbidden`);
  }
}

const unique = [...new Set(failures)];
const result = {
  schemaVersion: 1,
  status: unique.length === 0 ? 'PASS' : 'FAIL',
  baseSha: base,
  headSha: git('rev-parse', 'HEAD').trim(),
  failures: unique
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (unique.length) process.exit(1);
