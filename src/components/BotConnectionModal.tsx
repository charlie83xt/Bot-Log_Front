import React, { useState } from 'react';
import {
  Webhook,
  Copy,
  Check,
  Send,
  Code2,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  GitBranch,
  ExternalLink,
  X,
} from 'lucide-react';

interface BotConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sseConnected: boolean;
  onTriggerTestWebhook: () => Promise<void>;
}

export const BotConnectionModal: React.FC<BotConnectionModalProps> = ({
  isOpen,
  onClose,
  sseConnected,
  onTriggerTestWebhook,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'python' | 'ninjatrader' | 'pinescript' | 'curl'>('python');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.app';
  const webhookUrl = `${currentOrigin}/api/webhook/bot-log`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestSend = async () => {
    setIsSendingTest(true);
    setTestSuccess(false);
    try {
      await onTriggerTestWebhook();
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingTest(false);
    }
  };

  const pythonSnippet = `# Python Trading Bot Log Dispatcher
import requests
import json
from datetime import datetime

WEBHOOK_URL = "${webhookUrl}"

def send_bot_telemetry(symbol, price, vwap, vix, atr, z_score, level="INFO", message="", contracts=2, stop_price=None, pnl=None):
    payload = {
        "timestamp": datetime.now().strftime("%H:%M:%S.%f")[:-3],
        "level": level,            # "SIGNAL" | "RISK_TRIGGER" | "STOP_LOSS" | "SIZING_CHANGE" | "EXECUTED"
        "symbol": symbol,          # "ES" or "MES"
        "price": float(price),
        "vwap": float(vwap),
        "vix": float(vix),
        "atr": float(atr),
        "zScore": float(z_score),
        "contracts": int(contracts),
        "message": message,
        "stopPrice": stop_price,
        "pnl": pnl
    }
    try:
        res = requests.post(WEBHOOK_URL, json=payload, timeout=2.0)
        return res.status_code == 200
    except Exception as e:
        print(f"Terminal webhook error: {e}")
        return False

# Example usage on bar or order fill:
# send_bot_telemetry("MES", 5938.50, 5954.25, 24.2, 6.8, -2.35, level="SIGNAL", message="Lower 2σ VWAP fade ready")
`;

  const ninjaTraderSnippet = `// NinjaTrader 8 C# Strategy Webhook Hook
using System;
using System.Net.Http;
using System.Text;

private static readonly HttpClient httpClient = new HttpClient();
private const string WebhookUrl = "${webhookUrl}";

private async void PostTerminalLog(string symbol, double price, double vwap, double vix, double atr, double zScore, string level, string message, int contracts)
{
    try
    {
        var payload = new
        {
            timestamp = DateTime.Now.ToString("HH:mm:ss.fff"),
            level = level,
            symbol = symbol,
            price = price,
            vwap = vwap,
            vix = vix,
            atr = atr,
            zScore = zScore,
            contracts = contracts,
            message = message
        };
        string json = Newtonsoft.Json.JsonConvert.SerializeObject(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        await httpClient.PostAsync(WebhookUrl, content);
    }
    catch (Exception ex)
    {
        Print("Terminal Webhook failure: " + ex.Message);
    }
}
`;

  const pineScriptSnippet = `// TradingView Webhook Alert JSON Payload
// In your Alert dialog, set Webhook URL to: ${webhookUrl}
// Message body:
{
  "timestamp": "{{time}}",
  "level": "SIGNAL",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "vwap": {{plot_0}},
  "vix": {{plot_1}},
  "atr": {{plot_2}},
  "zScore": -2.35,
  "contracts": 2,
  "message": "PineScript Mean Reversion Alert at {{close}}"
}
`;

  const curlSnippet = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "level": "SIGNAL",
    "symbol": "MES",
    "price": 5938.75,
    "vwap": 5954.25,
    "vix": 24.2,
    "atr": 6.8,
    "zScore": -2.35,
    "contracts": 4,
    "message": "Manual test from external bot script"
  }'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-3xl w-full p-6 text-slate-200 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight font-sans">
                Bot Repository & Webhook Integration Hub
              </h2>
              <span className="text-xs text-slate-400">
                Stream live execution telemetry from your GitHub Python / C# / NinjaTrader bot
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Listener Status Card */}
        <div className="bg-slate-950 p-4 rounded border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">SSE Real-Time Terminal Listener:</span>
                <span className={sseConnected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {sseConnected ? 'ONLINE (Ready for Bot Events)' : 'STANDBY (Polling Mode)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Every incoming HTTP POST request instantly updates your terminal charts, risk audit, and action helpers without a page refresh.
              </p>
            </div>
          </div>

          <button
            onClick={handleTestSend}
            disabled={isSendingTest}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded transition-colors disabled:opacity-50"
          >
            {isSendingTest ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : testSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-950" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{testSuccess ? 'Signal Ingested!' : 'Send Test Bot Webhook'}</span>
          </button>
        </div>

        {/* Webhook Endpoint Address */}
        <div>
          <label className="text-[11px] text-slate-400 uppercase font-bold block mb-1.5 font-sans">
            Incoming Webhook Destination URL:
          </label>
          <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded border border-slate-800">
            <code className="text-amber-400 flex-1 truncate">{webhookUrl}</code>
            <button
              onClick={() => copyToClipboard(webhookUrl, 'url')}
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors"
            >
              {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'url' ? 'Copied' : 'Copy URL'}</span>
            </button>
          </div>
        </div>

        {/* Code Snippets for Trader Bot Repo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 uppercase font-bold font-sans">
              Bot Integration Snippets (Drop into your Repository):
            </span>
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
              <button
                onClick={() => setActiveSnippetTab('python')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  activeSnippetTab === 'python' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Python
              </button>
              <button
                onClick={() => setActiveSnippetTab('ninjatrader')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  activeSnippetTab === 'ninjatrader' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                NinjaTrader C#
              </button>
              <button
                onClick={() => setActiveSnippetTab('pinescript')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  activeSnippetTab === 'pinescript' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                TradingView
              </button>
              <button
                onClick={() => setActiveSnippetTab('curl')}
                className={`px-2.5 py-0.5 rounded text-[11px] ${
                  activeSnippetTab === 'curl' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                cURL
              </button>
            </div>
          </div>

          <div className="relative bg-slate-950 p-4 rounded border border-slate-800 text-[11px] overflow-x-auto max-h-56">
            <pre className="text-slate-300 font-mono">
              {activeSnippetTab === 'python' && pythonSnippet}
              {activeSnippetTab === 'ninjatrader' && ninjaTraderSnippet}
              {activeSnippetTab === 'pinescript' && pineScriptSnippet}
              {activeSnippetTab === 'curl' && curlSnippet}
            </pre>
            <button
              onClick={() => {
                const code =
                  activeSnippetTab === 'python'
                    ? pythonSnippet
                    : activeSnippetTab === 'ninjatrader'
                    ? ninjaTraderSnippet
                    : activeSnippetTab === 'pinescript'
                    ? pineScriptSnippet
                    : curlSnippet;
                copyToClipboard(code, 'code');
              }}
              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded text-[10px] border border-slate-700 transition-colors"
            >
              {copiedKey === 'code' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'code' ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>
        </div>

        {/* GitHub Linking Rationale */}
        <div className="p-3 bg-slate-950/60 rounded border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>GitHub Repository Workflow</span>
          </div>
          Commit your futures bot code to GitHub and set the environment variable{' '}
          <code className="text-amber-400 font-mono">TERMINAL_WEBHOOK_URL</code> to this URL. Whenever your strategy executes a trade, updates a trailing stop, or encounters a VIX regime change, simply dispatch an HTTP POST request.
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-sans font-medium transition-colors"
          >
            Close Integration Hub
          </button>
        </div>
      </div>
    </div>
  );
};
