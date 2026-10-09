import { createHash } from 'node:crypto';
import type { AgentSettings } from '../ports/agent-settings';
import type { Cache } from '../ports/cache.port';
import type { EmbeddingProvider } from '../ports/embedding.port';
import type { ScoredChunk, VectorStore } from '../ports/vector-store.port';
import type { ConversationMessage } from '../../domain/entities/conversation';
import { estimateWordpieces, normalizeText, wordCount } from '../../domain/services/text';
import type { KnowledgeChunk } from '../../domain/services/chunker';

const SHORT_QUERY_WORDS = 6;
const flat = (text: string): string => text.replace(/\s+/g, ' ').trim();
const sentencesOf = (text: string): string[] => flat(text).split(/(?<=[.!?])\s+/).filter(Boolean);

/** A short follow-up ("¿y para MANAGER?") is embedded together with the previous question; no LLM call is spent rewriting it. */
export function buildSearchQuery(message: string, history: ConversationMessage[]): string {
  if (wordCount(message) >= SHORT_QUERY_WORDS) return message;
  const previous = [...history].reverse().find((entry) => entry.role === 'user');
  return previous ? `${previous.text} ${message}` : message;
}

function mergeText(previous: string, next: string): string {
  const previousFlat = flat(previous);
  const nextSentences = sentencesOf(next);
  // Consecutive chunks overlap by a few sentences; drop the repeated head of the second one.
  for (let drop = Math.min(nextSentences.length, 5); drop > 0; drop--) {
    if (previousFlat.endsWith(nextSentences.slice(0, drop).join(' '))) {
      return [previous, ...nextSentences.slice(drop)].join('\n');
    }
  }
  return `${previous}\n${next}`;
}

function mergeContiguous(picked: ScoredChunk[]): ScoredChunk[] {
  const ordered = [...picked].sort((a, b) => a.chunk.docId.localeCompare(b.chunk.docId) || a.chunk.chunkIndex - b.chunk.chunkIndex);
  const merged: ScoredChunk[] = [];
  for (const current of ordered) {
    const last = merged[merged.length - 1];
    const adjacent =
      last &&
      last.chunk.docId === current.chunk.docId &&
      last.chunk.section === current.chunk.section &&
      current.chunk.chunkIndex === last.chunk.chunkIndex + 1;
    if (!adjacent) {
      merged.push({ chunk: { ...current.chunk }, score: current.score });
      continue;
    }
    const combined: KnowledgeChunk = {
      ...last.chunk,
      chunkIndex: current.chunk.chunkIndex,
      text: mergeText(last.chunk.text, current.chunk.text),
    };
    merged[merged.length - 1] = { chunk: combined, score: Math.max(last.score, current.score) };
  }
  return merged.sort((a, b) => b.score - a.score);
}

export function selectContext(candidates: ScoredChunk[], rag: AgentSettings['rag'], topK = rag.topK): ScoredChunk[] {
  const perSection = new Map<string, number>();
  const picked: ScoredChunk[] = [];
  for (const candidate of [...candidates].sort((a, b) => b.score - a.score)) {
    const key = `${candidate.chunk.docId}|${candidate.chunk.section}`;
    if ((perSection.get(key) ?? 0) >= rag.maxPerSection) continue;
    perSection.set(key, (perSection.get(key) ?? 0) + 1);
    picked.push(candidate);
    if (picked.length >= topK) break;
  }

  const selected: ScoredChunk[] = [];
  let tokens = 0;
  for (const chunk of mergeContiguous(picked)) {
    tokens += estimateWordpieces(chunk.chunk.text);
    if (selected.length > 0 && tokens > rag.maxContextTokens) break;
    selected.push(chunk);
  }
  return selected;
}

export interface RetrievalResult {
  chunks: ScoredChunk[];
  embedMs: number;
  searchMs: number;
}

export class Retriever {
  constructor(
    private readonly embedding: EmbeddingProvider,
    private readonly vectorStore: VectorStore,
    private readonly cache: Cache,
    private readonly rag: AgentSettings['rag'],
  ) {}

  async retrieve(query: string, topK = this.rag.topK): Promise<RetrievalResult> {
    const embedStart = performance.now();
    const vector = await this.embedQuery(query);
    const embedMs = Math.round(performance.now() - embedStart);

    const searchStart = performance.now();
    const candidates = await this.vectorStore.search(vector, this.rag.candidateLimit, this.rag.minScore);
    const chunks = selectContext(candidates, this.rag, topK);
    return { chunks, embedMs, searchMs: Math.round(performance.now() - searchStart) };
  }

  private async embedQuery(query: string): Promise<number[]> {
    const key = `emb:${this.embedding.model}:${createHash('sha256').update(normalizeText(query)).digest('hex')}`;
    const cached = await this.cache.get<number[]>(key).catch(() => null);
    if (cached) return cached;
    const [vector] = await this.embedding.embed([query]);
    await this.cache.set(key, vector, this.rag.embeddingCacheTtlSeconds).catch(() => undefined);
    return vector;
  }
}
