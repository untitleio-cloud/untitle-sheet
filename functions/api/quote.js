const cache = new Map();
const TTL_MS = 30000;

async function fromFinnhub(sym, key) {
  const res = await fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(key));
  if (!res.ok) throw new Error('finnhub ' + res.status);
  const d = await res.json();
  if (!d || !isFinite(d.c) || d.c <= 0) throw new Error('finnhub no data');
  return { price: d.c, change: d.dp || 0, src: 'finnhub' };
}

async function fromYahoo(sym) {
  const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1d', {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; QuoteProxy/1.0)' },
  });
  if (!res.ok) throw new Error('yahoo ' + res.status);
  const j = await res.json();
  const m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || !isFinite(m.regularMarketPrice) || m.regularMarketPrice <= 0) throw new Error('yahoo no data');
  const prev = m.chartPreviousClose || m.previousClose;
  return { price: m.regularMarketPrice, change: prev ? (m.regularMarketPrice / prev - 1) * 100 : 0, src: 'yahoo' };
}

async function fromCoinbaseSpot(symbol) {
  const res = await fetch('https://api.coinbase.com/v2/prices/' + encodeURIComponent(symbol) + '-USD/spot');
  if (!res.ok) throw new Error('coinbase ' + res.status);
  const d = await res.json();
  const amt = d && d.data && d.data.amount;
  if (!amt || !isFinite(parseFloat(amt))) throw new Error('coinbase no data');
  return { price: parseFloat(amt), change: 0, src: 'coinbase' };
}

export async function onRequestGet(context) {
  const params = new URL(context.request.url).searchParams;
  const key = context.env.FINNHUB_KEY;

  if (params.get('probe')) return Response.json({ ok: true });

  const symbol = (params.get('symbol') || '').toUpperCase();
  const type = params.get('type') === 'crypto' ? 'crypto' : 'stock';
  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) {
    return Response.json({ error: 'bad symbol' }, { status: 400 });
  }

  const cacheKey = type + ':' + symbol;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL_MS) return Response.json(hit.v);

  const attempts = [];
  if (key) attempts.push(() => fromFinnhub(type === 'crypto' ? symbol + 'USD' : symbol, key));
  attempts.push(() => fromYahoo(type === 'crypto' ? symbol + '-USD' : symbol));
  if (type === 'crypto') attempts.push(() => fromCoinbaseSpot(symbol));

  let lastErr = 'no sources';
  for (const attempt of attempts) {
    try {
      const v = await attempt();
      cache.set(cacheKey, { t: Date.now(), v });
      return Response.json(v);
    } catch (e) {
      lastErr = String(e && e.message || e);
    }
  }
  return Response.json({ error: 'all sources failed: ' + lastErr }, { status: 502 });
}
