import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb } from 'pdf-lib';
import { chromium } from 'playwright';
import { META } from './sources.mjs';

const require = createRequire(import.meta.url);
const SEARCH_KEY_LENGTH = 60;
const TOC_END_MARKER = 'zztocendzz';
const MM = 72 / 25.4;
const MARGIN = 20 * MM;

const MERMAID_THEME = {
  primaryColor: '#EAF1FF',
  primaryBorderColor: '#2563EB',
  primaryTextColor: '#0F2747',
  secondaryColor: '#E6FAF7',
  secondaryBorderColor: '#14B8A6',
  tertiaryColor: '#F1F5F9',
  lineColor: '#475569',
  textColor: '#0F2747',
  noteBkgColor: '#FFFBEB',
  noteBorderColor: '#F59E0B',
  actorBkg: '#0F2747',
  actorTextColor: '#FFFFFF',
  actorBorder: '#0F2747',
  signalColor: '#475569',
  fontSize: '14px',
};

/* ---------- Rendering with Chromium ---------- */

export async function renderPdf(html, workDir) {
  const htmlPath = join(workDir, 'documentacion.html');
  writeFileSync(htmlPath, html);

  const browser = await chromium.launch();
  try {
    // Same width as the printed content area so text wraps, and is measured, as it will be in the PDF.
    const page = await browser.newPage({ viewport: { width: 665, height: 900 } });
    page.on('pageerror', (error) => console.warn(`  [browser] ${error.message}`));
    await page.goto(`file://${htmlPath}`);
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ path: require.resolve('mermaid/dist/mermaid.min.js') });
    await page.evaluate(
      async ({ themeVariables, wideScaleLimit, landscapeContentHeight, maxPortraitWidth, maxPortraitHeight, splitAbovePx }) => {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables,
          securityLevel: 'loose',
          fontFamily: 'Inter, sans-serif',
          flowchart: { nodeSpacing: 15, rankSpacing: 25 },
        });
        const effectiveScale = (svg) => {
          const [, , width, height] = svg.match(/viewBox="([\d.\-\s]+)"/)[1].trim().split(/\s+/).map(Number);
          return Math.min(maxPortraitWidth / width, maxPortraitHeight / height);
        };
        const isHeading = (element) => /^H[2-5]$/.test(element.tagName);

        // A diagram too wide for the portrait page gets its own landscape page, together with the
        // content that precedes it in its section (or only its heading if that is long).
        const moveToLandscapePage = (figure) => {
          const section = figure.parentElement;
          const preceding = [];
          for (let element = figure.previousElementSibling; element; element = element.previousElementSibling) preceding.unshift(element);
          const height = preceding.reduce((sum, element) => sum + element.getBoundingClientRect().height, 0);
          const lastHeading = preceding.map(isHeading).lastIndexOf(true);
          const moved = height <= 220 ? preceding : lastHeading === -1 ? [] : preceding.slice(lastHeading);
          const wrapper = document.createElement('div');
          wrapper.className = 'wide-page';
          section.insertBefore(wrapper, moved[0] ?? figure);
          moved.forEach((element) => wrapper.appendChild(element));
          wrapper.appendChild(figure);
          const used = moved.reduce((sum, element) => sum + element.getBoundingClientRect().height, 0);
          figure.querySelector('svg').style.maxHeight = `${landscapeContentHeight - used - 48}px`;
        };

        let counter = 0;
        for (const node of document.querySelectorAll('pre.mermaid')) {
          const source = node.textContent;
          const candidates = /^\s*(flowchart|graph)\s+LR\b/.test(source) ? [source, source.replace(/(flowchart|graph)\s+LR\b/, '$1 TB')] : [source];
          const rendered = [];
          for (const code of candidates) {
            const { svg } = await window.mermaid.render(`mermaid-${counter++}`, code);
            rendered.push({ svg, scale: effectiveScale(svg) });
          }
          const best = rendered.reduce((a, b) => (b.scale > a.scale ? b : a));
          const figure = node.closest('figure');
          node.outerHTML = `<div class="mermaid-output">${best.svg}</div>`;
          if (best.scale < wideScaleLimit) moveToLandscapePage(figure);
        }

        // Small tables and code blocks never split; tall ones may, so they cannot leave a page nearly empty.
        for (const element of document.querySelectorAll('table, .code-block')) {
          if (element.getBoundingClientRect().height > splitAbovePx) element.classList.add('splittable');
        }
      },
      { themeVariables: MERMAID_THEME, wideScaleLimit: 0.45, landscapeContentHeight: 665, maxPortraitWidth: 665, maxPortraitHeight: 775, splitAbovePx: 0.35 * 905 },
    );
    await page.emulateMedia({ media: 'print' });
    return await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}

