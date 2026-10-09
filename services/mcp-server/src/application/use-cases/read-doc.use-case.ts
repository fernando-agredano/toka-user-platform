import { ToolExecutionError } from '../../domain/errors/tool-execution-error';
import type { DocsRepository } from '../ports/governance.port';

/** Backs the `toka://docs/{name}` resources. Names are checked against the catalog, never used as a path. */
export class ReadDocUseCase {
  constructor(private readonly docs: DocsRepository) {}

  list() {
    return this.docs.list();
  }

  async execute(name: string): Promise<string> {
    const known = (await this.docs.list()).some((doc) => doc.name === name);
    const content = known ? await this.docs.read(name) : null;
    if (content === null) throw new ToolExecutionError('not_found', `Unknown document "${name}"`);
    return content;
  }
}
