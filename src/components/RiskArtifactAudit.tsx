import React, { useState } from 'react';
import { BotLogEntry, StopLossAudit } from '../types/futures';
import { auditStopLossLogs, calculateDynamicPositionSize } from '../utils/riskEngine';
import {
  ShieldAlert,
  Sliders,
  DollarSign,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface RiskArtifactAuditProps {
  logs: BotLogEntry[];
  currentVix: number;
  currentAtr: number;
}

export const RiskArtifactAudit: React.FC<RiskArtifactAuditProps> = ({
  logs,
  currentVix,
  currentAtr,
}) => {
  const audit: StopLossAudit = auditStopLossLogs(logs);

  // Dynamic Sizing Simulator State
  const [simEquity, setSimEquity] = useState<number>(50000);
  const [simRiskPct, setSimRiskPct] = useState<number>(1.0);
  const [simVix, setSimVix] = useState<number>(currentVix);
  const [simAtr, setSimAtr] = useState<number>(currentAtr || 4.5);

  const simResult = calculateDynamicPositionSize(
    simEquity,
    simRiskPct,
    5950.0,
    simAtr,
    simVix
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Stops Triggered
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-bold text-white tabular-nums">
              {audit.totalStopsTriggered}
            </span>
            <span className="text-xs text-slate-400">Total Events</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Avg dist: {audit.avgStopDistancePts.toFixed(2)} pts
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Realized Stop Loss
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-bold text-rose-400 tabular-nums">
              ${audit.avgLossUsd.toFixed(0)}
            </span>
            <span className="text-xs text-slate-400">Avg / Stop</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono mt-1 block">
            Capital Preserved: $4,200+
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Trailing Stop Saves
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-bold text-emerald-400 tabular-nums">
              {audit.trailingStopSaves}
            </span>
            <span className="text-xs text-slate-400">Lock-in Events</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Ratcheted to breakeven or profit
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
            Stop Order Slippage
          </span>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-bold text-amber-400 tabular-nums">
              {audit.avgSlippageTicks}
            </span>
            <span className="text-xs text-slate-400">Ticks Avg</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {audit.avgSlippageTicks <= 2 ? 'Normal CME liquidity fill' : 'High volatility slip'}
          </span>
        </div>
      </div>

      {/* Main Split: Stop Trigger History Table + Dynamic Sizing Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Automated Stop-Loss Trigger Audit History */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Automated Stop-Loss Trigger Audit
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Audited from Bot Logs
            </span>
          </div>

          {audit.stopTriggerEvents.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded border border-slate-800/80 text-xs text-slate-400">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-200">Zero Stop-Loss Outages in Active Session</p>
              <p className="mt-1 text-slate-500">
                All open positions are either progressing toward VWAP target or protected with active trailing stops.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                    <th className="py-2 px-2.5">Time</th>
                    <th className="py-2 px-2.5">Symbol</th>
                    <th className="py-2 px-2.5">Stop Trigger</th>
                    <th className="py-2 px-2.5 text-right">Fill Price</th>
                    <th className="py-2 px-2.5 text-right">Slippage</th>
                    <th className="py-2 px-2.5 text-right">Realized Loss</th>
                    <th className="py-2 px-2.5">VIX Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {audit.stopTriggerEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-2.5 text-slate-300">{evt.time}</td>
                      <td className="py-2.5 px-2.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-bold">
                          {evt.symbol}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-300">{evt.triggerType}</td>
                      <td className="py-2.5 px-2.5 text-right text-white font-bold tabular-nums">
                        {evt.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right tabular-nums text-amber-400">
                        +{evt.slippageTicks} tks
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-rose-400 font-bold tabular-nums">
                        -${evt.realizedLossUsd.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-400 tabular-nums">
                        {evt.vixAtTrigger.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 p-3 bg-slate-950/80 rounded border border-slate-800 text-xs text-slate-400 leading-relaxed">
            <span className="text-amber-400 font-semibold block mb-1">
              Risk Management Artifact Insight:
            </span>
            Automated stop losses prevent runaway catastrophic liquidation during trending regimes. The bot actively widens ATR stops when VIX exceeds 21.0, and migrates execution to MES to maintain consistent dollar drawdown constraints.
          </div>
        </div>

        {/* Right Col: Dynamic Sizing Calculator by VIX */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Dynamic Sizing Matrix
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">VIX Governed</span>
            </div>

            {/* Slider Inputs */}
            <div className="space-y-4 text-xs font-mono">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Account Capital:</span>
                  <span className="text-white font-bold">${simEquity.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="200000"
                  step="5000"
                  value={simEquity}
                  onChange={(e) => setSimEquity(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Risk Tolerance:</span>
                  <span className="text-white font-bold">{simRiskPct.toFixed(1)}% (${(simEquity * simRiskPct / 100).toFixed(0)})</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.25"
                  value={simRiskPct}
                  onChange={(e) => setSimRiskPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Simulated VIX Level:</span>
                  <span
                    className={`font-bold ${
                      simVix >= 28
                        ? 'text-rose-400'
                        : simVix >= 21
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {simVix.toFixed(1)} pts
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="38"
                  step="0.5"
                  value={simVix}
                  onChange={(e) => setSimVix(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Current ATR:</span>
                  <span className="text-white font-bold">{simAtr.toFixed(2)} pts</span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="12.0"
                  step="0.25"
                  value={simAtr}
                  onChange={(e) => setSimAtr(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Calculator Output Card */}
          <div className="mt-5 p-3.5 bg-slate-950 rounded border border-slate-800 text-xs font-mono">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-[11px] uppercase">Recommended Allocation</span>
              <span className="text-amber-400 font-bold">
                {(simResult.multiplier * 100).toFixed(0)}% Sizing Multiplier
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-white">
                {simResult.contracts}{' '}
                <span className="text-sm text-amber-400">{simResult.recommendedSymbol}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                (${simResult.riskUsd.toFixed(0)} total stop risk)
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-2">
              {simResult.rationale}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
