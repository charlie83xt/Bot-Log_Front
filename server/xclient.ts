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
  if (!r.ok) {
    const level = r.headers.get('x-access-level');
    const hint = r.status === 403 && level === 'read'
      ? ' (this access token is read-only: regenerate the Access Token and Secret now that the app has Read and write)'
      : '';
    throw new Error(`X ${r.status}: ${body.slice(0, 300)}${hint}`);
  }
  const id = (JSON.parse(body) as { data?: { id?: string } }).data?.id;
  if (!id) throw new Error('X returned no post id');
  return { id };
}

/** Non-secret hints so you can tell which keys the running server has (last 4 characters, and the
 *  X user id that starts every access token). */
export function xKeyHints() {
  const key = env('X_API_KEY');
  const token = env('X_ACCESS_TOKEN');
  return {
    api_key_ends_with: key ? key.slice(-4) : null,
    access_token_user_id: /^\d+-/.test(token) ? token.split('-')[0] : null,
  };
}

/** Read-only check: asks X which account these keys post as. Nothing is posted. */
export async function checkX(): Promise<
  { ok: true; username: string; id: string; access_level: string | null } | { ok: false; error: string }
> {
  if (!xConfigured()) return { ok: false, error: 'X keys not set' };
  const url = `${env('X_API_BASE') || 'https://api.twitter.com'}/2/users/me`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: oauthHeader('GET', url, {
          consumerKey: env('X_API_KEY'),
          consumerSecret: env('X_API_SECRET'),
          token: env('X_ACCESS_TOKEN'),
          tokenSecret: env('X_ACCESS_SECRET'),
        }),
      },
      signal: AbortSignal.timeout(15000),
    });
    const body = await r.text();
    if (!r.ok) return { ok: false, error: `X ${r.status}: ${body.slice(0, 400)}` };
    const d = (JSON.parse(body) as { data?: { id?: string; username?: string } }).data;
    // X reports the access token's permission: "read", "read-write" or "read-write-directmessages".
    return { ok: true, username: d?.username ?? '?', id: d?.id ?? '?', access_level: r.headers.get('x-access-level') };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
