import { z } from 'zod';

export const cocoModeSchema = z.enum([
  'chat',
  'focus',
  'workout',
  'vent',
  'diary',
  'prayer',
]);
export type CocoMode = z.infer<typeof cocoModeSchema>;

export const cocoToneSchema = z.enum(['gentle', 'balanced', 'firm']);
export type CocoTone = z.infer<typeof cocoToneSchema>;

export const cocoCitationSchema = z
  .object({
    recordType: z.enum([
      'task',
      'routine',
      'food_entry',
      'workout',
      'goal',
      'memory',
      'target',
      'expenditure',
      'achievement',
      'scripture',
    ]),
    recordId: z.string().min(1).max(200),
    label: z.string().trim().min(1).max(120),
  })
  .strict();
export type CocoCitation = z.infer<typeof cocoCitationSchema>;

export const cocoActionNameSchema = z.enum([
  'create_task',
  'complete_task',
  'create_routine',
  'create_goal',
  'start_focus',
  'log_food',
  'remember_this',
]);

const taskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(160),
        notes: z.string().trim().max(1000).nullable(),
        scheduledFor: z.string().date().nullable(),
        dueAt: z.string().datetime({ offset: true }).nullable(),
      })
      .strict(),
  })
  .strict();

const completeTaskProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('complete_task'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z.object({ taskId: z.string().min(1).max(200) }).strict(),
  })
  .strict();

const routineProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_routine'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(120),
        notes: z.string().trim().max(1000).nullable(),
        scheduleDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        preferredTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
          .nullable(),
      })
      .strict(),
  })
  .strict();

const goalProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('create_goal'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        title: z.string().trim().min(1).max(180),
        description: z.string().trim().max(2000).nullable(),
        kind: z.enum(['goal', 'campaign', 'chapter']),
        targetDate: z.string().date().nullable(),
      })
      .strict(),
  })
  .strict();

const focusProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('start_focus'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        taskId: z.string().min(1).max(200).nullable(),
        minutes: z.number().int().min(1).max(180),
      })
      .strict(),
  })
  .strict();

const foodProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('log_food'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({ inputHint: z.string().trim().min(1).max(300).nullable() })
      .strict(),
  })
  .strict();

const memoryProposalSchema = z
  .object({
    proposalId: z.string().min(1).max(100),
    action: z.literal('remember_this'),
    summary: z.string().trim().min(1).max(180),
    requiresConfirmation: z.literal(true),
    arguments: z
      .object({
        kind: z.enum(['preference', 'goal', 'context', 'faith']),
        content: z.string().trim().min(1).max(2000),
      })
      .strict(),
  })
  .strict();

export const cocoActionProposalSchema = z.discriminatedUnion('action', [
  taskProposalSchema,
  completeTaskProposalSchema,
  routineProposalSchema,
  goalProposalSchema,
  focusProposalSchema,
  foodProposalSchema,
  memoryProposalSchema,
]);
export type CocoActionProposal = z.infer<typeof cocoActionProposalSchema>;
export type CocoActionName = CocoActionProposal['action'];

export const cocoSafetyResultSchema = z
  .object({
    level: z.enum(['safe', 'supportive_redirect', 'urgent']),
    category: z.enum([
      'none',
      'self_harm',
      'eating_disorder',
      'medical_emergency',
      'abuse',
    ]),
    allowModel: z.boolean(),
    showEmergencyPrompt: z.boolean(),
    message: z.string().trim().min(1).max(800).nullable(),
  })
  .strict();
export type CocoSafetyResult = z.infer<typeof cocoSafetyResultSchema>;

