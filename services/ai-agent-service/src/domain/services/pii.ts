const SECRET_PATTERNS = [
  /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g,
  /\bAIza[\w-]{30,}\b/g,
  /\bBearer\s+[\w.~+/-]{20,}=*/g,
  /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
];
const CARD_CANDIDATE = /\b(?:\d[ -]?){13,19}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export const REDACTION_MARK = '[REDACTADO]';

function passesLuhn(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export function findSecrets(text: string): string[] {
  const found = SECRET_PATTERNS.flatMap((pattern) => text.match(pattern) ?? []);
  const cards = (text.match(CARD_CANDIDATE) ?? []).filter(passesLuhn);
  return [...found, ...cards];
}

/** Emails and UUIDs in an answer must come from the evidence (or the caller's own identity); otherwise they were invented or leaked. */
export function findUnsupportedEntities(text: string, allowedText: string): string[] {
  const allowed = allowedText.toLowerCase();
  const entities = [...(text.match(EMAIL) ?? []), ...(text.match(UUID) ?? [])];
  return entities.filter((entity) => !allowed.includes(entity.toLowerCase()));
}

export function redactFragments(text: string, fragments: string[]): string {
  return fragments.reduce((current, fragment) => current.split(fragment).join(REDACTION_MARK), text);
}
