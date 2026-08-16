import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKAGE, isSupabaseConfigured } from './index';

describe('@kayamo/db', () => {
  it('loads', () => {
    expect(PACKAGE).toBe('@kayamo/db');
  });
});

describe('isSupabaseConfigured', () => {
  it('is false when public env is missing', () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(isSupabaseConfigured()).toBe(false);
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
  });
});

describe('service-role guard', () => {
  it('marks the service client as server-only', () => {
    const src = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/import 'server-only'/);
    expect(src).toMatch(/Never import this module from a file that has `"use client"`/);
  });

  it('is not re-exported from the public package entry', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch('createServiceSupabase');
    expect(src).not.toMatch('./service');
  });
});
