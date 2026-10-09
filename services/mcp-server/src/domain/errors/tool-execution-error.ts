export type ToolErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'conflict'
  | 'rate_limited'
  | 'unavailable';

/** A failure the assistant can understand and act on; anything else is reported as an opaque internal error. */
export class ToolExecutionError extends Error {
  constructor(
    readonly kind: ToolErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
