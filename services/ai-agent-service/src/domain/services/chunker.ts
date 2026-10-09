import { deterministicUuid } from './deterministic-uuid';

export interface RawDocument {
  /** File name, also the stable identifier of the document in the vector store. */
  docId: string;
  title: string;
  version: string;
  content: string;
  contentHash: string;
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  docTitle: string;
  section: string;
  chunkIndex: number;
  /** What is shown and cited. */
  text: string;
  /** What is embedded: the text prefixed with its document and section so a short chunk keeps its topic. */
  embedText: string;
  contentHash: string;
  docVersion: string;
}

export type TokenCounter = (text: string) => number;

export interface ChunkOptions {
  maxTokens: number;
  overlapTokens: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { maxTokens: 200, overlapTokens: 40 };

interface Unit {
  text: string;
  tableHeader?: string;
}

interface Section {
  name: string;
  lines: string[];
}

const METADATA_LINE = /^- \*\*[^*]+:\*\*/;
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;
const TABLE_SEPARATOR = /^\|[\s:|-]+\|?$/;

function parseSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let current: Section = { name: 'Introducción', lines: [] };
  let parent = '';
  let seenSection = false;
  const close = () => {
    if (current.lines.some((line) => line.trim())) sections.push(current);
  };

  for (const line of markdown.split('\n')) {
    if (/^# /.test(line)) continue;
    const heading = /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      close();
      seenSection = true;
      if (heading[1] === '##') parent = heading[2].trim();
      current = { name: heading[1] === '###' && parent ? `${parent} > ${heading[2].trim()}` : heading[2].trim(), lines: [] };
    } else if (seenSection || !METADATA_LINE.test(line)) {
      current.lines.push(line);
    }
  }
  close();
  return sections;
}

function toUnits(lines: string[]): Unit[] {
  const units: Unit[] = [];
  let paragraph: string[] = [];
  let tableHeader: string[] | null = null;
  let lastWasItem = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) units.push({ text: paragraph.join(' ') });
    paragraph = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      tableHeader = null;
      lastWasItem = false;
    } else if (trimmed.startsWith('|')) {
      flushParagraph();
      lastWasItem = false;
      if (tableHeader === null) tableHeader = [trimmed];
      else if (tableHeader.length === 1 && TABLE_SEPARATOR.test(trimmed)) tableHeader.push(trimmed);
      else units.push({ text: trimmed, tableHeader: tableHeader.join('\n') });
    } else if (LIST_ITEM.test(line)) {
      flushParagraph();
      tableHeader = null;
      units.push({ text: trimmed });
      lastWasItem = true;
    } else if (lastWasItem && /^\s/.test(line)) {
      units[units.length - 1].text += ` ${trimmed}`;
    } else {
      tableHeader = null;
      lastWasItem = false;
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  return units;
}

function render(units: Unit[]): string {
  const lines: string[] = [];
  let lastHeader: string | undefined;
  for (const unit of units) {
    if (unit.tableHeader && unit.tableHeader !== lastHeader) lines.push(unit.tableHeader);
    lines.push(unit.text);
    lastHeader = unit.tableHeader;
  }
  return lines.join('\n');
}

const splitSentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/).filter(Boolean);

function splitOversized(unit: Unit, count: TokenCounter, maxTokens: number): Unit[] {
  const pieces: string[] = [];
  let buffer = '';
  const push = (text: string) => {
    if (buffer && count(`${buffer} ${text}`) > maxTokens) {
      pieces.push(buffer);
      buffer = '';
    }
    buffer = buffer ? `${buffer} ${text}` : text;
  };
  for (const sentence of splitSentences(unit.text)) {
    if (count(sentence) <= maxTokens) push(sentence);
    else sentence.split(/\s+/).forEach(push);
  }
  if (buffer) pieces.push(buffer);
  return pieces.map((text) => ({ text, tableHeader: unit.tableHeader }));
}

/** The trailing sentences (or lines) of a chunk that fit the overlap budget, so a rule cut between chunks stays retrievable. */
function overlapTail(units: Unit[], count: TokenCounter, budget: number): Unit | null {
  const last = units[units.length - 1];
  if (budget <= 0 || !last || last.tableHeader) return null;
  const parts = render(units)
    .split('\n')
    .flatMap((line) => splitSentences(line));
  const tail: string[] = [];
  for (let index = parts.length - 1; index >= 0; index--) {
    if (count([parts[index], ...tail].join(' ')) > budget) break;
    tail.unshift(parts[index]);
  }
  return tail.length > 0 ? { text: tail.join(' ') } : null;
}

function packSection(units: Unit[], count: TokenCounter, options: ChunkOptions): string[] {
  const bodies: string[] = [];
  let current: Unit[] = [];
  let hasNewContent = false;

  const flush = () => {
    if (hasNewContent) bodies.push(render(current));
    const tail = hasNewContent ? overlapTail(current, count, options.overlapTokens) : null;
    current = tail ? [tail] : [];
    hasNewContent = false;
  };

  // Pieces of an oversized unit leave room for the overlap; filled to the brim, the tail would never fit.
  const pieceTokens = Math.max(1, options.maxTokens - options.overlapTokens);
  const expanded = units.flatMap((unit) =>
    count(render([unit])) > options.maxTokens ? splitOversized(unit, count, pieceTokens) : [unit],
  );
  for (const unit of expanded) {
    if (current.length > 0 && count(render([...current, unit])) > options.maxTokens) {
      flush();
      if (current.length > 0 && count(render([...current, unit])) > options.maxTokens) current = [];
    }
    current.push(unit);
    hasNewContent = true;
  }
  if (hasNewContent) bodies.push(render(current));
  return bodies;
}

export function chunkDocument(
  doc: RawDocument,
  count: TokenCounter,
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const section of parseSections(doc.content)) {
    for (const body of packSection(toUnits(section.lines), count, options)) {
      const text = body.trim();
      chunks.push({
        id: deterministicUuid(`${doc.docId}#${chunks.length}`),
        docId: doc.docId,
        docTitle: doc.title,
        section: section.name,
        chunkIndex: chunks.length,
        text,
        embedText: `${doc.title} > ${section.name}\n${text}`,
        contentHash: doc.contentHash,
        docVersion: doc.version,
      });
    }
  }
  return chunks;
}
