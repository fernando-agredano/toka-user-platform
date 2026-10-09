/**
 * Offline retrieval evaluation (no LLM, no Qdrant): chunks the knowledge base, embeds it with the configured
 * model and ranks by brute-force cosine. It measures hit@k and MRR on in-domain questions and how often
 * out-of-domain questions would wrongly receive context, for a sweep of score thresholds.
 *
 *   npm run eval:retrieval -w services/ai-agent-service
 *   EMBEDDING_MODEL=Xenova/paraphrase-multilingual-MiniLM-L12-v2 EMBEDDING_DTYPE=q8 npm run eval:retrieval -w services/ai-agent-service
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type KnowledgeChunk, chunkDocument } from '../src/domain/services/chunker';
import { normalizeText } from '../src/domain/services/text';
import { DEFAULT_EMBEDDING_DTYPE, DEFAULT_EMBEDDING_MODEL } from '../src/infrastructure/config/ai-config';
import { TransformersEmbeddingProvider } from '../src/infrastructure/embeddings/transformers-embedding.provider';
import { FsKnowledgeSource } from '../src/infrastructure/knowledge/fs-knowledge.source';

interface Expected {
  docId: string;
  section: string;
}

interface Cases {
  inDomain: Array<{ question: string; expected: Expected[] }>;
  outOfDomain: string[];
}

interface Ranked {
  chunk: KnowledgeChunk;
  score: number;
}

const ROOT = resolve(__dirname, '..');
const TOP_K = 4;
const THRESHOLDS = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];

const dot = (a: number[], b: number[]): number => a.reduce((sum, value, index) => sum + value * b[index], 0);
const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

const matches = (chunk: KnowledgeChunk, expected: Expected[]): boolean =>
  expected.some(
    (candidate) => chunk.docId === candidate.docId && normalizeText(chunk.section).includes(normalizeText(candidate.section)),
  );

async function main(): Promise<void> {
  const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);
  const dtype = process.env.EMBEDDING_DTYPE ?? DEFAULT_EMBEDDING_DTYPE;
  const embedding = new TransformersEmbeddingProvider(model, dimensions, process.env.HF_CACHE_DIR ?? join(ROOT, '.cache'), dtype);
  const cases = JSON.parse(readFileSync(join(__dirname, 'retrieval-cases.json'), 'utf8')) as Cases;

  const countTokens = await embedding.tokenCounter();
  const documents = await new FsKnowledgeSource(join(ROOT, 'knowledge')).load();
  const chunks = documents.flatMap((doc) => chunkDocument(doc, countTokens));
  const chunkVectors = await embedding.embed(chunks.map((chunk) => chunk.embedText));
  const oversized = chunks.filter((chunk) => countTokens(chunk.embedText) > 256).length;

  const rank = async (question: string): Promise<Ranked[]> => {
    const [vector] = await embedding.embed([question]);
    return chunks.map((chunk, index) => ({ chunk, score: dot(vector, chunkVectors[index]) })).sort((a, b) => b.score - a.score);
  };

  const inDomain = await Promise.all(
    cases.inDomain.map(async ({ question, expected }) => {
      const ranking = await rank(question);
      const position = ranking.findIndex(({ chunk }) => matches(chunk, expected));
      return { question, ranking, position };
    }),
  );
  const outOfDomain = await Promise.all(cases.outOfDomain.map(async (question) => ({ question, ranking: await rank(question) })));

  const hitAt = (k: number): number => inDomain.filter(({ position }) => position >= 0 && position < k).length / inDomain.length;
  const mrr = inDomain.reduce((sum, { position }) => sum + (position >= 0 ? 1 / (position + 1) : 0), 0) / inDomain.length;
  const relevantScores = inDomain.map(({ ranking, position }) => (position >= 0 ? ranking[position].score : 0));
  const irrelevantTop = outOfDomain.map(({ ranking }) => ranking[0].score);

  const sweep = THRESHOLDS.map((threshold) => {
    const recall =
      inDomain.filter(({ position, ranking }) => position >= 0 && position < TOP_K && ranking[position].score >= threshold).length /
      inDomain.length;
    const falsePositives = outOfDomain.filter(({ ranking }) => ranking[0].score >= threshold).length / outOfDomain.length;
    const specificity = 1 - falsePositives;
    const f1 = recall + specificity === 0 ? 0 : (2 * recall * specificity) / (recall + specificity);
    return { threshold, recall, falsePositives, f1 };
  });
  const best = sweep.reduce((winner, row) => (row.f1 > winner.f1 ? row : winner));

  const misses = inDomain.filter(({ position }) => position < 0 || position >= TOP_K);
  const lines = [
    `# Evaluación de recuperación`,
    '',
    `- Modelo: \`${model}\` (${dimensions} dims, dtype ${dtype})`,
    `- Chunks: ${chunks.length} de ${documents.length} documentos (${oversized} con más de 256 wordpieces; el modelo trunca a 256)`,
    `- Casos: ${inDomain.length} dentro del dominio, ${outOfDomain.length} fuera`,
    '',
    '## Calidad del ranking (dentro del dominio)',
    '',
    `| hit@1 | hit@${TOP_K} | MRR | score medio del chunk correcto | score máximo medio fuera de dominio |`,
    '|---|---|---|---|---|',
    `| ${pct(hitAt(1))} | ${pct(hitAt(TOP_K))} | ${mrr.toFixed(3)} | ${(relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length).toFixed(3)} | ${(irrelevantTop.reduce((a, b) => a + b, 0) / irrelevantTop.length).toFixed(3)} |`,
    '',
    '## Barrido de umbral',
    '',
    `Recall = preguntas cuyo chunk correcto está en el top-${TOP_K} **y** supera el umbral. Falsos positivos = preguntas fuera de dominio que aún recibirían contexto.`,
    '',
    '| Umbral | Recall | Falsos positivos | F1 |',
    '|---|---|---|---|',
    ...sweep.map((row) => `| ${row.threshold.toFixed(2)}${row === best ? ' ◀' : ''} | ${pct(row.recall)} | ${pct(row.falsePositives)} | ${row.f1.toFixed(3)} |`),
    '',
    `**Umbral recomendado: ${best.threshold.toFixed(2)}** (F1 ${best.f1.toFixed(3)}).`,
    '',
    '## Fuera de dominio: mejor score por pregunta',
    '',
    ...outOfDomain.map(({ question, ranking }) => `- ${ranking[0].score.toFixed(3)} · ${question} → ${ranking[0].chunk.docId} › ${ranking[0].chunk.section}`),
    '',
    `## Fallos (${misses.length})`,
    '',
    ...(misses.length === 0
      ? ['Ninguno.']
      : misses.map(({ question, ranking, position }) => `- ${question} — esperado en posición ${position < 0 ? 'ninguna' : position + 1}; top-1: ${ranking[0].chunk.docId} › ${ranking[0].chunk.section} (${ranking[0].score.toFixed(3)})`)),
    '',
  ];
  const report = lines.join('\n');
  const slug = `${model.split('/').pop()?.toLowerCase()}-${dtype}`;
  writeFileSync(join(__dirname, `retrieval-report-${slug}.md`), report);
  console.log(report);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
