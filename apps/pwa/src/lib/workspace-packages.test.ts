import { describe, expect, it } from 'vitest';
import { workspacePackages } from './workspace-packages';

describe('@kayamo/* aliases', () => {
  it('resolve from the PWA', () => {
    expect(workspacePackages).toEqual({
      ai: '@kayamo/ai',
      core: '@kayamo/core',
      db: '@kayamo/db',
      food: '@kayamo/food',
      offline: '@kayamo/offline',
      ui: '@kayamo/ui',
    });
  });
});
