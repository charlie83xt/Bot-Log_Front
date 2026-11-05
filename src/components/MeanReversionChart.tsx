import React, { useState } from 'react';
import { BotLogEntry, MarketContext } from '../types/futures';
import { Maximize2, RefreshCw, Eye, EyeOff } from 'lucide-react';

interface MeanReversionChartProps {
  logs: BotLogEntry[];
  context: MarketContext;
}

export const MeanReversionChart: React.FC<MeanReversionChartProps> = ({ logs, context }) => {
  const [hoveredEntry, setHoveredEntry] = useState<BotLogEntry | null>(null);
  const [showVixSubplot, setShowVixSubplot] = useState(true);

  // Take the last 20 entries for high visual clarity
  const displayLogs = logs.slice(-25);
  if (displayLogs.length < 2) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-500">
        Waiting for sufficient bot ticks to render mean-reversion chart...
      </div>
    );
  }

  // Calculate scales
  const allPrices = displayLogs.flatMap((l) => [l.price, l.vwap, l.upperBand, l.lowerBand]);
  const minPrice = Math.min(...allPrices) - 2;
  const maxPrice = Math.max(...allPrices) + 2;
  const priceRange = maxPrice - minPrice || 1;

  const width = 800;
  const mainHeight = showVixSubplot ? 220 : 300;
  const subHeight = 70;
  const totalSvgHeight = showVixSubplot ? mainHeight + subHeight + 30 : mainHeight + 20;

  const getX = (index: number) => {
    return 50 + (index / (displayLogs.length - 1)) * (width - 70);
  };

  const getY = (price: number) => {
    return mainHeight - ((price - minPrice) / priceRange) * (mainHeight - 30) - 15;
  };

  // VIX scales
  const allVix = displayLogs.map((l) => l.vix);
  const minVix = Math.max(10, Math.min(...allVix) - 1);
  const maxVix = Math.max(30, Math.max(...allVix) + 2);
  const vixRange = maxVix - minVix || 1;

  const getVixY = (vixVal: number) => {
    const startY = mainHeight + 30;
    return startY + subHeight - ((vixVal - minVix) / vixRange) * (subHeight - 15) - 5;
  };

  // Build SVG Paths
  const pricePath = displayLogs
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(l.price).toFixed(1)}`)
    .join(' ');

  const vwapPath = displayLogs
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(l.vwap).toFixed(1)}`)
    .join(' ');

  const upperBandPath = displayLogs
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(l.upperBand).toFixed(1)}`)
    .join(' ');

  const lowerBandPath = displayLogs
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(l.lowerBand).toFixed(1)}`)
    .join(' ');

  const vixPath = displayLogs
    .map((l, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getVixY(l.vix).toFixed(1)}`)
    .join(' ');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-3 shadow-sm">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white tracking-tight">
              S&P 500 {context.symbol} Mean Reversion & Volatility Filter Channel
            </h3>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
              2.0σ VWAP Bands
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Real-time execution telemetry with automated stop-loss markers and VIX regime filter
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 border-dashed" />
            <span className="text-slate-400">VWAP Mean</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-purple-400" />
            <span className="text-slate-400">+2σ Band</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-400" />
            <span className="text-slate-400">-2σ Band</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400" />
            <span className="text-slate-300 font-bold">ES Price</span>
          </div>
          <button
            onClick={() => setShowVixSubplot(!showVixSubplot)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 ml-2"
          >
            {showVixSubplot ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            <span>VIX Subplot</span>
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full overflow-hidden bg-slate-950/80 rounded border border-slate-800/80 p-2">
        <svg
          viewBox={`0 0 ${width} ${totalSvgHeight}`}
          className="w-full h-auto select-none font-mono"
        >
          <defs>
            <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="vixFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct, idx) => {
            const p = minPrice + pct * priceRange;
            const y = getY(p);
            return (
              <g key={idx}>
                <line
                  x1={45}
                  y1={y}
                  x2={width - 20}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="3 3"
                  strokeWidth="0.75"
                />
                <text
                  x={40}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="9"
                  className="tabular-nums"
                >
                  {p.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Upper Band */}
          <path d={upperBandPath} fill="none" stroke="#a855f7" strokeWidth="1.25" strokeDasharray="4 2" />

          {/* Lower Band */}
          <path d={lowerBandPath} fill="none" stroke="#10b981" strokeWidth="1.25" strokeDasharray="4 2" />

          {/* VWAP Mean Line */}
          <path d={vwapPath} fill="none" stroke="#f59e0b" strokeWidth="1.75" strokeDasharray="5 3" />

          {/* S&P 500 Price Line */}
          <path d={pricePath} fill="none" stroke="#38bdf8" strokeWidth="2.25" strokeLinecap="round" />

          {/* Event Markers on Price Line */}
          {displayLogs.map((l, i) => {
            const cx = getX(i);
            const cy = getY(l.price);
            const isSignal = l.level === 'SIGNAL';
            const isStopLoss = l.level === 'STOP_LOSS';
            const isRiskTrigger = l.level === 'RISK_TRIGGER';
            const isFilterReject = l.level === 'FILTER_REJECT';
            const isExecuted = l.level === 'EXECUTED';

            if (!isSignal && !isStopLoss && !isRiskTrigger && !isFilterReject && !isExecuted) {
              return null;
            }

            let fillColor = '#38bdf8';
            if (isStopLoss) fillColor = '#ef4444';
            else if (isFilterReject) fillColor = '#f97316';
            else if (isSignal) fillColor = l.zScore < 0 ? '#10b981' : '#a855f7';
            else if (isExecuted) fillColor = '#22c55e';
            else if (isRiskTrigger) fillColor = '#eab308';

            return (
              <g
                key={l.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onMouseEnter={() => setHoveredEntry(l)}
                onMouseLeave={() => setHoveredEntry(null)}
              >
                <circle cx={cx} cy={cy} r={isStopLoss ? 5.5 : 4} fill={fillColor} stroke="#020617" strokeWidth="1.5" />
                {isStopLoss && (
                  <line
                    x1={cx - 3}
                    y1={cy - 3}
                    x2={cx + 3}
                    y2={cy + 3}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            );
          })}

          {/* VIX Subplot */}
          {showVixSubplot && (
            <g>
              <line
                x1={45}
                y1={mainHeight + 15}
                x2={width - 20}
                y2={mainHeight + 15}
                stroke="#475569"
                strokeWidth="1"
              />
              <text x={45} y={mainHeight + 27} fill="#94a3b8" fontSize="9" fontWeight="bold">
                VIX VOLATILITY FILTER SUBPLOT
              </text>

              {/* 21.0 VIX Threshold Line */}
              {maxVix >= 21 && minVix <= 21 && (
                <g>
                  <line
                    x1={45}
                    y1={getVixY(21.0)}
                    x2={width - 20}
                    y2={getVixY(21.0)}
                    stroke="#f43f5e"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  <text
                    x={width - 15}
                    y={getVixY(21.0) + 3}
                    fill="#f43f5e"
                    fontSize="8"
                    textAnchor="start"
                  >
                    21.0 Threshold (MES Mandate)
                  </text>
                </g>
              )}

              {/* VIX Curve */}
              <path d={vixPath} fill="none" stroke="#f59e0b" strokeWidth="1.75" />

              {/* VIX Y-Axis */}
              <text
                x={40}
                y={getVixY(minVix) + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="8"
              >
                {minVix.toFixed(0)}
              </text>
              <text
                x={40}
                y={getVixY(maxVix) + 3}
                textAnchor="end"
                fill="#64748b"
                fontSize="8"
              >
                {maxVix.toFixed(0)}
              </text>
            </g>
          )}

          {/* Time axis labels */}
          {displayLogs.map((l, i) => {
            if (i % 6 !== 0 && i !== displayLogs.length - 1) return null;
            return (
              <text
                key={i}
                x={getX(i)}
                y={totalSvgHeight - 5}
                textAnchor="middle"
                fill="#64748b"
                fontSize="8"
              >
                {l.timestamp.split('.')[0]}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredEntry && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-amber-500/50 rounded p-3 text-xs shadow-xl backdrop-blur-sm max-w-sm pointer-events-none z-10 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
              <span className="font-bold text-amber-400">[{hoveredEntry.level}]</span>
              <span className="text-slate-400">{hoveredEntry.timestamp}</span>
            </div>
            <p className="text-slate-200 text-[11px] mb-2 leading-relaxed">{hoveredEntry.message}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-300">
              <div>
                Price: <span className="text-white font-bold">{hoveredEntry.price.toFixed(2)}</span>
              </div>
              <div>
                VWAP: <span className="text-amber-400">{hoveredEntry.vwap.toFixed(2)}</span>
              </div>
              <div>
                Z-Score: <span className="text-white">{hoveredEntry.zScore.toFixed(2)}σ</span>
              </div>
              <div>
                VIX: <span className="text-amber-300 font-bold">{hoveredEntry.vix.toFixed(1)}</span>
              </div>
              {hoveredEntry.pnl !== undefined && (
                <div className="col-span-2 text-emerald-400 font-bold">
                  PnL: {hoveredEntry.pnl >= 0 ? `+$${hoveredEntry.pnl}` : `-$${Math.abs(hoveredEntry.pnl)}`}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
