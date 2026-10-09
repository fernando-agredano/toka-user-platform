import type { z } from 'zod';
import type { Caller } from '../dtos/caller';

export interface ToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface ToolOutput {
  data: Record<string, unknown>;
  /** True when the tool only described what it would do (a destructive call without `confirm`). */
  preview?: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
  /** Permissions the caller's token must carry; the owning service still enforces them independently. */
  permissions: string[];
  execute(args: Record<string, unknown>, caller: Caller): Promise<ToolOutput>;
}

/** Keeps each tool's `execute` typed from its own schema while the registry stores them uniformly. */
export function defineTool<Shape extends z.ZodRawShape>(
  tool: Omit<ToolDefinition, 'inputSchema' | 'execute'> & {
    inputSchema: Shape;
    execute(args: z.objectOutputType<Shape, z.ZodTypeAny>, caller: Caller): Promise<ToolOutput>;
  },
): ToolDefinition {
  return tool as unknown as ToolDefinition;
}

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const WRITE: ToolAnnotations = { ...READ_ONLY, readOnlyHint: false, idempotentHint: false };
export const DESTRUCTIVE: ToolAnnotations = { ...WRITE, destructiveHint: true };

export const confirmationPreview = (data: Record<string, unknown>): ToolOutput => ({
  preview: true,
  data: {
    preview: true,
    requiresConfirmation: true,
    ...data,
    howToConfirm: 'Nothing was changed. Show this to the user and, only if they explicitly agree, call the tool again with confirm: true.',
  },
});
