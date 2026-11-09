// Public news-feed server for one automated ES/MES trading system.
//   POST /api/events   signed events from the bot (HMAC-SHA256, see feed_publisher.py)
//   GET  /api/feed     public events (each one appears PUBLIC_DELAY_MIN minutes after it arrives)
//   GET  /api/stream   the same events, pushed live (Server-Sent Events)
//   GET  /api/market   delayed market snapshot from ES-Collector's Supabase bars
//   GET  /api/stats    fixed research facts (content/research_stats.json)
//   GET  /api/support  donation details from settings
//   GET  /rss.xml      public events as an RSS feed
//   GET  /admin        private: marketing drafts, posting to X, visitor counts (needs ADMIN_TOKEN)
import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEvent } from './server/events.ts';
import { narrate } from './server/narrate.ts';
import { eventExists, insertEvent, latestPublic, storageKind, type FeedRow } from './server/store.ts';
import { getSnapshot, marketConfigured } from './server/market.ts';
import { siteUrl, supportInfo } from './server/site.ts';
import { keyCanWrite, keyKind, sbGet } from './server/supabase.ts';
import { countVisit } from './server/visits.ts';
import { mountAdmin } from './server/admin.ts';
import { startAgent } from './server/marketing.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// In development, AI Studio dev server runs behind an internal proxy on port 3000.
// In production deployment (Cloud Run), the server must listen on process.env.PORT (defaults to 8080).
const port = process.env.NODE_ENV === 'production'
  ? (Number(process.env.PORT) || 8080)
  : 3000;
const delayMin = () => Number(process.env.PUBLIC_DELAY_MIN ?? 10) || 10;

app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(countVisit);

// ---------- small per-IP rate limiter ----------
function rateLimit(perMinute: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, res: Response, next: () => void) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now > h.reset) hits.set(key, { n: 1, reset: now + 60_000 });
    else if (++h.n > perMinute) return void res.status(429).json({ error: 'too many requests' });
    if (hits.size > 10_000) hits.clear();
    next();
  };
}

// ---------- signed events from the bot ----------
function verifySignature(req: Request, body: Buffer): string | null {
  const secret = process.env.FEED_SECRET?.trim();
  if (!secret || secret.length < 32) return 'feed not configured';
  const ts = String(req.header('X-Feed-Timestamp') ?? '');
  const sig = String(req.header('X-Feed-Signature') ?? '');
  if (!/^\d{9,11}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) return 'missing signature';
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return 'stale signature';
  const expected = crypto.createHmac('sha256', secret).update(`${ts}.`).update(body).digest();
  const given = Buffer.from(sig, 'hex');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return 'bad signature';
  return null;
}

app.post(
  '/api/events',
  rateLimit(120),
  express.raw({ type: 'application/json', limit: '8kb' }),
  async (req: Request, res: Response) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const sigError = verifySignature(req, body);
    if (sigError) return void res.status(sigError === 'feed not configured' ? 503 : 401).json({ error: sigError });

    let parsed: unknown;
    try {
      parsed = JSON.parse(body.toString('utf8'));
    } catch {
      return void res.status(400).json({ error: 'invalid json' });
    }
    const v = validateEvent(parsed);
    if (!v.ok) return void res.status(422).json({ error: v.error });

    try {
      if (await eventExists(v.event.event_id)) return void res.status(200).json({ status: 'duplicate' });
      const { text, source } = await narrate(v.event);
      const inserted = await insertEvent({
        event_id: v.event.event_id,
        type: v.event.type,
        occurred_at: v.event.occurred_at,
        public_at: new Date(Date.now() + delayMin() * 60_000).toISOString(),
        payload: v.event,
        narration: text,
        narration_source: source,
      });
      res.status(inserted ? 201 : 200).json({ status: inserted ? 'stored' : 'duplicate' });
    } catch (err) {
      console.error('event store failed:', (err as Error).message);
      res.status(500).json({ error: 'store failed' });
    }
  },
);

// ---------- public read API ----------
const publicRow = (r: FeedRow) => ({
  id: r.id,
  type: r.type,
  occurred_at: r.occurred_at,
  public_at: r.public_at,
  account_type: r.payload.account_type,
  data: r.payload,
  narration: r.narration,
  narration_source: r.narration_source,
});

app.get('/api/health', rateLimit(20), async (req, res) => {
  const out: Record<string, unknown> = {
    ok: true,
    version: 5,
    storage: storageKind(),
    market: marketConfigured(),
    narration: process.env.NARRATE_WITH_LLM === '1' && process.env.GEMINI_API_KEY ? 'llm' : 'template',
    delay_minutes: delayMin(),
    site_url: siteUrl() || null,
  };
  // ?deep=1 also checks that each Supabase table can be read (reports errors, never addresses or keys)
  if (req.query.deep === '1' && marketConfigured()) {
    const tables: Record<string, string> = {};
    for (const t of ['feed_events', 'market_bars_1m', 'rth_daily', 'marketing_posts', 'page_visits']) {
      try {
        await sbGet(`${t}?select=*&limit=1`);
        tables[t] = 'ok';
      } catch (err) {
        tables[t] = (err as Error).message.replace(/https?:\/\/\S+/g, '').slice(0, 160);
      }
    }
    out.tables = tables;
    out.supabase_key = keyKind();
    if (!keyCanWrite()) {
      out.ok = false;
      out.problem = 'SUPABASE_SERVICE_KEY is not the service_role/secret key: bot events, X drafts and visit counts cannot be saved.';
    }
    try {
      const snap = await getSnapshot();
      out.market_data = snap ? { last_bar: snap.as_of, stale: snap.stale, symbol: snap.symbol } : 'no bars';
    } catch (err) {
      out.market_data = (err as Error).message.replace(/https?:\/\/\S+/g, '').slice(0, 160);
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json(out);
});

app.get('/api/feed', rateLimit(60), async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const before = req.query.before !== undefined ? Number(req.query.before) : undefined;
    const rows = await latestPublic(limit, Number.isInteger(before) ? before : undefined);
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.json({ delay_minutes: delayMin(), events: rows.map(publicRow) });
  } catch (err) {
    console.error('feed read failed:', (err as Error).message);
    res.status(502).json({ error: 'feed unavailable' });
  }
});

