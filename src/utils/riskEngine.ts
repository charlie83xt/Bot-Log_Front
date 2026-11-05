import {
  ActionHelper,
  BotLogEntry,
  ContractSymbol,
  FilterStatus,
  MarketContext,
  StopLossAudit,
  VolRegime,
} from '../types/futures';

export function determineVolRegime(vix: number): {
  regime: VolRegime;
  label: string;
  multiplier: number;
  recommendedSymbol: ContractSymbol;
} {
  if (vix < 16) {
    return {
      regime: 'LOW_VOL',
      label: 'Calm / Low Volatility (Standard ES Sizing)',
      multiplier: 1.0,
      recommendedSymbol: 'ES',
    };
  } else if (vix < 21) {
    return {
      regime: 'MODERATE_VOL',
      label: 'Moderate Volatility (Scaled ES / MES Hybrid)',
      multiplier: 0.75,
      recommendedSymbol: 'ES',
    };
  } else if (vix < 28) {
    return {
      regime: 'ELEVATED_VOL',
      label: 'Elevated Volatility (Micro MES Mandate)',
      multiplier: 0.4,
      recommendedSymbol: 'MES',
    };
  } else {
    return {
      regime: 'EXTREME_VOL',
      label: 'Extreme Volatility (Circuit Breaker / Risk Halt)',
      multiplier: 0.0,
      recommendedSymbol: 'MES',
    };
  }
}

export function calculateDynamicPositionSize(
  accountEquity: number,
  riskTolerancePct: number,
  currentPrice: number,
  atr: number,
  vix: number
): {
  recommendedSymbol: ContractSymbol;
  contracts: number;
  riskUsd: number;
  multiplier: number;
  rationale: string;
} {
  const maxRiskCapital = accountEquity * (riskTolerancePct / 100);
  const { multiplier, recommendedSymbol } = determineVolRegime(vix);

  const atrStopPts = Math.max(3.0, atr * (vix > 21 ? 2.3 : 1.8));

  if (vix >= 28) {
    return {
      recommendedSymbol: 'MES',
      contracts: 0,
      riskUsd: 0,
      multiplier: 0,
      rationale:
        'VIX exceeds 28.0 extreme threshold. Mean reversion edge decays in liquidation environments; sizing set to 0 (Trade Halt).',
    };
  }

  if (recommendedSymbol === 'ES') {
    // 1 ES pt = $50
    const riskPerContract = atrStopPts * 50;
    const rawContracts = Math.floor((maxRiskCapital / riskPerContract) * multiplier);
    const contracts = Math.max(1, rawContracts);
    const actualRisk = contracts * riskPerContract;

    return {
      recommendedSymbol: 'ES',
      contracts,
      riskUsd: actualRisk,
      multiplier,
      rationale: `VIX at ${vix.toFixed(1)} permits ES contracts. Sizing multiplier ${multiplier * 100}% with ${atrStopPts.toFixed(2)} pt stop (${(actualRisk / accountEquity * 100).toFixed(2)}% risk).`,
    };
  } else {
    // 1 MES pt = $5
    const riskPerContract = atrStopPts * 5;
    const rawContracts = Math.floor((maxRiskCapital / riskPerContract) * multiplier);
    const contracts = Math.max(1, rawContracts);
    const actualRisk = contracts * riskPerContract;

    return {
      recommendedSymbol: 'MES',
      contracts,
      riskUsd: actualRisk,
      multiplier,
      rationale: `VIX elevated at ${vix.toFixed(1)}. Substituted ES for Micro E-mini (MES) to prevent chunky tick risk. ${contracts} MES contracts equal to ${(contracts * 0.1).toFixed(2)} ES.`,
    };
  }
}

