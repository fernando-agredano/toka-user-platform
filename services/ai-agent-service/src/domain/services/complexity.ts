import { normalizeText } from './text';

const REASONING_MARKERS = /\b(por que|compara|comparar|diferencia|que pasa si|como se relaciona|como afecta)\b/;
const DATA_INTENT = /\b(usuarios?|auditoria|eventos|roles? de|cuantos|logins?)\b/;
const POLICY_INTENT = /\b(por que|permiso|politica|puede|puedo)\b/;
const DETAIL_REQUEST = /\b(detalle|detalla|detallado|a fondo|paso a paso|con detalle|explica(?:me)? todo)\b/;

export const THINKING_BUDGET_COMPLEX = 512;

/** Reasoning tokens are billed as output, so they are only enabled for questions that look multi-step. */
export function thinkingBudgetFor(message: string, toolRoundsDone = 0): number {
  const text = normalizeText(message);
  const questionMarks = (message.match(/\?/g) ?? []).length;
  const mixesDataAndPolicy = DATA_INTENT.test(text) && POLICY_INTENT.test(text);
  const complex = REASONING_MARKERS.test(text) || questionMarks >= 2 || mixesDataAndPolicy || toolRoundsDone >= 1;
  return complex ? THINKING_BUDGET_COMPLEX : 0;
}

export const asksForDetail = (message: string): boolean => DETAIL_REQUEST.test(normalizeText(message));
