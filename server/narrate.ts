// Turns one validated event into one plain-English sentence.
// The template sentence is always built from the event's own numbers. An LLM may only rephrase it,
// and its output is thrown away unless it uses no new numbers and none of the forbidden phrases.
import { GoogleGenAI } from '@google/genai';
import type { FeedEvent } from './events.ts';

const REASONS: Record<string, string> = {
  entries_blocked: 'new entries are paused',
  wrong_account: 'the expected account was not selected',
  not_enough_history: 'there is not yet enough price history for the average',
  below_average: 'price is below its long-term average',
  positions_unreadable: 'the platform position could not be read',
  already_in_position: 'a position was already open',
  ranging_regime_block: 'the market looked range-bound',
  session_drain: 'the session is winding down',
  stop_loss: 'its stop-loss level was reached',
  take_profit: 'its profit target was reached',
  time_exit: 'its time limit was reached',
};

function reasonText(code: unknown): string {
  if (typeof code !== 'string' || !code) return 'a rule was not met';
  const c = code.toLowerCase();
  return REASONS[c] ?? `rule "${c.replace(/_/g, ' ')}"`;
}

function setupText(setup: unknown): string {
  return typeof setup === 'string' && setup ? setup.replace(/_/g, ' ') : 'a';
}

const n2 = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : '?');

function direction(side: unknown): string {
  return side === 'buy' || side === 'long' ? 'long' : 'short';
}

function pointsText(p: unknown): string {
  if (typeof p !== 'number') return 'result not reported';
  if (p === 0) return 'flat (0.00 points)';
  return `${p > 0 ? 'up' : 'down'} ${Math.abs(p).toFixed(2)} points`;
}

export function templateNarration(e: FeedEvent): string {
  switch (e.type) {
    case 'overnight': {
      const days = typeof e.average_days === 'number' ? Math.round(e.average_days) : '?';
      switch (e.decision) {
        case 'enter':
          return `At 15:55 ET price ${n2(e.price)} was above its ${days}-day average of ${n2(e.average)}, so the overnight rule opened a 1-contract long position, to be closed at the 09:30 ET open.`;
        case 'enter_dry_run':
          return `Price ${n2(e.price)} is above its ${days}-day average of ${n2(e.average)}, so the overnight rule would have opened a 1-contract long position (test mode: no order was sent).`;
        case 'skip':
          if (String(e.reason).toLowerCase() === 'below_average' && typeof e.price === 'number')
            return `Price ${n2(e.price)} is below its ${days}-day average of ${n2(e.average)}, so the overnight rule stayed out tonight.`;
          return `The overnight rule did not trade tonight because ${reasonText(e.reason)}.`;
        case 'exit':
          return `The overnight position was closed at the open, ${pointsText(e.points)}.`;
        case 'exit_failed':
          return 'The automatic close of the overnight position did not go through and needs manual attention.';
      }
      return 'Overnight rule update.';
    }
    case 'signal': {
      const side = e.side ? `${direction(e.side)} ` : '';
      if (e.status === 'approved') return `The ${setupText(e.setup)} setup produced a ${side}signal and the risk checks approved it.`;
      return `The ${setupText(e.setup)} setup produced a ${side}signal, but it was blocked because ${reasonText(e.reason)}.`;
    }
    case 'trade_open':
      return `A ${direction(e.side)} position was opened at ${n2(e.entry_price)}${e.setup ? ` by the ${setupText(e.setup)} setup` : ''}.`;
    case 'trade_close': {
      const from = typeof e.entry_price === 'number' ? ` from ${n2(e.entry_price)}` : '';
      const why = e.exit_reason ? ` because ${reasonText(e.exit_reason)}` : '';
      return `The ${direction(e.side)} position${from} was closed at ${n2(e.exit_price)}${why}, ${pointsText(e.points)}.`;
    }
    case 'bot_status':
      return {
        started: 'The trading system started.',
        stopped: 'The trading system stopped.',
        connected: 'The trading system connected to its trading platform.',
        disconnected: 'The trading system lost its connection to the trading platform.',
      }[String(e.state)] ?? 'Trading system status update.';
  }
}

const FORBIDDEN = [
  'should', 'recommend', 'advice', 'advise', 'guarantee', 'buy now', 'sell now', 'opportunity', 'will rise',
  'will fall', 'will go', 'expect', 'predict', 'forecast', 'profit', 'easy money', 'risk-free', 'you ', 'your ',
];
const numbersIn = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map((x) => Number(x));

export function acceptRephrase(template: string, candidate: string): boolean {
  const c = candidate.trim();
  if (!c || c.length > 320 || /[<>{}`*#]/.test(c)) return false;
  const lower = c.toLowerCase();
  if (FORBIDDEN.some((w) => lower.includes(w))) return false;
  const allowed = numbersIn(template);
  const used = numbersIn(c);
  if (!used.every((x) => allowed.some((a) => Math.abs(a - x) < 1e-9))) return false;
  return allowed.every((a) => used.some((x) => Math.abs(a - x) < 1e-9));
}

let ai: GoogleGenAI | null = null;

export async function narrate(e: FeedEvent): Promise<{ text: string; source: 'template' | 'llm' }> {
  const text = templateNarration(e);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (process.env.NARRATE_WITH_LLM !== '1' || !key) return { text, source: 'template' };
  try {
    ai ??= new GoogleGenAI({ apiKey: key });
    const call = ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
      contents: text,
      config: {
        systemInstruction:
          'Rewrite the sentence you are given about an automated S&P 500 futures trading system so a non-trader understands it. ' +
          'Return one or two short sentences of plain text. Keep every number exactly as written and add no new numbers. ' +
          'Do not give advice, do not predict prices, do not address the reader.',
        temperature: 0.3,
        maxOutputTokens: 120,
      },
    });
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
    const res = await Promise.race([call, timeout]);
    const out = (res.text ?? '').replace(/\s+/g, ' ').trim();
    if (acceptRephrase(text, out)) return { text: out, source: 'llm' };
  } catch (err) {
    console.warn('narration rephrase skipped:', (err as Error).message);
  }
  return { text, source: 'template' };
}
