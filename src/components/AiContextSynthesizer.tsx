import React, { useState } from 'react';
import { BotLogEntry, MarketContext } from '../types/futures';
import {
  Sparkles,
  RefreshCw,
  Send,
  HelpCircle,
  Shield,
  Compass,
  AlertTriangle,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface AiContextSynthesizerProps {
  logs: BotLogEntry[];
  context: MarketContext;
}

interface SynthesisResult {
  executiveSummary: string;
  marketRegime: string;
  volatilityFilterDiagnosis: string;
  stopLossAudit: string;
  actionablePlaybook: string[];
  sizingAndRiskGuidance: string;
}

export const AiContextSynthesizer: React.FC<AiContextSynthesizerProps> = ({
  logs,
  context,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [userQuery, setUserQuery] = useState<string>('');
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const quickQuestions = [
    'Why did the bot reject trades during the last expansion?',
    'Are my automated stop losses placed too close to current ATR?',
    'How should I manage my ES vs MES position sizing today?',
    'What is the likelihood of mean reversion back to VWAP within 1 hour?',
  ];

  const handleSynthesize = async (queryToUse?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/synthesize-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.slice(-20),
          marketContext: context,
          userQuery: queryToUse !== undefined ? queryToUse : userQuery,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setSynthesis(data);
    } catch (err: any) {
      console.error('Synthesis failed:', err);
      setError(err.message || 'Unable to connect to AI synthesis engine.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-5 shadow-sm text-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              AI Market Context & Bot Log Intelligence Synthesizer
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Powered by Gemini 3.8 Flash · Evaluates mean-reversion drift, volatility traps, and risk artifacts
          </span>
        </div>

        <button
          onClick={() => handleSynthesize()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 font-mono font-bold rounded transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Logs...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>Run Synthesis</span>
            </>
          )}
        </button>
      </div>

      {/* Query Bar */}
      <div className="flex flex-col gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSynthesize(userQuery);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            placeholder="Ask the Quantitative Risk Officer a specific question about these bot logs..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3 h-3 text-amber-400" />
            <span>Ask</span>
          </button>
        </form>

        {/* Quick prompt chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500 font-mono">Quick Inquiries:</span>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUserQuery(q);
                handleSynthesize(q);
              }}
              className="text-[11px] text-slate-400 hover:text-amber-300 bg-slate-950/80 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-800 transition-colors truncate max-w-xs"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Synthesis Output Display */}
      {synthesis ? (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {/* Executive Summary */}
          <div className="bg-slate-950 p-4 rounded border border-amber-500/30">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span className="font-bold uppercase tracking-wider">Executive Synthesis</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{synthesis.marketRegime}</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {synthesis.executiveSummary}
            </p>
          </div>

          {/* Grid: Volatility Diagnosis + Stop Loss Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/80 p-4 rounded border border-slate-800">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase flex items-center gap-1.5 mb-2">
                <Flame className="w-3.5 h-3.5" />
                Volatility Filter Diagnosis
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {synthesis.volatilityFilterDiagnosis}
              </p>
            </div>

            <div className="bg-slate-950/80 p-4 rounded border border-slate-800">
              <span className="text-xs font-mono font-bold text-rose-400 uppercase flex items-center gap-1.5 mb-2">
                <Shield className="w-3.5 h-3.5" />
                Stop-Loss & Risk Management Audit
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {synthesis.stopLossAudit}
              </p>
            </div>
          </div>

          {/* Actionable Playbook */}
          <div className="bg-slate-950/80 p-4 rounded border border-slate-800">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center gap-1.5 mb-2.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Actionable Trader Playbook (Next 30-60 Minutes)
            </span>
            <ul className="space-y-2">
              {synthesis.actionablePlaybook.map((action, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <span className="text-amber-400 font-mono font-bold">{i + 1}.</span>
                  <span className="leading-relaxed">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sizing & Capital Guidance */}
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/80 text-xs text-slate-400 font-mono flex items-center justify-between">
            <span className="text-slate-300">Sizing & Risk Guidance:</span>
            <span className="text-amber-400 font-semibold">{synthesis.sizingAndRiskGuidance}</span>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-950/40 rounded border border-slate-800/80 text-xs text-slate-500 font-mono">
          Click <span className="text-amber-400 font-bold">Run Synthesis</span> or ask a question above to generate real-time quantitative context and actionable advice for current bot logs.
        </div>
      )}
    </div>
  );
};
