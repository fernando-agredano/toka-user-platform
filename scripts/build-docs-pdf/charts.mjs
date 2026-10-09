const COLORS = {
  navy: '#0F2747',
  blue: '#2563EB',
  teal: '#14B8A6',
  amber: '#F59E0B',
  slate: '#475569',
  grid: '#E2E8F0',
  block: '#F1F5F9',
};
const DONUT_COLORS = [COLORS.navy, COLORS.blue, COLORS.teal, COLORS.amber, COLORS.slate, '#60A5FA', '#0D9488'];
const FONT = `font-family="Inter, sans-serif"`;

const text = (x, y, content, { size = 9, weight = 400, fill = COLORS.slate, anchor = 'start', halo = false } = {}) =>
  `<text x="${x}" y="${y}" ${FONT} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${halo ? ' stroke="#fff" stroke-width="3" paint-order="stroke"' : ''}>${content}</text>`;

const figure = (svg, caption, extraClass = '') =>
  `<figure class="figure chart ${extraClass}">${svg}<figcaption>Figura @@FIG@@. ${caption}</figcaption></figure>`;

const percent = (value) => `${value.toFixed(1)}%`;

export function coverageChart(coverage) {
  const metrics = [
    { key: 'lines', label: 'Lines', color: COLORS.navy },
    { key: 'branches', label: 'Branches', color: COLORS.blue },
    { key: 'functions', label: 'Functions', color: COLORS.teal },
  ];
  const width = 680;
  const plotLeft = 150;
  const plotWidth = 470;
  const top = 46;
  const barHeight = 11;
  const barGap = 3;
  const groupHeight = metrics.length * (barHeight + barGap) + 12;
  const height = top + coverage.length * groupHeight + 34;
  const xFor = (value) => plotLeft + (plotWidth * value) / 100;

  const gridlines = [0, 20, 40, 60, 80, 100]
    .map(
      (tick) =>
        `<line x1="${xFor(tick)}" y1="${top - 6}" x2="${xFor(tick)}" y2="${height - 28}" stroke="${COLORS.grid}" stroke-width="1"/>` +
        text(xFor(tick), height - 14, `${tick}%`, { size: 8, anchor: 'middle' }),
    )
    .join('');

  const groups = coverage
    .map((row, index) => {
      const y0 = top + index * groupHeight;
      const bars = metrics
        .map((metric, metricIndex) => {
          const y = y0 + metricIndex * (barHeight + barGap);
          const value = row[metric.key];
          return (
            `<rect x="${plotLeft}" y="${y}" width="${(plotWidth * value) / 100}" height="${barHeight}" rx="2.5" fill="${metric.color}"/>` +
            text(xFor(value) + 5, y + 9, percent(value), { size: 8, weight: 600, fill: COLORS.navy, halo: true })
          );
        })
        .join('');
      const labelY = y0 + (metrics.length * (barHeight + barGap)) / 2 + 2;
      return text(plotLeft - 10, labelY, row.name, { size: 9.5, weight: 600, fill: COLORS.navy, anchor: 'end' }) + bars;
    })
    .join('');

  const legend = metrics
    .map(
      (metric, index) =>
        `<rect x="${plotLeft + index * 90}" y="10" width="10" height="10" rx="2" fill="${metric.color}"/>` +
        text(plotLeft + index * 90 + 15, 19, metric.label, { size: 9 }),
    )
    .join('');

  const threshold =
    `<line x1="${xFor(70)}" y1="${top - 10}" x2="${xFor(70)}" y2="${height - 28}" stroke="${COLORS.amber}" stroke-width="1.8" stroke-dasharray="5 3"/>` +
    text(xFor(70) + 5, 24, 'Umbral 70%', { size: 8.5, weight: 700, fill: '#B45309' });

  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Cobertura por paquete">${gridlines}${threshold}${groups}${legend}</svg>`;
  return figure(
    svg,
    'Cobertura por paquete (lines, branches, functions) con el umbral de 70%. El frontend no tiene umbral configurado.',
  );
}

