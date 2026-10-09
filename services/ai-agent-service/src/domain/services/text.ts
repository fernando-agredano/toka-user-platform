const STOPWORDS = new Set(
  ('el la los las un una unos unas de del al a en y o u e que por para con sin se su sus es son ser esta este estos ' +
    'estas lo le les como mas pero si no ya tu tus mi mis ha han hay muy cada todo toda todos todas sobre entre desde ' +
    'hasta cuando donde tambien solo puede pueden debe deben').split(' '),
);

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const wordCount = (value: string): number => (value.trim() ? value.trim().split(/\s+/).length : 0);

/** Rough wordpiece estimate for Spanish text; the real tokenizer is used when indexing. */
export const estimateWordpieces = (value: string): number => Math.ceil(wordCount(value) * 1.5);

// Crude 5-character stems let "bloquea" and "bloqueo" match without a full Spanish stemmer.
const stem = (word: string): string => (word.length > 5 ? word.slice(0, 5) : word);

export function contentStems(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((word) => word.length > 2 && !STOPWORDS.has(word))
    .map(stem);
}

export function numbersIn(value: string): Set<string> {
  const numbers = value.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return new Set(numbers.map((number) => String(Number.parseFloat(number.replace(',', '.')))));
}
