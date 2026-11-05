import { BotLogEntry, ContractSymbol, LogSeverity } from '../types/futures';

export function parseRawBotLogs(text: string): BotLogEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Check if text is JSON
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => sanitizeLogItem(item, idx));
      }
    } catch {
      // Fallback to line-by-line parsing
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const entries: BotLogEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const entry = parseSingleLogLine(line, i);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

function parseSingleLogLine(line: string, index: number): BotLogEntry {
  // Extract timestamp
  const timeMatch =
    line.match(/\b(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\b/) ||
    line.match(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z?)\b/);
  const timestamp = timeMatch ? timeMatch[1] : new Date().toLocaleTimeString();

  // Extract severity / event level
  let level: LogSeverity = 'INFO';
  if (/STOP[_-]?LOSS/i.test(line)) level = 'STOP_LOSS';
  else if (/FILTER[_-]?REJECT/i.test(line)) level = 'FILTER_REJECT';
  else if (/SIZING|ALLOCAT/i.test(line)) level = 'SIZING_CHANGE';
  else if (/FILLED|EXECUT/i.test(line)) level = 'EXECUTED';
  else if (/SIGNAL|ENTRY|OVERSOLD|OVERBOUGHT/i.test(line)) level = 'SIGNAL';
  else if (/RISK|ALERT|TRAIL|HALT|CIRCUIT/i.test(line)) level = 'RISK_TRIGGER';

  // Extract symbol: ES or MES
  let symbol: ContractSymbol = 'ES';
  if (/\bMES\b/i.test(line)) {
    symbol = 'MES';
  }

  // Extract numbers
  const priceMatch = line.match(/(?:@|price:?|at\s+)(\d{4}(?:\.\d{2})?)/i) || line.match(/(\d{4}\.\d{2})/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 5950.0;

  const vwapMatch = line.match(/VWAP:?\s*(\d{4}(?:\.\d{2})?)/i);
  const vwap = vwapMatch ? parseFloat(vwapMatch[1]) : price + (level === 'SIGNAL' ? 8.5 : 0);

  const vixMatch = line.match(/VIX:?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  const vix = vixMatch ? parseFloat(vixMatch[1]) : 17.5;

  const atrMatch = line.match(/ATR:?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  const atr = atrMatch ? parseFloat(atrMatch[1]) : 4.25;

  const zMatch = line.match(/Z(?:-Score)?:?\s*(-?\d+(?:\.\d+)?)/i);
  const zScore = zMatch ? parseFloat(zMatch[1]) : (price - vwap) / (atr || 4);

  const rsiMatch = line.match(/RSI(?:-14)?:?\s*(\d+(?:\.\d+)?)/i);
  const rsi = rsiMatch ? parseFloat(rsiMatch[1]) : 50.0;

  const contractsMatch = line.match(/(\d+)\s+(?:contracts?|ES|MES)/i);
  const contracts = contractsMatch ? parseInt(contractsMatch[1], 10) : 2;

  const pnlMatch = line.match(/(?:pnl|loss|gain|profit):?\s*([+-]?\$?\d+(?:\.\d{2})?)/i);
  let pnl: number | undefined;
  if (pnlMatch) {
    const rawPnl = pnlMatch[1].replace('$', '');
    pnl = parseFloat(rawPnl);
  }

  const stopMatch = line.match(/stop:?\s*(\d{4}(?:\.\d{2})?)/i);
  const stopPrice = stopMatch ? parseFloat(stopMatch[1]) : undefined;

  const targetMatch = line.match(/target:?\s*(\d{4}(?:\.\d{2})?)/i);
  const targetPrice = targetMatch ? parseFloat(targetMatch[1]) : undefined;

  const bandWidth = atr * 4;
  const upperBand = vwap + bandWidth / 2;
  const lowerBand = vwap - bandWidth / 2;

  return {
    id: `log-${Date.now()}-${index}`,
    timestamp,
    unixMs: Date.now() - (100 - index) * 5000,
    level,
    message: line.trim(),
    symbol,
    price,
    vwap,
    upperBand,
    lowerBand,
    bandWidth,
    zScore,
    rsi,
    vix,
    vixDelta: 0.25,
    atr,
    contracts,
    contractType: symbol,
    pnl,
    stopPrice,
    targetPrice,
  };
}

function sanitizeLogItem(item: any, idx: number): BotLogEntry {
  const symbol = item.symbol === 'MES' ? 'MES' : 'ES';
  const price = typeof item.price === 'number' ? item.price : 5950.0;
  const vwap = typeof item.vwap === 'number' ? item.vwap : price;
  const atr = typeof item.atr === 'number' ? item.atr : 4.5;

  return {
    id: item.id || `json-log-${idx}-${Date.now()}`,
    timestamp: item.timestamp || new Date().toLocaleTimeString(),
    unixMs: typeof item.unixMs === 'number' ? item.unixMs : Date.now() - idx * 1000,
    level: item.level || 'INFO',
    message: item.message || JSON.stringify(item),
    symbol,
    price,
    vwap,
    upperBand: item.upperBand || vwap + atr * 2,
    lowerBand: item.lowerBand || vwap - atr * 2,
    bandWidth: item.bandWidth || atr * 4,
    zScore: typeof item.zScore === 'number' ? item.zScore : 0,
    rsi: typeof item.rsi === 'number' ? item.rsi : 50,
    vix: typeof item.vix === 'number' ? item.vix : 18.0,
    vixDelta: typeof item.vixDelta === 'number' ? item.vixDelta : 0,
    atr,
    contracts: typeof item.contracts === 'number' ? item.contracts : 2,
    contractType: symbol,
    pnl: item.pnl,
    stopPrice: item.stopPrice,
    targetPrice: item.targetPrice,
    filterReason: item.filterReason,
    executionSlippageTicks: item.executionSlippageTicks,
  };
}

export function generateSimulatedTickLog(
  lastEntry: BotLogEntry,
  currentVix: number
): BotLogEntry {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
    now.getMilliseconds()
  ).padStart(3, '0')}`;

  // Random walk price by -1.50 to +1.50 pts in 0.25 tick increments
  const tickSteps = Math.floor(Math.random() * 9) - 4; // -4 to +4 ticks
  const priceDelta = tickSteps * 0.25;
  const newPrice = Number((lastEntry.price + priceDelta).toFixed(2));
  const newVwap = Number((lastEntry.vwap + priceDelta * 0.1).toFixed(2));
  const atr = lastEntry.atr;
  const zScore = Number(((newPrice - newVwap) / atr).toFixed(2));
  const rsi = Math.max(12, Math.min(88, Number((50 + zScore * 14).toFixed(1))));

  let level: LogSeverity = 'INFO';
  let message = `Market tick scan: ES @ ${newPrice.toFixed(2)}, Z=${zScore}σ, VWAP=${newVwap.toFixed(2)}`;
  let contracts = lastEntry.contracts;
  const symbol = currentVix > 21 ? 'MES' : 'ES';

  if (zScore <= -2.1) {
    level = 'SIGNAL';
    message = `MEAN REVERSION LONG TRIGGER: S&P ${symbol} breached -2.0σ VWAP band @ ${newPrice.toFixed(2)}. RSI=${rsi}. Assessing VIX filter...`;
  } else if (zScore >= 2.1) {
    level = 'SIGNAL';
    message = `MEAN REVERSION SHORT TRIGGER: S&P ${symbol} extended beyond +2.0σ VWAP band @ ${newPrice.toFixed(2)}. RSI=${rsi}. Assessing VIX filter...`;
  } else if (Math.random() > 0.85) {
    level = 'RISK_TRIGGER';
    message = `DYNAMIC VOLATILITY AUDIT: Current VIX ${currentVix.toFixed(2)}. Dynamic position sizing set to ${symbol} (multiplier ${(currentVix > 21 ? 0.4 : 1.0) * 100}%).`;
  }

  return {
    id: `sim-${Date.now()}`,
    timestamp: timeStr,
    unixMs: Date.now(),
    level,
    message,
    symbol,
    price: newPrice,
    vwap: newVwap,
    upperBand: Number((newVwap + atr * 2).toFixed(2)),
    lowerBand: Number((newVwap - atr * 2).toFixed(2)),
    bandWidth: Number((atr * 4).toFixed(2)),
    zScore,
    rsi,
    vix: currentVix,
    vixDelta: Number((currentVix - 16.0).toFixed(2)),
    atr,
    contracts,
    contractType: symbol,
  };
}

export function exportLogsToCsv(logs: BotLogEntry[]): string {
  const headers = [
    'Timestamp',
    'Level',
    'Symbol',
    'Price',
    'VWAP',
    'UpperBand',
    'LowerBand',
    'ZScore',
    'RSI',
    'VIX',
    'ATR',
    'Contracts',
    'PnL',
    'Message',
  ];

  const rows = logs.map((l) => [
    l.timestamp,
    l.level,
    l.symbol,
    l.price.toFixed(2),
    l.vwap.toFixed(2),
    l.upperBand.toFixed(2),
    l.lowerBand.toFixed(2),
    l.zScore.toFixed(2),
    l.rsi.toFixed(1),
    l.vix.toFixed(2),
    l.atr.toFixed(2),
    l.contracts,
    l.pnl !== undefined ? l.pnl.toFixed(2) : '',
    `"${l.message.replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
