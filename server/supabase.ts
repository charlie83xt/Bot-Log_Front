// Minimal Supabase (PostgREST) client using fetch, so no extra package is needed.
// The service key stays on the server; it is never sent to the browser.

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_KEY?.trim());
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_KEY!.trim();
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function url(pathAndQuery: string): string {
  return `${process.env.SUPABASE_URL!.trim().replace(/\/+$/, '')}/rest/v1/${pathAndQuery}`;
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
  if (!r.ok) throw new Error(`supabase POST ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
  if (!r.ok) throw new Error(`supabase POST ${r.status}: ${(await r.text()).slice(0, 200)}`);
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
  if (!r.ok) throw new Error(`supabase PATCH ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as T[];
}
