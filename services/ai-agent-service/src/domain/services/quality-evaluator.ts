import { findSecrets, findUnsupportedEntities, redactFragments } from './pii';
import { contentStems, normalizeText, numbersIn, wordCount } from './text';

export interface EvidenceItem {
  /** `S#` for knowledge-base chunks, `D#` for tool results. */
  label: string;
  text: string;
}

export interface QualityInput {
  answer: string;
  evidence: EvidenceItem[];
  /** Identifiers the answer may mention without an evidence label (the caller's own id and email). */
  allowedEntities: string[];
  detailRequested: boolean;
  degraded: boolean;
}

export interface QualityChecks {
  grounded: number;
  citationsValid: boolean;
  noPii: boolean;
  format: boolean;
  length: boolean;
  degraded: boolean;
}

export interface QualityReport {
  score: number;
  checks: QualityChecks;
  /** The answer after automatic actions: invalid citations stripped and PII redacted. */
  answer: string;
}

const WEIGHTS = { grounded: 0.45, citations: 0.15, pii: 0.2, format: 0.1, length: 0.1 };
const PII_SCORE_CAP = 0.3;
const MAX_WORDS = 220;
const MAX_WORDS_DETAILED = 400;
const MIN_EVALUABLE_WORDS = 6;
const MIN_SUPPORT_RATIO = 0.5;
const MAX_LIST_ROWS = 10;

const CITATION = /\[([SD]\d+)\]/g;
const REFUSAL =
  /^(no tengo|no puedo|no cuento|no dispongo|no encontr|lo siento|no hay (informacion|datos|documentos)|solo puedo|unicamente puedo|no tienes|no tiene|tu sesion no|no pude|no fue posible)/;
const REDIRECTION = /\b(contacta|escribe|comunicate|consulta|pide|pidele|solicita)\b.*\b(soporte|responsable|administrador)\b/;
const INTERNAL_MARKERS = /<\/?(contexto_recuperado|resultado_herramienta|pregunta)|contexto de la sesion|prompt_version/i;

const labelsIn = (text: string): string[] => [...text.matchAll(CITATION)].map((match) => match[1]);

function cleanLine(line: string): string {
  const cleaned = line
    .replace(/^\s*(#+\s+|[-*•]\s+|\d+\.\s+)/, '')
    .replace(/\|/g, ' ')
    .replace(/[*_`]/g, '')
    .trim();
  return /^[\s:-]*$/.test(cleaned) ? '' : cleaned;
}

const splitSentences = (line: string): string[] => line.split(/(?<=[.!?])\s+/);

function isMetaSentence(text: string): boolean {
  const normalized = normalizeText(text);
  return REFUSAL.test(normalized) || REDIRECTION.test(normalized);
}

function isSupported(sentence: string, evidenceText: string): boolean {
  const stems = contentStems(sentence);
  if (stems.length === 0) return true;
  const evidenceStems = new Set(contentStems(evidenceText));
  const hits = stems.filter((stem) => evidenceStems.has(stem)).length;
  if (hits / stems.length < MIN_SUPPORT_RATIO) return false;
  const evidenceNumbers = numbersIn(evidenceText);
  return [...numbersIn(sentence)].every((number) => evidenceNumbers.has(number));
}

function groundedness(answer: string, evidence: Map<string, string>): { score: number; evaluable: number } {
  let evaluable = 0;
  let supported = 0;
  for (const rawLine of answer.split('\n')) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    const lineLabels = labelsIn(line);
    for (const sentence of splitSentences(line)) {
      const sentenceLabels = labelsIn(sentence);
      const labels = (sentenceLabels.length > 0 ? sentenceLabels : lineLabels).filter((label) => evidence.has(label));
      const text = sentence.replace(CITATION, ' ').trim();
      if (wordCount(text) < MIN_EVALUABLE_WORDS || isMetaSentence(text)) continue;
      evaluable++;
      if (labels.length > 0 && isSupported(text, labels.map((label) => evidence.get(label)).join('\n'))) supported++;
    }
  }
  return { score: evaluable === 0 ? 1 : supported / evaluable, evaluable };
}

function longestListRun(answer: string): { rows: number; hasTable: boolean } {
  let longest = 0;
  let current = 0;
  let hasTable = false;
  for (const line of answer.split('\n')) {
    if (/^\s*(?:[-*•]|\d+\.|\|)/.test(line)) {
      current++;
      hasTable ||= line.trim().startsWith('|');
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return { rows: longest, hasTable };
}

function hasValidFormat(answer: string): boolean {
  if (answer.includes('```') || /<\/?[a-z][^>]*>/i.test(answer) || /^\s*[{[]\s*"/m.test(answer)) return false;
  if (INTERNAL_MARKERS.test(answer)) return false;
  const { rows, hasTable } = longestListRun(answer);
  // A table adds a header and a separator row on top of the data rows.
  return rows <= MAX_LIST_ROWS + (hasTable ? 2 : 0);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Deterministic 0-1 score computed on every answer; an LLM judge would double cost and consume provider RPM. */
export function evaluateQuality(input: QualityInput): QualityReport {
  const evidence = new Map(input.evidence.map((item) => [item.label, item.text]));
  const cited = labelsIn(input.answer);
  const invalidLabels = [...new Set(cited.filter((label) => !evidence.has(label)))];

  const { score: groundedScore, evaluable } = input.degraded
    ? { score: 1, evaluable: 0 }
    : groundedness(input.answer, evidence);
  const needsCitation = evidence.size > 0 && evaluable > 0 && !input.degraded;
  const citationsValid = invalidLabels.length === 0 && (!needsCitation || cited.length > 0);

  const allowedText = [...evidence.values(), ...input.allowedEntities].join('\n');
  const offending = [...findSecrets(input.answer), ...findUnsupportedEntities(input.answer, allowedText)];
  const noPii = offending.length === 0;

  const words = wordCount(input.answer.replace(CITATION, ' '));
  const length = words >= 1 && words <= (input.detailRequested ? MAX_WORDS_DETAILED : MAX_WORDS);
  const format = hasValidFormat(input.answer);

  let score =
    WEIGHTS.grounded * groundedScore +
    WEIGHTS.citations * Number(citationsValid) +
    WEIGHTS.pii * Number(noPii) +
    WEIGHTS.format * Number(format) +
    WEIGHTS.length * Number(length);
  if (!noPii) score = Math.min(score, PII_SCORE_CAP);

  let answer = input.answer;
  for (const label of invalidLabels) answer = answer.split(`[${label}]`).join('');
  answer = redactFragments(answer, offending);

  return {
    score: round2(score),
    checks: { grounded: round2(groundedScore), citationsValid, noPii, format, length, degraded: input.degraded },
    answer,
  };
}
