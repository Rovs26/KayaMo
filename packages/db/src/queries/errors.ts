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

export function isUniqueViolation(error: unknown): boolean {
  if (error instanceof DbQueryError) return error.code === '23505';
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: string }).code === '23505';
  }
  return false;
}

function errorFields(error: unknown): { code?: string; message?: string } {
  if (error instanceof DbQueryError) return { code: error.code, message: error.message };
  if (typeof error === 'object' && error !== null) {
    const row = error as { code?: string; message?: string };
    return { code: row.code, message: row.message };
  }
  return {};
}

export function isMissingRpcError(error: unknown): boolean {
  const { code, message } = errorFields(error);
  if (code === 'PGRST202' || code === 'PGRST203' || code === '42883') return true;
  return /could not find the function/i.test(message ?? '');
}
