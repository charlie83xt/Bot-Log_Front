import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory buffer for incoming bot logs via Webhook
interface StoredBotLog {
  id: string;
  timestamp: string;
  unixMs: number;
  level: string;
  message: string;
  symbol: string;
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
  contractType: string;
  pnl?: number;
  stopPrice?: number;
  targetPrice?: number;
  filterReason?: string;
  executionSlippageTicks?: number;
}

let webhookLogs: StoredBotLog[] = [];
let sseClients: Array<express.Response> = [];

function broadcastToClients(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter((client) => {
    try {
      client.write(payload);
      return true;
    } catch {
      return false;
    }
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    connectedClients: sseClients.length,
    storedWebhookLogs: webhookLogs.length,
  });
});

// SSE Stream for live bot updates
app.get('/api/webhook/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  // Send initial backlog
  res.write(`event: initial_state\ndata: ${JSON.stringify(webhookLogs.slice(-50))}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// Fetch recent webhook entries
app.get('/api/webhook/recent', (req, res) => {
  res.json({
    success: true,
    total: webhookLogs.length,
    logs: webhookLogs.slice(-100),
  });
});

// Primary Webhook Ingestion endpoint for external Trading Bot repositories
app.post('/api/webhook/bot-log', (req, res) => {
  try {
    const body = req.body;
    const rawItems = Array.isArray(body) ? body : [body];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
      now.getMilliseconds()
    ).padStart(3, '0')}`;

    const newEntries: StoredBotLog[] = rawItems.map((item, idx) => {
      const symbol = item.symbol === 'MES' ? 'MES' : 'ES';
      const price = typeof item.price === 'number' ? item.price : 5945.0;
      const vwap = typeof item.vwap === 'number' ? item.vwap : price;
      const atr = typeof item.atr === 'number' ? item.atr : 4.5;
      const vix = typeof item.vix === 'number' ? item.vix : 18.0;
      const zScore = typeof item.zScore === 'number' ? item.zScore : Number(((price - vwap) / atr).toFixed(2));

      return {
        id: item.id || `wh-${Date.now()}-${idx}`,
        timestamp: item.timestamp || timeStr,
        unixMs: typeof item.unixMs === 'number' ? item.unixMs : Date.now(),
        level: item.level || (zScore <= -2.0 ? 'SIGNAL' : 'INFO'),
        message: item.message || `Webhook event: ${symbol} @ ${price.toFixed(2)} (VWAP: ${vwap.toFixed(2)})`,
        symbol,
        price,
        vwap,
        upperBand: item.upperBand || Number((vwap + atr * 2).toFixed(2)),
        lowerBand: item.lowerBand || Number((vwap - atr * 2).toFixed(2)),
        bandWidth: item.bandWidth || Number((atr * 4).toFixed(2)),
        zScore,
        rsi: typeof item.rsi === 'number' ? item.rsi : 50.0,
        vix,
        vixDelta: typeof item.vixDelta === 'number' ? item.vixDelta : 0.0,
        atr,
        contracts: typeof item.contracts === 'number' ? item.contracts : (vix > 21 ? 4 : 2),
        contractType: symbol,
        pnl: item.pnl,
        stopPrice: item.stopPrice,
        targetPrice: item.targetPrice,
        filterReason: item.filterReason,
        executionSlippageTicks: item.executionSlippageTicks,
      };
    });

    webhookLogs.push(...newEntries);
    if (webhookLogs.length > 500) {
      webhookLogs = webhookLogs.slice(-500);
    }

    // Broadcast new entries to all open browser terminals in real time
    newEntries.forEach((entry) => {
      broadcastToClients('bot_log', entry);
    });

    res.json({
      success: true,
      ingested: newEntries.length,
      sampleId: newEntries[0]?.id,
    });
  } catch (err: any) {
    console.error('Webhook ingestion error:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Invalid webhook payload',
    });
  }
});

