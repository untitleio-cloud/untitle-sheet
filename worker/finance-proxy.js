/**
 * untitle.io Sheet2 indicator proxy (Cloudflare Worker, free plan)
 *
 * WHY: browsers cannot call FRED (no CORS) and no free keyless API exists for
 * KR/JP/DE/CN 10Y yields (verified 2026-09-16: Yahoo has US-only bond symbols,
 * FRED OECD international series discontinued, Stooq/ECB/TradingView routes failed).
 * This Worker runs server-side (no CORS limits), caches 10 min, and centralizes
 * the values that need manual quarterly updates — edit STATIC below, no site redeploy.
 *
 * DEPLOY (Cloudflare dashboard, free):
 *   1. dash.cloudflare.com -> Workers & Pages -> Create -> Create Worker
 *   2. Paste this file's contents -> Deploy -> note the *.workers.dev URL
 *   3. In index.html set: const S2_PROXY = 'https://<name>.<acct>.workers.dev';
 *
 * ENDPOINT: GET /api/indicators -> JSON { bonds:[...], rates:[...], meta:{...} }
 */

const STATIC = {
  // Central bank policy rates (edit after each MPC decision)
  rates: [
    { id: 'fed', v: '3.75%', chg: '0.00', cls: 's2-flat', d: 'Jul 30' }
  ]
};

let cache = { t: 0, body: null };

async function fred(seriesId) {
  try {
    const r = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + seriesId);
    if (!r.ok) return null;
    const lines = (await r.text()).trim().split('\n');
    const last = lines[lines.length - 1].split(',');
    const v = parseFloat(last[1]);
    return { date: last[0], v: isNaN(v) ? null : v };
  } catch (e) { return null; }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/quote/')) {
      const sym = decodeURIComponent(url.pathname.slice('/quote/'.length));
      try {
        const up = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=2d&interval=1d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const body = await up.text();
        return new Response(body, { status: up.status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } });
      } catch (e) {
        return new Response('{"error":"upstream"}', { status: 502, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
      }
    }
    if (url.pathname !== '/api/indicators') {
      return new Response('untitle.io indicator proxy', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const now = Date.now();
    if (!cache.body || now - cache.t > 10 * 60 * 1000) {
      const [us10y, fedfunds] = await Promise.all([fred('DGS10'), fred('FEDFUNDS')]);
      const body = Object.assign({}, STATIC, {
        meta: { us10y: us10y, fedfunds: fedfunds, refreshed: new Date().toISOString() }
      });
      cache = { t: now, body: JSON.stringify(body) };
    }
    return new Response(cache.body, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=600'
      }
    });
  }
};
