// Marketing agent: writes X posts from real data only (the delayed market snapshot, public feed events and
// the research facts), keeps them as drafts, and posts a draft to X when you approve it on /admin.
// With MARKETING_AUTOPOST=1 it posts its own drafts without waiting (off by default).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { sbGet, sbInsert, sbPatch, supabaseConfigured } from './supabase.ts';
import { etParts, getSnapshot, type MarketSnapshot } from './market.ts';
import { latestPublic, type FeedRow } from './store.ts';
import { numbersIn, publicTextProblems } from './narrate.ts';
import { postToX, xConfigured } from './xclient.ts';
import { siteUrl } from './site.ts';
import { getScorecard, type Scorecard } from './scorecard.ts';

export interface Post {
  id: number;
  key: string;
  kind: 'recap' | 'overnight' | 'fact' | 'scorecard' | 'manual';
  text: string;
  alt_text: string | null;
  status: 'draft' | 'posted' | 'rejected' | 'failed';
  channel: string;
  post_id: string | null;
  error: string | null;
  created_at: string;
  posted_at: string | null;
}

const MAX_POSTS_PER_DAY = 4;
const env = (k: string) => process.env[k]?.trim() || '';
const statsFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'research_stats.json');
const siteFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'site.json');

// ---------- storage (Supabase table marketing_posts, or memory for local tests) ----------
const memory: Post[] = [];
let memId = 0;

export async function listPosts(limit = 50): Promise<Post[]> {
  if (!supabaseConfigured()) return [...memory].sort((a, b) => b.id - a.id).slice(0, limit);
  return sbGet<Post>(`marketing_posts?select=*&order=id.desc&limit=${limit}`);
}

async function getPost(id: number): Promise<Post | null> {
  if (!supabaseConfigured()) return memory.find((p) => p.id === id) ?? null;
  return (await sbGet<Post>(`marketing_posts?select=*&id=eq.${id}&limit=1`))[0] ?? null;
}

async function keyExists(key: string): Promise<boolean> {
  if (!supabaseConfigured()) return memory.some((p) => p.key === key);
  return (await sbGet<{ id: number }>(`marketing_posts?select=id&key=eq.${encodeURIComponent(key)}&limit=1`)).length > 0;
}

async function addPost(p: Pick<Post, 'key' | 'kind' | 'text' | 'alt_text'>): Promise<Post> {
  const row = { ...p, status: 'draft' as const, channel: 'x' };
  if (!supabaseConfigured()) {
    const full: Post = { id: ++memId, post_id: null, error: null, created_at: new Date().toISOString(), posted_at: null, ...row };
    memory.push(full);
    return full;
  }
  return (await sbInsert<Post>('marketing_posts', row))[0];
}

async function updatePost(id: number, patch: Partial<Post>): Promise<Post | null> {
  if (!supabaseConfigured()) {
    const p = memory.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
    return p ?? null;
  }
  return (await sbPatch<Post>('marketing_posts', `id=eq.${id}`, patch))[0] ?? null;
}

// ---------- text helpers ----------
// X's own counting (twitter-text v3): links count 23; most Latin, Greek, Cyrillic, Hebrew, Arabic letters and
// common punctuation count 1; everything else - emoji, arrows such as "→", CJK - counts 2. Limit is 280.
const LIGHT: [number, number][] = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function xLength(text: string): number {
  let n = 0;
  for (const { segment } of segmenter.segment(text.normalize('NFC').replace(/https?:\/\/\S+/g, '\u0001'))) {
    if (segment === '\u0001') { n += 23; continue; }
    if (/\p{Extended_Pictographic}/u.test(segment)) { n += 2; continue; } // a whole emoji, even multi-part
    for (const ch of segment) {
      const cp = ch.codePointAt(0)!;
      n += LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
    }
  }
  return n;
}

export function checkPost(text: string): string[] {
  const problems = publicTextProblems(text);
  if (!text.trim()) problems.push('empty');
  if (xLength(text) > 280) problems.push(`too long for X (${xLength(text)}/280)`);
  return problems;
}

