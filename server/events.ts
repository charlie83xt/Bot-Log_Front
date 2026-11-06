// Fixed schema for events sent by the trading bot (feed_publisher.py).
// Anything that does not match exactly is rejected - nothing is filled in with made-up defaults.

export type FeedType = 'overnight' | 'signal' | 'trade_open' | 'trade_close' | 'bot_status';
export type AccountType = 'simulation' | 'live' | 'unknown';

export interface FeedEvent {
  event_id: string;
  type: FeedType;
  occurred_at: string;
  account_type: AccountType;
  [field: string]: string | number | boolean | null;
}

type Spec =
  | { kind: 'enum'; values: readonly string[]; required?: boolean }
  | { kind: 'code'; required?: boolean }
  | { kind: 'num'; min: number; max: number; required?: boolean };

const PRICE: Spec = { kind: 'num', min: 100, max: 100000 };
const POINTS: Spec = { kind: 'num', min: -2000, max: 2000 };
const SIDE: Spec = { kind: 'enum', values: ['buy', 'sell', 'long', 'short'] };
// For positions the side is the position's direction, not the side of the closing order.
const POSITION: Spec = { kind: 'enum', values: ['long', 'short'], required: true };

const SCHEMAS: Record<FeedType, Record<string, Spec>> = {
  overnight: {
    decision: { kind: 'enum', values: ['enter', 'enter_dry_run', 'skip', 'exit', 'exit_failed'], required: true },
    reason: { kind: 'code' },
    price: PRICE,
    average: PRICE,
    average_days: { kind: 'num', min: 1, max: 1000 },
    points: POINTS,
  },
  signal: {
    status: { kind: 'enum', values: ['approved', 'blocked'], required: true },
    setup: { kind: 'code' },
    side: SIDE,
    reason: { kind: 'code' },
  },
  trade_open: {
    side: POSITION,
    setup: { kind: 'code' },
    entry_price: { ...PRICE, required: true } as Spec,
  },
  trade_close: {
    side: POSITION,
    setup: { kind: 'code' },
    entry_price: PRICE,
    exit_price: { ...PRICE, required: true } as Spec,
    points: POINTS,
    exit_reason: { kind: 'code' },
  },
  bot_status: {
    state: { kind: 'enum', values: ['started', 'stopped', 'connected', 'disconnected'], required: true },
  },
};

const COMMON = new Set(['event_id', 'type', 'occurred_at', 'account_type']);
const CODE_RE = /^[A-Za-z0-9_.-]{1,60}$/;

export type Validation = { ok: true; event: FeedEvent } | { ok: false; error: string };

export function validateEvent(raw: unknown, now = Date.now()): Validation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'body must be an object' };
  const r = raw as Record<string, unknown>;

  if (typeof r.event_id !== 'string' || !/^[0-9a-f]{32}$/.test(r.event_id)) return { ok: false, error: 'bad event_id' };
  if (typeof r.type !== 'string' || !(r.type in SCHEMAS)) return { ok: false, error: 'unknown type' };
  const type = r.type as FeedType;

  if (typeof r.occurred_at !== 'string') return { ok: false, error: 'bad occurred_at' };
  const t = Date.parse(r.occurred_at);
  if (!Number.isFinite(t)) return { ok: false, error: 'bad occurred_at' };
  if (t > now + 5 * 60_000 || t < now - 24 * 3600_000) return { ok: false, error: 'occurred_at out of range' };

  if (!['simulation', 'live', 'unknown'].includes(r.account_type as string)) return { ok: false, error: 'bad account_type' };

  const schema = SCHEMAS[type];
  const event: FeedEvent = {
    event_id: r.event_id,
    type,
    occurred_at: new Date(t).toISOString(),
    account_type: r.account_type as AccountType,
  };

  for (const key of Object.keys(r)) {
    if (!COMMON.has(key) && !(key in schema)) return { ok: false, error: `unexpected field ${key}` };
  }
  for (const [key, spec] of Object.entries(schema)) {
    const v = r[key];
    if (v === undefined || v === null) {
      if (spec.required) return { ok: false, error: `missing ${key}` };
      continue;
    }
    if (spec.kind === 'num') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max) return { ok: false, error: `bad ${key}` };
      event[key] = Math.round(v * 100) / 100;
    } else if (spec.kind === 'enum') {
      if (typeof v !== 'string' || !spec.values.includes(v.toLowerCase())) return { ok: false, error: `bad ${key}` };
      event[key] = v.toLowerCase();
    } else {
      if (typeof v !== 'string' || !CODE_RE.test(v)) return { ok: false, error: `bad ${key}` };
      event[key] = v;
    }
  }
  return { ok: true, event };
}
