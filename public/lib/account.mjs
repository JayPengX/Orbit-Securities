// Orbit Securities' account: the shared kit's (stock-account.mjs), one copy for
// Securities and the Worker that checks its account (Orbit-Core stock-check.js).
export * from '#kit/stock-account.mjs';

// Whether two copies of an account differ in their daily net-worth snapshots
// alone (taken every 10 minutes while prices come): such a change is kept on
// the phone and goes to the Pass with the next sync, never a sync of its own.
export const onlySnapshot = (a, b) => !!a && !!b && a !== b && Object.keys({ ...a, ...b }).every(k => k === 'snapshots' || a[k] === b[k]);