export function generateActionHelper(
  context: MarketContext,
  recentLogs: BotLogEntry[]
): ActionHelper {
  const vix = context.currentVix;
  const zScore = context.zScore;
  const price = context.lastPrice;
  const vwap = context.vwap;
  const atr = context.atr || 4.5;

  const { regime, multiplier, recommendedSymbol } = determineVolRegime(vix);

  let filterStatus: FilterStatus = 'PASS';
  let filterMsg = `Volatility within normal operational limits (${vix.toFixed(1)}).`;

  if (vix >= 28) {
    filterStatus = 'BLOCKED';
    filterMsg = `CRITICAL: VIX at ${vix.toFixed(1)} exceeds safety ceiling (28.0). Mean reversion suspended.`;
  } else if (vix >= 21) {
    filterStatus = 'WARN';
    filterMsg = `CAUTION: VIX elevated at ${vix.toFixed(1)}. MES sizing mandatory; trailing stops widened.`;
  } else if (context.vixDelta > 2.0) {
    filterStatus = 'WARN';
    filterMsg = `VOLATILITY EXPANSION: VIX rising fast (+${context.vixDelta.toFixed(2)} pts). Beware false band touches.`;
  }

  // Determine Reversion Bias
  let reversionBias: ActionHelper['reversionBias'] = 'NO_EDGE';
  let headline = 'Market in Balance Near VWAP';
  let subtext = 'Price is within 1.0σ of mean. No statistical mean reversion asymmetry exists currently.';
  let status: ActionHelper['status'] = 'STANDBY';

  if (vix >= 28) {
    reversionBias = 'VOLATILITY_HALTED';
    headline = 'Volatility Halt: Circuit Breaker Active';
    subtext = 'Mean reversion bot is paused. Strong momentum trending risks outsized adverse excursion.';
    status = 'HALTED';
  } else if (zScore <= -1.8) {
    reversionBias = 'LONG_FAVORED';
    headline = `Oversold Mean Reversion Opportunity (${zScore.toFixed(2)}σ)`;
    subtext = `Price is ${Math.abs(price - vwap).toFixed(2)} pts below VWAP. High statistical reversion probability toward ${vwap.toFixed(2)}.`;
    status = filterStatus === 'BLOCKED' ? 'CAUTION' : 'ACTIONABLE';
  } else if (zScore >= 1.8) {
    reversionBias = 'SHORT_FAVORED';
    headline = `Overbought Mean Reversion Short Asymmetry (+${zScore.toFixed(2)}σ)`;
    subtext = `Price is +${(price - vwap).toFixed(2)} pts above VWAP. Exhaustion fading favorable toward ${vwap.toFixed(2)}.`;
    status = filterStatus === 'BLOCKED' ? 'CAUTION' : 'ACTIONABLE';
  }

  // Sizing Calculation for a default $50,000 account
  const sizing = calculateDynamicPositionSize(50000, 1.0, price, atr, vix);

  // Stop Loss & Target Guidance
  const stopDistancePts = atr * (vix > 21 ? 2.3 : 1.8);
  const stopAnchorPrice =
    reversionBias === 'LONG_FAVORED'
      ? price - stopDistancePts
      : price + stopDistancePts;

  const pointValue = sizing.recommendedSymbol === 'ES' ? 50 : 5;
  const riskPerContractUsd = stopDistancePts * pointValue;
  const totalRiskUsd = riskPerContractUsd * sizing.contracts;

  const targetPrice = vwap;
  const targetDistancePts = Math.abs(targetPrice - price);
  const potentialProfitUsd = targetDistancePts * pointValue * sizing.contracts;
  const rewardRiskRatio = totalRiskUsd > 0 ? potentialProfitUsd / totalRiskUsd : 0;

  const directives: string[] = [];
  if (status === 'HALTED') {
    directives.push('Do NOT initiate new counter-trend mean reversion positions.');
    directives.push('Allow market to consolidate and wait for VIX to print 2 consecutive lower 15-minute bars.');
    directives.push('If holding positions, rely on structural ATR stops without manual widening.');
  } else if (reversionBias === 'LONG_FAVORED') {
    directives.push(
      `Look for 1-minute order book delta absorption at or below ${context.lowerBand.toFixed(2)}.`
    );
    directives.push(
      `Place initial protective stop at ${stopAnchorPrice.toFixed(2)} (${stopDistancePts.toFixed(2)} pts / ${sizing.recommendedSymbol}).`
    );
    directives.push(
      `Set primary take-profit at VWAP (${vwap.toFixed(2)}). Step trailing stop to Breakeven once +${(targetDistancePts * 0.5).toFixed(2)} pts reached.`
    );
  } else if (reversionBias === 'SHORT_FAVORED') {
    directives.push(
      `Verify buyer exhaustion at upper band (${context.upperBand.toFixed(2)}) via decreasing volume.`
    );
    directives.push(
      `Anchor stop-loss at ${stopAnchorPrice.toFixed(2)} (${stopDistancePts.toFixed(2)} pts / ${sizing.recommendedSymbol}).`
    );
    directives.push(
      `Scale out 50% at VWAP midpoint (${vwap.toFixed(2)}) and trail remaining contracts.`
    );
  } else {
    directives.push('Price is oscillating near fair value. Maintain flat posture to preserve commissions.');
    directives.push(`Alert set at ${context.lowerBand.toFixed(2)} (Lower Band) and ${context.upperBand.toFixed(2)} (Upper Band).`);
  }

  return {
    status,
    headline,
    subtext,
    reversionBias,
    vixFilterMessage: filterMsg,
    vixFilterStatus: filterStatus,
    recommendedContracts: sizing.contracts,
    recommendedSymbol: sizing.recommendedSymbol,
    sizingMultiplier: multiplier,
    sizingReason: sizing.rationale,
    activeStopGuidance: {
      anchorPrice: Number(stopAnchorPrice.toFixed(2)),
      stopType: vix > 21 ? 'ATR_DYNAMIC' : 'TRAILING_VWAP',
      distancePoints: Number(stopDistancePts.toFixed(2)),
      riskPerContractUsd: Number(riskPerContractUsd.toFixed(2)),
      totalRiskUsd: Number(totalRiskUsd.toFixed(2)),
    },
    targetGuidance: {
      price: Number(targetPrice.toFixed(2)),
      distancePoints: Number(targetDistancePts.toFixed(2)),
      potentialProfitUsd: Number(potentialProfitUsd.toFixed(2)),
      rewardRiskRatio: Number(rewardRiskRatio.toFixed(2)),
    },
    tacticalDirectives: directives,
  };
}

