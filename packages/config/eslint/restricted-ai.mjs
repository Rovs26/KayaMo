/** Provider SDKs stay inside packages/ai. Apps import @kayamo/ai instead. */
export const RESTRICTED_AI_PROVIDER_PATHS = [
  {
    name: 'ai',
    message:
      'All LLM calls go through @kayamo/ai (completeObject or the Coco router). Do not import the Vercel AI SDK from apps or other packages.',
  },
  {
    name: '@ai-sdk/openai',
    message:
      'OpenAI stays inside packages/ai. Import createOpenAICocoProvider from @kayamo/ai/server.',
  },
  {
    name: 'openai',
    message: 'The OpenAI SDK stays inside packages/ai.',
  },
];

export const RESTRICTED_AI_PROVIDER_PATTERNS = [
  {
    group: ['@ai-sdk/*', '@anthropic-ai', '@anthropic-ai/*'],
    message:
      'Model SDKs stay inside packages/ai. Import @kayamo/ai (completeObject or the Coco router) instead.',
  },
];

export const RESTRICTED_AI_DYNAMIC_IMPORTS = [
  {
    selector: "ImportExpression[source.value='ai']",
    message:
      'All LLM calls go through @kayamo/ai. Do not dynamically import the Vercel AI SDK outside packages/ai.',
  },
  {
    selector: "ImportExpression[source.value='@ai-sdk/openai']",
    message:
      'OpenAI stays inside packages/ai. Do not dynamically import @ai-sdk/openai outside that package.',
  },
  {
    selector: "ImportExpression[source.value=/^@ai-sdk\\//]",
    message: 'Model SDKs stay inside packages/ai. Do not dynamically import @ai-sdk/* outside that package.',
  },
  {
    selector: "ImportExpression[source.value='openai']",
    message: 'The OpenAI SDK stays inside packages/ai.',
  },
  {
    selector: "ImportExpression[source.value=/^@anthropic-ai(\\s|$|\\/)/]",
    message: 'Anthropic stays inside packages/ai.',
  },
];
