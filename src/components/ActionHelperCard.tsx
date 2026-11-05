import React from 'react';
import { ActionHelper } from '../types/futures';
import {
  Compass,
  Shield,
  Layers,
  Target,
  AlertOctagon,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface ActionHelperCardProps {
  helper: ActionHelper;
}

export const ActionHelperCard: React.FC<ActionHelperCardProps> = ({ helper }) => {
  const isHalted = helper.status === 'HALTED';
  const isActionable = helper.status === 'ACTIONABLE';
  const isCaution = helper.status === 'CAUTION';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-5 text-slate-200 shadow-sm">
      {/* Header status strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${
              isHalted
                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                : isActionable
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : isCaution
                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isHalted ? (
              <AlertOctagon className="w-5 h-5" />
            ) : isActionable ? (
              <Compass className="w-5 h-5" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Action Helper Directive
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  isHalted
                    ? 'bg-rose-900/60 text-rose-200 border border-rose-700'
                    : isActionable
                    ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700'
                    : isCaution
                    ? 'bg-amber-900/60 text-amber-200 border border-amber-700'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {helper.status}
              </span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">{helper.headline}</h2>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] text-slate-400 font-mono block">Reversion Asymmetry</span>
          <span
            className={`text-xs font-mono font-bold ${
              helper.reversionBias === 'LONG_FAVORED'
                ? 'text-emerald-400'
                : helper.reversionBias === 'SHORT_FAVORED'
                ? 'text-purple-400'
                : 'text-slate-400'
            }`}
          >
            {helper.reversionBias.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Primary Subtext / Context Explanation */}
      <div className="text-sm text-slate-300 leading-relaxed bg-slate-950/50 p-3.5 rounded border border-slate-800/60">
        <p>{helper.subtext}</p>
        <div className="mt-2 text-xs font-mono text-amber-300/90 flex items-center gap-1.5">
          <span className="text-slate-400">Volatility Filter:</span>
          <span>{helper.vixFilterMessage}</span>
        </div>
      </div>

      {/* Grid: Dynamic Position Sizing + Automated Stop-Loss Trigger Specs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dynamic Sizing Helper */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Dynamic Position Sizing Helper
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {(helper.sizingMultiplier * 100).toFixed(0)}% Allocation
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2 font-mono">
              <span className="text-2xl font-bold text-white">
                {helper.recommendedContracts}{' '}
                <span className="text-sm text-amber-400">{helper.recommendedSymbol}</span>
              </span>
              <span className="text-xs text-slate-400">
                ({helper.recommendedSymbol === 'MES' ? `${helper.recommendedContracts * 0.1} ES eq.` : 'Standard ES'})
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{helper.sizingReason}</p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Max Dollar Risk:</span>
            <span className="text-rose-400 font-bold tabular-nums">
              ${helper.activeStopGuidance.totalRiskUsd.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Automated Stop-Loss & Target Guidance */}
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                Automated Stop & Target Artifacts
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                R:R {helper.targetGuidance.rewardRiskRatio > 0 ? `${helper.targetGuidance.rewardRiskRatio.toFixed(2)}:1` : 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-2 font-mono text-xs">
              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Stop-Loss Anchor</span>
                <span className="text-rose-400 font-bold text-sm tabular-nums">
                  {helper.activeStopGuidance.anchorPrice.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  -{helper.activeStopGuidance.distancePoints.toFixed(2)} pts ({helper.activeStopGuidance.stopType})
                </span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Target (Mean VWAP)</span>
                <span className="text-emerald-400 font-bold text-sm tabular-nums">
                  {helper.targetGuidance.price.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  +{helper.targetGuidance.distancePoints.toFixed(2)} pts (${helper.targetGuidance.potentialProfitUsd.toFixed(0)})
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Trailing Trigger:</span>
            <span className="text-slate-200">Rachet to BE @ 50% Mean Reversion</span>
          </div>
        </div>
      </div>

      {/* Tactical Directives List */}
      <div className="bg-slate-950 border border-slate-800 rounded p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-2">
          <span>Immediate Execution Directives</span>
          <span className="text-[10px] text-amber-400 font-mono font-normal">
            (Derived from Log Indicators & Real-time Volatility)
          </span>
        </h3>
        <ul className="space-y-2">
          {helper.tacticalDirectives.map((dir, index) => (
            <li key={index} className="flex items-start gap-2.5 text-xs text-slate-300">
              <span className="text-amber-500 font-mono font-bold text-xs shrink-0 mt-0.5">
                {String(index + 1).padStart(2, '0')}.
              </span>
              <span className="leading-relaxed">{dir}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
