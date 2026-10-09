import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readSource } from './sources.mjs';

// Event types published on the `toka.events` exchange (CONTEXTO.md §6).
const EVENT_TYPES = [
  'auth.user.registered',
  'auth.login.succeeded',
  'auth.login.failed',
  'auth.login.locked',
  'user.created',
  'user.updated',
  'user.activated',
  'user.deactivated',
  'role.assigned',
  'role.revoked',
  'role.created',
  'role.permissions.updated',
  'ai.query.completed',
];

const sectionBetween = (markdown, startHeading, endMarker = '\n## ') => {
  const start = markdown.indexOf(startHeading);
  if (start === -1) throw new Error(`Heading not found: ${startHeading}`);
  const rest = markdown.slice(start + startHeading.length);
  const end = rest.indexOf(endMarker);
  return end === -1 ? rest : rest.slice(0, end);
};

const firstNumber = (text, pattern, label) => {
  const match = text.match(pattern);
  if (!match) throw new Error(`Could not find ${label} in docs/05-ejemplos.md`);
  return Number(match[1]);
};

function parseCoverage() {
  const table = sectionBetween(readSource('docs/coverage.md'), '## Cobertura oficial');
  return table
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => /^\d+$/.test(cells[1]))
    .map(([name, tests, statements, branches, functions, lines]) => ({
      name: name.replace(/`/g, '').replace(/\s*\(.*\)$/, ''),
      tests: Number(tests),
      statements: parseFloat(statements),
      branches: parseFloat(branches),
      functions: parseFloat(functions),
      lines: parseFloat(lines),
    }));
}

function parseExamples() {
  const markdown = readSource('docs/05-ejemplos.md');
  const headings = [...markdown.matchAll(/^## (\d+)\. (.+)$/gm)];
  const examples = headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? markdown.indexOf('\n## Evidencia');
    const chunk = markdown.slice(heading.index, end);
    const title = heading[2];
    return {
      title,
      label: title.match(/\((.+)\)/)?.[1] ?? title,
      latencyMs: firstNumber(chunk, /"latencyMs":\s*(\d+)/, 'latencyMs'),
      inputTokens: firstNumber(chunk, /"inputTokens":\s*(\d+)/, 'inputTokens'),
      outputTokens: firstNumber(chunk, /"outputTokens":\s*(\d+)/, 'outputTokens'),
      costUsd: firstNumber(chunk, /"costUsd":\s*([\d.]+)/, 'costUsd'),
      provider: chunk.match(/"provider":\s*"(\w+)"/)?.[1] ?? 'desconocido',
    };
  });

  const aggregate = markdown.slice(markdown.indexOf('### Métricas agregadas'));
  return {
    examples,
    aggregate: {
      requests: firstNumber(aggregate, /"requests":\s*(\d+)/, 'requests'),
      p50Ms: firstNumber(aggregate, /"p50":\s*(\d+)/, 'p50'),
      p95Ms: firstNumber(aggregate, /"p95":\s*(\d+)/, 'p95'),
      totalCostUsd: firstNumber(aggregate, /"total":\s*([\d.]+)/, 'costUsd.total'),
    },
  };
}

const countEndpoints = () =>
  (readSource('CONTEXTO.md').match(/^\| (GET|POST|PUT|PATCH|DELETE) \|/gm) ?? []).length;

const countServices = () =>
  readdirSync(join(ROOT, 'services'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;

export function loadMetrics() {
  const coverage = parseCoverage();
  const { examples, aggregate } = parseExamples();
  const average = (metric) => coverage.reduce((sum, row) => sum + row[metric], 0) / coverage.length;

  return {
    coverage,
    examples,
    aggregate,
    kpis: {
      services: countServices(),
      averageLineCoverage: average('lines'),
      totalTests: coverage.reduce((sum, row) => sum + row.tests, 0),
      endpoints: countEndpoints(),
      events: EVENT_TYPES.length,
      p95LatencyMs: aggregate.p95Ms,
      costPerQueryUsd: aggregate.requests ? aggregate.totalCostUsd / aggregate.requests : 0,
      llmProvider: examples[0]?.provider ?? 'desconocido',
    },
  };
}
