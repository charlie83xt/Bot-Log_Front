// Public site settings: content/site.json, with environment variables taking priority.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content', 'site.json');

interface SiteFile {
  site_url?: string;
  paypal_me?: string;
  donation_currency?: string;
  donation_amounts?: number[];
  x_handle?: string;
}

function readFile(): SiteFile {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as SiteFile;
  } catch {
    return {};
  }
}

const env = (k: string) => process.env[k]?.trim() || '';

/**
 * Accepts any of: "name", "@name", "paypal.me/name", "www.paypal.me/name", "https://paypal.me/name/5",
 * "paypalme/name", "https://www.paypal.com/paypalme/name". Returns the bare handle or null.
 */
export function paypalHandle(raw: string): string | null {
  let s = raw.trim().replace(/^@/, '');
  s = s.replace(/^(https?:\/\/)?(www\.)?(paypal\.me\/|paypal\.com\/paypalme\/|paypalme\/)/i, '');
  s = s.split(/[/?#]/)[0];
  return /^[A-Za-z0-9]{1,20}$/.test(s) ? s : null;
}

export function siteUrl(): string {
  const u = env('SITE_URL') || readFile().site_url || env('APP_URL');
  return /^https:\/\/[^\s"'<>]+$/.test(u ?? '') ? u!.replace(/\/+$/, '') : '';
}

export function supportInfo() {
  const f = readFile();
  const handle = paypalHandle(env('SUPPORT_PAYPAL_ME') || f.paypal_me || '');
  const currency = (env('SUPPORT_CURRENCY') || f.donation_currency || 'GBP').toUpperCase();
  const amounts = (f.donation_amounts ?? [])
    .filter((a) => Number.isInteger(a) && a > 0 && a <= 500)
    .slice(0, 4);
  const wallets: { coin: string; address: string }[] = [];
  const check: [string, string, RegExp][] = [
    ['BTC', 'SUPPORT_BTC', /^(bc1[a-z0-9]{20,90}|[13][A-HJ-NP-Za-km-z1-9]{25,34})$/],
    ['ETH', 'SUPPORT_ETH', /^0x[0-9a-fA-F]{40}$/],
    ['SOL', 'SUPPORT_SOL', /^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
  ];
  for (const [coin, key, re] of check) {
    const a = env(key);
    if (a && re.test(a)) wallets.push({ coin, address: a });
  }
  const base = handle ? `https://paypal.me/${handle}` : null;
  const x = (env('X_HANDLE') || f.x_handle || '').replace(/^@/, '');
  return {
    x_handle: /^[A-Za-z0-9_]{1,15}$/.test(x) ? x : null,
    paypal: base,
    paypal_handle: handle,
    paypal_amounts: base && /^[A-Z]{3}$/.test(currency)
      ? amounts.map((a) => ({ label: `${currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' '}${a}`, url: `${base}/${a}${currency}` }))
      : [],
    crypto: wallets,
  };
}
