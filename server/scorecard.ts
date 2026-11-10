// Overnight-rule scorecard: every night the rule was "in", what happened from its 15:55 ET entry price
// to the next regular-session open (09:30 ET). Uses the bot's own exit result when there is one;
// otherwise (test mode, or a missed exit) it is computed from the 1-minute bars and marked as such.
import { sbGet, supabaseConfigured } from './supabase.ts';
import { etParts, etToUtc } from './market.ts';
import type { FeedRow } from './store.ts';

export interface Night {
  night: string;                     // ET date of the 15:55 decision
  decision: 'in' | 'in_test' | 'out';
  reason: string | null;             // for "out" nights
  account: string;
  entry: number | null;
  exit: number | null;
  exit_day: string | null;
  points: number | null;             // before costs
  source: 'fill' | 'prices' | 'pending' | null;
}

export interface Scorecard {
  since: string | null;
  nights_in: number;
  nights_out: number;
  completed: number;
  total_points: number;
  total_after_costs: number;
  avg_points: number | null;
  up_share: number | null;
  worst_night: number | null;
  max_drawdown: number;
  longest_losing_run: number;
  cost_points: number;
  curve: { night: string; total: number }[];
  nights: Night[];
}

// $3.74 per MES round trip (commission + one tick of slippage each side) = 0.748 points at $5 a point.
const COST_POINTS = 0.75;
const r2 = (x: number) => Math.round(x * 100) / 100;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

let cache: { at: number; card: Scorecard } | null = null;
const opens = new Map<string, number | null>(); // "symbol|day" -> 09:30 open (null = no bar that day)

async function openAt0930(symbol: string, day: string): Promise<number | null> {
  const key = `${symbol}|${day}`;
  if (opens.has(key)) return opens.get(key)!;
  const ts = new Date(etToUtc(day, 9, 30)).toISOString();
  const rows = await sbGet<{ open: number }>(
    `market_bars_1m?select=open&symbol=eq.${encodeURIComponent(symbol)}&ts=eq.${encodeURIComponent(ts)}&limit=1`,
  );
  const v = rows.length ? Math.round(Number(rows[0].open) * 100) / 100 : null;
  opens.set(key, v);
  return v;
}

/** First regular-session open after `night`, skipping weekends and holidays (no 09:30 bar). */
async function nextOpen(symbol: string, night: string, cutoffMs: number): Promise<{ day: string; open: number } | 'pending' | null> {
  for (let i = 1; i <= 6; i++) {
    const day = addDays(night, i);
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    if (etToUtc(day, 9, 31) > cutoffMs) return 'pending'; // not public yet
    const o = await openAt0930(symbol, day);
    if (o !== null) return { day, open: o };
  }
  return null;
}

export function summarise(nights: Night[]): Scorecard {
  const done = nights.filter((n) => n.decision !== 'out' && n.points !== null);
  let total = 0, peak = 0, dd = 0, run = 0, worstRun = 0;
  const curve: { night: string; total: number }[] = [];
  for (const n of done) {
    total += n.points! - COST_POINTS;
    peak = Math.max(peak, total);
    dd = Math.min(dd, total - peak);
    run = n.points! < 0 ? run + 1 : 0;
    worstRun = Math.max(worstRun, run);
    curve.push({ night: n.night, total: r2(total) });
  }
  const pts = done.map((n) => n.points!);
  return {
    since: nights.length ? nights[0].night : null,
    nights_in: nights.filter((n) => n.decision !== 'out').length,
    nights_out: nights.filter((n) => n.decision === 'out').length,
    completed: done.length,
    total_points: r2(pts.reduce((a, b) => a + b, 0)),
    total_after_costs: r2(total),
    avg_points: pts.length ? r2(pts.reduce((a, b) => a + b, 0) / pts.length) : null,
    up_share: pts.length ? r2(pts.filter((p) => p > 0).length / pts.length) : null,
    worst_night: pts.length ? Math.min(...pts) : null,
    max_drawdown: r2(dd),
    longest_losing_run: worstRun,
    cost_points: COST_POINTS,
    curve,
    nights: [...nights].reverse(),
  };
}

export async function getScorecard(): Promise<Scorecard | null> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.card;
  if (!supabaseConfigured()) return null;
  const delayMin = Number(process.env.PUBLIC_DELAY_MIN ?? 10) || 10;
  const cutoff = Date.now() - delayMin * 60_000;
  const symbol = process.env.OVERNIGHT_SYMBOL?.trim() || 'MES_CONTFUT';

  const rows = await sbGet<FeedRow>(
    `feed_events?select=id,event_id,type,occurred_at,public_at,payload,narration,narration_source` +
      `&type=eq.overnight&public_at=lte.${encodeURIComponent(new Date().toISOString())}&order=occurred_at.asc&limit=1000`,
  );

  // One decision per night (the last one wins if the bot re-ran), and the exit results that follow them.
  const decisions = new Map<string, FeedRow>();
  const exits: FeedRow[] = [];
  for (const r of rows) {
    const d = String(r.payload.decision);
    if (['enter', 'enter_dry_run', 'skip'].includes(d)) decisions.set(etParts(Date.parse(r.occurred_at)).day, r);
    else if (d === 'exit') exits.push(r);
  }

  const nights: Night[] = [];
  for (const [night, r] of [...decisions].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const d = String(r.payload.decision);
    // Skips caused by something other than the price rule (wrong account, bot paused...) are not
    // results of the rule, so they are left out of the scorecard.
    if (d === 'skip' && r.payload.reason !== 'below_average') continue;
    const base: Night = {
      night,
      decision: d === 'enter' ? 'in' : d === 'enter_dry_run' ? 'in_test' : 'out',
      reason: d === 'skip' ? String(r.payload.reason) : null,
      account: String(r.payload.account_type),
      entry: typeof r.payload.price === 'number' ? r.payload.price : null,
      exit: null, exit_day: null, points: null, source: null,
    };
    if (base.decision === 'out' || base.entry === null) {
      nights.push(base);
      continue;
    }
    const next = await nextOpen(symbol, night, cutoff);
    const fill = exits.find((x) => {
      const t = Date.parse(x.occurred_at);
      return t > Date.parse(r.occurred_at) && (!next || next === 'pending' || etParts(t).day <= next.day);
    });
    if (fill && typeof fill.payload.points === 'number') {
      nights.push({ ...base, points: fill.payload.points, exit: r2(base.entry + fill.payload.points), exit_day: etParts(Date.parse(fill.occurred_at)).day, source: 'fill' });
    } else if (next && next !== 'pending') {
      nights.push({ ...base, exit: next.open, exit_day: next.day, points: r2(next.open - base.entry), source: 'prices' });
    } else {
      nights.push({ ...base, source: next === 'pending' ? 'pending' : null });
    }
  }

  const card = summarise(nights);
  cache = { at: Date.now(), card };
  return card;
}
