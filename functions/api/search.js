const cache = new Map();
const TTL_MS = 600000;

export async function onRequestGet(context) {
  const q = (new URL(context.request.url).searchParams.get('q') || '').trim();
  if (!q || q.length > 20) return Response.json({ results: [] });

  const hit = cache.get(q.toLowerCase());
  if (hit && Date.now() - hit.t < TTL_MS) return Response.json(hit.v);

  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v1/finance/search?q=' +
      encodeURIComponent(q) + '&quotesCount=12&newsCount=0&enableFuzzyQuery=false',
      { headers: { 'user-agent': 'Mozilla/5.0 (compatible; QuoteProxy/1.0)' } }
    );
    if (!res.ok) throw new Error('yahoo ' + res.status);
    const j = await res.json();
    const seen = {};
    const results = [];
    for (const x of j.quotes || []) {
      if (['EQUITY', 'ETF', 'CRYPTOCURRENCY'].indexOf(x.quoteType) === -1) continue;
      let ticker, type;
      if (x.quoteType === 'CRYPTOCURRENCY') {
        ticker = String(x.symbol || '').split('-')[0];
        type = 'crypto';
      } else {
        ticker = String(x.symbol || '');
        type = 'stock';
      }
      if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(ticker) || seen[ticker]) continue;
      seen[ticker] = true;
      results.push({ ticker, realName: x.shortname || x.name || ticker, type });
    }
    const v = { results };
    cache.set(q.toLowerCase(), { t: Date.now(), v });
    return Response.json(v);
  } catch (e) {
    return Response.json({ results: [] }, { status: 502 });
  }
}
