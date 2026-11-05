import React, { useState } from 'react';
import { BotLogEntry, LogSeverity } from '../types/futures';
import { exportLogsToCsv } from '../utils/logParser';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Terminal,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';

interface LogStreamViewerProps {
  logs: BotLogEntry[];
  onClearLogs: () => void;
  onResetLogs: () => void;
}

export const LogStreamViewer: React.FC<LogStreamViewerProps> = ({
  logs,
  onClearLogs,
  onResetLogs,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<BotLogEntry | null>(null);

  const severities: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Logs' },
    { id: 'SIGNAL', label: 'Signals' },
    { id: 'FILTER_REJECT', label: 'Filter Rejects' },
    { id: 'RISK_TRIGGER', label: 'Risk Triggers' },
    { id: 'STOP_LOSS', label: 'Stop Loss' },
    { id: 'SIZING_CHANGE', label: 'Sizing Changes' },
    { id: 'EXECUTED', label: 'Executed' },
  ];

  const filteredLogs = logs.filter((log) => {
    if (selectedSeverity !== 'ALL' && log.level !== selectedSeverity) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMessage = log.message.toLowerCase().includes(q);
      const matchSymbol = log.symbol.toLowerCase().includes(q);
      const matchTime = log.timestamp.toLowerCase().includes(q);
      const matchPrice = log.price.toString().includes(q);
      return matchMessage || matchSymbol || matchTime || matchPrice;
    }
    return true;
  });

  const handleDownloadCsv = () => {
    const csvContent = exportLogsToCsv(filteredLogs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aequitas_futures_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeverityBadge = (level: LogSeverity) => {
    switch (level) {
      case 'STOP_LOSS':
        return 'text-rose-400 bg-rose-950/60 border-rose-800';
      case 'FILTER_REJECT':
        return 'text-orange-400 bg-orange-950/60 border-orange-800';
      case 'RISK_TRIGGER':
        return 'text-amber-400 bg-amber-950/60 border-amber-800';
      case 'SIGNAL':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
      case 'SIZING_CHANGE':
        return 'text-sky-400 bg-sky-950/60 border-sky-800';
      case 'EXECUTED':
        return 'text-emerald-300 bg-emerald-950/70 border-emerald-700';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col gap-4 shadow-sm">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">
            Bot Execution & Risk Telemetry Logs
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            ({filteredLogs.length} / {logs.length} entries)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
            title="Download CSV export"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={onResetLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            title="Reset to scenario defaults"
          >
            <span>Reset</span>
          </button>
          <button
            onClick={onClearLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 rounded border border-slate-700 hover:border-rose-800 transition-colors"
            title="Clear current log buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Severity Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 overflow-x-auto max-w-full">
          {severities.map((sev) => (
            <button
              key={sev.id}
              onClick={() => setSelectedSeverity(sev.id)}
              className={`px-2.5 py-1 text-xs font-mono font-medium rounded whitespace-nowrap transition-colors ${
                selectedSeverity === sev.id
                  ? 'bg-slate-800 text-amber-400 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search log messages, prices, IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Log Table Container */}
      <div className="bg-slate-950 rounded border border-slate-800 overflow-hidden">
        <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px] z-10">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Level</th>
                <th className="py-2 px-3">Symbol</th>
                <th className="py-2 px-3 text-right">Price</th>
                <th className="py-2 px-3 text-right">VWAP</th>
                <th className="py-2 px-3 text-right">Z-Score</th>
                <th className="py-2 px-3 text-right">VIX</th>
                <th className="py-2 px-3 text-right">Size</th>
                <th className="py-2 px-4">Message / Action Telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No logs matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-slate-850/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getSeverityBadge(
                          log.level
                        )}`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-200">
                      {log.symbol}
                    </td>
                    <td className="py-2 px-3 text-right text-white font-bold tabular-nums">
                      {log.price.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-400/90 tabular-nums">
                      {log.vwap.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                      {log.zScore > 0 ? `+${log.zScore.toFixed(2)}` : log.zScore.toFixed(2)}σ
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-amber-300">
                      {log.vix.toFixed(1)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                      {log.contracts}
                    </td>
                    <td className="py-2 px-4 text-slate-300 truncate max-w-md">
                      {log.message}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Log Inspector Detail */}
      {selectedLog && (
        <div className="bg-slate-950 p-4 rounded border border-amber-500/30 font-mono text-xs text-slate-300 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">Log Inspector:</span>
              <span className="text-white font-semibold">[{selectedLog.level}]</span>
              <span className="text-slate-400">{selectedLog.timestamp}</span>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <p className="text-white text-xs leading-relaxed">{selectedLog.message}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-slate-400">
            <div>Symbol: <span className="text-white">{selectedLog.symbol}</span></div>
            <div>Price: <span className="text-white">{selectedLog.price.toFixed(2)}</span></div>
            <div>VWAP: <span className="text-amber-400">{selectedLog.vwap.toFixed(2)}</span></div>
            <div>VIX: <span className="text-amber-300">{selectedLog.vix.toFixed(2)}</span></div>
            <div>Z-Score: <span className="text-white">{selectedLog.zScore.toFixed(2)}σ</span></div>
            <div>ATR: <span className="text-white">{selectedLog.atr.toFixed(2)}</span></div>
            <div>Contracts: <span className="text-white">{selectedLog.contracts}</span></div>
            {selectedLog.pnl !== undefined && (
              <div>PnL: <span className={selectedLog.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>${selectedLog.pnl}</span></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
