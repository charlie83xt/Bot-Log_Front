-- Run once in the Supabase SQL editor of the same project ES-Collector writes to.
-- Safe to re-run.

-- 1) Events from the trading bot, as shown on the public feed.
create table if not exists feed_events (
  id               bigserial primary key,
  event_id         text not null unique,          -- uuid hex sent by the bot (de-duplicates retries)
  type             text not null,
  occurred_at      timestamptz not null,
  public_at        timestamptz not null,          -- the page shows the event only after this time
  payload          jsonb not null,                -- validated fields only (no account numbers, no money)
  narration        text not null,
  narration_source text not null default 'template',
  created_at       timestamptz not null default now()
);
create index if not exists idx_feed_events_public on feed_events (public_at desc);

-- Only the dashboard server (service key) reads or writes; the browser never talks to Supabase.
alter table feed_events enable row level security;

-- 2) One row per regular session (09:30-16:00 New York time) per symbol, built from the 1-minute bars.
create or replace view rth_daily with (security_invoker = true) as
select
  symbol,
  (ts at time zone 'America/New_York')::date                as day,
  (array_agg(open  order by ts asc))[1]                      as open,
  max(high)                                                  as high,
  min(low)                                                   as low,
  (array_agg(close order by ts desc))[1]                     as close,
  sum(volume)                                                as volume,
  count(*)                                                   as bars
from market_bars_1m
where (ts at time zone 'America/New_York')::time >= time '09:30'
  and (ts at time zone 'America/New_York')::time <  time '16:00'
  and extract(isodow from (ts at time zone 'America/New_York')) < 6
group by 1, 2;
