export interface ModelPrice {
  /** USD per one million tokens. */
  input: number;
  cachedInput: number;
  output: number;
}

export type PricingTable = Record<string, ModelPrice>;

export interface TokenUsage {
  input: number;
  output: number;
  thoughts: number;
  cachedInput: number;
}

export const emptyUsage = (): TokenUsage => ({ input: 0, output: 0, thoughts: 0, cachedInput: 0 });

export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  thoughts: a.thoughts + b.thoughts,
  cachedInput: a.cachedInput + b.cachedInput,
});

export interface CostResult {
  costUsd: number;
  /** False when the model is missing from the pricing table, so a zero is not mistaken for "free". */
  pricingKnown: boolean;
}

const PER_MILLION = 1_000_000;
const round6 = (value: number): number => Math.round(value * PER_MILLION) / PER_MILLION;

export class CostCalculator {
  constructor(private readonly pricing: PricingTable) {}

  compute(model: string, usage: TokenUsage): CostResult {
    const price = this.pricing[model];
    if (!price) return { costUsd: 0, pricingKnown: false };
    const billableInput = Math.max(0, usage.input - usage.cachedInput);
    // Thinking tokens are billed at the output rate.
    const costUsd =
      (billableInput / PER_MILLION) * price.input +
      (usage.cachedInput / PER_MILLION) * price.cachedInput +
      ((usage.output + usage.thoughts) / PER_MILLION) * price.output;
    return { costUsd: round6(costUsd), pricingKnown: true };
  }
}
