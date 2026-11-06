# Marketing plan

The pitch: **an automated trading system that shows every decision in public, losses included.**
Most trading accounts on X show only winners. This one shows the research that failed (six setups that lost
money after costs), the one rule that held up, and every night's result. Honesty is the hook. Keep it that way.

## Rules to protect the page and you
- Never say what anyone should buy or sell, never predict prices, and never promise returns. The agent blocks
  these phrases, but read every post before it goes out.
- Never sell signals, copy-trading, a course or "access". Under the UK's FCA rules, that kind of offer is a
  financial promotion. Donations that buy nothing are fine.
- Label the X account as automated: X Settings → Your account → Account information → Automation, then link
  it to your own account.
- Don't send automated replies, @mentions, follows or DMs to strangers. That breaks X's automation rules and
  gets accounts suspended. Replies should be written by you, by hand.
- PayPal.Me works on a personal account. If donations grow, PayPal may ask you to upgrade to a business
  account, which is free.
- Email: only to people who sign up themselves (PECR/GDPR). There is no email list yet.

## What the agent does (switch on with `MARKETING_ENABLED=1`)
| When (New York time) | Draft | Built from |
|---|---|---|
| Weekdays after 09:50 | Overnight result: "closed at the open, up/down N points" | the bot's `exit` event |
| Weekdays after 16:20 | Session recap: close, change, range and VWAP, plus tonight's overnight decision | the delayed market data and the bot's 15:55 event |
| Sundays after 11:00 | One research fact (a different one each week) | `content/research_stats.json` |

- **Approving:** every draft waits on `/admin` until you edit, post or reject it. Turn on `MARKETING_AUTOPOST=1`
  only after a couple of weeks of drafts you didn't need to change.
- **Limits:** at most 4 posts a day.
- **AI wording:** with `NARRATE_WITH_LLM=1`, Gemini also offers an alternative wording. It is only kept if it
  keeps every number and the link, and passes the same checks.
- **Links:** every link carries `?ref=x`, so `/admin → Visitors` shows how many people each channel brought in.
  No cookies are used.

## Weeks 1-2: launch
1. Set up the X profile:
   - name and bio, for example: "One automated S&P 500 futures system, every decision logged in plain English.
     Losses included. Information only, not advice.";
   - the page link;
   - the image from `public/og.png` as the banner.
2. Pin a thread about the story, written by you:
   - you're a data scientist, not a trader;
   - two years of 1-minute data;
   - six setups that looked good and lost money after costs;
   - the overnight effect that has held since 1993;
   - now testing it in public.

   Real numbers from the stats panel make this thread work.
3. Post every day from the drafts. Consistency matters more than volume on X.
4. Share it where builders gather, following each community's self-promotion rules:
   - Reddit: r/algotrading (they like honest failures with data) and r/datascience (frame it as a project);
   - Hacker News: "Show HN: I logged every decision of my S&P futures bot, losses included";
   - Use `?ref=reddit` and `?ref=hn` in those links.

## Weeks 3-8: build the habit
- **Weekly scorecard (Sunday):** the overnight rule's running total in points, the number of nights, and the
  share up. Post it even when it's down; that is the brand. This can be added to the agent once there are a few
  weeks of results.
- **Charts beat text on X:** a later step can attach a picture of the day's chart to the recap. X's media upload
  API is separate, so that is a follow-up.
- **Replies:** by hand, to big market accounts on days the market moves a lot, adding one real fact from the
  page ("overnight vs day session since 1993: ...").
- **RSS** at `/rss.xml`. It lets people follow without X, and you can pipe it into a Telegram or Discord channel
  with a free RSS bot.

## Later, once there are visitors
- An opt-in email "weekly log" (double opt-in, with an unsubscribe link).
- A page per day (`/day/2026-11-06`) so each day's recap has its own link and shows up in Google.
- Write-ups on Medium, Substack or a personal blog about the research method: design year vs validation year,
  the deflated Sharpe ratio, and costs. This is the most shareable content you have.
- A small embeddable widget for other sites.

## How to tell what works
Check `/admin → Visitors` weekly:
- which `ref` sources bring people in;
- whether visits rise on days you post;
- which kinds of post get clicks.

Drop what doesn't work after three weeks.
