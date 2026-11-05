import React, { useState } from 'react';
import { PRESET_SCENARIOS } from '../data/presetScenarios';
import { BotLogEntry, ScenarioPreset } from '../types/futures';
import { parseRawBotLogs } from '../utils/logParser';
import {
  UploadCloud,
  FileText,
  Check,
  X,
  AlertCircle,
  FileCode,
  Layers,
  Sparkles,
} from 'lucide-react';

interface LogIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPreset: (preset: ScenarioPreset) => void;
  onApplyCustomLogs: (logs: BotLogEntry[]) => void;
  currentPresetId: string;
}

export const LogIngestModal: React.FC<LogIngestModalProps> = ({
  isOpen,
  onClose,
  onApplyPreset,
  onApplyCustomLogs,
  currentPresetId,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'paste'>('presets');
  const [rawText, setRawText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<BotLogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = parseRawBotLogs(content);
        if (parsed.length === 0) {
          setErrorMessage('Could not extract valid bot log events from this file.');
          return;
        }
        setParsedPreview(parsed);
        setRawText(content.slice(0, 500) + (content.length > 500 ? '...' : ''));
      } catch (err: any) {
        setErrorMessage('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRawTextChange = (text: string) => {
    setRawText(text);
    setErrorMessage(null);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }
    const parsed = parseRawBotLogs(text);
    setParsedPreview(parsed);
  };

  const handleApplyCustom = () => {
    if (parsedPreview.length === 0) {
      setErrorMessage('No valid log entries found to apply.');
      return;
    }
    onApplyCustomLogs(parsedPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-6 text-slate-200 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto font-mono">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight font-sans">
              Ingest S&P 500 Bot Execution Logs
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-1.5 px-3 rounded font-medium transition-colors ${
              activeTab === 'presets'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Institutional Presets
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 px-3 rounded font-medium transition-colors ${
              activeTab === 'upload'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Upload File (.log / .json / .csv)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-1.5 px-3 rounded font-medium transition-colors ${
              activeTab === 'paste'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Paste Raw Logs
          </button>
        </div>

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400 leading-relaxed font-sans">
              Select a pre-loaded real-market scenario reflecting genuine futures volatility filtering and mean reversion executions:
            </p>
            {PRESET_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => {
                  onApplyPreset(scenario);
                  onClose();
                }}
                className={`p-3.5 rounded border cursor-pointer transition-all ${
                  currentPresetId === scenario.id
                    ? 'bg-amber-950/40 border-amber-500/60 text-white'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-white font-sans">{scenario.name}</span>
                  <span className="text-[11px] text-amber-400 font-mono">{scenario.vixSummary}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mb-1.5">{scenario.tag}</div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{scenario.description}</p>
                <div className="mt-2 text-[10px] text-slate-500 font-mono">
                  Contains {scenario.logs.length} logged events with automated stops and sizing artifacts
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-amber-500/60 rounded-lg p-6 text-center transition-colors bg-slate-950/50">
              <input
                type="file"
                id="file-upload"
                accept=".log,.txt,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <UploadCloud className="w-10 h-10 text-amber-400 mb-2" />
                <span className="text-sm font-bold text-white font-sans">
                  Choose a Bot Log File to Ingest
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Compatible with NinjaTrader, TradeStation, Python, Sierra Chart, or JSON
                </span>
                <span className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700">
                  Browse Files
                </span>
              </label>
            </div>

            {parsedPreview.length > 0 && (
              <div className="p-3 bg-slate-950 rounded border border-emerald-500/40 text-xs">
                <span className="text-emerald-400 font-bold block mb-1">
                  ✓ Ready to Ingest: {parsedPreview.length} entries parsed
                </span>
                <span className="text-slate-400 text-[11px]">
                  Detected symbols: {Array.from(new Set(parsedPreview.map((p) => p.symbol))).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Paste Raw Logs Tab */}
        {activeTab === 'paste' && (
          <div className="space-y-3">
            <label className="text-xs text-slate-400 block font-sans">
              Paste raw execution logs from your futures trading bot:
            </label>
            <textarea
              rows={7}
              placeholder={`Example lines:\n09:30:15 [SIGNAL] ES @ 5942.50 | VWAP: 5950.00 | VIX: 18.2 | ATR: 4.5 | Z: -2.1\n09:30:16 [EXECUTED] BUY 2 ES @ 5942.75 limit\n09:30:20 [RISK_TRIGGER] STOP-LOSS set at 5934.50 (1.8x ATR)`}
              value={rawText}
              onChange={(e) => handleRawTextChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
            {parsedPreview.length > 0 && (
              <div className="text-xs text-emerald-400">
                ✓ Successfully detected {parsedPreview.length} valid log entries
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/50 border border-rose-800 rounded text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white rounded transition-colors"
          >
            Cancel
          </button>
          {activeTab !== 'presets' && (
            <button
              onClick={handleApplyCustom}
              disabled={parsedPreview.length === 0}
              className="px-4 py-2 text-xs font-mono font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 rounded transition-colors"
            >
              Apply Ingested Logs ({parsedPreview.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
