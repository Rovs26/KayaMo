export class DbQueryError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'DbQueryError';
    this.code = code;
    this.status = status;
  }
}

export function throwIfError(
  error: { message: string; code?: string; status?: number } | null,
): void {
  if (error) {
    throw new DbQueryError(error.message, error.code, error.status);
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof DbQueryError) {
    return error.status === 401 || error.code === '401' || error.code === 'PGRST301';
  }
  if (typeof error === 'object' && error !== null && 'status' in error) {
    return (error as { status?: number }).status === 401;
  }
  return false;
}