/* ---------- Locating headings in the rendered PDF ---------- */

const normalize = (value) => value.normalize('NFC').toLowerCase().replace(/\s+/g, '');

export async function extractPageTexts(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), verbosity: 0 }).promise;
  const texts = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    texts.push(normalize(content.items.map((item) => item.str).join('')));
  }
  return texts;
}

/** Finds each entry's page by searching in reading order, starting after the table of contents. */
export function locateEntries(pageTexts, entries) {
  const tocEndIndex = pageTexts.findIndex((text) => text.includes(TOC_END_MARKER));
  if (tocEndIndex === -1) throw new Error('Table of contents end marker not found in the PDF');

  const pages = new Map();
  let cursor = tocEndIndex + 1;
  for (const entry of entries) {
    const key = normalize(entry.searchText).slice(0, SEARCH_KEY_LENGTH);
    const found = pageTexts.findIndex((text, index) => index >= cursor && text.includes(key));
    if (found === -1) throw new Error(`Entry not found in PDF: "${entry.searchText}"`);
    pages.set(entry.id, found + 1);
    cursor = found;
  }
  return { pages, tocEndPage: tocEndIndex + 1 };
}

/* ---------- Headers and footers ---------- */

const sectionLabel = (entry) => (entry.number ? `${entry.number}. ${entry.text}` : entry.text);

/** Section shown in each page header, derived from where each level-0 entry starts. */
function headerLabels(pageCount, entries, pages, tocEndPage) {
  const starts = entries.filter((entry) => entry.level === 0).map((entry) => ({ page: pages.get(entry.id), label: sectionLabel(entry) }));
  return Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    if (page <= tocEndPage) return 'Índice';
    return [...starts].reverse().find((start) => start.page <= page)?.label ?? '';
  });
}

export async function stampHeadersAndFooters(pdfBuffer, labels) {
  const pdf = await PDFDocument.load(pdfBuffer);
  pdf.registerFontkit(fontkit);
  const embed = (weight) => pdf.embedFont(readFileSync(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`)), { subset: true });
  const [regular, semibold] = await Promise.all([embed(400), embed(600)]);
  const navy = rgb(0.059, 0.153, 0.278);
  const slate = rgb(0.278, 0.333, 0.412);
  const rule = rgb(0.796, 0.835, 0.882);
  const total = pdf.getPageCount();

  pdf.getPages().forEach((page, index) => {
    if (index === 0) return; // the cover carries no header or footer
    const { width, height } = page.getSize();
    const right = width - MARGIN;
    const size = 7.6;
    const draw = (text, x, y, font, color, alignRight = false) =>
      page.drawText(text, { x: alignRight ? x - font.widthOfTextAtSize(text, size) : x, y, size, font, color });

    draw(META.title, MARGIN, height - 36, semibold, navy);
    draw(labels[index], right, height - 36, regular, slate, true);
    page.drawLine({ start: { x: MARGIN, y: height - 43 }, end: { x: right, y: height - 43 }, thickness: 0.6, color: rule });

    page.drawLine({ start: { x: MARGIN, y: 44 }, end: { x: right, y: 44 }, thickness: 0.6, color: rule });
    draw(META.author, MARGIN, 30, regular, slate);
    draw(`Página ${index + 1} de ${total}`, right, 30, semibold, navy, true);
  });
  return Buffer.from(await pdf.save());
}

export const addHeadersAndFooters = (pdfBuffer, pageCount, entries, location) =>
  stampHeadersAndFooters(pdfBuffer, headerLabels(pageCount, entries, location.pages, location.tocEndPage));

/* ---------- Page screenshots (macOS Quick Look) ---------- */

export async function exportPagePngs(pdfBuffer, pageNumbers, outDir) {
  mkdirSync(outDir, { recursive: true });
  const source = await PDFDocument.load(pdfBuffer);
  const written = [];
  for (const pageNumber of pageNumbers) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [pageNumber - 1]);
    single.addPage(copied);
    const pdfPath = join(outDir, `page-${pageNumber}.pdf`);
    writeFileSync(pdfPath, await single.save());
    execFileSync('qlmanage', ['-t', '-s', '1500', '-o', outDir, pdfPath], { stdio: 'ignore' });
    written.push(`${pdfPath}.png`);
  }
  return written;
}
