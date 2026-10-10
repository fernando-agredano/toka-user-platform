import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { CHART_BUILDERS } from './charts.mjs';
import { escapeHtml, renderMarkdown } from './markdown.mjs';
import { ANNEX, META, ROOT, SECTIONS, extractReadmeSections, readSource } from './sources.mjs';

const require = createRequire(import.meta.url);
const CHART_PLACEHOLDER = /<p>\{\{chart:(\w+)\}\}<\/p>/g;
const STACK_DOT_COLORS = ['#E0234E', '#38BDF8', '#60A5FA', '#34D399', '#F87171', '#FB923C', '#F472B6', '#A78BFA', '#2563EB'];

/* ---------- Content loading ---------- */

function insertChartPlaceholders(markdown, charts = []) {
  return charts.reduce((result, { name, before }) => {
    if (!before) return `${result}\n\n{{chart:${name}}}\n`;
    const index = result.indexOf(`\n## ${before}`);
    if (index === -1) throw new Error(`Heading "${before}" not found to place chart "${name}"`);
    return `${result.slice(0, index)}\n\n{{chart:${name}}}\n${result.slice(index)}`;
  }, markdown);
}

function loadSection(section, number, metrics) {
  const markdown = insertChartPlaceholders(readSource(section.file), section.charts);
  const { html, toc } = renderMarkdown(markdown, {
    label: number,
    baseDir: join(ROOT, dirname(section.file)),
    keepNumbers: section.keepNumbers,
  });
  const withCharts = html.replace(CHART_PLACEHOLDER, (_, name) => CHART_BUILDERS[name](metrics));
  return { ...section, number, html: withCharts, toc };
}

function loadAnnex() {
  const { html, toc } = renderMarkdown(extractReadmeSections(ANNEX.readmeHeadings), {
    label: ANNEX.label,
    baseDir: ROOT,
    dropFirstH1: false,
  });
  return { ...ANNEX, number: ANNEX.label, html, toc };
}

export function loadDocument(metrics) {
  const sections = SECTIONS.map((section, index) => loadSection(section, String(index + 1), metrics));
  return { sections: [...sections, loadAnnex()], metrics };
}

/* ---------- Table of contents ---------- */

const separatorEyebrow = (section) => {
  if (section.key === 'anexo') return `Anexo ${section.number}`;
  const eyebrow = `Sección ${section.number.padStart(2, '0')}`;
  return section.extra ? `${eyebrow} · Módulo extra` : eyebrow;
};

/** Flat list of entries; `searchText` is what the PDF analysis looks for to find each entry's page. */
export function buildTocEntries(sections) {
  return [
    { id: 'resumen', level: 0, number: '', text: 'Resumen ejecutivo', searchText: 'Resumen ejecutivo' },
    ...sections.flatMap((section) => [
      { id: `sec-${section.key}`, level: 0, number: section.number, text: section.title, searchText: separatorEyebrow(section) },
      ...section.toc.map((heading) => ({
        id: heading.id,
        level: 1,
        number: heading.number,
        text: heading.text,
        searchText: `${heading.number}${heading.text}`,
      })),
    ]),
  ];
}

function tocHtml(entries, pages) {
  const rows = entries
    .map(
      (entry) => `<li class="toc-row level${entry.level}"><span>${entry.number ? `<span class="num">${entry.number}</span>` : ''}${escapeHtml(entry.text)}</span><span class="toc-leader"></span><span class="toc-page-no">${pages?.get(entry.id) ?? '00'}</span></li>`,
    )
    .join('');
  return `<section class="toc-page"><span class="eyebrow">Contenido</span><h1 class="page-title">Índice</h1><ol class="toc">${rows}</ol><span class="hidden-marker">ZZTOCENDZZ</span></section>`;
}

/* ---------- Cover, summary, separators ---------- */

