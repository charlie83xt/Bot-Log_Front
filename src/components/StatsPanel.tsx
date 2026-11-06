import type { ResearchStats } from '../types/feed';

export function StatsPanel({ stats }: { stats: ResearchStats | null }) {
  if (!stats) return null;
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-sm font-semibold text-slate-200">What the research found</h2>
      <p className="mt-1 text-xs text-slate-500">{stats.note}</p>
      <ul className="mt-4 space-y-3">
        {stats.items.map((s) => (
          <li key={s.title} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <div className="text-xs text-slate-400">{s.title}</div>
            <div className="mt-1 font-mono text-sm text-amber-300">{s.value}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.detail}</p>
            <div className="mt-1 text-[11px] text-slate-500">{s.sample} - {s.period}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
