import { chapterCloseSummary, type ChapterCloseInput, type StoryDraft } from '@kayamo/core';
import { getOfflineDb, type LocalGroveChapter, type LocalLifeStoryEntry } from './db';

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

export async function createLocalLifeStoryEntry(input: {
  userId: string;
  draft: StoryDraft;
  id?: string;
}): Promise<LocalLifeStoryEntry> {
  const at = nowIso();
  const row: LocalLifeStoryEntry = {
    id: input.id ?? newId(),
    user_id: input.userId,
    title: input.draft.title.trim(),
    summary: input.draft.summary.trim(),
    happened_on: input.draft.happenedOn,
    kind: input.draft.kind,
    professional: input.draft.professional,
    source_id: input.draft.sourceId,
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().life_story_entries.put(row);
  return row;
}

export async function listLocalLifeStory(userId: string): Promise<LocalLifeStoryEntry[]> {
  return (await getOfflineDb().life_story_entries.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.happened_on.localeCompare(a.happened_on) || b.created_at.localeCompare(a.created_at));
}

export async function tombstoneLocalLifeStoryEntry(params: {
  id: string;
  userId: string;
}): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.life_story_entries.get(params.id);
  if (!existing || existing.user_id !== params.userId || existing.deleted_at) return;
  const at = nowIso();
  await db.life_story_entries.put({ ...existing, deleted_at: at, updated_at: at });
}

export async function closeLocalGroveChapter(input: {
  userId: string;
  closedOn: string;
  fields: ChapterCloseInput;
  id?: string;
}): Promise<LocalGroveChapter> {
  const at = nowIso();
  const row: LocalGroveChapter = {
    id: input.id ?? newId(),
    user_id: input.userId,
    closed_on: input.closedOn,
    changed: input.fields.changed.trim(),
    accomplished: input.fields.accomplished.trim(),
    let_go: input.fields.letGo.trim(),
    learned: input.fields.learned.trim(),
    carries: input.fields.carries.trim(),
    summary: chapterCloseSummary(input.fields),
    created_at: at,
    updated_at: at,
    deleted_at: null,
  };
  await getOfflineDb().grove_chapters.put(row);
  return row;
}

export async function listLocalGroveChapters(userId: string): Promise<LocalGroveChapter[]> {
  return (await getOfflineDb().grove_chapters.where('user_id').equals(userId).toArray())
    .filter((row) => !row.deleted_at)
    .sort((a, b) => b.closed_on.localeCompare(a.closed_on) || b.created_at.localeCompare(a.created_at));
}
