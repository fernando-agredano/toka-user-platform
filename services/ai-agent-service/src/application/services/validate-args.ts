import type { JsonSchema } from '../ports/llm-provider.port';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type ArgsResult = { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

function coerce(value: unknown, schema: JsonSchema, name: string): { value: unknown } | { error: string } {
  // Models often send numbers as strings ("5"); accepting them saves a wasted round trip.
  if ((schema.type === 'integer' || schema.type === 'number') && typeof value === 'string' && value.trim() !== '') {
    value = Number(value);
  }
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') return { error: `"${name}" must be a string` };
      if (schema.maxLength !== undefined && value.length > schema.maxLength) return { error: `"${name}" is too long` };
      if (schema.enum && !schema.enum.includes(value)) return { error: `"${name}" must be one of ${schema.enum.join(', ')}` };
      if (schema.format === 'uuid' && !UUID.test(value)) return { error: `"${name}" must be a UUID` };
      if (schema.format === 'date-time' && (!ISO_DATE_TIME.test(value) || Number.isNaN(Date.parse(value)))) {
        return { error: `"${name}" must be an ISO-8601 date-time` };
      }
      return { value };
    }
    case 'integer':
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: `"${name}" must be a number` };
      if (schema.type === 'integer' && !Number.isInteger(value)) return { error: `"${name}" must be an integer` };
      if (schema.minimum !== undefined && value < schema.minimum) return { error: `"${name}" must be >= ${schema.minimum}` };
      if (schema.maximum !== undefined && value > schema.maximum) return { error: `"${name}" must be <= ${schema.maximum}` };
      return { value };
    }
    case 'boolean':
      return typeof value === 'boolean' ? { value } : { error: `"${name}" must be a boolean` };
    default:
      return { error: `"${name}" has an unsupported type` };
  }
}

/** Validates model-supplied arguments against the tool's own schema before any downstream call is made. */
export function validateArgs(schema: JsonSchema, args: unknown): ArgsResult {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return { ok: false, error: 'arguments must be an object' };
  const properties = schema.properties ?? {};
  const input = args as Record<string, unknown>;
  const value: Record<string, unknown> = {};

  for (const required of schema.required ?? []) {
    if (input[required] === undefined) return { ok: false, error: `"${required}" is required` };
  }
  for (const [name, raw] of Object.entries(input)) {
    const propertySchema = properties[name];
    if (!propertySchema) return { ok: false, error: `unknown parameter "${name}"` };
    if (raw === undefined || raw === null) continue;
    const result = coerce(raw, propertySchema, name);
    if ('error' in result) return { ok: false, error: result.error };
    value[name] = result.value;
  }
  return { ok: true, value };
}