const coverBackground = `
<svg class="cover-bg" viewBox="0 0 816 1056" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0F2747"/><stop offset="0.6" stop-color="#0C2142"/><stop offset="1" stop-color="#081529"/>
    </linearGradient>
    <radialGradient id="glowBlue" cx="85%" cy="12%" r="65%">
      <stop offset="0" stop-color="#2563EB" stop-opacity="0.42"/><stop offset="1" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowTeal" cx="8%" cy="96%" r="55%">
      <stop offset="0" stop-color="#14B8A6" stop-opacity="0.26"/><stop offset="1" stop-color="#14B8A6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.3" fill="#fff" fill-opacity="0.2"/></pattern>
  </defs>
  <rect width="816" height="1056" fill="url(#bg)"/>
  <rect width="816" height="1056" fill="url(#glowBlue)"/>
  <rect width="816" height="1056" fill="url(#glowTeal)"/>
  <rect x="60" y="60" width="220" height="132" fill="url(#dots)"/>
  <g fill="none" stroke="#2563EB" stroke-opacity="0.38" stroke-width="1.5">
    <circle cx="700" cy="150" r="270"/><circle cx="700" cy="150" r="200"/><circle cx="700" cy="150" r="130"/>
  </g>
  <g stroke="#93C5FD" stroke-opacity="0.16" stroke-width="1.2">
    <line x1="430" y1="1056" x2="816" y2="670"/><line x1="500" y1="1056" x2="816" y2="740"/><line x1="570" y1="1056" x2="816" y2="810"/>
  </g>
  <polygon points="816,430 816,760 520,760" fill="#14B8A6" fill-opacity="0.12"/>
  <rect x="560" y="610" width="150" height="150" rx="20" transform="rotate(24 635 685)" fill="#2563EB" fill-opacity="0.16"/>
  <polygon points="96,640 136,617 176,640 176,686 136,709 96,686" fill="none" stroke="#14B8A6" stroke-opacity="0.55" stroke-width="2"/>
  <polygon points="44,742 74,725 104,742 104,776 74,793 44,776" fill="#14B8A6" fill-opacity="0.18"/>
</svg>`;

const coverHtml = `<section class="cover">${coverBackground}
  <div class="cover-content">
    <div class="cover-bar"></div>
    <div class="cover-kicker">Documentación técnica</div>
    <h1>${escapeHtml(META.title)}</h1>
    <div class="cover-subtitle">${escapeHtml(META.subtitle)}</div>
  </div>
  <div class="cover-meta">
    <div class="cover-author">${escapeHtml(META.author)}</div>
    <div class="cover-date">${escapeHtml(META.date)}</div>
  </div>
  <div class="stack-strip">${META.stack
    .map((name, index) => `<span class="stack-chip"><i style="background:${STACK_DOT_COLORS[index % STACK_DOT_COLORS.length]}"></i>${name}</span>`)
    .join('')}</div>
</section>`;

const kpiCard = (value, label, accent = false) =>
  `<div class="kpi-card${accent ? ' accent' : ''}"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>`;

