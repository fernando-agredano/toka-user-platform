import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { KnowledgeSource } from '../../application/ports/knowledge-source.port';
import type { RawDocument } from '../../domain/services/chunker';

const TITLE = /^# (.+)$/m;
const VERSION = /^- \*\*Versión:\*\*\s*(.+)$/m;

export class FsKnowledgeSource implements KnowledgeSource {
  constructor(private readonly directory: string) {}

  async load(): Promise<RawDocument[]> {
    const files = (await readdir(this.directory)).filter((file) => file.endsWith('.md')).sort();
    return Promise.all(
      files.map(async (docId) => {
        const content = await readFile(join(this.directory, docId), 'utf8');
        return {
          docId,
          title: TITLE.exec(content)?.[1].trim() ?? docId,
          version: VERSION.exec(content)?.[1].trim() ?? 'unversioned',
          content,
          contentHash: createHash('sha256').update(content).digest('hex'),
        };
      }),
    );
  }
}