export const cocoContextSnapshotSchema = z
  .object({
    version: z.literal(1),
    logicalDate: z.string().date(),
    timezone: z.string().min(1).max(100),
    recommendedAction: z
      .object({
        kind: z.enum(['task', 'routine', 'food', 'check_in']),
        recordId: z.string().max(200).nullable(),
        title: z.string().trim().min(1).max(180),
      })
      .strict(),
    tasks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(160),
            completed: z.boolean(),
            dueAt: z.string().datetime({ offset: true }).nullable(),
          })
          .strict(),
      )
      .max(50),
    routines: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(120),
            completed: z.boolean(),
          })
          .strict(),
      )
      .max(30),
    health: z
      .object({
        mealsLogged: z.number().int().nonnegative(),
        weightLogged: z.boolean(),
        workoutStatus: z.enum(['none', 'planned', 'active', 'completed']),
        confirmedWorkouts: z
          .array(
            z
              .object({
                id: z.string().min(1).max(200),
                status: z.enum(['active', 'completed', 'abandoned']),
                startedAt: z.string().datetime({ offset: true }),
                endedAt: z.string().datetime({ offset: true }).nullable(),
                setsCompleted: z.number().int().nonnegative(),
                exerciseNames: z.array(z.string().trim().min(1).max(160)).max(30),
                bestE1rmKg: z.number().nonnegative().nullable(),
                isDeload: z.boolean(),
              })
              .strict(),
          )
          .max(10)
          .optional(),
        nutritionGuidance: z
          .object({
            targetId: z.string().min(1).max(200),
            expenditureId: z.string().min(1).max(200),
            targetKcal: z.number().nonnegative(),
            targetProteinG: z.number().nonnegative(),
            loggedKcal: z.number().nonnegative(),
            loggedProteinG: z.number().nonnegative(),
            source: z.literal('target_engine'),
            confidence: z.number().min(0).max(1),
          })
          .strict()
          .nullable()
          .optional(),
      })
      .strict(),
    goals: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            title: z.string().trim().min(1).max(180),
            status: z.enum(['active', 'completed', 'paused']),
            kind: z.enum(['goal', 'campaign', 'chapter']).optional(),
          })
          .strict(),
      )
      .max(20),
    companion: z
      .object({
        totalPoints: z.number().int().nonnegative(),
        stageKey: z.enum(['seed', 'sprout', 'sapling', 'young_tree', 'flourishing_tree']),
        achievements: z
          .array(
            z
              .object({
                id: z.string().min(1).max(200),
                title: z.string().trim().min(1).max(160),
                sourceEventId: z.string().min(1).max(200),
              })
              .strict(),
          )
          .max(20),
      })
      .strict()
      .optional(),
    scripture: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            reference: z.string().trim().min(1).max(100),
            text: z.string().trim().min(1).max(1200),
            translation: z.literal('engwebp'),
            sourceUrl: z.string().url(),
            tags: z.array(z.string().min(1).max(50)).max(20),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    memories: z
      .array(
        z
          .object({
            id: z.string().min(1).max(200),
            kind: z.string().min(1).max(60),
            content: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .max(20),
    permissions: z
      .object({
        health: z.boolean(),
        faith: z.boolean(),
        memory: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type CocoContextSnapshot = z.infer<typeof cocoContextSnapshotSchema>;

export const cocoModelOutputSchema = z
  .object({
    message: z.string().trim().min(1).max(1200),
    tone: cocoToneSchema,
    proposals: z.array(cocoActionProposalSchema).max(3),
    citations: z.array(cocoCitationSchema).max(8),
  })
  .strict();
export type CocoModelOutput = z.infer<typeof cocoModelOutputSchema>;

export const cocoResponseSchema = cocoModelOutputSchema
  .extend({ safety: cocoSafetyResultSchema })
  .strict();
export type CocoResponse = z.infer<typeof cocoResponseSchema>;

export const cocoRequestSchema = z
  .object({
    requestId: z.string().min(1).max(100),
    userId: z.string().min(1).max(200),
    mode: cocoModeSchema,
    message: z.string().max(5000),
    context: cocoContextSnapshotSchema,
    allowedActions: z.array(cocoActionNameSchema),
  })
  .strict();

export type CocoRequest = Omit<z.infer<typeof cocoRequestSchema>, 'allowedActions'> & {
  allowedActions: CocoActionName[];
};

export const cocoToolCallSchema = z
  .object({
    callId: z.string().min(1).max(100),
    name: z.enum(['read_daily_context', 'read_memory', 'propose_action']),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CocoToolCall = z.infer<typeof cocoToolCallSchema>;

export const cocoToolResultSchema = z
  .object({
    callId: z.string().min(1).max(100),
    status: z.enum(['ok', 'denied', 'error']),
    content: z.record(z.string(), z.unknown()),
  })
  .strict();
export type CocoToolResult = z.infer<typeof cocoToolResultSchema>;

export type CocoMemory = {
  id: string;
  kind: 'preference' | 'goal' | 'context' | 'faith';
  content: string;
  explicit: true;
};