function link(): string {
  const u = siteUrl();
  return u ? `${u}/?ref=x` : '';
}

function tags(): string {
  try {
    const t = (JSON.parse(fs.readFileSync(siteFile, 'utf8')) as { x_tags?: string }).x_tags ?? '';
    return /^[#$A-Za-z0-9_ ]{0,60}$/.test(t) ? t.trim() : '';
  } catch {
    return '';
  }
}

/** Builds "head / optional lines / last line + tags", dropping tags first, then optional lines, until it fits. */
function fit(head: string, optional: string[], last: string): string {
  const t = tags();
  const opts = optional.filter(Boolean);
  const build = (o: string[], withTags: boolean) =>
    [head, ...o, [last, withTags ? t : ''].filter(Boolean).join(' ')].filter(Boolean).join('\n\n');
  if (t && xLength(build(opts, true)) <= 280) return build(opts, true);
  while (opts.length && xLength(build(opts, false)) > 280) opts.pop();
  return build(opts, false);
}

const sgn = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const accountWord = (e: FeedRow) => (e.payload.account_type === 'live' ? 'live account' : 'simulation account');

// ---------- the three kinds of post ----------
export function recapText(m: MarketSnapshot, overnight: FeedRow | null): string | null {
  const s = m.session;
  if (s.status !== 'closed' || s.close == null || !m.previous) return null;
  const chg = s.close - m.previous.close;
  const pct = (chg / m.previous.close) * 100;
  const head =
    `S&P 500 futures (${m.symbol}), ${dayLabel(s.day)}: closed at ${s.close.toFixed(2)}, ${sgn(chg)} (${sgn(pct)}%). ` +
    `Range ${s.low.toFixed(2)} to ${s.high.toFixed(2)}` + (s.vwap != null ? `, VWAP ${s.vwap.toFixed(2)}.` : '.');
  let rule = '';
  if (overnight) {
    const d = overnight.payload.decision;
    const avgDays = overnight.payload.average_days;
    if (d === 'enter')
      rule = `Overnight rule: price above its ${avgDays}-day average, so the system holds 1 contract to the open (${accountWord(overnight)}).`;
    else if (d === 'enter_dry_run')
      rule = `Overnight rule: price above its ${avgDays}-day average, so the system would hold 1 contract to the open (test mode).`;
    else if (d === 'skip' && overnight.payload.reason === 'below_average')
      rule = `Overnight rule: price below its ${avgDays}-day average, so the system stays out tonight.`;
  }
  const l = link();
  return fit(head, [rule], l ? `Full plain-English log: ${l}` : '');
}

export function overnightText(exit: FeedRow): string | null {
  const p = exit.payload.points;
  if (typeof p !== 'number') return null;
  const result = p === 0 ? 'flat' : `${p > 0 ? 'up' : 'down'} ${Math.abs(p).toFixed(2)} points`;
  const head = `Overnight rule result: the 1 contract held from yesterday's close was closed at the 09:30 ET open, ${result} (${accountWord(exit)}).`;
  const l = link();
  return fit(head, [], l ? `Every decision, wins and losses, is logged here: ${l}` : '');
}

export function factText(week: number): string | null {
  try {
    const stats = JSON.parse(fs.readFileSync(statsFile, 'utf8')) as { items: { title: string; value: string; sample: string; period: string }[] };
    if (!stats.items?.length) return null;
    const f = stats.items[week % stats.items.length];
    const l = link();
    return fit(
      `${f.title}: ${f.value}.`,
      [`Source: ${f.sample}, ${f.period}. Measured on past data.`],
      l ? `More research and a live log of one automated system: ${l}` : '',
    );
  } catch {
    return null;
  }
}

/** Weekly results of the overnight rule, for nights completed in the last 7 days. */
export function scorecardText(card: Scorecard, sinceDay: string): string | null {
  const week = card.nights.filter((n) => n.night >= sinceDay && n.decision !== 'out' && n.points !== null);
  const out = card.nights.filter((n) => n.night >= sinceDay && n.decision === 'out').length;
  if (!week.length && !out) return null;
  const pts = week.reduce((a, n) => a + n.points!, 0);
  const head =
    `Overnight rule, live test, this week: ${week.length} night${week.length === 1 ? '' : 's'} held` +
    (out ? `, ${out} out` : '') + (week.length ? `, ${sgn(pts)} points before costs.` : '.');
  const total =
    `Since ${dayLabel(card.since!)}: ${card.completed} nights, ${sgn(card.total_after_costs)} points after costs` +
    (card.up_share != null ? `, up on ${Math.round(card.up_share * 100)}% of nights.` : '.');
  const l = link();
  return fit(head, [total, 'Wins and losses both get posted.'], l ? `Night by night: ${l}` : '');
}

// ---------- optional AI rewording, checked like the narration ----------
let ai: GoogleGenAI | null = null;
async function altWording(text: string): Promise<string | null> {
  const key = env('GEMINI_API_KEY');
  if (env('NARRATE_WITH_LLM') !== '1' || !key) return null;
  try {
    ai ??= new GoogleGenAI({ apiKey: key });
    const call = ai.models.generateContent({
      model: env('GEMINI_MODEL') || 'gemini-3.8-flash',
      contents: text,
      config: {
        systemInstruction:
          'Rewrite this post for X so a curious non-trader wants to read it. Plain, calm, no hype, no emojis except at most one. ' +
          'Keep every number and the link exactly as written and add no new numbers. No advice, no predictions, do not tell the reader to trade. ' +
          'At most 270 characters. Return only the post.',
        temperature: 0.7,
        maxOutputTokens: 160,
      },
    });
    const res = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
    const out = (res.text ?? '').trim();
    const allowed = numbersIn(text);
    const urls = text.match(/https?:\/\/\S+/g) ?? [];
    const ok =
      out && checkPost(out).length === 0 &&
      numbersIn(out.replace(/https?:\/\/\S+/g, '')).every((n) => allowed.includes(n)) &&
      urls.every((u) => out.includes(u));
    return ok ? out : null;
  } catch {
    return null;
  }
}

// ---------- posting ----------
async function postedToday(): Promise<number> {
  const today = etParts(Date.now()).day;
  const posts = await listPosts(30);
  return posts.filter((p) => p.status === 'posted' && p.posted_at && etParts(Date.parse(p.posted_at)).day === today).length;
}

/** Posting through the X API is billed per post, so it is off unless X_POST_MODE=api. */
export const apiPostingOn = () => env('X_POST_MODE') === 'api' && xConfigured();

/** You posted it yourself (free, via the "Open in X" button): record it as posted. */
export async function markPosted(id: number, text: string): Promise<Post> {
  const p = await getPost(id);
  if (!p || p.status === 'posted' || p.status === 'rejected') throw new Error('cannot mark this post');
  const problems = checkPost(text);
  if (problems.length) throw new Error(problems.join('; '));
  return (await updatePost(id, { status: 'posted', text, post_id: 'manual', posted_at: new Date().toISOString(), error: null }))!;
}

export async function publishPost(id: number, useAlt = false): Promise<Post> {
  if (!apiPostingOn()) throw new Error('API posting is off (X charges per post). Use "Open in X", or set X_POST_MODE=api.');
  const p = await getPost(id);
  if (!p) throw new Error('no such post');
  if (p.status === 'posted') throw new Error('already posted');
  if (p.status === 'rejected') throw new Error('this post was rejected');
  const text = useAlt && p.alt_text ? p.alt_text : p.text;
  const problems = checkPost(text);
  if (problems.length) throw new Error(problems.join('; '));
  if ((await postedToday()) >= MAX_POSTS_PER_DAY) throw new Error(`daily limit of ${MAX_POSTS_PER_DAY} posts reached`);
  try {
    const { id: postId } = await postToX(text);
    return (await updatePost(id, { status: 'posted', text, post_id: postId, posted_at: new Date().toISOString(), error: null }))!;
  } catch (err) {
    await updatePost(id, { status: 'failed', error: (err as Error).message.slice(0, 300) });
    throw err;
  }
}

export async function editPost(id: number, text: string): Promise<Post> {
  const problems = checkPost(text);
  if (problems.length) throw new Error(problems.join('; '));
  const p = await getPost(id);
  if (!p || p.status === 'posted' || p.status === 'rejected') throw new Error('cannot edit this post');
  return (await updatePost(id, { text, status: 'draft', error: null }))!;
}

export async function rejectPost(id: number): Promise<Post> {
  const p = await getPost(id);
  if (!p || p.status === 'posted') throw new Error('cannot reject this post');
  return (await updatePost(id, { status: 'rejected' }))!;
}

export async function addManualPost(text: string): Promise<Post> {
  const problems = checkPost(text);
  if (problems.length) throw new Error(problems.join('; '));
  return addPost({ key: `manual:${Date.now()}`, kind: 'manual', text, alt_text: null });
}

// ---------- the agent loop ----------
async function draft(key: string, kind: Post['kind'], text: string | null) {
  if (!text || (await keyExists(key))) return;
  if (checkPost(text).length) return; // never store a draft that could not be posted
  const created = await addPost({ key, kind, text, alt_text: await altWording(text) });
  console.log(`marketing: new ${kind} draft ${created.id}`);
  if (env('MARKETING_AUTOPOST') === '1' && apiPostingOn()) {
    try {
      await publishPost(created.id);
      console.log(`marketing: auto-posted ${created.id}`);
    } catch (err) {
      console.warn('marketing: auto-post failed:', (err as Error).message);
    }
  }
}

function isoWeek(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export async function runAgentOnce(nowMs = Date.now()) {
  const et = etParts(nowMs);
  const weekday = !['Sat', 'Sun'].includes(et.weekday);
  const todays = (rows: FeedRow[], pred: (r: FeedRow) => boolean) =>
    rows.find((r) => etParts(Date.parse(r.occurred_at)).day === et.day && pred(r)) ?? null;

  if (weekday && et.minutes >= 9 * 60 + 50 && et.minutes < 12 * 60) {
    const exit = todays(await latestPublic(50), (r) => r.type === 'overnight' && r.payload.decision === 'exit');
    if (exit) await draft(`overnight:${et.day}`, 'overnight', overnightText(exit));
  }
  if (weekday && et.minutes >= 16 * 60 + 20) {
    const m = await getSnapshot().catch(() => null);
    if (m && m.session.day === et.day) {
      const on = todays(await latestPublic(50), (r) => r.type === 'overnight' && ['enter', 'enter_dry_run', 'skip'].includes(String(r.payload.decision)));
      await draft(`recap:${et.day}`, 'recap', recapText(m, on));
    }
  }
  if (et.weekday === 'Sat' && et.minutes >= 11 * 60) {
    const card = await getScorecard().catch(() => null);
    const monday = new Date(Date.parse(`${et.day}T12:00:00Z`) - 5 * 86400_000).toISOString().slice(0, 10);
    if (card?.since) await draft(`scorecard:${et.day}`, 'scorecard', scorecardText(card, monday));
  }
  if (et.weekday === 'Sun' && et.minutes >= 11 * 60) {
    const w = isoWeek(nowMs);
    await draft(`fact:${et.day.slice(0, 4)}-w${w}`, 'fact', factText(w));
  }
}

export function startAgent() {
  if (env('MARKETING_ENABLED') !== '1') return;
  const tick = () => runAgentOnce().catch((err) => console.warn('marketing agent:', (err as Error).message));
  setInterval(tick, 5 * 60_000).unref();
  setTimeout(tick, 20_000).unref();
  console.log(`marketing agent on (posting: ${apiPostingOn() ? 'X API' : 'manual, free'}, autopost ${env('MARKETING_AUTOPOST') === '1' && apiPostingOn() ? 'on' : 'off'})`);
}
