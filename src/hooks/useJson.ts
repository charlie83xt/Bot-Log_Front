import { useEffect, useState } from 'react';

/** Fetches JSON from the server, optionally refreshing every `refreshMs`. */
export function useJson<T>(url: string, refreshMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(url);
        const body = await readJson(r);
        if (!alive) return;
        if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
        setData(body as T);
        setError(null);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    };
    void load();
    const timer = refreshMs ? setInterval(load, refreshMs) : undefined;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [url, refreshMs]);

  return { data, error };
}

/** Reads a JSON reply; gives a clear message when the server sent a web page or an error instead. */
export async function readJson(r: Response): Promise<any> {
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(r.ok ? 'the server sent a page instead of data' : `server error ${r.status}`);
  }
}
