// Where feed events live: the Supabase table feed_events, or memory when Supabase is not set up
// (memory is only for local testing - it is lost on restart).
import { sbGet, sbInsertIgnore, supabaseConfigured } from './supabase.ts';
import type { FeedEvent } from './events.ts';

export interface FeedRow {
  id: number;
  event_id: string;
  type: string;
  occurred_at: string;
  public_at: string;
  payload: FeedEvent;
  narration: string;
  narration_source: 'template' | 'llm';
}

type NewRow = Omit<FeedRow, 'id'>;

const memory: FeedRow[] = [];
let memoryId = 0;

export const storageKind = () => (supabaseConfigured() ? 'supabase' : 'memory');

export async function eventExists(eventId: string): Promise<boolean> {
  if (!supabaseConfigured()) return memory.some((r) => r.event_id === eventId);
  const rows = await sbGet<{ id: number }>(`feed_events?select=id&event_id=eq.${eventId}&limit=1`);
  return rows.length > 0;
}

export async function insertEvent(row: NewRow): Promise<boolean> {
  if (!supabaseConfigured()) {
    if (memory.some((r) => r.event_id === row.event_id)) return false;
    memory.push({ id: ++memoryId, ...row });
    if (memory.length > 2000) memory.shift();
    return true;
  }
  return sbInsertIgnore('feed_events', row, 'event_id');
}

const COLS = 'id,event_id,type,occurred_at,public_at,payload,narration,narration_source';

/** Newest public events (public_at already passed), newest first. */
export async function latestPublic(limit: number, before?: number): Promise<FeedRow[]> {
  const nowIso = new Date().toISOString();
  if (!supabaseConfigured()) {
    return memory
      .filter((r) => r.public_at <= nowIso && (before === undefined || r.id < before))
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }
  const beforeQ = before !== undefined ? `&id=lt.${before}` : '';
  return sbGet<FeedRow>(
    `feed_events?select=${COLS}&public_at=lte.${encodeURIComponent(nowIso)}${beforeQ}&order=id.desc&limit=${limit}`,
  );
}
