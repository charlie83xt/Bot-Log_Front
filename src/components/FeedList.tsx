import { Activity, Moon, Power, Radio, Target } from 'lucide-react';
import type { FeedItem } from '../types/feed';
import { ago, etDateTime } from '../format';

const ICON = { overnight: Moon, signal: Target, trade_open: Activity, trade_close: Activity, bot_status: Power };
const LABEL = { overnight: 'Overnight rule', signal: 'Signal', trade_open: 'Position opened', trade_close: 'Position closed', bot_status: 'System' };

export function FeedList({ items, live, delay, error }: { items: FeedItem[]; live: boolean; delay: number | null; error: string | null }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-200">What the system did</h2>
        <span className={`flex items-center gap-1.5 text-[11px] ${live ? 'text-emerald-400' : 'text-slate-500'}`}>
          <Radio size={12} /> {live ? 'live' : 'reconnecting'}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Each entry appears {delay ?? 10} minutes after it happens. Positions are on a simulation account unless marked live.
      </p>

      {error && <p className="mt-4 text-sm text-rose-300">Feed unavailable ({error}).</p>}
      {!error && items.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">
          Nothing yet. The overnight rule makes its decision at 15:55 ET on trading days.
        </p>
      )}

      <ol className="mt-4 space-y-3">
        {items.map((it) => {
          const Icon = ICON[it.type] ?? Activity;
          return (
            <li key={it.id} className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <Icon size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-300">{LABEL[it.type] ?? it.type}</span>
                  <span title={etDateTime(it.occurred_at)}>{etDateTime(it.occurred_at)} - {ago(it.occurred_at)}</span>
                  {it.account_type === 'live'
                    ? <span className="rounded bg-amber-500/10 px-1.5 text-amber-300">live account</span>
                    : <span className="rounded bg-slate-800 px-1.5 text-slate-400">simulation</span>}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">{it.narration}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
