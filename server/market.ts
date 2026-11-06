// Market snapshot computed from ES-Collector's 1-minute bars in Supabase (table market_bars_1m)
// and the regular-hours daily view rth_daily. Everything is shown with a fixed public delay.
import { sbGet, sbGetAll, supabaseConfigured } from './supabase.ts';

interface Bar { ts: string; open: number; high: number; low: number; close: number; volume: number | null }
interface Daily { day: string; open: number; high: number; low: number; close: number; volume: number | null; bars: number }

export interface MarketSnapshot {
  symbol: string;
  delay_minutes: number;
  as_of: string;
  last: number;
  previous_close: number | null;
  change: number | null;
  change_pct: number | null;
  session: {
    day: string;
    status: 'open' | 'closed';
    open: number;
    high: number;
    low: number;
    vwap: number | null;
    opening_range: { high: number; low: number } | null;
  };
  previous: { day: string; high: number; low: number; close: number } | null;
  average: { days: number; value: number | null; days_available: number; price_above: boolean | null };
  chart: { t: string; c: number }[];
}

// ---------- New York time helpers ----------
const ET = 'America/New_York';
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: ET, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
});

export function etParts(ms: number) {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: p.weekday,
    wallAsUtc: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second),
  };
}

/** UTC milliseconds for a New York wall-clock time (day = YYYY-MM-DD). */
export function etToUtc(day: string, hh: number, mm: number): number {
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - (etParts(guess).wallAsUtc - guess);
  return guess;
}

const OPEN = 9 * 60 + 30, CLOSE = 16 * 60, OR_END = 9 * 60 + 45;

// ---------- caches ----------
let dailyCache: { at: number; symbol: string; rows: Daily[] } | null = null;
let snapCache: { at: number; snap: MarketSnapshot } | null = null;

async function dailyRows(symbol: string): Promise<Daily[]> {
  if (dailyCache && dailyCache.symbol === symbol && Date.now() - dailyCache.at < 3600_000) return dailyCache.rows;
  const rows = await sbGet<Daily>(
    `rth_daily?select=day,open,high,low,close,volume,bars&symbol=eq.${encodeURIComponent(symbol)}&order=day.desc&limit=260`,
    30000,
  );
  dailyCache = { at: Date.now(), symbol, rows: rows.map(numify) };
  return dailyCache.rows;
}

function numify<T extends object>(row: T): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of ['open', 'high', 'low', 'close', 'volume']) if (out[k] != null) out[k] = r2(Number(out[k]));
  return out as unknown as T;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function marketConfigured() {
  return supabaseConfigured();
}

export async function getSnapshot(): Promise<MarketSnapshot | null> {
  if (snapCache && Date.now() - snapCache.at < 60_000) return snapCache.snap;
  const symbol = process.env.FEED_SYMBOL?.trim() || 'MES_CONTFUT';
  const delayMin = Number(process.env.PUBLIC_DELAY_MIN ?? 10) || 10;
  const cutoff = Date.now() - delayMin * 60_000;
  // only bars that had fully finished before the cutoff
  const lastOpenAllowed = new Date(cutoff - 60_000).toISOString();

  const latest = await sbGet<Bar>(
    `market_bars_1m?select=ts,open,high,low,close,volume&symbol=eq.${encodeURIComponent(symbol)}` +
      `&ts=lte.${encodeURIComponent(lastOpenAllowed)}&order=ts.desc&limit=1`,
  );
  if (!latest.length) return null;
  const lastBar = numify(latest[0]);
  const lastMs = Date.parse(lastBar.ts);

  const daily = await dailyRows(symbol);
  const now = etParts(lastMs);
  const weekday = !['Sat', 'Sun'].includes(now.weekday);
  // The session shown is today's regular session once it has opened, otherwise the latest finished one.
  const fallbackDay = daily.find((d) => d.day < now.day)?.day ?? null;
  const loadSession = async (day: string) => {
    const open = etToUtc(day, 9, 30);
    const close = etToUtc(day, 16, 0);
    const bars = (
      await sbGetAll<Bar>(
        `market_bars_1m?select=ts,open,high,low,close,volume&symbol=eq.${encodeURIComponent(symbol)}` +
          `&ts=gte.${encodeURIComponent(new Date(open).toISOString())}` +
          `&ts=lte.${encodeURIComponent(lastOpenAllowed)}&order=ts.asc`,
        6000,
      )
    ).map(numify);
    const rth = bars.filter((b) => {
      const t = Date.parse(b.ts);
      return t >= open && t < close;
    });
    return { day, open, close, bars, rth };
  };
  let s = weekday && now.minutes >= OPEN ? await loadSession(now.day) : null;
  if (!s?.rth.length && fallbackDay) s = await loadSession(fallbackDay); // weekend, holiday or before the open
  if (!s?.rth.length) return null;
  const { day: sessionDay, open: sessionOpen, close: sessionClose, bars, rth } = s;

  let pv = 0, vol = 0;
  for (const b of rth) {
    const v = b.volume ?? 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
  }
  const orBars = rth.filter((b) => Date.parse(b.ts) < etToUtc(sessionDay, 9, 45));
  const orDone = rth.some((b) => etParts(Date.parse(b.ts)).minutes >= OR_END);

  const prev = daily.find((d) => d.day < sessionDay) ?? null;
  const sessionDone = lastMs >= sessionClose - 60_000;
  // Closes used for the long average: finished regular sessions only.
  const finished = daily.filter((d) => d.day < sessionDay || (d.day === sessionDay && sessionDone));
  const closes = finished.slice(0, 200).map((d) => d.close);
  const avgDays = 200;
  const avg = closes.length >= avgDays ? r2(closes.reduce((a, b) => a + b, 0) / closes.length) : null;

  // Chart: every bar since the session open, thinned to at most ~400 points.
  const step = Math.max(1, Math.ceil(bars.length / 400));
  const chart = bars.filter((_, i) => i % step === 0 || i === bars.length - 1).map((b) => ({ t: b.ts, c: b.close }));

  const last = lastBar.close;
  const snap: MarketSnapshot = {
    symbol: symbol.replace(/_CONTFUT$/, ''),
    delay_minutes: delayMin,
    as_of: new Date(lastMs + 60_000).toISOString(),
    last,
    previous_close: prev ? prev.close : null,
    change: prev ? r2(last - prev.close) : null,
    change_pct: prev ? r2(((last - prev.close) / prev.close) * 100) : null,
    session: {
      day: sessionDay,
      status: sessionDone || lastMs < sessionOpen ? 'closed' : 'open',
      open: rth[0].open,
      high: Math.max(...rth.map((b) => b.high)),
      low: Math.min(...rth.map((b) => b.low)),
      vwap: vol > 0 ? r2(pv / vol) : null,
      opening_range: orDone && orBars.length
        ? { high: Math.max(...orBars.map((b) => b.high)), low: Math.min(...orBars.map((b) => b.low)) }
        : null,
    },
    previous: prev ? { day: prev.day, high: prev.high, low: prev.low, close: prev.close } : null,
    average: { days: avgDays, value: avg, days_available: closes.length, price_above: avg === null ? null : last > avg },
    chart,
  };
  snapCache = { at: Date.now(), snap };
  return snap;
}
