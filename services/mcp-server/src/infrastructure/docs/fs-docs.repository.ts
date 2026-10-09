import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { DocsRepository } from '../../application/ports/governance.port';

const MARKDOWN = /\.md$/;

export class FsDocsRepository implements DocsRepository {
  constructor(private readonly directory: string) {}

  async list(): Promise<Array<{ name: string; title: string }>> {
    const files = await readdir(this.directory).catch(() => [] as string[]);
    const docs = await Promise.all(
      files.filter((file) => MARKDOWN.test(file)).sort().map(async (file) => {
        const name = file.replace(MARKDOWN, '');
        const content = await readFile(join(this.directory, file), 'utf8');
        return { name, title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? name };
      }),
    );
    return docs;
  }

  async read(name: string): Promise<string | null> {
    return readFile(join(this.directory, `${name}.md`), 'utf8').catch(() => null);
  }
}
