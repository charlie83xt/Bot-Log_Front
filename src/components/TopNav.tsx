import React from 'react';
import { Activity, UploadCloud, Play, Square, Download, Sparkles } from 'lucide-react';

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenIngestModal: () => void;
  onOpenBotConnectModal: () => void;
  onOpenDonationModal: () => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onSynthesize: () => void;
  sseConnected: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenIngestModal,
  onOpenBotConnectModal,
  onOpenDonationModal,
  isSimulating,
  onToggleSimulation,
  onSynthesize,
  sseConnected,
}) => {
  const navItems = [
    { id: 'overview', label: 'Action Helpers & Context' },
    { id: 'risk_audit', label: 'Risk Artifacts & Stops' },
    { id: 'logs', label: 'Bot Execution Logs' },
    { id: 'ai_synthesis', label: 'AI Market Intelligence' },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-slate-100 select-none">
      {/* Zone 1: Single text wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-slate-950 text-sm shadow-inner">
          Æ
        </div>
        <div className="flex flex-col">
          <a
            href="/"
            className="text-base font-bold tracking-tight text-white hover:text-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Aequitas Terminal
          </a>
          <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
            S&P 500 (ES/MES) Mean Reversion
          </span>
        </div>
      </div>

      {/* Zone 2: 4 single-line text nav links */}
      <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`cursor-pointer whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
              activeTab === item.id
                ? 'text-amber-400 border-amber-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: Primary Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Connect Bot Webhook button */}
        <button
          onClick={onOpenBotConnectModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-amber-500/50"
          title="Connect external GitHub trading bot via Webhook"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
          <span>Connect Bot</span>
        </button>

        {/* Live Simulation button */}
        <button
          onClick={onToggleSimulation}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 border ${
            isSimulating
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title={isSimulating ? 'Stop live tick simulation' : 'Start live bot feed simulation'}
        >
          {isSimulating ? (
            <>
              <Square className="w-3 h-3 fill-emerald-400" />
              <span>Simulating</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-slate-300" />
              <span>Simulate</span>
            </>
          )}
        </button>

        {/* Subtle Support Cloud Hosting button */}
        <button
          onClick={onOpenDonationModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-300 border border-slate-700"
          title="Help fund 24/7 cloud runtime and CME data feeds"
        >
          <span className="text-rose-400">♥</span>
          <span>Support Cloud</span>
        </button>

        {/* Ingest Logs button */}
        <button
          onClick={onOpenIngestModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-500 transition-colors whitespace-nowrap shrink-0 shadow-sm font-semibold"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Ingest Logs</span>
        </button>
      </div>
    </header>
  );
};
