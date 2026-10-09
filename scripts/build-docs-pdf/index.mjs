import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMetrics } from './data.mjs';
import { buildTocEntries, loadDocument, renderDocument } from './layout.mjs';
import { addHeadersAndFooters, exportPagePngs, extractPageTexts, locateEntries, renderPdf } from './pdf.mjs';
import { OUTPUT_PDF } from './sources.mjs';

const MAX_LAYOUT_PASSES = 4;
const SPARSE_PAGE_CHARACTERS = 450;

const option = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const samePages = (a, b) => a && b && [...a].every(([id, page]) => b.get(id) === page);

/** The table of contents needs real page numbers, so render until they stop moving. */
async function renderWithStablePageNumbers(document, entries, workDir) {
  let pages = null;
  for (let pass = 1; pass <= MAX_LAYOUT_PASSES; pass++) {
    const pdf = await renderPdf(renderDocument(document, entries, pages), workDir);
    const texts = await extractPageTexts(pdf);
    const location = locateEntries(texts, entries);
    console.log(`  pass ${pass}: ${texts.length} pages`);
    if (samePages(pages, location.pages)) return { pdf, texts, location };
    pages = location.pages;
  }
  throw new Error(`Page numbers did not stabilize after ${MAX_LAYOUT_PASSES} passes`);
}

function reportLayout(texts, entries, location) {
  const separatorPages = new Set(entries.filter((entry) => entry.level === 0 && entry.number).map((entry) => location.pages.get(entry.id)));
  const sparse = texts
    .map((text, index) => ({ page: index + 1, characters: text.length }))
    .filter(({ page, characters }) => page > 1 && !separatorPages.has(page) && characters < SPARSE_PAGE_CHARACTERS);
  const figures = texts.flatMap((text, index) => [...text.matchAll(/figura(\d+)\./g)].map((match) => `Figura ${match[1]} → p.${index + 1}`));

  console.log(`  sections: ${entries.filter((e) => e.level === 0).map((e) => `${e.number || 'R'}@${location.pages.get(e.id)}`).join(' ')}`);
  console.log(`  figures: ${figures.join(', ')}`);
  console.log(sparse.length ? `  WARNING sparse pages: ${sparse.map((s) => `p.${s.page} (${s.characters} chars)`).join(', ')}` : '  no sparse pages');
}

async function main() {
  const workDir = mkdtempSync(join(tmpdir(), 'toka-docs-pdf-'));
  try {
    console.log('Loading documentation…');
    const document = loadDocument(loadMetrics());
    const entries = buildTocEntries(document.sections);

    console.log('Rendering PDF…');
    const { pdf, texts, location } = await renderWithStablePageNumbers(document, entries, workDir);
    reportLayout(texts, entries, location);

    const finalPdf = await addHeadersAndFooters(pdf, texts.length, entries, location);
    writeFileSync(OUTPUT_PDF, finalPdf);
    console.log(`Written ${OUTPUT_PDF} (${texts.length} pages, ${(finalPdf.length / 1024).toFixed(0)} KB)`);

    const shots = option('shots');
    if (shots) {
      const files = await exportPagePngs(finalPdf, shots.split(',').map(Number), option('shots-dir') ?? workDir);
      console.log(`Screenshots:\n${files.join('\n')}`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