export function latencyChart({ examples, aggregate }) {
  const width = 680;
  const height = 330;
  const plotLeft = 70;
  const plotRight = 560;
  const plotTop = 52;
  const plotBottom = 232;
  const maxValue = Math.ceil(Math.max(aggregate.p95Ms, ...examples.map((e) => e.latencyMs)) / 50) * 50 + 50;
  const yFor = (value) => plotBottom - ((plotBottom - plotTop) * value) / maxValue;
  const slot = (plotRight - plotLeft) / examples.length;
  const barWidth = Math.min(96, slot * 0.5);

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((maxValue / 4) * i))
    .map(
      (tick) =>
        `<line x1="${plotLeft}" y1="${yFor(tick)}" x2="${plotRight}" y2="${yFor(tick)}" stroke="${COLORS.grid}"/>` +
        text(plotLeft - 8, yFor(tick) + 3, `${tick}`, { size: 8, anchor: 'end' }),
    )
    .join('');

  const bars = examples
    .map((example, index) => {
      const centerX = plotLeft + slot * index + slot / 2;
      const barTop = yFor(example.latencyMs);
      return (
        `<rect x="${centerX - barWidth / 2}" y="${barTop}" width="${barWidth}" height="${plotBottom - barTop}" rx="4" fill="${COLORS.blue}"/>` +
        text(centerX, barTop + 17, `${example.latencyMs} ms`, { size: 10.5, weight: 700, fill: '#fff', anchor: 'middle' }) +
        text(centerX, plotBottom + 18, example.label, { size: 9.5, weight: 600, fill: COLORS.navy, anchor: 'middle' }) +
        text(centerX, plotBottom + 36, `Costo: US$${example.costUsd.toFixed(4)}`, { size: 9, weight: 700, fill: '#0D9488', anchor: 'middle' }) +
        text(centerX, plotBottom + 50, `${example.inputTokens.toLocaleString('en-US')} in · ${example.outputTokens} out tokens`, {
          size: 8,
          anchor: 'middle',
        })
      );
    })
    .join('');

  const reference = (value, label, color) =>
    `<line x1="${plotLeft}" y1="${yFor(value)}" x2="${plotRight}" y2="${yFor(value)}" stroke="${color}" stroke-width="1.6" stroke-dasharray="6 4"/>` +
    text(plotRight + 8, yFor(value) + 3, label, { size: 8.5, weight: 700, fill: color });

  const title =
    text(plotLeft, 22, 'Latencia por consulta (ms)', { size: 11, weight: 700, fill: COLORS.navy }) +
    text(plotLeft, 36, `Proveedor: ${examples[0]?.provider ?? 'n/d'} · referencias sobre ${aggregate.requests} consultas registradas`, { size: 8.5 });

  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Latencia y costo por consulta">${title}${ticks}${bars}${reference(aggregate.p95Ms, `p95 global: ${aggregate.p95Ms} ms`, '#B45309')}${reference(aggregate.p50Ms, `p50 global: ${aggregate.p50Ms} ms`, COLORS.teal)}</svg>`;
  return figure(
    svg,
    'Latencia y costo por consulta del agente IA en los tres ejemplos documentados. El costo es cero porque el proveedor fue el mock, no Gemini.',
  );
}

export function testsDonutChart(coverage) {
  const total = coverage.reduce((sum, row) => sum + row.tests, 0);
  const width = 680;
  const height = 290;
  const centerX = 170;
  const centerY = 145;
  const radius = 92;
  const strokeWidth = 40;
  const circumference = 2 * Math.PI * radius;

  const ordered = [...coverage].sort((a, b) => b.tests - a.tests);
  let offset = 0;
  const slices = ordered
    .map((row, index) => {
      const length = (row.tests / total) * circumference;
      const slice = `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${DONUT_COLORS[index % DONUT_COLORS.length]}" stroke-width="${strokeWidth}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${centerX} ${centerY})"/>`;
      offset += length;
      return slice;
    })
    .join('');

  const legend = ordered
    .map((row, index) => {
      const y = 62 + index * 28;
      return (
        `<rect x="360" y="${y - 10}" width="12" height="12" rx="3" fill="${DONUT_COLORS[index % DONUT_COLORS.length]}"/>` +
        text(381, y, row.name, { size: 10.5, weight: 600, fill: COLORS.navy }) +
        text(620, y, `${row.tests}`, { size: 10.5, weight: 700, fill: COLORS.navy, anchor: 'end' }) +
        text(660, y, `${((row.tests / total) * 100).toFixed(1)}%`, { size: 9.5, anchor: 'end' })
      );
    })
    .join('');

  const center =
    text(centerX, centerY + 4, `${total}`, { size: 28, weight: 800, fill: COLORS.navy, anchor: 'middle' }) +
    text(centerX, centerY + 22, 'tests', { size: 10, anchor: 'middle' });

  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distribución de tests por paquete">${slices}${center}${legend}</svg>`;
  return figure(svg, 'Distribución de tests por paquete.');
}

export const CHART_BUILDERS = {
  coverage: ({ coverage }) => coverageChart(coverage),
  latency: ({ examples, aggregate }) => latencyChart({ examples, aggregate }),
  tests: ({ coverage }) => testsDonutChart(coverage),
};
