import type { agentMemory, agentRuns } from './schema/agent';
import type {
  foodAliases,
  foodEntries,
  foods,
  mealTemplates,
  offContributeRequests,
  recipeIngredients,
  recipes,
  servings,
} from './schema/foods';
import type { profiles } from './schema/profiles';
import type { exercises, workoutSets, workouts } from './schema/training';
import type { expenditureEstimates, targets, weightLogs } from './schema/user-metrics';

type TableDef<T extends { $inferSelect: unknown; $inferInsert: unknown }> = {
  Row: T['$inferSelect'];
  Insert: Omit<T['$inferInsert'], 'server_updated_at' | 'logical_date'> & {
    server_updated_at?: string;
    logical_date?: string;
  };
  Update: Partial<T['$inferInsert']>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<typeof profiles>;
      foods: TableDef<typeof foods>;
      servings: TableDef<typeof servings>;
      food_aliases: TableDef<typeof foodAliases>;
      recipes: TableDef<typeof recipes>;
      recipe_ingredients: TableDef<typeof recipeIngredients>;
      food_entries: TableDef<typeof foodEntries>;
      meal_templates: TableDef<typeof mealTemplates>;
      off_contribute_requests: TableDef<typeof offContributeRequests>;
      exercises: TableDef<typeof exercises>;
      workouts: TableDef<typeof workouts>;
      workout_sets: TableDef<typeof workoutSets>;
      weight_logs: TableDef<typeof weightLogs>;
      expenditure_estimates: TableDef<typeof expenditureEstimates>;
      targets: TableDef<typeof targets>;
      agent_runs: TableDef<typeof agentRuns>;
      agent_memory: TableDef<typeof agentMemory>;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      kayamo_logical_date: {
        Args: { p_at: string; p_tz: string | null; p_day_starts_at: string | null };
        Returns: string;
      };
      kayamo_search_foods: {
        Args: { p_query: string; p_limit?: number };
        Returns: { food_id: string; similarity: number }[];
      };
      kayamo_food_log_counts: {
        Args: { p_food_ids: string[] };
        Returns: { food_id: string; times_logged: number }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Food = Database['public']['Tables']['foods']['Row'];
export type FoodInsert = Database['public']['Tables']['foods']['Insert'];
export type FoodEntry = Database['public']['Tables']['food_entries']['Row'];
export type FoodEntryInsert = Database['public']['Tables']['food_entries']['Insert'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type WeightLogInsert = Database['public']['Tables']['weight_logs']['Insert'];
export type Workout = Database['public']['Tables']['workouts']['Row'];
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];
export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type Serving = Database['public']['Tables']['servings']['Row'];
export type ServingInsert = Database['public']['Tables']['servings']['Insert'];
export type Recipe = Database['public']['Tables']['recipes']['Row'];
export type MealTemplate = Database['public']['Tables']['meal_templates']['Row'];
export type AgentRun = Database['public']['Tables']['agent_runs']['Row'];
