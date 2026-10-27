<p align="center">
  <img src="public/icons/icon-192.png" width="96" height="96" alt="">
</p>

<h1 align="center">Orbit Securities</h1>

<p align="center">
  <b>Invest worldwide, risk-free.</b><br>
  <a href="https://jaypengx.com/securities/"><b>jaypengx.com/securities</b></a>
</p>

<p align="center">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=000"> <img alt="PWA" src="https://img.shields.io/badge/PWA-works_offline-5A0FC8?logo=pwa&logoColor=fff"> <img alt="Cloudflare" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=fff"> <img alt="GitHub" src="https://img.shields.io/badge/GitHub-Pages-24292F?logo=github&logoColor=fff"> <img alt="Tests" src="https://img.shields.io/badge/Tests-node_--test-339933?logo=nodedotjs&logoColor=fff">
</p>

A Taiwan brokerage on play money, with real prices and a real broker's rules. Part of **Orbit**, a family of phone apps for life in Taiwan that share one sign-in, the Orbit Pass. See them all at [jaypengx.com](https://jaypengx.com/).

## What it does

- **Markets:** Taiwan and world stocks, ETFs, funds, futures, forex, bonds, crypto and gold.
- **Real trading rules:** limit and stop orders, margin, shorts, fees and taxes.
- **Your portfolio:** net worth over time, allocation, income, and how you did against 0050 and VOO.
- **Detail pages** with charts, the facts and a plain-language read of each company or fund.
- **Price alerts** and regular investment plans.

## Stack

- Plain JavaScript (ES modules), HTML and CSS: no framework, no build step, no runtime dependencies.
- An installable phone web app (Add to Home Screen), cached by a service worker.
- The look, sign-in (the Orbit Pass) and notices come from the shared kit in [Shared-Proxy](https://github.com/JayPengX/Shared-Proxy).
- Live data goes through the Orbit proxy on Cloudflare Workers (`api.jaypengx.com`). Orders are filled by the proxy at real quotes.
- Hosted on GitHub Pages and served at jaypengx.com by a Cloudflare Worker; every push to `main` tests and deploys.

## For developers

```bash
npm test
```

How it works, file by file, and the decisions still in force: **[MAP.md](MAP.md)**.
