// 真相 (資金 › 真相): what trading and borrowing really cost, from the rules
// this app trades by (the kit's market table), and this account's own
// record in the wallet. Pure functions, tested directly.
import { MARKETS, CURRENCIES } from '#kit/stock-markets.mjs';
import { DEFAULT_PENALTY } from '#kit/stock-account.mjs';
import { OVERDRAFT_RATE } from '#kit/orbit.mjs';

const TW = MARKETS.TW;
export const STOCK = {
  commission: TW.commission.rate,
  commissionMin: TW.commission.min,
  // Securities transaction tax on a sale; a 當沖 (sold the day it was bought) pays half.
  tax: TW.sell.stock.tax,
  dayTradeTax: Date.now() < TW.sell.stock.dayTradeUntil ? TW.sell.stock.dayTrade : TW.sell.stock.tax,
  // Yearly margin interest on NT$.
  loanRate: CURRENCIES.TWD.loanRate,
  // A default on an overdraft: this share of what's owed.
  penalty: DEFAULT_PENALTY
};

// A Taiwan stock bought and sold for `amount`: commission both ways and the
// tax on the sale.
export function roundTrip(amount, { dayTrade = false } = {}) {
  const fee = Math.max(STOCK.commissionMin, Math.floor(amount * STOCK.commission));
  const tax = Math.floor(amount * (dayTrade ? STOCK.dayTradeTax : STOCK.tax));
  return { fee: fee * 2, tax, total: fee * 2 + tax, share: (fee * 2 + tax) / amount };
}

// The overdraft's yearly cost: OVERDRAFT_RATE a month, compounded.
export const overdraftYear = () => (1 + OVERDRAFT_RATE) ** 12 - 1;

// Overdraft interest this account has paid (the Worker's `eco:od:<month>` entries).
export const overdraftPaid = wallet => (wallet?.entries || []).filter(e => e.app === 'eco' && e.kind === 'od').reduce((sum, e) => sum - Math.round(Number(e.amount) || 0), 0);