// Live stream: one database poll every 15 s is shared by all connected browsers.
const clients = new Set<Response>();
const seen = new Set<string>();
let primed = false;

async function pollFeed() {
  try {
    const rows = (await latestPublic(50)).reverse();
    for (const r of rows) {
      if (seen.has(r.event_id)) continue;
      seen.add(r.event_id);
      if (primed) {
        const msg = `event: feed\ndata: ${JSON.stringify(publicRow(r))}\n\n`;
        for (const c of clients) c.write(msg);
      }
    }
    primed = true;
    if (seen.size > 5000) {
      const keep = [...seen].slice(-1000);
      seen.clear();
      keep.forEach((id) => seen.add(id));
    }
  } catch (err) {
    console.warn('feed poll failed:', (err as Error).message);
  }
}
setInterval(pollFeed, 15_000).unref();
void pollFeed();
setInterval(() => {
  for (const c of clients) c.write(': ping\n\n');
}, 25_000).unref();

app.get('/api/stream', (req, res) => {
  if (clients.size >= 2000) return void res.status(503).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 15000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/market', rateLimit(60), async (_req, res) => {
  if (!marketConfigured()) return void res.status(503).json({ error: 'market data not configured' });
  try {
    const snap = await getSnapshot();
    if (!snap) return void res.status(503).json({ error: 'no market data yet' });
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(snap);
  } catch (err) {
    console.error('market read failed:', (err as Error).message);
    res.status(502).json({ error: 'market data unavailable' });
  }
});

const statsPath = path.resolve(__dirname, 'content', 'research_stats.json');
app.get('/api/stats', (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.type('application/json').send(fs.readFileSync(statsPath, 'utf8'));
  } catch {
    res.status(404).json({ error: 'no stats' });
  }
});

app.get('/api/support', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.json(supportInfo());
});

mountAdmin(app);
app.use('/api', (_req, res) => void res.status(404).json({ error: 'not found' }));

// ---------- RSS and robots ----------
const xmlEsc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
const FEED_TITLES: Record<string, string> = {
  overnight: 'Overnight rule', signal: 'Signal', trade_open: 'Position opened', trade_close: 'Position closed', bot_status: 'System',
};
app.get('/rss.xml', rateLimit(30), async (_req, res) => {
  try {
    const base = siteUrl();
    const rows = await latestPublic(30);
    const items = rows.map((r) => `<item><title>${xmlEsc(`${FEED_TITLES[r.type] ?? r.type}: ${r.narration.slice(0, 80)}`)}</title>` +
      `<description>${xmlEsc(r.narration)}</description>` +
      (base ? `<link>${xmlEsc(`${base}/?ref=rss`)}</link>` : '') +
      `<guid isPermaLink="false">${r.event_id}</guid><pubDate>${new Date(r.public_at).toUTCString()}</pubDate></item>`).join('');
    res.type('application/rss+xml').setHeader('Cache-Control', 'public, max-age=300');
    res.send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>S&amp;P Futures Bot Log</title>` +
      `<link>${xmlEsc(base || 'https://example.invalid')}</link><description>What one automated S&amp;P 500 futures system did, in plain English. Delayed. Not advice.</description>` +
      `${items}</channel></rss>`);
  } catch {
    res.status(502).send('feed unavailable');
  }
});
app.get('/robots.txt', (_req, res) => {
  const base = siteUrl();
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
});
app.get('/sitemap.xml', (_req, res) => {
  const base = siteUrl();
  if (!base) return void res.status(404).end();
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xmlEsc(base)}/</loc><changefreq>hourly</changefreq></url></urlset>`);
});

// index.html with the real site address filled in, so link previews on X show the card image.
function renderIndex(html: string): string {
  const base = siteUrl();
  return html.replaceAll('%SITE_URL%', base);
}


// ---------- the page itself ----------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distHtmlPath = path.resolve(__dirname, 'dist', 'index.html');
    app.use(express.static(path.resolve(__dirname, 'dist'), { index: false }));
    app.get('*', (_req, res) => {
      try {
        if (fs.existsSync(distHtmlPath)) {
          const indexHtml = renderIndex(fs.readFileSync(distHtmlPath, 'utf8'));
          res.type('html').send(indexHtml);
        } else {
          res.sendFile(path.resolve(__dirname, 'index.html'));
        }
      } catch {
        res.sendFile(path.resolve(__dirname, 'index.html'));
      }
    });
  }
  startAgent();
  if (marketConfigured() && !keyCanWrite())
    console.warn(`SUPABASE_SERVICE_KEY looks like a ${keyKind()} key: writes will be refused. Use the service_role or secret key.`);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port} (storage: ${storageKind()}, market: ${marketConfigured() ? 'on' : 'off'})`);
  });
}

startServer();
