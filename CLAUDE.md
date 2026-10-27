# Working on Orbit Securities

Read `../Shared-Proxy/docs/TRUTH.md` first (one page: how the owner works and what matters).
MAP.md is this repo's map (README.md is the short public front page).

- `npm test`, then `git push origin HEAD:main`.
- Orders are filled and cash counted by the proxy (`stock-fill.js`), never the phone.
- See it on a phone: `node ../Shared-Proxy/tools/preview.mjs securities --live --width 375`.
