export type ContractSymbol = 'ES' | 'MES';

export type VolRegime = 'LOW_VOL' | 'MODERATE_VOL' | 'ELEVATED_VOL' | 'EXTREME_VOL';

export type LogSeverity =
  | 'INFO'
  | 'SIGNAL'
  | 'RISK_TRIGGER'
  | 'STOP_LOSS'
  | 'SIZING_CHANGE'
  | 'FILTER_REJECT'
  | 'EXECUTED';

export type FilterStatus = 'PASS' | 'WARN' | 'BLOCKED';

export interface BotLogEntry {
  id: string;
  timestamp: string;
  unixMs: number;
  level: LogSeverity;
  message: string;
  symbol: ContractSymbol;
  price: number;
  vwap: number;
  upperBand: number;
  lowerBand: number;
  bandWidth: number;
  zScore: number;
  rsi: number;
  vix: number;
  vixDelta: number;
  atr: number;
  contracts: number;
  contractType: ContractSymbol;
  pnl?: number;
  stopPrice?: number;
  targetPrice?: number;
  trailingDistance?: number;
  filterReason?: string;
  executionSlippageTicks?: number;
  rawText?: string;
}

export interface MarketContext {
  symbol: ContractSymbol;
  lastPrice: number;
  priceChange: number;
  priceChangePct: number;
  currentVix: number;
  vixDelta: number;
  vixRegime: VolRegime;
  regimeLabel: string;
  vwap: number;
  upperBand: number;
  lowerBand: number;
  zScore: number;
  rsi: number;
  atr: number;
  botState: 'IDLE' | 'FADE_READY' | 'ACTIVE_TRADE' | 'VOL_HALT' | 'COOLDOWN';
  activePosition: {
    contracts: number;
    symbol: ContractSymbol;
    side: 'FLAT' | 'LONG' | 'SHORT';
    entryPrice: number;
    unrealizedPnl: number;
    stopLossPrice: number;
    targetPrice: number;
    trailingActive: boolean;
    timeInTradeMin: number;
  } | null;
}

export interface ActionHelper {
  status: 'ACTIONABLE' | 'STANDBY' | 'CAUTION' | 'HALTED';
  headline: string;
  subtext: string;
  reversionBias: 'LONG_FAVORED' | 'SHORT_FAVORED' | 'NO_EDGE' | 'VOLATILITY_HALTED';
  vixFilterMessage: string;
  vixFilterStatus: FilterStatus;
  recommendedContracts: number;
  recommendedSymbol: ContractSymbol;
  sizingMultiplier: number;
  sizingReason: string;
  activeStopGuidance: {
    anchorPrice: number;
    stopType: 'ATR_DYNAMIC' | 'STRUCTURAL' | 'TRAILING_VWAP' | 'VOL_BREAKOUT';
    distancePoints: number;
    riskPerContractUsd: number;
    totalRiskUsd: number;
  };
  targetGuidance: {
    price: number;
    distancePoints: number;
    potentialProfitUsd: number;
    rewardRiskRatio: number;
  };
  tacticalDirectives: string[];
}

export interface StopLossAudit {
  totalStopsTriggered: number;
  avgStopDistancePts: number;
  avgLossUsd: number;
  maxAdverseExcursionPts: number;
  avgSlippageTicks: number;
  trailingStopSaves: number;
  stopTriggerEvents: Array<{
    id: string;
    time: string;
    symbol: ContractSymbol;
    price: number;
    stopPrice: number;
    slippageTicks: number;
    realizedLossUsd: number;
    vixAtTrigger: number;
    triggerType: string;
  }>;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  vixSummary: string;
  initialContext: Partial<MarketContext>;
  logs: BotLogEntry[];
}