export function auditStopLossLogs(logs: BotLogEntry[]): StopLossAudit {
  const stopEvents = logs.filter(
    (l) => l.level === 'STOP_LOSS' || (l.level === 'RISK_TRIGGER' && l.message.includes('STOP-LOSS TRIGGERED'))
  );

  let totalLoss = 0;
  let totalSlippage = 0;
  let totalDistance = 0;
  let trailingSaves = 0;

  logs.forEach((l) => {
    if (l.message.includes('TRAILING STOP') || l.message.includes('breakeven')) {
      trailingSaves++;
    }
  });

  const parsedEvents = stopEvents.map((evt, idx) => {
    const slippage = evt.executionSlippageTicks ?? 1;
    const loss = Math.abs(evt.pnl ?? -150);
    const stopPrice = evt.stopPrice ?? evt.price;
    const dist = Math.abs(evt.price - stopPrice);

    totalLoss += loss;
    totalSlippage += slippage;
    totalDistance += dist;

    return {
      id: evt.id || `stop-${idx}`,
      time: evt.timestamp,
      symbol: evt.symbol,
      price: evt.price,
      stopPrice,
      slippageTicks: slippage,
      realizedLossUsd: loss,
      vixAtTrigger: evt.vix,
      triggerType: evt.vix > 22 ? 'Volatility Expanded ATR Stop' : 'Standard Invalidation Stop',
    };
  });

  const count = parsedEvents.length;

  return {
    totalStopsTriggered: count,
    avgStopDistancePts: count > 0 ? Number((totalDistance / count).toFixed(2)) : 0,
    avgLossUsd: count > 0 ? Number((totalLoss / count).toFixed(2)) : 0,
    maxAdverseExcursionPts: count > 0 ? Math.max(...parsedEvents.map((e) => Math.abs(e.price - e.stopPrice))) : 0,
    avgSlippageTicks: count > 0 ? Number((totalSlippage / count).toFixed(1)) : 0,
    trailingStopSaves: trailingSaves,
    stopTriggerEvents: parsedEvents,
  };
}
