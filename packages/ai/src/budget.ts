export type CocoUsage = {
  userId: string;
  logicalDate: string;
  requestId: string;
  costUsd: number;
};

export interface CocoBudgetStore {
  spentUsd(userId: string, logicalDate: string): Promise<number>;
  recordUsage(usage: CocoUsage): Promise<void>;
}

export class InMemoryCocoBudgetStore implements CocoBudgetStore {
  private readonly usages = new Map<string, number[]>();

  async spentUsd(userId: string, logicalDate: string): Promise<number> {
    return (this.usages.get(`${userId}:${logicalDate}`) ?? []).reduce(
      (total, cost) => total + cost,
      0,
    );
  }

  async recordUsage(usage: CocoUsage): Promise<void> {
    const key = `${usage.userId}:${usage.logicalDate}`;
    const daily = this.usages.get(key) ?? [];
    daily.push(Math.max(0, usage.costUsd));
    this.usages.set(key, daily);
  }
}
