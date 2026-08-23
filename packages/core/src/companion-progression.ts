export const COMPANION_EVENT_TYPES = [
  'task_completed',
  'routine_completed',
  'habit_completed',
  'milestone_completed',
  'goal_completed',
  'workout_completed',
  'food_logged',
  'recovery_return',
] as const;

export type CompanionEventType = (typeof COMPANION_EVENT_TYPES)[number];

/** Rewards completion, recovery, and honest logging—not health outcomes. */
export const COMPANION_EVENT_POINTS: Readonly<Record<CompanionEventType, number>> = {
  task_completed: 10,
  routine_completed: 8,
  habit_completed: 8,
  milestone_completed: 20,
  goal_completed: 50,
  workout_completed: 20,
  food_logged: 2,
  recovery_return: 15,
};

export const COMPANION_STAGES = [
  { key: 'seed', minimumPoints: 0 },
  { key: 'sprout', minimumPoints: 100 },
  { key: 'sapling', minimumPoints: 300 },
  { key: 'young_tree', minimumPoints: 700 },
  { key: 'flourishing_tree', minimumPoints: 1_500 },
] as const;

export type CompanionLedgerEvent = {
  eventKey: string;
  eventType: CompanionEventType;
  sourceTable: string;
  sourceId: string;
  logicalDate: string;
};

export type CompanionProgression = {
  totalPoints: number;
  stageKey: (typeof COMPANION_STAGES)[number]['key'];
  acceptedEventKeys: string[];
  eventCounts: Record<CompanionEventType, number>;
};

export function companionEventKey(input: {
  eventType: CompanionEventType;
  sourceTable: string;
  sourceId: string;
}): string {
  return `${input.eventType}:${input.sourceTable}:${input.sourceId}`;
}

export function companionStageForPoints(
  totalPoints: number,
): CompanionProgression['stageKey'] {
  if (!Number.isFinite(totalPoints) || totalPoints < 0) {
    throw new Error('Companion points must be nonnegative');
  }
  return [...COMPANION_STAGES]
    .reverse()
    .find((stage) => totalPoints >= stage.minimumPoints)!.key;
}

export function reduceCompanionEvents(
  events: readonly CompanionLedgerEvent[],
): CompanionProgression {
  const accepted = new Set<string>();
  const eventCounts = Object.fromEntries(
    COMPANION_EVENT_TYPES.map((type) => [type, 0]),
  ) as Record<CompanionEventType, number>;
  let totalPoints = 0;
  for (const event of events) {
    const expectedKey = companionEventKey(event);
    if (event.eventKey !== expectedKey || accepted.has(event.eventKey)) continue;
    accepted.add(event.eventKey);
    eventCounts[event.eventType] += 1;
    totalPoints += COMPANION_EVENT_POINTS[event.eventType];
  }
  return {
    totalPoints,
    stageKey: companionStageForPoints(totalPoints),
    acceptedEventKeys: [...accepted],
    eventCounts,
  };
}

export type AchievementRule =
  | { kind: 'total_points'; threshold: number }
  | { kind: 'event_count'; threshold: number }
  | { kind: 'event_type_count'; eventType: CompanionEventType; threshold: number };

export type AchievementDefinition = {
  key: string;
  rule: AchievementRule;
};

export function earnedAchievementKeys(
  progression: CompanionProgression,
  definitions: readonly AchievementDefinition[],
): string[] {
  return definitions
    .filter((definition) => {
      const { rule } = definition;
      if (rule.kind === 'total_points') return progression.totalPoints >= rule.threshold;
      if (rule.kind === 'event_count') {
        return progression.acceptedEventKeys.length >= rule.threshold;
      }
      return progression.eventCounts[rule.eventType] >= rule.threshold;
    })
    .map((definition) => definition.key);
}
