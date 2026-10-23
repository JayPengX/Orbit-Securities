// Tests' accounts with 開戶與交易資格 already in place (kit stock-access.mjs):
// each key signed and open from the account's opening.
export const signed = (a, ...keys) => ({
  ...a,
  events: [...a.events, ...keys.map(key => ({ id: `access:${key}:test`, type: 'access', key, t: a.created, from: a.created, ...(key === 'kyc' ? { level: 'aggressive', maxRR: 5 } : {}) }))]
});
