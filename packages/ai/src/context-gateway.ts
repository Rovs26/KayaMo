import type { CocoContextSnapshot } from './contracts';
import {
  MUS_CONTEXT_PERMISSION_DOMAINS,
  defaultMusContextPermissions,
  musContextPermissionsSchema,
  type MusContextPermissionDomain,
  type MusContextPermissions,
} from './context-permissions';

type RecommendedAction = CocoContextSnapshot['recommendedAction'];
type HealthContext = CocoContextSnapshot['health'];

export type GoalsPlanningContextProjection = {
  tasks: CocoContextSnapshot['tasks'];
  routines: CocoContextSnapshot['routines'];
  goals: CocoContextSnapshot['goals'];
  recommendedAction: RecommendedAction | null;
};

export type PhysicalSelfContextProjection = {
  health: HealthContext;
  recommendedAction: RecommendedAction | null;
};

export type MemoryContextProjection = {
  memories: CocoContextSnapshot['memories'];
};

export type FaithContextProjection = {
  scripture: NonNullable<CocoContextSnapshot['scripture']>;
};

export type MusContextDomainLoaders = {
  goals_planning: () => Promise<GoalsPlanningContextProjection>;
  physical_self: () => Promise<PhysicalSelfContextProjection>;
  memory: () => Promise<MemoryContextProjection>;
  faith: () => Promise<FaithContextProjection>;
};

export type MusContextAuthorizationAudit = {
  requestedDomains: MusContextPermissionDomain[];
  grantedDomains: MusContextPermissionDomain[];
  omittedDomains: MusContextPermissionDomain[];
  permissionLookupFailed: boolean;
  domainLoadFailures: MusContextPermissionDomain[];
};

const emptyHealth = (): HealthContext => ({
  mealsLogged: 0,
  weightLogged: false,
  workoutStatus: 'none',
  confirmedWorkouts: [],
  nutritionGuidance: null,
});

export async function buildAuthorizedCocoContext(input: {
  logicalDate: string;
  timezone: string;
  readPermissions: () => Promise<MusContextPermissions>;
  loaders: MusContextDomainLoaders;
}): Promise<{ context: CocoContextSnapshot; audit: MusContextAuthorizationAudit }> {
  let configured = defaultMusContextPermissions();
  let permissionLookupFailed = false;
  try {
    configured = musContextPermissionsSchema.parse(await input.readPermissions());
  } catch {
    permissionLookupFailed = true;
  }

  const effective = defaultMusContextPermissions();
  const domainLoadFailures: MusContextPermissionDomain[] = [];
  let goalsPlanning: GoalsPlanningContextProjection | null = null;
  let physicalSelf: PhysicalSelfContextProjection | null = null;
  let memory: MemoryContextProjection | null = null;
  let faith: FaithContextProjection | null = null;

  if (!permissionLookupFailed && configured.goals_planning) {
    try {
      goalsPlanning = await input.loaders.goals_planning();
      effective.goals_planning = true;
    } catch {
      domainLoadFailures.push('goals_planning');
    }
  }
  if (!permissionLookupFailed && configured.physical_self) {
    try {
      physicalSelf = await input.loaders.physical_self();
      effective.physical_self = true;
    } catch {
      domainLoadFailures.push('physical_self');
    }
  }
  if (!permissionLookupFailed && configured.memory) {
    try {
      memory = await input.loaders.memory();
      effective.memory = true;
    } catch {
      domainLoadFailures.push('memory');
    }
  }
  if (!permissionLookupFailed && configured.faith) {
    try {
      faith = await input.loaders.faith();
      effective.faith = true;
    } catch {
      domainLoadFailures.push('faith');
    }
  }

  const recommendedAction = goalsPlanning?.recommendedAction ??
    physicalSelf?.recommendedAction ?? {
      kind: 'check_in' as const,
      recordId: null,
      title: 'Choose what would help next',
    };
  const context: CocoContextSnapshot = {
    version: 1,
    logicalDate: input.logicalDate,
    timezone: input.timezone,
    recommendedAction,
    tasks: goalsPlanning?.tasks ?? [],
    routines: goalsPlanning?.routines ?? [],
    health: physicalSelf?.health ?? emptyHealth(),
    goals: goalsPlanning?.goals ?? [],
    scripture: faith?.scripture,
    memories: memory?.memories ?? [],
    permissions: effective,
  };
  const grantedDomains = MUS_CONTEXT_PERMISSION_DOMAINS.filter(
    (domain) => effective[domain],
  );
  return {
    context,
    audit: {
      requestedDomains: [...MUS_CONTEXT_PERMISSION_DOMAINS],
      grantedDomains,
      omittedDomains: MUS_CONTEXT_PERMISSION_DOMAINS.filter(
        (domain) => !effective[domain],
      ),
      permissionLookupFailed,
      domainLoadFailures,
    },
  };
}
