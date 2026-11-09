import { useState } from 'react';
import { Heart, Share2 } from 'lucide-react';
import { useFeed } from './hooks/useFeed';
import { useJson } from './hooks/useJson';
import type { MarketSnapshot, ResearchStats, SupportInfo } from './types/feed';
import { MarketPanel } from './components/MarketPanel';
import { FeedList } from './components/FeedList';
import { StatsPanel } from './components/StatsPanel';
import { SupportModal } from './components/SupportModal';

export default function App() {
  const feed = useFeed();
  const market = useJson<MarketSnapshot>('/api/market', 60_000);
  const stats = useJson<ResearchStats>('/api/stats');
  const support = useJson<SupportInfo>('/api/support');
  const [showSupport, setShowSupport] = useState(false);
  const [showLogo, setShowLogo] = useState(true);
  const canSupport = !!support.data && (!!support.data.paypal || support.data.crypto.length > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {showLogo && (
              <img src="/logo.png" alt="" width={40} height={40} onError={() => setShowLogo(false)}
                className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-slate-700" />
            )}
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white">S&amp;P Futures Bot Log</h1>
              <p className="text-xs text-slate-500">One automated system's view of the ES/MES market, in plain English</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('A plain-English, delayed log of what one automated S&P 500 futures system does, with the research behind it:')}&url=${encodeURIComponent(`${window.location.origin}/?ref=share`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-sky-500/50 hover:text-sky-300">
            <Share2 size={13} /> Share
          </a>
          {support.data?.x_handle && (
            <a href={`https://x.com/${support.data.x_handle}`} target="_blank" rel="noopener noreferrer"
              className="hidden rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-white sm:block">
              Follow @{support.data.x_handle}
            </a>
          )}
          {canSupport && (
            <button onClick={() => setShowSupport(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500/50 hover:text-amber-300">
              <Heart size={13} /> Support
            </button>
          )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <MarketPanel m={market.data} error={market.error} />
          <FeedList items={feed.items} live={feed.live} delay={feed.delay} error={feed.error} />
        </div>
        <div className="lg:col-span-2">
          <StatsPanel stats={stats.data} />
        </div>
      </main>

      <footer className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-5 text-xs leading-relaxed text-slate-500">
          <p>Information about one automated system's view of the ES/MES market. Not advice.</p>
          <p className="mt-1">
            Nothing here is a recommendation to buy or sell anything. Market data is delayed. Futures trading can lose more than
            the money put in. Research figures describe the past and may not repeat.
          </p>
        </div>
      </footer>

      {showSupport && support.data && <SupportModal info={support.data} onClose={() => setShowSupport(false)} />}
    </div>
  );
}