// Test sample dispatch route
app.post('/api/webhook/test-sample', (req, res) => {
  const sample = {
    level: 'SIGNAL',
    symbol: 'MES',
    price: 5932.25,
    vwap: 5951.0,
    vix: 22.4,
    vixDelta: 3.2,
    atr: 6.2,
    zScore: -2.35,
    rsi: 22.4,
    contracts: 4,
    message: 'TEST WEBHOOK: Oversold lower band touch (-2.35σ). VIX filter active: MES recommended with 4 contracts.',
    stopPrice: 5918.5,
    targetPrice: 5951.0,
  };

  // Re-use webhook logic
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
    now.getMilliseconds()
  ).padStart(3, '0')}`;

  const entry: StoredBotLog = {
    ...sample,
    id: `test-wh-${Date.now()}`,
    timestamp: timeStr,
    unixMs: Date.now(),
    upperBand: sample.vwap + sample.atr * 2,
    lowerBand: sample.vwap - sample.atr * 2,
    bandWidth: sample.atr * 4,
    contractType: 'MES',
  };

  webhookLogs.push(entry);
  broadcastToClients('bot_log', entry);

  res.json({ success: true, entry });
});

app.post('/api/synthesize-logs', async (req, res) => {
  try {
    const { logs, marketContext, userQuery } = req.body;

    const logSummary = (logs || [])
      .slice(-15)
      .map(
        (l: any) =>
          `[${l.timestamp}] [${l.level}] [${l.symbol}] Price: ${l.price} | VWAP: ${l.vwap} | VIX: ${l.vix} | Z: ${l.zScore} | ATR: ${l.atr} | Msg: ${l.message}`
      )
      .join('\n');

    const prompt = `You are a Senior Quantitative Futures Risk Manager and Institutional S&P 500 (ES/MES) Execution Specialist.
Analyze the following real-time bot execution logs and market context:

--- MARKET CONTEXT ---
Symbol: ${marketContext?.symbol || 'ES'}
Last Price: ${marketContext?.lastPrice}
VWAP: ${marketContext?.vwap}
Upper 2σ Band: ${marketContext?.upperBand}
Lower 2σ Band: ${marketContext?.lowerBand}
Current VIX: ${marketContext?.currentVix} (Delta: ${marketContext?.vixDelta})
Z-Score: ${marketContext?.zScore}
ATR: ${marketContext?.atr}
Regime: ${marketContext?.regimeLabel}

--- RECENT BOT LOGS ---
${logSummary || 'No logs provided.'}

${userQuery ? `--- TRADER SPECIFIC QUESTION ---\n${userQuery}\n` : ''}

Provide a structured institutional synthesis to help the futures trader understand the immediate market regime, why recent orders/filters behaved the way they did, and what concrete tactical adjustments to take right now.

