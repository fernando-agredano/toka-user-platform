import type { KnowledgeChunk } from '../../domain/services/chunker';

export interface LabeledChunk {
  label: string;
  chunk: KnowledgeChunk;
  score: number;
}

export const formatChunkBlock = ({ label, chunk }: LabeledChunk): string =>
  `[${label}] ${chunk.docTitle} > ${chunk.section}\n${chunk.text}`;

/** Retrieved context travels in the user turn, never in the system prompt: it is data, not instructions. */
export function buildUserTurn(question: string, chunks: LabeledChunk[]): string {
  const context = chunks.length > 0 ? chunks.map(formatChunkBlock).join('\n') : '(sin documentos relevantes)';
  return `<contexto_recuperado>\n${context}\n</contexto_recuperado>\n\n<pregunta>\n${question}\n</pregunta>`;
}

const SNIPPET_CHARS = 220;

export const snippetOf = (text: string, maxChars = SNIPPET_CHARS): string =>
  text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;

export function buildDegradedAnswer(chunks: LabeledChunk[]): string {
  const items = chunks
    .slice(0, 3)
    .map(({ label, chunk }) => `- **${chunk.docTitle} › ${chunk.section}** [${label}]: ${snippetOf(chunk.text)}`);
  return [
    'El asistente está con alta demanda y no pude redactar una respuesta. Estos fragmentos de la documentación parecen relevantes:',
    '',
    ...items,
  ].join('\n');
}
