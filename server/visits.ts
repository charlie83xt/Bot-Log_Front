// Counts page views per day and source (?ref=x, or the referring site). No cookies, no IP addresses,
// nothing that identifies a person - just totals, so you can see which marketing brings people in.
import type { NextFunction, Request, Response } from 'express';
import { sbGet, sbInsert, supabaseConfigured } from './supabase.ts';
import { etParts } from './market.ts';

const pending = new Map<string, number>(); // "day|ref" -> hits not yet saved
const memory: { day: string; ref: string; hits: number }[] = [];
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|monitor|curl|wget|python/i;

const REFERRERS: [RegExp, string][] = [
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)news\.ycombinator\.com$/, 'hn'],
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'linkedin'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)youtube\.com$/, 'youtube'],
];

function source(req: Request): string {
  const ref = String(req.query.ref ?? '').toLowerCase();
  if (/^[a-z0-9_-]{1,20}$/.test(ref)) return ref;
  try {
    const host = new URL(String(req.get('referer') ?? '')).hostname.toLowerCase();
    if (!host || host === req.hostname) return 'direct';
    for (const [re, name] of REFERRERS) if (re.test(host)) return name;
    return 'other';
  } catch {
    return 'direct';
  }
}

export function countVisit(req: Request, _res: Response, next: NextFunction) {
  try {
    const isPage = req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.') &&
      !req.path.startsWith('/admin') && !req.path.startsWith('/@') && !req.path.startsWith('/src');
    if (isPage && !BOT_UA.test(String(req.get('user-agent') ?? ''))) {
      const key = `${etParts(Date.now()).day}|${source(req)}`;
      if (pending.size < 500) pending.set(key, (pending.get(key) ?? 0) + 1);
    }
  } catch {
    /* counting must never break the page */
  }
  next();
}

async function flush() {
  if (!pending.size) return;
  const rows = [...pending].map(([k, hits]) => {
    const [day, ref] = k.split('|');
    return { day, ref, hits };
  });
  pending.clear();
  if (!supabaseConfigured()) {
    memory.push(...rows);
    return;
  }
  try {
    await sbInsert('page_visits', rows);
  } catch (err) {
    console.warn('visit counts not saved:', (err as Error).message);
  }
}
setInterval(flush, 10 * 60_000).unref();

/** Totals for the last `days` days: { day: { ref: hits } }, including not-yet-saved counts. */
export async function visitTotals(days = 14): Promise<Record<string, Record<string, number>>> {
  const since = etParts(Date.now() - days * 86400_000).day;
  const rows = supabaseConfigured()
    ? await sbGet<{ day: string; ref: string; hits: number }>(`page_visits?select=day,ref,hits&day=gte.${since}&limit=5000`)
    : memory.filter((r) => r.day >= since);
  const out: Record<string, Record<string, number>> = {};
  const add = (day: string, ref: string, hits: number) => {
    out[day] ??= {};
    out[day][ref] = (out[day][ref] ?? 0) + hits;
  };
  rows.forEach((r) => add(r.day, r.ref, r.hits));
  for (const [k, hits] of pending) {
    const [day, ref] = k.split('|');
    add(day, ref, hits);
  }
  return out;
}
