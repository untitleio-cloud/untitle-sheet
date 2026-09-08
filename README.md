# Untitled Spreadsheet

A privacy-first, spreadsheet-style personal market dashboard that runs entirely
in your browser. Single HTML file — no build step, no accounts, no servers, no
tracking. All data lives in your browser's `localStorage`.

## Features

- Google Sheets-like UI: cell/range selection, header row & column select,
  move-drag, undo/redo, formatting toolbar, context menu, whole row/column
  insert & delete
- Formula engine: `+ - * / ^ %`, parentheses, cell & range references
  (`=C2*2`, `=SUM(C2:C6)`), `SUM / AVERAGE / MIN / MAX / COUNT / ABS / ROUND`,
  comparisons, circular-reference detection
- Point mode: while typing `=...`, click or drag cells to insert references
- Live prices for crypto and stock perpetuals, with Auto Sync polling mode
- Price source you can switch (Edit → API sources…): **Binance Futures**
  (default), **Hyperliquid** (free, no key — ~900 crypto + 100+ stock
  perpetuals including Nasdaq names, all prices in one batch call),
  **CoinGecko** (free, no key — crypto only), **Finnhub** (US stocks/Nasdaq +
  major crypto, free API key from [finnhub.io](https://finnhub.io) entered
  in the dialog), or — when deployed on Cloudflare Pages (see below) —
  **Self-hosted API**: stocks + crypto served from your own deployment with
  the key kept server-side. One choice at a time. The dialog probes each
  source when it opens and disables any that is unreachable, geo-blocked,
  or has an invalid key; the best reachable source is auto-selected per
  visitor region, and if your selected source goes down mid-session, the
  app falls back to the others automatically. Cells with no reachable quote
  show `No Data` — never simulated numbers
- Item Code autocomplete bound to the active data source, with free-form
  ticker entry
- USD everywhere, Local Storage persistence only

## Usage

Open `index.html` in a modern browser. That's it.

### Recommended hosting: Cloudflare Pages (adds the same-origin price API)

This is the setup for US-based visitors, where Binance is geo-blocked and
browser-only stock APIs are unavailable. The repo includes a Cloudflare Pages
Function (`functions/api/quote.js`) that serves stock + crypto quotes from
your own deployment — visitors see a fourth "Self-hosted API" source
(auto-selected on first visit), and your Finnhub key stays server-side.

1. Push this folder to GitHub as the repository root (`index.html` and
   `functions/` must sit at the root)
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
   Framework preset: **None**, build command: empty, output directory: `/`
3. (Optional, recommended) Settings → Variables → add `FINNHUB_KEY` = a free
   key from [finnhub.io](https://finnhub.io). Without it the function falls
   back to public endpoints (Yahoo for stocks, Coinbase spot for crypto) —
   fine to start with, but Finnhub is the stable official path. Either way
   **visitors never need a key**
4. Done — `/api/quote` is live on the same origin and the sheet picks it up

Free tier (100,000 requests/day, responses cached 30s per symbol) is plenty
for a team dashboard. `/api/hl` additionally relays the Hyperliquid snapshot
server-side, which also works from networks where the browser cannot reach
`api.hyperliquid.xyz` directly. Without the function (e.g. GitHub Pages), the
app behaves exactly as before: browser-direct Binance / Hyperliquid / CoinGecko
/ Finnhub-key sources. Strict single source: prices come only from the source
you pick; unreachable sources are disabled and auto-switched.

### Hosting on GitHub Pages

Put the site files in a `docs/` folder (with an empty `.nojekyll` file),
enable Pages for that folder — the site is fully static. Visitors' browsers
connect to the data sources on their own behalf; the "Self-hosted API"
source simply does not appear (there is no `/api/quote`). Visitors in
regions where Binance is unavailable should pick CoinGecko (crypto) or enter
their own Finnhub key (stocks).

## Disclaimer

- This project is **not affiliated with, endorsed by, or connected to Google
  LLC or Binance**. "Google Sheets" and "Binance" are trademarks of their
  respective owners.
- The author does **not** provide, cache, or redistribute market data. Every
  user's browser connects to the data source *they* enable, directly and on
  their own behalf. You are responsible for complying with the terms of use
  and regional availability of whatever data source you configure.
- Prices may be delayed, incomplete, or wrong. Nothing in this software is
  investment advice. Use at your own risk.

## License

[MIT](LICENSE)

## Tests

Behavior harness (jsdom, 27 checks: prices, sources, formulas, formatting,
row/column operations, keyboard):

```bash
cd tests && npm install && npm test
```

In-app: **Tools → Run self-test…** runs 22 live-sheet checks and restores data.