function summaryHtml({ kpis, aggregate, coverage }) {
  const cards = [
    kpiCard(kpis.services, 'Microservicios'),
    kpiCard(`${kpis.averageLineCoverage.toFixed(1)}%`, 'Cobertura media (líneas)', true),
    kpiCard(kpis.totalTests, 'Tests automatizados'),
    kpiCard(kpis.endpoints, 'Endpoints HTTP', true),
    kpiCard(kpis.events, 'Tipos de evento'),
    kpiCard(`${kpis.p95LatencyMs} ms`, 'Latencia p95 IA*', true),
    kpiCard(`US$${kpis.costPerQueryUsd.toFixed(2)}`, 'Costo por consulta IA*'),
  ].join('');

  return `<section class="summary" id="resumen">
<span class="eyebrow">Visión general</span>
<h1>Resumen ejecutivo</h1>

<h2>El problema</h2>
<p>Toka necesita una plataforma para gestionar usuarios, roles y permisos con trazabilidad completa de lo que ocurre en ella, y un asistente de IA que responda sobre las políticas y los datos del sistema <strong>sin dar nunca más acceso del que tiene quien pregunta</strong>. Todo debe seguir funcionando de forma degradada, y no caerse, cuando un servicio o el proveedor de LLM fallan.</p>

<h2>Arquitectura en cinco puntos</h2>
<ol class="five-points">
<li><strong>Cinco microservicios por bounded context</strong> (auth, user, role, audit y ai-agent), cada uno con su propia base de datos, detrás de un único gateway nginx.</li>
<li><strong>Clean Architecture y DDD</strong> en cada servicio: el dominio no conoce NestJS ni Prisma y los casos de uso se prueban con repositorios en memoria.</li>
<li><strong>Identidad distribuida:</strong> JWT RS256 firmado por auth y validado por cada servicio con JWKS en caché, sin llamar a auth en cada petición; el logout se resuelve con una blacklist de <code>jti</code> en Redis.</li>
<li><strong>Consistencia por eventos:</strong> RabbitMQ con Transactional Outbox, consumidores idempotentes y DLQ; audit-service es el lado de lectura de un CQRS ligero.</li>
<li><strong>Agente RAG que actúa como el usuario:</strong> recupera de Qdrant con embeddings locales y llama a las demás APIs con el JWT de quien pregunta; limita el uso en tres capas y degrada a fragmentos citados cuando el LLM no responde.</li>
</ol>

<h2>Stack</h2>
<div class="stack-grid">
<div><b>Backend</b>Node.js 22, TypeScript estricto, NestJS 10</div>
<div><b>Frontend</b>React 18, Vite, RTK Query, Tailwind</div>
<div><b>Datos</b>PostgreSQL 16 (Prisma), MongoDB 7, Redis 7</div>
<div><b>Mensajería</b>RabbitMQ 3.13, exchange topic y DLX</div>
<div><b>IA</b>Qdrant, embeddings locales, Gemini 2.5 Flash-Lite</div>
<div><b>Calidad</b>Jest, React Testing Library, MSW</div>
</div>

<h2>Indicadores clave</h2>
<div class="kpi-row">${cards}</div>
<p class="kpi-note">Cobertura: media de líneas de ${coverage.length} paquetes (servicios, <code>@toka/common</code> y frontend); el umbral de 70% de los servicios mide dominio y aplicación. Endpoints: rutas de los controladores de los cinco servicios; eventos: catálogo de la sección 1. <strong>Módulo extra</strong>, fuera de los requisitos: un servidor MCP (sección 8) expone la plataforma a Claude Desktop, Claude Code y Cursor con los permisos del usuario; sus tests y cobertura figuran en los indicadores, pero el conteo de microservicios solo incluye los cinco de la prueba.</p>
<aside class="callout warning"><span class="callout-label">Advertencia</span><p>* Medido con el proveedor <strong>${escapeHtml(kpis.llmProvider)}</strong> sobre ${aggregate.requests} consultas, no con Gemini real: el costo es cero por construcción y la latencia no incluye la del modelo.</p></aside>
</section>`;
}

const separatorArt = `<svg class="sep-art" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <g fill="none" stroke="#2563EB" stroke-opacity="0.35" stroke-width="1.5"><circle cx="190" cy="190" r="120"/><circle cx="190" cy="190" r="80"/></g>
  <polygon points="300,120 300,300 120,300" fill="#14B8A6" fill-opacity="0.14"/>
  <rect x="150" y="150" width="70" height="70" rx="10" transform="rotate(20 185 185)" fill="#2563EB" fill-opacity="0.12"/>
</svg>`;

const separatorHtml = (section) => `<section class="separator" id="sec-${section.key}">
${separatorArt}
<span class="eyebrow">${separatorEyebrow(section)}</span>
<div class="sep-number">${section.key === 'anexo' ? section.number : section.number.padStart(2, '0')}</div>
<h1>${escapeHtml(section.title)}</h1>
<p>${escapeHtml(section.description)}</p>
</section>`;

/* ---------- Final document ---------- */

const fontFaces = () =>
  [400, 500, 600, 700, 800]
    .map((weight) => {
      const file = require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff2`);
      return `@font-face{font-family:'Inter';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format('woff2');}`;
    })
    .join('\n');

const stylesheet = () =>
  [
    fontFaces(),
    readFileSync(require.resolve('highlight.js/styles/github.css'), 'utf8'),
    readFileSync(new URL('./styles.css', import.meta.url), 'utf8'),
    '.hljs{background:transparent!important}',
  ].join('\n');

/** Replaces the figure placeholders in document order so numbering follows reading order. */
const numberFigures = (html) => {
  let figure = 0;
  return html.replace(/@@FIG@@/g, () => String(++figure));
};

export function renderDocument({ sections, metrics }, tocEntries, pages) {
  const body = [
    coverHtml,
    tocHtml(tocEntries, pages),
    summaryHtml(metrics),
    ...sections.map((section) => `${separatorHtml(section)}<section class="content">${section.html}</section>`),
  ].join('\n');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(META.title)}</title><style>${stylesheet()}</style></head><body>${numberFigures(body)}</body></html>`;
}
