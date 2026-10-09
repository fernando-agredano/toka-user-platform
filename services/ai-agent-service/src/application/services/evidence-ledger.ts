import type { ScoredChunk } from '../ports/vector-store.port';
import type { EvidenceItem } from '../../domain/services/quality-evaluator';
import { type LabeledChunk, snippetOf } from '../prompts/user-turn';

export interface AiSourceView {
  /** `S#` for documents, `D#` for tool data; the same labels the model cites. */
  id: string;
  title: string;
  section?: string;
  source: string;
  score?: number;
  snippet: string;
}

export interface DataEvidence {
  title: string;
  source: string;
  snippet: string;
  /** Human-readable rendering used to check that the answer's claims come from this result. */
  text: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
const CITATION = /\[([SD]\d+)\]/g;

/** Everything the model may cite in one request, with stable labels shared by the prompt, the quality check and the response. */
export class EvidenceLedger {
  private readonly chunks = new Map<string, LabeledChunk>();
  private readonly data: Array<DataEvidence & { label: string }> = [];

  addChunks(scored: ScoredChunk[]): LabeledChunk[] {
    return scored.map(({ chunk, score }) => {
      const existing = this.chunks.get(chunk.id);
      if (existing) {
        existing.score = Math.max(existing.score, score);
        return existing;
      }
      const labeled: LabeledChunk = { label: `S${this.chunks.size + 1}`, chunk, score };
      this.chunks.set(chunk.id, labeled);
      return labeled;
    });
  }

  addData(entry: DataEvidence): string {
    const label = `D${this.data.length + 1}`;
    this.data.push({ ...entry, label });
    return label;
  }

  get chunkCount(): number {
    return this.chunks.size;
  }

  get topScore(): number | null {
    const scores = [...this.chunks.values()].map((labeled) => labeled.score);
    return scores.length > 0 ? round2(Math.max(...scores)) : null;
  }

  get labeledChunks(): LabeledChunk[] {
    return [...this.chunks.values()];
  }

  get evidence(): EvidenceItem[] {
    return [
      ...this.labeledChunks.map(({ label, chunk }) => ({ label, text: `${chunk.docTitle} ${chunk.section} ${chunk.text}` })),
      ...this.data.map(({ label, title, text }) => ({ label, text: `${title} ${text}` })),
    ];
  }

  /** Only the sources the answer actually cites, in citation order. */
  sourcesCitedIn(answer: string): AiSourceView[] {
    const cited = [...new Set([...answer.matchAll(CITATION)].map((match) => match[1]))];
    const views = new Map<string, AiSourceView>();
    for (const { label, chunk, score } of this.chunks.values()) {
      views.set(label, {
        id: label,
        title: chunk.docTitle,
        section: chunk.section,
        source: chunk.docId,
        score: round2(score),
        snippet: snippetOf(chunk.text),
      });
    }
    for (const { label, title, source, snippet } of this.data) views.set(label, { id: label, title, source, snippet });
    return cited.flatMap((label) => views.get(label) ?? []);
  }
}
