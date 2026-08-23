export const PACKAGE = '@kayamo/ai';

export {
  completeObject,
  AiConfigError,
  type AiTier,
  type GenerateObjectFn,
} from './router';
export { extractNutritionLabel, LABEL_OCR_SYSTEM } from './ocr-label';
export { InMemoryCocoBudgetStore } from './budget';
export type { CocoBudgetStore, CocoUsage } from './budget';
export {
  cocoActionNameSchema,
  cocoActionProposalSchema,
  cocoCitationSchema,
  cocoContextSnapshotSchema,
  cocoModeSchema,
  cocoModelOutputSchema,
  cocoRequestSchema,
  cocoResponseSchema,
  cocoSafetyResultSchema,
  cocoToneSchema,
  cocoToolCallSchema,
  cocoToolResultSchema,
} from './contracts';
export type {
  CocoActionName,
  CocoActionProposal,
  CocoCitation,
  CocoContextSnapshot,
  CocoMemory,
  CocoMode,
  CocoModelOutput,
  CocoRequest,
  CocoResponse,
  CocoSafetyResult,
  CocoTone,
  CocoToolCall,
  CocoToolResult,
} from './contracts';
export { createCocoRouter } from './coco-router';
export type {
  CocoProvider,
  CocoProviderRequest,
  CocoProviderResult,
  CocoRouterConfig,
  CocoRouterResult,
  CocoTelemetryEvent,
  CocoTelemetrySink,
} from './coco-router';
export { evaluateCocoSafety } from './safety';
export { authorizeCocoToolCall } from './tools';
export type { CocoToolAuthorization } from './tools';
