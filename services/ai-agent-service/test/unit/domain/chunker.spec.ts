import { chunkDocument, type RawDocument } from '../../../src/domain/services/chunker';
import { deterministicUuid } from '../../../src/domain/services/deterministic-uuid';
import { estimateWordpieces } from '../../../src/domain/services/text';

const doc = (content: string): RawDocument => ({
  docId: 'policy.md',
  title: 'Policy',
  version: '1.0',
  content,
  contentHash: 'hash-1',
});

const options = { maxTokens: 30, overlapTokens: 12 };

describe('chunkDocument', () => {
  it('creates one chunk per short section, prefixed with its document and section', () => {
    const chunks = chunkDocument(
      doc('# Policy\n\n- **Versión:** 1.0\n\n## Alpha\nFirst section text.\n\n## Beta\nSecond section text.'),
      estimateWordpieces,
      options,
    );
    expect(chunks.map((chunk) => chunk.section)).toEqual(['Alpha', 'Beta']);
    expect(chunks[0].embedText).toBe('Policy > Alpha\nFirst section text.');
    expect(chunks[0].text).toBe('First section text.');
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
  });

  it('keeps document metadata lines out of the indexed text', () => {
    const chunks = chunkDocument(
      doc('# Policy\n\n- **Responsable:** Security\n- **Versión:** 1.0\n\n## Alpha\nBody text here.'),
      estimateWordpieces,
      options,
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).not.toContain('Responsable');
  });

  it('names subsections after their parent', () => {
    const chunks = chunkDocument(doc('## Parent\n### Child\nChild body text.'), estimateWordpieces, options);
    expect(chunks[0].section).toBe('Parent > Child');
  });

  it('splits a long section with a sentence-aligned overlap between chunks', () => {
    const sentences = Array.from({ length: 12 }, (_, index) => `Sentence number ${index} says something useful.`);
    const chunks = chunkDocument(doc(`## Long\n${sentences.join(' ')}`), estimateWordpieces, options);

    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) expect(estimateWordpieces(chunk.text)).toBeLessThanOrEqual(options.maxTokens);
    const firstEnd = chunks[0].text.split('. ').pop() as string;
    expect(chunks[1].text).toContain(firstEnd.replace(/\.$/, ''));
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('Sentence number 11');
  });

  it('splits an oversized single sentence by words instead of dropping text', () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const chunks = chunkDocument(doc(`## Run-on\n${words}`), estimateWordpieces, options);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.text).join(' ')).toContain('word79');
  });

  it('repeats the table header when a table is split across chunks', () => {
    const rows = Array.from({ length: 8 }, (_, index) => `| row${index} | value number ${index} |`);
    const chunks = chunkDocument(doc(`## Table\n| Name | Meaning |\n|---|---|\n${rows.join('\n')}`), estimateWordpieces, options);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.startsWith('| Name | Meaning |')).toBe(true);
  });

  it('keeps list items intact as units', () => {
    const chunks = chunkDocument(
      doc('## Steps\n1. First step with a long enough description.\n2. Second step with another description.'),
      estimateWordpieces,
      options,
    );
    expect(chunks[0].text).toContain('1. First step');
  });

  it('produces stable ids so re-indexing overwrites instead of duplicating', () => {
    const content = '## Alpha\nSome text.';
    const first = chunkDocument(doc(content), estimateWordpieces, options);
    const second = chunkDocument(doc(content), estimateWordpieces, options);
    expect(first[0].id).toBe(second[0].id);
    expect(first[0].id).toBe(deterministicUuid('policy.md#0'));
    expect(first[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns nothing for a document without content', () => {
    expect(chunkDocument(doc('# Only a title'), estimateWordpieces, options)).toEqual([]);
  });
});
