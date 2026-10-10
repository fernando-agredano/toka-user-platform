// Usage: npm run coverage:style
// Istanbul ships a plain default theme. This appends a themed block (project design tokens, light/dark)
// to every generated base.css, replacing its own previous block so it is safe to run repeatedly.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const START = '/* toka-theme:start */';
const END = '/* toka-theme:end */';

const THEME = `${START}
:root{--bg:#f7f8fa;--card:#fff;--border:#e5e7eb;--text:#111827;--muted:#6b7280;--primary:#4f46e5;--primary-soft:#eef2ff;
--ok:#16a34a;--ok-soft:#dcfce7;--warn:#f59e0b;--warn-soft:#fef3c7;--bad:#ef4444;--bad-soft:#fee2e2;--shadow:0 4px 12px rgba(16,24,40,.08)}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#1a1d23;--border:#2a2e37;--text:#f3f4f6;--muted:#9ca3af;--primary:#818cf8;--primary-soft:#1e1b3a;
--ok:#4ade80;--ok-soft:#14301e;--warn:#fbbf24;--warn-soft:#3a2d0b;--bad:#f87171;--bad-soft:#3b1717;--shadow:0 4px 12px rgba(0,0,0,.4)}}
body,html{font-family:Geist,Inter,-apple-system,"Segoe UI",sans-serif;color:var(--text);background:var(--bg);font-size:14px}
.wrapper{max-width:1100px;margin:0 auto;padding:0 20px}
.pad1{padding:20px 0}
.wrapper>.pad1:first-child,.wrapper>.pad1:first-of-type{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);margin:24px 0 0;padding:24px}
.wrapper>.pad1:first-child{border-bottom-left-radius:0;border-bottom-right-radius:0}
h1{font-size:1.5rem;font-weight:700;margin:0 0 8px;color:var(--text)}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline;color:var(--primary)}
div.path a:link,div.path a:visited{color:var(--primary)}
.clearfix .fl{background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:12px 18px;margin:8px 12px 8px 0}
.strong{font-size:1.875rem;font-weight:700;display:block;line-height:1.1}
.quiet,.quiet a{color:var(--muted)}
.fraction{display:block;font-size:.75rem;color:var(--muted);margin-top:2px;background:none;padding:0;border-radius:0;font-family:inherit}
.status-line{height:4px;border-radius:0}
.status-line.high,.high .cover-fill{background:var(--ok)}
.status-line.medium,.medium .cover-fill{background:var(--warn)}
.status-line.low,.low .cover-fill{background:var(--bad)}
.high .chart,.medium .chart,.low .chart{border:0;border-radius:9999px;overflow:hidden}
.cover-empty{background:var(--border)}
.chart{height:8px;border-radius:9999px;overflow:hidden}
.cover-fill,.cover-empty{height:8px;display:inline-block}
.wrapper>.pad1:nth-of-type(2){background:var(--card);border:1px solid var(--border);border-top:0;border-radius:0 0 16px 16px;box-shadow:var(--shadow);margin-bottom:24px;padding:8px 24px 16px}
.coverage-summary{border-collapse:collapse;width:100%}
.coverage-summary th{background:transparent;color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;padding:12px 10px;border-bottom:1px solid var(--border)}
.coverage-summary td{padding:11px 10px;border-bottom:1px solid var(--border)}
.coverage-summary tr:hover td{background:var(--primary-soft)}
.coverage-summary td.file{font-weight:500}
.coverage-summary td.pct{font-variant-numeric:tabular-nums}
.coverage-summary td.pct.high,.coverage-summary td.pct.medium,.coverage-summary td.pct.low{font-weight:600}
td.pct.high,.pct.high{color:var(--ok)}td.pct.medium,.pct.medium{color:var(--warn)}td.pct.low,.pct.low{color:var(--bad)}
.coverage-summary td.low,.coverage-summary td.low .pct{background:var(--bad-soft)}
.coverage-summary td.medium{background:var(--warn-soft)}
.coverage-summary td.high,.coverage-summary td.empty{background:transparent}
.coverage-summary tbody,.coverage-summary tr,.coverage-summary td,.coverage-summary th{border-left:0;border-right:0}
.coverage-summary tbody{border:0}
.coverage-summary td.abs{color:var(--muted);font-size:.8rem}
.coverage-summary tfoot td{border-bottom:0}
.high,.cline-yes{background:transparent}
.cstat-no,.fstat-no,.cbranch-no,.cbranch-no{background:var(--bad-soft)!important;color:var(--text)}
.cline-no,.low.cline-no{background:var(--bad-soft)}
.cstat-skip,.fstat-skip,.cbranch-skip{background:var(--warn-soft)}
.cstat-yes{color:var(--text)}
span.cline-any.cline-yes{background:var(--ok-soft);color:var(--ok)}
span.cline-any.cline-no{background:var(--bad-soft);color:var(--bad)}
table.coverage td.line-count,table.coverage td.line-coverage{color:var(--muted)}
pre,table.coverage td.text pre{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12.5px}
.wrapper>.pad1:has(table.coverage){background:var(--card);border:1px solid var(--border);border-radius:12px;overflow-x:auto}
.footer{color:var(--muted);border-top:1px solid var(--border)}
#fileSearch{background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:8px;padding:6px 10px}
.pln,.pun,.pln *{color:var(--text)}.kwd{color:var(--primary)}.str{color:var(--ok)}.com{color:var(--muted)}
${END}`;

function findBaseStylesheets(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules' || name === '.git') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return findBaseStylesheets(path);
    return name === 'base.css' ? [path] : [];
  });
}

const candidates = ['docs/coverage', 'frontend/coverage', ...['services', 'packages'].flatMap((group) => readdirSync(join(ROOT, group)).map((name) => `${group}/${name}/coverage`))];
let styled = 0;
for (const relativeDir of candidates) {
  let stylesheets = [];
  try {
    stylesheets = findBaseStylesheets(join(ROOT, relativeDir));
  } catch {
    continue; // package without a generated report
  }
  for (const path of stylesheets) {
    const original = readFileSync(path, 'utf8');
    const start = original.indexOf(START);
    const base = start === -1 ? original : original.slice(0, start).trimEnd();
    writeFileSync(path, `${base}\n${THEME}\n`);
    styled += 1;
  }
}
console.log(`Tema aplicado a ${styled} reportes de coverage.`);
