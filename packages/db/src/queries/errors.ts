export class DbQueryError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DbQueryError';
    this.code = code;
  }
}

export function throwIfError(error: { message: string; code?: string } | null): void {
  if (error) {
    throw new DbQueryError(error.message, error.code);
  }
}
