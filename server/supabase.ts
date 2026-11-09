// Minimal Supabase (PostgREST) client using fetch, so no extra package is needed.
// The service key stays on the server; it is never sent to the browser.

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim());
}

/**
 * Which kind of key SUPABASE_SERVICE_KEY holds. Only 'service_role' (legacy JWT) and 'secret' (sb_secret_...)
 * can write; 'anon' / 'publishable' keys can read some tables but every insert is refused by row-level security.
 */
export function keyKind(): 'service_role' | 'secret' | 'anon' | 'publishable' | 'unknown' {
  const key = process.env.SUPABASE_SERVICE_KEY?.trim() || '';
  if (key.startsWith('sb_secret_')) return 'secret';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const role = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role;
      if (role === 'service_role' || role === 'anon') return role;
    } catch {
      /* not a JWT */
    }
  }
  return 'unknown';
}

export const keyCanWrite = () => ['service_role', 'secret'].includes(keyKind());

async function failure(method: string, r: Response): Promise<Error> {
  const body = (await r.text()).slice(0, 200);
  if (body.includes('42501') || body.includes('row-level security')) {
    return new Error(`Supabase refused the write (row-level security). SUPABASE_SERVICE_KEY is a${keyKind() === 'anon' ? 'n anon' : ' ' + keyKind()} key; ` +
      'it must be the service_role key (Project Settings -> API keys -> Legacy: service_role) or a secret key (sb_secret_...).');
  }
  return new Error(`supabase ${method} ${r.status}: ${body}`);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_KEY!.trim();
  // New-style keys (sb_secret_/sb_publishable_) go in the apikey header only; legacy JWT keys also as Bearer.
  return key.startsWith('sb_') ? { apikey: key, ...extra } : { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

/** Project address only, e.g. https://abcd.supabase.co - any path pasted after it (/rest/v1, /) is ignored. */
export function supabaseBase(): string {
  const raw = process.env.SUPABASE_URL!.trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  }
}

function url(pathAndQuery: string): string {
  return `${supabaseBase()}/rest/v1/${pathAndQuery}`;
}

export async function sbGet<T>(pathAndQuery: string, timeoutMs = 15000): Promise<T[]> {
  const r = await fetch(url(pathAndQuery), { headers: headers(), signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`supabase GET ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T[];
}

/** Reads every row of a query in pages of 1000 (Supabase's default row cap), up to maxRows. */
export async function sbGetAll<T>(pathAndQuery: string, maxRows = 5000): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < maxRows; offset += 1000) {
    const page = await sbGet<T>(`${pathAndQuery}&limit=1000&offset=${offset}`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/** Inserts one row; returns false when a row with the same unique key already exists. */
export async function sbInsertIgnore(table: string, row: object, conflictColumn: string): Promise<boolean> {
  const r = await fetch(url(`${table}?on_conflict=${conflictColumn}`), {
    method: 'POST',
    headers: headers({
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    }),
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw await failure('POST', r);
  const rows = (await r.json()) as unknown[];
  return rows.length > 0;
}

/** Inserts rows; returns the inserted rows. */
export async function sbInsert<T>(table: string, rows: object | object[]): Promise<T[]> {
  const r = await fetch(url(table), {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw await failure('POST', r);
  return (await r.json()) as T[];
}

/** Updates rows matching the filter (e.g. "id=eq.5"); returns the updated rows. */
export async function sbPatch<T>(table: string, filter: string, patch: object): Promise<T[]> {
  const r = await fetch(url(`${table}?${filter}`), {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw await failure('PATCH', r);
  return (await r.json()) as T[];
}
