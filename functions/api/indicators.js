const STATIC = {
  rates: [
    { id: 'fed', v: '3.75%', chg: '0.00', cls: 's2-flat', d: 'Jul 30' }
  ]
};

const cache = { t: 0, body: null };
const TTL_MS = 10 * 60 * 1000;

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

export async function onRequestGet() {
  const now = Date.now();
  if (!cache.body || now - cache.t > TTL_MS) {
    const [us10y, fedfunds] = await Promise.all([fred('DGS10'), fred('FEDFUNDS')]);
    const body = Object.assign({}, STATIC, {
      meta: { us10y: us10y, fedfunds: fedfunds, refreshed: new Date().toISOString() }
    });
    cache.t = now;
    cache.body = JSON.stringify(body);
  }
  return new Response(cache.body, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600'
    }
  });
}
