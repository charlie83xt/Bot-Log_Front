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
        const body = await r.json();
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
