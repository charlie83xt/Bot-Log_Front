import type { Scorecard } from '../types/feed';
import { signed } from '../format';

const day = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-emerald-300' : tone === 'down' ? 'text-rose-300' : 'text-slate-100';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-base ${color}`}>{value}</div>
    </div>
  );
}

function Curve({ points }: { points: { night: string; total: number }[] }) {
  if (points.length < 2) return null;
  const W = 600, H = 120, P = 6;
  const vals = [0, ...points.map((p) => p.total)];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(hi - lo, 1);
  const x = (i: number) => P + (i / points.length) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = points[points.length - 1].total;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 h-28 w-full" role="img"
      aria-label={`Running total after costs: ${signed(last)} points`}>
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={last >= 0 ? '#34d399' : '#fb7185'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const LABEL: Record<string, string> = { in: 'held overnight', in_test: 'test mode (no order)', out: 'stayed out' };

export function ScorecardPanel({ card, error }: { card: Scorecard | null; error: string | null }) {
  if (!card && !error) return null;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-sm font-semibold text-slate-200">Overnight rule: live scorecard</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        At 15:55 ET, if price is above its 200-day average, the system holds 1 MES contract until the 09:30 ET open.
        Results are in points (1 point = $5 a contract), with {card ? card.cost_points.toFixed(2) : '0.75'} points of costs
        taken off each night in the totals. The research behind it found about +1.3 to +3.6 points a night on average,
        up on 57% of nights (MES, 2024-2026, before costs). Past results do not promise future ones.
      </p>

      {error && <p className="mt-4 text-sm text-slate-400">Scorecard unavailable ({error}).</p>}
      {card && card.nights.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">The first night is in progress. Results appear after the next 09:30 ET open.</p>
      )}

      {card && card.nights.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Nights held / out" value={`${card.completed} / ${card.nights_out}`} />
            <Tile label="Total after costs" value={`${signed(card.total_after_costs)} pts`}
              tone={card.total_after_costs > 0 ? 'up' : card.total_after_costs < 0 ? 'down' : undefined} />
            <Tile label="Average night" value={card.avg_points != null ? `${signed(card.avg_points)} pts` : '-'} />
            <Tile label="Up nights" value={card.up_share != null ? `${Math.round(card.up_share * 100)}%` : '-'} />
          </div>
          <Curve points={card.curve} />
          <p className="mt-1 text-[11px] text-slate-500">
            Running total after costs since {card.since ? day(card.since) : '-'}. Deepest fall from a high:{' '}
            {card.max_drawdown.toFixed(2)} pts. Longest losing run: {card.longest_losing_run} night{card.longest_losing_run === 1 ? '' : 's'}.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="text-slate-500">
                <tr><th className="py-1 pr-2 font-normal">Night</th><th className="pr-2 font-normal">Decision</th>
                  <th className="pr-2 font-normal">In at</th><th className="pr-2 font-normal">Out at open</th><th className="font-normal">Points</th></tr>
              </thead>
              <tbody className="font-mono text-slate-300">
                {card.nights.slice(0, 15).map((n) => (
                  <tr key={n.night} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2">{day(n.night)}</td>
                    <td className="pr-2 font-sans text-slate-400">{LABEL[n.decision]}</td>
                    <td className="pr-2">{n.entry != null && n.decision !== 'out' ? n.entry.toFixed(2) : '-'}</td>
                    <td className="pr-2">{n.exit != null ? n.exit.toFixed(2) : n.source === 'pending' ? 'tomorrow' : '-'}</td>
                    <td className={n.points == null ? '' : n.points > 0 ? 'text-emerald-300' : n.points < 0 ? 'text-rose-300' : ''}>
                      {n.points != null ? signed(n.points) : '-'}
                      {n.source === 'prices' && <span className="ml-1 font-sans text-[10px] text-slate-500" title="Worked out from market prices, not from an order fill">*</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {card.nights.some((n) => n.source === 'prices') && (
              <p className="mt-2 text-[11px] text-slate-500">* worked out from market prices (test mode or no exit fill reported), not from an order fill.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
