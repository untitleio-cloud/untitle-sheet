/**
 * untitle.io Sheet2 indicator proxy (Cloudflare Worker, free plan)
 *
 * WHY: browsers cannot call FRED (no CORS) and no free keyless API exists for
 * KR/JP/DE/CN 10Y yields (verified 2026-09-16: Yahoo has US-only bond symbols,
 * FRED OECD international series discontinued, Stooq/ECB/TradingView routes failed).
 * This Worker runs server-side (no CORS limits), caches 10 min, and centralizes
 * the values that need manual quarterly updates — edit STATIC below, no site redeploy.
 *
 * DEPLOY (Cloudflare, free):
 *   cd worker && CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *     npx -p wrangler@3 wrangler deploy        (needs Node >= 18; DO migration in wrangler.toml)
 *   Served on api.untitle.io via zone route (created once through the CF dashboard/API).
 *
 * BOT GUARD: non-browser User-Agents get 403; per-IP rate limit (60/min for /quote,
 * 120/min otherwise) enforced globally by the "Guard" Durable Object (429 + Retry-After).
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

// ===== BOT GUARD =====
const BOT_RE = /(bot|crawl|spider|slurp|curl|wget|python|scrapy|httpclient|okhttp|go-http|java|phantom|headless|selenium|puppeteer|playwright|lwp-trivial|libwww|feedfetcher|feedparser|nmap|zgrab|masscan|sqlmap|nikto|nuclei|httpie|axios\/|node-fetch|undici|got\/|aiohttp|hyper|net::)/i;
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 120;
const RATE_MAX_BURST = 60;
const rate = new Map();
const lastWarn = new Map();

function clientKey(request) {
  const xff = request.headers.get('CF-Connecting-IP') || (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim();
  return xff || 'anon';
}

function rateLimited(key, max) {
  const now = Date.now();
  let b = rate.get(key);
  if (!b || now - b.t0 > RATE_WINDOW_MS) {
    if (rate.size > 5000) rate.clear();
    b = { t0: now, n: 0 };
    rate.set(key, b);
  }
  b.n++;
  return b.n > max;
}

async function blocked(request, env) {
  const ua = request.headers.get('User-Agent') || '';
  if (!ua || BOT_RE.test(ua)) {
    return new Response('{"error":"forbidden"}', { status: 403, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  const key = clientKey(request);
  const path = new URL(request.url).pathname;
  const isBurst = path.startsWith('/quote/');
  let limited = false;
  if (env.GUARD) {
    try {
      const stub = env.GUARD.get(env.GUARD.idFromName('global'));
      const gr = await stub.fetch('https://guard/check?k=' + encodeURIComponent(key) + '&b=' + (isBurst ? 1 : 0));
      limited = !!(await gr.json()).over;
    } catch (e) { limited = false; }
  } else {
    limited = rateLimited(key, isBurst ? RATE_MAX_BURST : RATE_MAX);
  }
  if (limited) {
    const now = Date.now();
    if (!lastWarn.get(key) || now - lastWarn.get(key) > 300000) {
      lastWarn.set(key, now);
      try { fetch('https://untitle.io/api/abuse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, ua, path }) }).catch(() => {}); } catch (e) {}
    }
    return new Response('{"error":"rate limited"}', { status: 429, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
  return null;
}

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
  async fetch(request, env) {
    const url = new URL(request.url);
    const deny = await blocked(request, env);
    if (deny) return deny;
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

export class Guard {
  constructor(state) {
    this.state = state;
    this.map = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/check') return new Response('guard');
    const key = url.searchParams.get('k') || 'anon';
    const burst = url.searchParams.get('b') === '1';
    const now = Date.now();
    if (!this.map) this.map = new Map();
    if (this.map.size > 3000) {
      for (const [k, v] of this.map) { if (now - v.t0 > 120000) this.map.delete(k); }
    }
    let b = this.map.get(key);
    if (!b || now - b.t0 > 60000) { b = { t0: now, n: 0 }; this.map.set(key, b); }
    b.n++;
    const over = b.n > (burst ? RATE_MAX_BURST : RATE_MAX);
    return new Response(JSON.stringify({ n: b.n, over }), { headers: { 'Content-Type': 'application/json' } });
  }
}
