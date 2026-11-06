import { useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import type { SupportInfo } from '../types/feed';

export function SupportModal({ info, onClose }: { info: SupportInfo; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (coin: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(coin);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard not available - the address is selectable */
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Support this project</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800" aria-label="Close"><X size={16} /></button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          This page is free and has no ads. Donations help pay for the data and hosting. They buy nothing: no signals, no advice, no access.
        </p>
        {info.paypal && (
          <a href={info.paypal} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
            Donate with PayPal <ExternalLink size={14} />
          </a>
        )}
        {info.crypto.length > 0 && (
          <ul className="mt-4 space-y-2">
            {info.crypto.map((w) => (
              <li key={w.coin} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{w.coin}</span>
                  <button onClick={() => copy(w.coin, w.address)} className="flex items-center gap-1 text-slate-300 hover:text-white">
                    {copied === w.coin ? <><Check size={12} /> copied</> : <><Copy size={12} /> copy</>}
                  </button>
                </div>
                <code className="mt-1 block break-all text-[11px] text-slate-200 select-all">{w.address}</code>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
