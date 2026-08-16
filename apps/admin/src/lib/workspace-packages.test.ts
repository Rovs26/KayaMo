import { describe, expect, it } from 'vitest';
import { workspacePackages } from './workspace-packages';

describe('@kayamo/* aliases', () => {
  it('resolve from admin', () => {
    expect(workspacePackages).toEqual({
      db: '@kayamo/db',
      food: '@kayamo/food',
      ui: '@kayamo/ui',
    });
  });
});
