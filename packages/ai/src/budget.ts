export type CocoUsage = {
  userId: string;
  logicalDate: string;
  requestId: string;
  costUsd: number;
};

/** Per-call spend gate for completeObject (OCR, future ch14 extract). */
export type AiBudgetGate = {
  spentUsd: () => Promise<number>;
  recordUsage: (usage: { costUsd: number; latencyMs: number }) => Promise<void>;
  dailyBudgetUsd: number;
  estimatedRequestCostUsd: number;
};

export function createMemoryAiBudgetGate(input: {
  spentUsd?: number;
  dailyBudgetUsd: number;
  estimatedRequestCostUsd: number;
}): AiBudgetGate & { recorded: Array<{ costUsd: number; latencyMs: number }> } {
  let spent = input.spentUsd ?? 0;
  const recorded: Array<{ costUsd: number; latencyMs: number }> = [];
  return {
    dailyBudgetUsd: input.dailyBudgetUsd,
    estimatedRequestCostUsd: input.estimatedRequestCostUsd,
    spentUsd: async () => spent,
    recordUsage: async (usage) => {
      recorded.push(usage);
      spent += Math.max(0, usage.costUsd);
    },
    recorded,
  };
}

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
