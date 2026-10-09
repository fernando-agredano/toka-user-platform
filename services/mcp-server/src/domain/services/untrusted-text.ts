const MAX_TEXT_LENGTH = 200;
const MAX_DEPTH = 6;
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|api[-_]?key|cookie/i;
const EMAIL = /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * Free text that other people wrote (names, user agents, event payloads) can carry instructions aimed at the assistant.
 * Flattening it to one short line removes the formatting an injection relies on; it does not make the text trustworthy.
 */
export function neutralizeText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  const flat = value.replace(CONTROL_CHARACTERS, ' ').replace(/\s{2,}/g, ' ').trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength)}…` : flat;
}

function mapStrings(value: unknown, transform: (text: string, key?: string) => string, key?: string, depth = 0): unknown {
  if (typeof value === 'string') return transform(value, key);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform, key, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([childKey, child]) => [childKey, mapStrings(child, transform, childKey, depth + 1)]),
  );
}

/** Applies `neutralizeText` to every string of a structure (audit event payloads, for example). */
export const neutralizeDeep = <T>(value: T): T => mapStrings(value, (text) => neutralizeText(text)) as T;

/** What is safe to store in the audit trail about a tool call: no secrets, masked emails, bounded size. */
export const redactArguments = (args: Record<string, unknown>): Record<string, unknown> =>
  mapStrings(args, (text, key) =>
    key && SENSITIVE_KEY.test(key) ? '[REDACTED]' : neutralizeText(text).replace(EMAIL, '$1***@$2'),
  ) as Record<string, unknown>;
