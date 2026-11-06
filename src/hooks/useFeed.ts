import { useEffect, useState } from 'react';
import type { FeedItem } from '../types/feed';
import { readJson } from './useJson';

/** Loads the public feed, then keeps it current through the server's live stream. */
export function useFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [delay, setDelay] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const merge = (incoming: FeedItem[]) =>
      setItems((prev) => {
        const byId = new Map(prev.map((x) => [x.id, x]));
        for (const x of incoming) byId.set(x.id, x);
        return [...byId.values()].sort((a, b) => b.id - a.id).slice(0, 200);
      });

    fetch('/api/feed?limit=50')
      .then(async (r) => {
        const body = await readJson(r);
        if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
        if (!alive) return;
        setDelay(body.delay_minutes);
        merge(body.events);
      })
      .catch((e) => alive && setError((e as Error).message));

    const es = new EventSource('/api/stream');
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener('feed', (ev) => {
      try {
        merge([JSON.parse((ev as MessageEvent).data) as FeedItem]);
      } catch {
        /* ignore malformed message */
      }
    });
    return () => {
      alive = false;
      es.close();
    };
  }, []);

  return { items, delay, live, error };
}
