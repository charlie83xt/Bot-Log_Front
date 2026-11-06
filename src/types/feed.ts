export interface FeedItem {
  id: number;
  type: 'overnight' | 'signal' | 'trade_open' | 'trade_close' | 'bot_status';
  occurred_at: string;
  public_at: string;
  account_type: 'simulation' | 'live' | 'unknown';
  data: Record<string, string | number | boolean | null>;
  narration: string;
  narration_source: 'template' | 'llm';
}

export interface MarketSnapshot {
  symbol: string;
  delay_minutes: number;
  as_of: string;
  last: number;
  previous_close: number | null;
  change: number | null;
  change_pct: number | null;
  session: {
    day: string;
    status: 'open' | 'closed';
    open: number;
    high: number;
    low: number;
    vwap: number | null;
    opening_range: { high: number; low: number } | null;
  };
  previous: { day: string; high: number; low: number; close: number } | null;
  average: { days: number; value: number | null; days_available: number; price_above: boolean | null };
  chart: { t: string; c: number }[];
}

export interface ResearchStats {
  updated: string;
  note: string;
  items: { title: string; value: string; detail: string; sample: string; period: string }[];
}

export interface SupportInfo {
  paypal: string | null;
  crypto: { coin: string; address: string }[];
}
