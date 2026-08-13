import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const args = new Set(process.argv.slice(2));
const full = args.has('--full');
const ci = args.has('--ci');
const steps = [
  ['DISCOVER', 'node', ['scripts/architecture-recovery/inventory.mjs', '--out', 'artifacts/architecture-recovery-inventory.json']],
  ['ARCH_GATE', 'npm', ['run', 'arch:gate']],
  ['STATIC_BOUNDARY', 'npm', ['run', 'lint']],
  ['TYPECHECK', 'npm', ['run', 'typecheck']],
  ['DEPENDENCY_ARCHITECTURE', 'npm', ['run', 'architecture:check']],
  ['UNIT_INTEGRATION', 'npm', ['test']],
  ['SECURITY', 'npm', ['audit', '--audit-level=high']],
  ['BUILD', 'npm', ['run', 'build']],
  ['BUNDLE', 'npm', ['run', 'quality:bundle']]
];

if (full) steps.push(['E2E', 'npm', ['run', 'test:e2e']]);

const report = {
  schemaVersion: 1,
  mode: full ? 'full' : 'standard',
  ci,
  startedAt: new Date().toISOString(),
  steps: []
};

for (const [name, command, commandArgs] of steps) {
  const started = Date.now();
  process.stdout.write(`\n=== ${name} ===\n`);
  const run = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  const entry = {
    name,
    status: run.status === 0 ? 'PASS' : 'FAIL',
    exitCode: run.status ?? 1,
    durationMs: Date.now() - started
  };
  report.steps.push(entry);
  if (run.status !== 0) {
    report.status = 'FAIL';
    report.failedState = name;
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync('artifacts', { recursive: true });
    fs.writeFileSync('artifacts/architecture-recovery-run.json', `${JSON.stringify(report, null, 2)}\n`);
    process.exit(run.status ?? 1);
  }
}

report.status = 'PASS';
report.finishedAt = new Date().toISOString();
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/architecture-recovery-run.json', `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\nARCHITECTURE_RECOVERY: PASS\n`);
