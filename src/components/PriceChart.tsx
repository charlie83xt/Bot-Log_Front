import type { MarketSnapshot } from '../types/feed';
import { etClock, pts } from '../format';

const W = 800, H = 260, PAD = 8;

interface Level { key: string; label: string; value: number; color: string; dash?: string }

export function PriceChart({ m }: { m: MarketSnapshot }) {
  const closes = m.chart.map((p) => p.c);
  if (closes.length < 2) return <p className="text-sm text-slate-400">Not enough bars yet for a chart.</p>;
  const lo = Math.min(...closes), hi = Math.max(...closes);
  const span = Math.max(hi - lo, 1);

  const candidates: Level[] = [];
  if (m.session.vwap != null) candidates.push({ key: 'vwap', label: 'Session VWAP', value: m.session.vwap, color: '#f59e0b' });
  if (m.session.opening_range) {
    candidates.push({ key: 'orh', label: 'Opening range high', value: m.session.opening_range.high, color: '#38bdf8', dash: '4 4' });
    candidates.push({ key: 'orl', label: 'Opening range low', value: m.session.opening_range.low, color: '#38bdf8', dash: '4 4' });
  }
  if (m.previous) {
    candidates.push({ key: 'pdh', label: 'Previous high', value: m.previous.high, color: '#94a3b8', dash: '2 6' });
    candidates.push({ key: 'pdl', label: 'Previous low', value: m.previous.low, color: '#94a3b8', dash: '2 6' });
    candidates.push({ key: 'pdc', label: 'Previous close', value: m.previous.close, color: '#cbd5e1', dash: '8 4' });
  }
  if (m.average.value != null)
    candidates.push({ key: 'avg', label: `${m.average.days}-day average`, value: m.average.value, color: '#a78bfa', dash: '10 4' });

  const shown = candidates.filter((l) => l.value >= lo - span * 0.6 && l.value <= hi + span * 0.6);
  const yMin = Math.min(lo, ...shown.map((l) => l.value));
  const yMax = Math.max(hi, ...shown.map((l) => l.value));
  const yr = Math.max(yMax - yMin, 1);
  const x = (i: number) => PAD + (i / (closes.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - yMin) / yr) * (H - 2 * PAD);
  const d = closes.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join('');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-56 w-full sm:h-64" role="img"
        aria-label={`${m.symbol} price since the ${m.session.day} open, delayed ${m.delay_minutes} minutes`}>
        {shown.map((l) => (
          <line key={l.key} x1={PAD} x2={W - PAD} y1={y(l.value)} y2={y(l.value)} stroke={l.color}
            strokeWidth={1.2} strokeDasharray={l.dash} vectorEffect="non-scaling-stroke" opacity={0.85} />
        ))}
        <path d={d} fill="none" stroke="#e2e8f0" strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-500">
        <span>{etClock(m.chart[0].t)} ET</span>
        <span>{etClock(m.chart[m.chart.length - 1].t)} ET</span>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {candidates.map((l) => (
          <li key={l.key} className="flex items-center gap-2 text-slate-400">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" x2="22" y1="3" y2="3" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash} />
            </svg>
            <span className="flex-1">{l.label}</span>
            <span className="font-mono text-slate-300">{pts(l.value)}</span>
            {!shown.includes(l) && <span className="text-[10px] text-slate-500">(off chart)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
