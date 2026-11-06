// Posts to X (Twitter) with the API v2 "create post" endpoint, signed with OAuth 1.0a user keys.
// Needs X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (from the X developer portal,
// app permissions "Read and write"). No extra package: the signature is built with node:crypto.
import crypto from 'crypto';

const env = (k: string) => process.env[k]?.trim() || '';

export function xConfigured(): boolean {
  return ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_SECRET'].every((k) => env(k));
}

const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

export function oauthHeader(method: string, url: string, keys: {
  consumerKey: string; consumerSecret: string; token: string; tokenSecret: string;
}, nonce = crypto.randomBytes(16).toString('hex'), timestamp = String(Math.floor(Date.now() / 1000))): string {
  const params: Record<string, string> = {
    oauth_consumer_key: keys.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: keys.token,
    oauth_version: '1.0',
  };
  // A JSON body is not part of the signature; only oauth (and query) parameters are.
  const u = new URL(url);
  const all: [string, string][] = [...Object.entries(params), ...u.searchParams.entries()];
  const paramString = all
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a, b], [c, d]) => (a === c ? (b < d ? -1 : 1) : a < c ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = `${method.toUpperCase()}&${enc(u.origin + u.pathname)}&${enc(paramString)}`;
  const signingKey = `${enc(keys.consumerSecret)}&${enc(keys.tokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.entries(params).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
}

export async function postToX(text: string): Promise<{ id: string }> {
  if (!xConfigured()) throw new Error('X keys not set');
  const url = `${env('X_API_BASE') || 'https://api.twitter.com'}/2/tweets`;
  const auth = oauthHeader('POST', url, {
    consumerKey: env('X_API_KEY'),
    consumerSecret: env('X_API_SECRET'),
    token: env('X_ACCESS_TOKEN'),
    tokenSecret: env('X_ACCESS_SECRET'),
  });
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`X ${r.status}: ${body.slice(0, 300)}`);
  const id = (JSON.parse(body) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error('X returned no post id');
  return { id };
}
