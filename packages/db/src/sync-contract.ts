export type SyncOwnerColumn = 'user_id' | 'created_by';
export type SyncStableKeyColumn = 'id' | 'user_id';
export type SyncConflictColumn = 'updated_at' | null;

export type SyncTableContract = {
  table: string;
  ownerColumn: SyncOwnerColumn;
  stableKeyColumn: SyncStableKeyColumn;
  conflictColumn: SyncConflictColumn;
  tombstones: boolean;
  serverSeqNullable: boolean;
};

const userOwned = <const TableName extends string>(
  table: TableName,
  options: Partial<Omit<SyncTableContract, 'table' | 'ownerColumn'>> = {},
) => ({
  table,
  ownerColumn: 'user_id' as const,
  stableKeyColumn: 'id' as const,
  conflictColumn: 'updated_at' as const,
  tombstones: true,
  serverSeqNullable: false,
  ...options,
});

/**
 * Shared contract between the server schema and the offline pull registry.
 * Adding a table here requires production sequence infrastructure; the live
 * database catalog test enforces that requirement.
 */
export const BIDIRECTIONAL_SYNC_CONTRACT = [
  userOwned('food_entries'),
  userOwned('weight_logs'),
  userOwned('workouts'),
  userOwned('workout_sets'),
  {
    table: 'exercises',
    ownerColumn: 'created_by',
    stableKeyColumn: 'id',
    conflictColumn: 'updated_at',
    tombstones: true,
    serverSeqNullable: true,
  },
  userOwned('workout_plans'),
  userOwned('workout_plan_exercises'),
  userOwned('meal_templates'),
  userOwned('tasks'),
  userOwned('routines'),
  userOwned('routine_completions'),
  userOwned('agent_memory'),
  userOwned('coco_conversations'),
  userOwned('coco_messages'),
  userOwned('goals'),
  userOwned('goal_milestones'),
  userOwned('habits'),
  userOwned('habit_completions'),
  userOwned('companion_events', {
    conflictColumn: null,
    tombstones: false,
  }),
  userOwned('daily_plans'),
  userOwned('focus_sessions'),
  userOwned('daily_loop_preferences', { stableKeyColumn: 'user_id' }),
  userOwned('future_selves', { stableKeyColumn: 'user_id' }),
  userOwned('compasses', { stableKeyColumn: 'user_id' }),
  userOwned('inbox_items'),
  userOwned('personal_rules'),
] as const satisfies readonly SyncTableContract[];

export type BidirectionalSyncTable =
  (typeof BIDIRECTIONAL_SYNC_CONTRACT)[number]['table'];
export type BidirectionalSyncSpec = (typeof BIDIRECTIONAL_SYNC_CONTRACT)[number];