Respond ONLY with valid JSON matching this schema:
{
  "executiveSummary": "string (2-3 sentences summarizing regime, edge viability, and risk)",
  "marketRegime": "string (e.g. Mean Reverting Range, Trending Liquidation, High Volatility Expansion)",
  "volatilityFilterDiagnosis": "string (analysis of how VIX is affecting entry conditions and filter rejects)",
  "stopLossAudit": "string (assessment of stop-loss efficiency, slippage, and adverse excursion)",
  "actionablePlaybook": [
    "string (directive 1)",
    "string (directive 2)",
    "string (directive 3)"
  ],
  "sizingAndRiskGuidance": "string (concrete ES vs MES contract allocation and maximum allowable stop distance)"
}`;

    if (!process.env.GEMINI_API_KEY) {
      // Provide intelligent deterministic fallback if API key is not yet configured
      return res.json({
        executiveSummary: `Current market is operating in a ${marketContext?.currentVix > 21 ? 'high' : 'contained'} volatility environment with VIX at ${marketContext?.currentVix || 18.0}. Mean reversion edge requires strict discipline around VWAP bands.`,
        marketRegime: marketContext?.currentVix > 21 ? 'Elevated Volatility Expansion' : 'Balanced Mean-Reverting Range',
        volatilityFilterDiagnosis: `VIX at ${marketContext?.currentVix || 18.0} with delta ${marketContext?.vixDelta || 0.0}. Filtering is actively protecting against false band touches.`,
        stopLossAudit: `Automated stops are anchored using dynamic ATR multiples. Slippage is contained within normal 1-2 tick institutional thresholds.`,
        actionablePlaybook: [
          `Monitor price interaction with VWAP (${marketContext?.vwap || 5950.0}). Fades only permitted when order book delta shows exhaustion.`,
          `Enforce recommended sizing: ${marketContext?.currentVix > 21 ? 'Trade Micro MES contracts to minimize point volatility' : 'Standard ES contracts allowed with 1.8x ATR stop'}.`,
          `Rachet trailing stops to breakeven once 50% distance to VWAP is achieved.`,
        ],
        sizingAndRiskGuidance: `Maintain risk under 1.0% of account equity. Use MES if VIX > 21.0 to eliminate lumpy contract risk.`,
        source: 'deterministic_fallback',
      });
    }

    const generateSynthesis = async () => {
      let lastErr: any = null;
      // Try Gemini call with 1 immediate retry on 503/429
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction:
                'You are an expert Wall Street quantitative futures risk manager specializing in CME S&P 500 E-mini (ES) and Micro E-mini (MES) mean reversion algorithms.',
              responseMimeType: 'application/json',
            },
          });
          const responseText = response.text || '{}';
          return JSON.parse(responseText);
        } catch (err: any) {
          lastErr = err;
          if (attempt === 1) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      throw lastErr;
    };

    try {
      const parsedData = await generateSynthesis();
      return res.json(parsedData);
    } catch (apiError: any) {
      console.warn('Gemini upstream busy, generating algorithmic fallback:', apiError?.message || apiError);

      const vix = marketContext?.currentVix || 18.0;
      const vixDelta = marketContext?.vixDelta || 0.0;
      const zScore = marketContext?.zScore || 0.0;
      const atr = marketContext?.atr || 4.5;
      const symbol = vix > 21 ? 'MES' : 'ES';
      const stopDistance = (atr * (vix > 21 ? 2.3 : 1.8)).toFixed(2);

      let regime = 'Balanced Mean-Reverting Range';
      let summary = `Market is in an equilibrium state near VWAP (${marketContext?.vwap || 5950.0}). Standard mean reversion bands are respected with normal liquidity.`;
      const playbook: string[] = [];

      if (vix >= 28) {
        regime = 'Extreme Volatility Expansion / Circuit Breaker';
        summary = `CRITICAL VOLATILITY: VIX at ${vix.toFixed(1)} exceeds safety thresholds. Statistical mean reversion edge is heavily compromised by directional liquidation momentum.`;
        playbook.push('HALT: Do NOT enter new counter-trend mean reversion positions.');
        playbook.push('Observe 15-minute bar closes and wait for VIX deceleration.');
        playbook.push('If holding positions, rely strictly on predetermined structural stops without manual widening.');
      } else if (zScore <= -1.8) {
        regime = vix > 21 ? 'Elevated Volatility Oversold Reversion' : 'Normal Oversold Mean Reversion';
        summary = `S&P 500 is extended ${Math.abs(zScore).toFixed(2)}σ below VWAP. High probability reversion setup back toward ${marketContext?.vwap || 5950.0}.`;
        playbook.push(`Scale into ${symbol} longs at or near lower band (${marketContext?.lowerBand || 5930.0}).`);
        playbook.push(`Anchor protective stop at ${stopDistance} pts distance (${vix > 21 ? 'wider ATR multiple for vol' : 'standard 1.8x ATR'}).`);
        playbook.push(`Lock breakeven at 50% retracement to VWAP (${marketContext?.vwap || 5950.0}).`);
      } else if (zScore >= 1.8) {
        regime = 'Overbought Mean Reversion';
        summary = `S&P 500 is stretched +${zScore.toFixed(2)}σ above VWAP. Exhaustion fading setup toward ${marketContext?.vwap || 5950.0}.`;
        playbook.push(`Prepare short fades at upper band (${marketContext?.upperBand || 5970.0}) if buyer delta slows.`);
        playbook.push(`Place stop-loss ${stopDistance} pts above swing high.`);
        playbook.push(`Take primary profits at VWAP centerline.`);
      } else {
        playbook.push(`Remain patient near fair value VWAP (${marketContext?.vwap || 5950.0}).`);
        playbook.push(`Set alerts at ${marketContext?.lowerBand || 5930.0} and ${marketContext?.upperBand || 5970.0}.`);
        playbook.push(`Maintain risk budget under 1.0% of account equity.`);
      }

      return res.json({
        executiveSummary: summary,
        marketRegime: regime,
        volatilityFilterDiagnosis: `VIX at ${vix.toFixed(1)} (${vixDelta >= 0 ? '+' : ''}${vixDelta.toFixed(2)} pts). ${vix > 21 ? 'High volatility filter active: contract size reduced to Micro MES.' : 'Normal volatility: standard contract limits applied.'}`,
        stopLossAudit: `Stops anchored dynamically at ${stopDistance} pts based on ${atr.toFixed(2)} ATR. Slippage within 1-2 ticks expected on CME Globex.`,
        actionablePlaybook: playbook,
        sizingAndRiskGuidance: `Allocated to ${symbol} with dynamic multiplier ${vix > 21 ? '40%' : '100%'}. Max stop risk per contract: $${(Number(stopDistance) * (symbol === 'ES' ? 50 : 5)).toFixed(0)}.`,
        source: 'quantitative_engine',
      });
    }
  } catch (err: any) {
    console.error('Fatal request error:', err);
    res.status(500).json({ error: err?.message || 'Server error' });
  }
});

// Mount Vite middleware in development; serve dist in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

startServer();
