import { TrendingDown, TrendingUp } from 'lucide-react';
import type { MarketSnapshot } from '../types/feed';
import { etDateTime, pts, signed } from '../format';
import { PriceChart } from './PriceChart';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-base text-slate-100">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function MarketPanel({ m, error }: { m: MarketSnapshot | null; error: string | null }) {
  if (!m) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-slate-200">Market</h2>
        <p className="mt-2 text-sm text-slate-400">{error ? `Market data unavailable (${error}).` : 'Loading market data...'}</p>
      </section>
    );
  }
  const up = (m.change ?? 0) >= 0;
  const avg = m.average;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            {m.symbol} futures <span className="font-normal text-slate-500">(S&amp;P 500)</span>
          </h2>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold text-white">{pts(m.last)}</span>
            {m.change != null && (
              <span className={`flex items-center gap-1 font-mono text-sm ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
                {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {signed(m.change)} ({signed(m.change_pct, '%')})
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            As of {etDateTime(m.as_of)} - delayed {m.delay_minutes} min - change vs previous regular-session close
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${m.session.status === 'open' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
          Regular session {m.session.status === 'open' ? 'open' : 'closed'} ({m.session.day})
        </span>
      </div>

      <div className="mt-4">
        <PriceChart m={m} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Session VWAP" value={pts(m.session.vwap)} hint="volume-weighted average price" />
        <Stat label="Session range" value={`${pts(m.session.low)} - ${pts(m.session.high)}`} />
        <Stat label="Opening range" value={m.session.opening_range ? `${pts(m.session.opening_range.low)} - ${pts(m.session.opening_range.high)}` : '-'} hint="09:30-09:45 ET" />
        <Stat
          label={`${avg.days}-day average`}
          value={avg.value != null ? pts(avg.value) : 'n/a'}
          hint={avg.value != null
            ? `price is ${avg.price_above ? 'above' : 'below'} it`
            : `needs ${avg.days} sessions, have ${avg.days_available}`}
        />
      </div>
    </section>
  );
}
