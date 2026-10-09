import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const METRICS = ['statements', 'branches', 'functions', 'lines'];

const PACKAGE_DIRS = [
  'packages/common',
  ...readdirSync(join(ROOT, 'services')).map((name) => `services/${name}`),
  'frontend',
];

const readTotals = (dir) => {
  const summaryPath = join(ROOT, dir, 'coverage', 'coverage-summary.json');
  if (!existsSync(summaryPath)) return null;
  return JSON.parse(readFileSync(summaryPath, 'utf8')).total;
};

const rows = PACKAGE_DIRS.map((dir) => {
  const totals = readTotals(dir);
  const row = { Paquete: dir };
  for (const metric of METRICS) {
    const label = metric.charAt(0).toUpperCase() + metric.slice(1);
    row[label] = totals ? `${totals[metric].pct.toFixed(2)}%` : 'sin reporte';
  }
  return row;
});

console.log('\nResumen de coverage (statements / branches / functions / lines)');
console.table(rows);
