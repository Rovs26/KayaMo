import type { SyncableTable } from './db';

export type SyncTableSpec = {
  table: SyncableTable;
  ownerColumn: 'user_id' | 'created_by';
  stableKeyColumn: 'id' | 'user_id';
  conflictColumn: 'updated_at' | null;
  tombstones: boolean;
};

const userOwned = (
  table: SyncableTable,
  options: Partial<Omit<SyncTableSpec, 'table' | 'ownerColumn'>> = {},
): SyncTableSpec => ({
  table,
  ownerColumn: 'user_id',
  stableKeyColumn: 'id',
  conflictColumn: 'updated_at',
  tombstones: true,
  ...options,
});

/**
 * Explicit allowlist for the v1 server-to-device feed. A Dexie table is never
 * synchronized merely because it exists.
 */
export const BIDIRECTIONAL_SYNC_REGISTRY: readonly SyncTableSpec[] = [
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
] as const;

export const LOCAL_ONLY_TABLES = [
  'local_journal_entries',
  'busy_blocks',
  'action_grants',
  'life_story_entries',
  'grove_chapters',
  'circles',
  'social_prefs',
  'rest_timers',
] as const;

export function syncSpecFor(table: SyncableTable): SyncTableSpec {
  const spec = BIDIRECTIONAL_SYNC_REGISTRY.find((candidate) => candidate.table === table);
  if (!spec) throw new Error(`Unsupported pull table: ${table}`);
  return spec;
}
