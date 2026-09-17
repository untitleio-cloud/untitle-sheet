const cache = new Map();
const TTL_MS = 60000;

export async function onRequestGet(context) {
  const p = context.params.path;
  const sym = decodeURIComponent(Array.isArray(p) ? p.join('/') : String(p || ''));
  if (!/^[A-Z0-9.\-^=]{1,15}$/i.test(sym)) {
    return Response.json({ error: 'bad symbol' }, { status: 400 });
  }
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.res.clone();
  try {
    const up = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=2d&interval=1d', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; QuoteProxy/1.0)' },
    });
    const body = await up.text();
    const res = new Response(body, {
      status: up.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
    if (up.ok) cache.set(sym, { t: Date.now(), res });
    return res;
  } catch (e) {
    return Response.json({ error: 'upstream' }, { status: 502 });
  }
}
