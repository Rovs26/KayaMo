/**
 * First slice of the ch17 embedding cache: exact normalized phrase per user.
 * Vector lookup can implement the same interface later without changing callers.
 * Do not call an embedding API from here — that is also a bill.
 */
export function normalizeFoodPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface PhraseCache {
  lookup(userId: string, normalizedPhrase: string): Promise<unknown | null>;
  store(userId: string, normalizedPhrase: string, value: unknown): Promise<void>;
}

export class MemoryPhraseCache implements PhraseCache {
  private readonly rows = new Map<string, unknown>();

  async lookup(userId: string, normalizedPhrase: string): Promise<unknown | null> {
    return this.rows.get(`${userId}:${normalizedPhrase}`) ?? null;
  }

  async store(userId: string, normalizedPhrase: string, value: unknown): Promise<void> {
    this.rows.set(`${userId}:${normalizedPhrase}`, value);
  }
}
