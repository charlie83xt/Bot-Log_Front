export const pts = (v: number | null | undefined) => (typeof v === 'number' ? v.toFixed(2) : '-');

export const signed = (v: number | null | undefined, suffix = '') =>
  typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(2)}${suffix}` : '-';

const etFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const etTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });

export const etDateTime = (iso: string) => `${etFmt.format(new Date(iso))} ET`;
export const etClock = (iso: string) => etTime.format(new Date(iso));

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
