import React from 'react';
import { MarketContext, ContractSymbol } from '../types/futures';
import { TrendingDown, TrendingUp, ShieldAlert, CheckCircle2, AlertTriangle, Flame } from 'lucide-react';

interface MarketContextBarProps {
  context: MarketContext;
  onSelectSymbol: (symbol: ContractSymbol) => void;
  activePresetName: string;
}

export const MarketContextBar: React.FC<MarketContextBarProps> = ({
  context,
  onSelectSymbol,
  activePresetName,
}) => {
  const isNegative = context.priceChange < 0;
  const isVixElevated = context.currentVix >= 21;
  const isVixCrisis = context.currentVix >= 28;

  return (
    <div className="bg-slate-950 border-b border-slate-800 px-6 py-2.5 text-xs text-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
        {/* Left: Active Contract & Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded">
            <button
              onClick={() => onSelectSymbol('ES')}
              className={`px-2 py-1 font-mono font-bold rounded transition-colors ${
                context.symbol === 'ES'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ES E-mini
            </button>
            <button
              onClick={() => onSelectSymbol('MES')}
              className={`px-2 py-1 font-mono font-bold rounded transition-colors ${
                context.symbol === 'MES'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MES Micro
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono tracking-tight text-white tabular-nums">
              {context.lastPrice.toFixed(2)}
            </span>
            <div
              className={`flex items-center gap-1 font-mono font-semibold text-xs tabular-nums ${
                isNegative ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {isNegative ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" />
              )}
              <span>
                {isNegative ? '' : '+'}
                {context.priceChange.toFixed(2)} ({context.priceChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <span className="hidden lg:inline text-slate-600">|</span>
          <div className="hidden lg:flex items-center gap-2 text-slate-400">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider">Preset Scenario:</span>
            <span className="text-slate-200 font-medium">{activePresetName}</span>
          </div>
        </div>

        {/* Center / Right: Mean Reversion Indicators & Volatility Regime */}
        <div className="flex items-center gap-5 font-mono text-[11px] tabular-nums">
          {/* VWAP and Bands */}
          <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">VWAP Mean</span>
              <span className="text-amber-400 font-bold">{context.vwap.toFixed(2)}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">Lower 2σ</span>
              <span className="text-slate-300">{context.lowerBand.toFixed(2)}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">Upper 2σ</span>
              <span className="text-slate-300">{context.upperBand.toFixed(2)}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase">Z-Score</span>
              <span
                className={`font-bold ${
                  context.zScore <= -2
                    ? 'text-emerald-400'
                    : context.zScore >= 2
                    ? 'text-purple-400'
                    : 'text-slate-300'
                }`}
              >
                {context.zScore > 0 ? `+${context.zScore.toFixed(2)}σ` : `${context.zScore.toFixed(2)}σ`}
              </span>
            </div>
          </div>

          {/* VIX Volatility Filter */}
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded border ${
              isVixCrisis
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : isVixElevated
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-slate-900/60 border-slate-800/80 text-emerald-300'
            }`}
          >
            {isVixCrisis ? (
              <Flame className="w-4 h-4 text-rose-400 shrink-0" />
            ) : isVixElevated ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">VIX Volatility</span>
                <span className="text-[10px] text-slate-500">
                  ({context.vixDelta >= 0 ? `+${context.vixDelta.toFixed(2)}` : context.vixDelta.toFixed(2)})
                </span>
              </div>
              <span className="font-bold text-white text-xs">{context.currentVix.toFixed(2)} pts</span>
            </div>
          </div>

          {/* Bot State Badge */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Bot Strategy State</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  context.botState === 'VOL_HALT'
                    ? 'bg-rose-500'
                    : context.botState === 'FADE_READY'
                    ? 'bg-emerald-400'
                    : context.botState === 'ACTIVE_TRADE'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-200 font-bold text-xs uppercase">{context.botState}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
