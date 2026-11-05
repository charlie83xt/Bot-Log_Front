import React, { useState, useEffect } from 'react';
import {
  Heart,
  Copy,
  Check,
  ExternalLink,
  Coins,
  DollarSign,
  Settings,
  Shield,
  Server,
  Zap,
  X,
  CreditCard,
} from 'lucide-react';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WalletConfig {
  paypalUsername: string;
  btcAddress: string;
  ethAddress: string;
  solAddress: string;
}

const DEFAULT_CONFIG: WalletConfig = {
  paypalUsername: 'quantfutures',
  btcAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ethAddress: '0x71C568ba74D3764857f02933ef0e4B28168B5d06',
  solAddress: '8FpLq2xZ9N4aB9wV5p1tC3eY7uK2mR4vX8wQ1sT3nP6',
};

export const DonationModal: React.FC<DonationModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'paypal' | 'crypto' | 'settings'>('paypal');
  const [selectedTier, setSelectedTier] = useState<number>(15);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Configuration state with localStorage persistence
  const [config, setConfig] = useState<WalletConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aequitas_donation_config');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CONFIG;
  });

  const [formConfig, setFormConfig] = useState<WalletConfig>(config);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    setFormConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setConfig(formConfig);
    try {
      localStorage.setItem('aequitas_donation_config', JSON.stringify(formConfig));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const donationAmount = customAmount ? parseFloat(customAmount) || selectedTier : selectedTier;
  const paypalUrl = `https://paypal.me/${config.paypalUsername}/${donationAmount}`;

  const tiers = [
    { amount: 5, label: '$5', desc: 'Coffee / Compute Hour' },
    { amount: 15, label: '$15', desc: '1-Day Server Runtime' },
    { amount: 35, label: '$35', desc: 'CME Data Feed Backer' },
    { amount: 75, label: '$75', desc: 'Quant Infra Sponsor' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xl w-full p-6 text-slate-200 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Heart className="w-4 h-4 fill-rose-500/30" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight font-sans">
                Support Cloud Hosting & Infrastructure
              </h2>
              <span className="text-xs text-slate-400">
                Help cover 24/7 server uptime, CME futures feeds, and quantitative AI compute
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('paypal')}
            className={`flex-1 py-1.5 px-3 rounded font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'paypal'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>PayPal & Cards</span>
          </button>
          <button
            onClick={() => setActiveTab('crypto')}
            className={`flex-1 py-1.5 px-3 rounded font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'crypto'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Crypto (BTC / ETH / SOL)</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-1.5 px-3 rounded font-medium transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Configure your own wallet addresses"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Edit Wallets</span>
          </button>
        </div>

        {/* PAYPAL TAB */}
        {activeTab === 'paypal' && (
          <div className="flex flex-col gap-4">
            <p className="text-slate-300 leading-relaxed font-sans">
              Choose a contribution tier or enter a custom amount to sponsor continuous cloud compute and real-time futures data streams:
            </p>

            {/* Tier Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              {tiers.map((t) => (
                <button
                  key={t.amount}
                  onClick={() => {
                    setSelectedTier(t.amount);
                    setCustomAmount('');
                  }}
                  className={`p-3 rounded border text-left transition-all ${
                    selectedTier === t.amount && !customAmount
                      ? 'bg-amber-500/20 border-amber-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base font-bold text-amber-400 block">{t.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">{t.desc}</span>
                </button>
              ))}
            </div>

            {/* Custom Amount Field */}
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded border border-slate-800">
              <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="number"
                min="1"
                placeholder="Custom USD amount..."
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="bg-transparent flex-1 text-white font-mono placeholder:text-slate-600 focus:outline-none"
              />
              <span className="text-slate-500 text-[11px] font-mono">USD</span>
            </div>

            {/* PayPal Button */}
            <a
              href={paypalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center justify-center gap-2 transition-colors shadow-sm font-sans"
            >
              <span>Contribute ${donationAmount} via PayPal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="text-[11px] text-slate-500 text-center font-mono">
              Recipient: <code className="text-slate-400">paypal.me/{config.paypalUsername}</code>
            </div>
          </div>
        )}

        {/* CRYPTO TAB */}
        {activeTab === 'crypto' && (
          <div className="flex flex-col gap-3 font-mono">
            <p className="text-slate-300 font-sans leading-relaxed text-[11px]">
              Direct peer-to-peer crypto contributions for decentralized infrastructure funding:
            </p>

            {/* Bitcoin */}
            <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>Bitcoin (BTC)</span>
                  <span className="text-slate-500 font-normal">Native SegWit</span>
                </span>
                <button
                  onClick={() => handleCopy(config.btcAddress, 'btc')}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                >
                  {copiedKey === 'btc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'btc' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-slate-300 text-[11px] break-all bg-slate-900/80 p-2 rounded border border-slate-800/80">
                {config.btcAddress}
              </code>
            </div>

            {/* Ethereum / EVM */}
            <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-sky-400 flex items-center gap-1.5">
                  <span>Ethereum (ETH / USDT / USDC)</span>
                  <span className="text-slate-500 font-normal">ERC-20 / Arbitrum / Base</span>
                </span>
                <button
                  onClick={() => handleCopy(config.ethAddress, 'eth')}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                >
                  {copiedKey === 'eth' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'eth' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-slate-300 text-[11px] break-all bg-slate-900/80 p-2 rounded border border-slate-800/80">
                {config.ethAddress}
              </code>
            </div>

            {/* Solana */}
            <div className="bg-slate-950 p-3 rounded border border-slate-800 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-purple-400 flex items-center gap-1.5">
                  <span>Solana (SOL / USDC)</span>
                  <span className="text-slate-500 font-normal">Instant Micro-Tips</span>
                </span>
                <button
                  onClick={() => handleCopy(config.solAddress, 'sol')}
                  className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
                >
                  {copiedKey === 'sol' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'sol' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="text-slate-300 text-[11px] break-all bg-slate-900/80 p-2 rounded border border-slate-800/80">
                {config.solAddress}
              </code>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveConfig} className="flex flex-col gap-3 font-mono">
            <p className="text-slate-300 font-sans text-xs leading-relaxed">
              Personalize these recipient details with your own PayPal username and wallet addresses. They will be saved to your browser and immediately active:
            </p>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                PayPal.me Username:
              </label>
              <input
                type="text"
                value={formConfig.paypalUsername}
                onChange={(e) => setFormConfig({ ...formConfig, paypalUsername: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                placeholder="yourusername"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Bitcoin (BTC) Address:
              </label>
              <input
                type="text"
                value={formConfig.btcAddress}
                onChange={(e) => setFormConfig({ ...formConfig, btcAddress: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                placeholder="bc1q..."
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Ethereum (ETH / ERC-20) Address:
              </label>
              <input
                type="text"
                value={formConfig.ethAddress}
                onChange={(e) => setFormConfig({ ...formConfig, ethAddress: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                placeholder="0x..."
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Solana (SOL) Address:
              </label>
              <input
                type="text"
                value={formConfig.solAddress}
                onChange={(e) => setFormConfig({ ...formConfig, solAddress: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                placeholder="Solana address..."
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-emerald-400">
                {saveSuccess ? '✓ Addresses saved successfully!' : ''}
              </span>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded transition-colors text-xs font-sans"
              >
                Save My Wallet Addresses
              </button>
            </div>
          </form>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-amber-400" />
            <span>Non-profit cloud infrastructure maintenance</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-sans transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
