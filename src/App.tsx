import React, { useState, useEffect, useRef } from 'react';
import { PRESET_SCENARIOS } from './data/presetScenarios';
import { BotLogEntry, ContractSymbol, MarketContext, ScenarioPreset } from './types/futures';
import { generateActionHelper, determineVolRegime } from './utils/riskEngine';
import { generateSimulatedTickLog } from './utils/logParser';
import { TopNav } from './components/TopNav';
import { MarketContextBar } from './components/MarketContextBar';
import { ActionHelperCard } from './components/ActionHelperCard';
import { MeanReversionChart } from './components/MeanReversionChart';
import { RiskArtifactAudit } from './components/RiskArtifactAudit';
import { LogStreamViewer } from './components/LogStreamViewer';
import { AiContextSynthesizer } from './components/AiContextSynthesizer';
import { LogIngestModal } from './components/LogIngestModal';
import { BotConnectionModal } from './components/BotConnectionModal';
import { DonationModal } from './components/DonationModal';
import {
  Compass,
  Shield,
  Terminal,
  Sparkles,
  TrendingUp,
  Layers,
  ArrowRight,
  Info,
  Heart,
  Webhook,
} from 'lucide-react';

export default function App() {
  const [currentPreset, setCurrentPreset] = useState<ScenarioPreset>(PRESET_SCENARIOS[0]);
  const [logs, setLogs] = useState<BotLogEntry[]>(PRESET_SCENARIOS[0].logs);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [isBotConnectModalOpen, setIsBotConnectModalOpen] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  // Initialize market context from current preset
  const [context, setContext] = useState<MarketContext>({
    symbol: PRESET_SCENARIOS[0].initialContext.symbol || 'MES',
    lastPrice: PRESET_SCENARIOS[0].initialContext.lastPrice || 5938.75,
    priceChange: PRESET_SCENARIOS[0].initialContext.priceChange || -24.50,
    priceChangePct: PRESET_SCENARIOS[0].initialContext.priceChangePct || -0.41,
    currentVix: PRESET_SCENARIOS[0].initialContext.currentVix || 24.2,
    vixDelta: PRESET_SCENARIOS[0].initialContext.vixDelta || 4.8,
    vixRegime: PRESET_SCENARIOS[0].initialContext.vixRegime || 'ELEVATED_VOL',
    regimeLabel: PRESET_SCENARIOS[0].initialContext.regimeLabel || 'Elevated Volatility (Micro MES Mandate)',
    vwap: PRESET_SCENARIOS[0].initialContext.vwap || 5954.25,
    upperBand: PRESET_SCENARIOS[0].initialContext.upperBand || 5978.50,
    lowerBand: PRESET_SCENARIOS[0].initialContext.lowerBand || 5930.00,
    zScore: PRESET_SCENARIOS[0].initialContext.zScore || -2.35,
    rsi: PRESET_SCENARIOS[0].initialContext.rsi || 24.8,
    atr: PRESET_SCENARIOS[0].initialContext.atr || 6.80,
    botState: PRESET_SCENARIOS[0].initialContext.botState || 'FADE_READY',
    activePosition: null,
  });

  // Calculate dynamic Action Helper
  const actionHelper = generateActionHelper(context, logs);

  // Live simulation ticker
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setLogs((prevLogs) => {
        const lastEntry = prevLogs[prevLogs.length - 1] || {
          price: context.lastPrice,
          vwap: context.vwap,
          atr: context.atr,
          vix: context.currentVix,
          contracts: 2,
        };

        const newEntry = generateSimulatedTickLog(lastEntry as any, context.currentVix);

        // Update context with simulated price
        setContext((prev) => {
          const newPrice = newEntry.price;
          const deltaPrice = Number((newPrice - prev.lastPrice).toFixed(2));
          const newChange = Number((prev.priceChange + deltaPrice).toFixed(2));
          const newChangePct = Number(((newChange / (newPrice - newChange)) * 100).toFixed(2));
          const zScore = newEntry.zScore;

          let botState = prev.botState;
          if (prev.currentVix >= 28) botState = 'VOL_HALT';
          else if (Math.abs(zScore) >= 2.0) botState = 'FADE_READY';
          else botState = 'IDLE';

          return {
            ...prev,
            lastPrice: newPrice,
            priceChange: newChange,
            priceChangePct: newChangePct,
            vwap: newEntry.vwap,
            upperBand: newEntry.upperBand,
            lowerBand: newEntry.lowerBand,
            zScore: newEntry.zScore,
            rsi: newEntry.rsi,
            botState,
          };
        });

        // Keep last 60 entries max
        return [...prevLogs.slice(-59), newEntry];
      });
    }, 3200);

    return () => clearInterval(interval);
  }, [isSimulating, context.currentVix, context.lastPrice, context.vwap, context.atr]);

  // Handle switching scenario preset
  const handleApplyPreset = (preset: ScenarioPreset) => {
    setCurrentPreset(preset);
    setLogs(preset.logs);
    setContext((prev) => ({
      ...prev,
      ...preset.initialContext,
    }));
  };

  // Handle custom logs ingestion
  const handleApplyCustomLogs = (customLogs: BotLogEntry[]) => {
    if (customLogs.length === 0) return;
    setLogs(customLogs);
    const last = customLogs[customLogs.length - 1];
    const { regime, label } = determineVolRegime(last.vix);

    setContext((prev) => ({
      ...prev,
      symbol: last.symbol,
      lastPrice: last.price,
      vwap: last.vwap,
      upperBand: last.upperBand,
      lowerBand: last.lowerBand,
      zScore: last.zScore,
      rsi: last.rsi,
      currentVix: last.vix,
      vixRegime: regime,
      regimeLabel: label,
      atr: last.atr,
    }));
  };

  // Connect to SSE Webhook stream for real-time bot event broadcasts
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/webhook/stream');
      eventSource.onopen = () => {
        setSseConnected(true);
      };
      eventSource.addEventListener('bot_log', (e: MessageEvent) => {
        try {
          const newEntry: BotLogEntry = JSON.parse(e.data);
          setLogs((prev) => [...prev.slice(-99), newEntry]);
          setContext((prev) => {
            const { regime, label } = determineVolRegime(newEntry.vix);
            return {
              ...prev,
              symbol: newEntry.symbol,
              lastPrice: newEntry.price,
              vwap: newEntry.vwap,
              upperBand: newEntry.upperBand,
              lowerBand: newEntry.lowerBand,
              zScore: newEntry.zScore,
              rsi: newEntry.rsi,
              currentVix: newEntry.vix,
              vixRegime: regime,
              regimeLabel: label,
              atr: newEntry.atr,
            };
          });
        } catch (err) {
          console.error('Error parsing SSE bot_log:', err);
        }
      });
      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.error('Failed to initialize EventSource:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const handleTriggerTestWebhook = async () => {
    await fetch('/api/webhook/test-sample', { method: 'POST' });
  };

  const handleSelectSymbol = (symbol: ContractSymbol) => {
    setContext((prev) => ({
      ...prev,
      symbol,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar Contract (3 zones) */}
      <TopNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenIngestModal={() => setIsIngestModalOpen(true)}
        onOpenBotConnectModal={() => setIsBotConnectModalOpen(true)}
        onOpenDonationModal={() => setIsDonationModalOpen(true)}
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        onSynthesize={() => setActiveTab('ai_synthesis')}
        sseConnected={sseConnected}
      />

      {/* Real-time S&P Futures & VIX Market Context Bar */}
      <MarketContextBar
        context={context}
        onSelectSymbol={handleSelectSymbol}
        activePresetName={currentPreset.name}
      />

      {/* Scenario Quick Switcher Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span className="text-slate-500 font-semibold uppercase">Quick Scenarios:</span>
          {PRESET_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleApplyPreset(scenario)}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                currentPreset.id === scenario.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {scenario.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
          <span>
            Contract Multiplier:{' '}
            <strong className="text-white">
              {context.symbol === 'ES' ? '$50 / pt ($12.50 / tick)' : '$5 / pt ($1.25 / tick)'}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Workspace Viewport */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
        {/* OVERVIEW TAB: Action Helper + Mean Reversion Chart + Quick Log Feed */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-150">
            {/* Primary Action Helper Card */}
            <ActionHelperCard helper={actionHelper} />

            {/* Mean Reversion & Volatility Filter Interactive Chart */}
            <MeanReversionChart logs={logs} context={context} />

            {/* Bottom Split: Recent Log Telemetry + Quick AI Brief */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <LogStreamViewer
                  logs={logs}
                  onClearLogs={() => setLogs([])}
                  onResetLogs={() => setLogs(currentPreset.logs)}
                />
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white tracking-tight">
                        AI Context Brief
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Gemini 3.8</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Transform raw bot logs into real-time decision-making context. The AI analyzes recent stop execution quality, volatility expansion traps, and provides immediate playbook guidance.
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800">
                  <button
                    onClick={() => setActiveTab('ai_synthesis')}
                    className="w-full py-2 px-3 text-xs font-mono font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>Open AI Intelligence Terminal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RISK & STOPS TAB: Stop-Loss Audit + Dynamic Position Sizing Matrix */}
        {activeTab === 'risk_audit' && (
          <div className="animate-in fade-in duration-150">
            <RiskArtifactAudit
              logs={logs}
              currentVix={context.currentVix}
              currentAtr={context.atr}
            />
          </div>
        )}

        {/* LOGS TAB: Dedicated Full-Height Telemetry Stream & Search */}
        {activeTab === 'logs' && (
          <div className="animate-in fade-in duration-150">
            <LogStreamViewer
              logs={logs}
              onClearLogs={() => setLogs([])}
              onResetLogs={() => setLogs(currentPreset.logs)}
            />
          </div>
        )}

        {/* AI SYNTHESIS TAB: Full Gemini AI Market Context Synthesizer */}
        {activeTab === 'ai_synthesis' && (
          <div className="animate-in fade-in duration-150">
            <AiContextSynthesizer logs={logs} context={context} />
          </div>
        )}
      </main>

      {/* Subtle Terminal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-3.5 text-[11px] text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span>Aequitas S&P 500 Terminal · Institutional Futures Intelligence</span>
            <span className="text-slate-700">|</span>
            <button
              onClick={() => setIsBotConnectModalOpen(true)}
              className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              Webhook API Hub
            </button>
          </div>

          <button
            onClick={() => setIsDonationModalOpen(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Sponsor continuous cloud runtime and CME data feeds"
          >
            <span className="text-rose-400">♥</span>
            <span>Support Cloud Hosting & Data Feeds</span>
          </button>
        </div>
      </footer>

      {/* Log Ingest Modal */}
      <LogIngestModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onApplyPreset={handleApplyPreset}
        onApplyCustomLogs={handleApplyCustomLogs}
        currentPresetId={currentPreset.id}
      />

      {/* External Bot Repo Connection Webhook Modal */}
      <BotConnectionModal
        isOpen={isBotConnectModalOpen}
        onClose={() => setIsBotConnectModalOpen(false)}
        sseConnected={sseConnected}
        onTriggerTestWebhook={handleTriggerTestWebhook}
      />

      {/* Donation & Cloud Hosting Support Modal */}
      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
      />
    </div>
  );
}
