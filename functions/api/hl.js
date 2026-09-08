let cache = null;
let cacheAt = 0;
const TTL_MS = 30000;

function post(body) {
  return fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => (r.ok ? r.json() : Promise.reject(new Error('hl ' + r.status))));
}

export async function onRequestGet() {
  if (cache && Date.now() - cacheAt < TTL_MS) return Response.json(cache);
  try {
    const [main, xyz] = await Promise.all([
      post({ type: 'metaAndAssetCtxs' }),
      post({ type: 'metaAndAssetCtxs', dex: 'xyz' }).catch(() => null),
    ]);
    const snap = {};
    const fill = (pair, type) => {
      if (!pair || !pair[0] || !pair[1]) return;
      pair[0].universe.forEach((u, i) => {
        const ctx = pair[1][i];
        if (!ctx) return;
        const raw = String(u.name);
        const t = raw.includes(':') ? raw.split(':')[1] : raw;
        const px = parseFloat(ctx.markPx || ctx.midPx);
        const prev = parseFloat(ctx.prevDayPx);
        if (!isFinite(px) || px <= 0 || !/^[A-Z][A-Z0-9.\-]{0,11}$/.test(t)) return;
        const entry = { price: px, change: isFinite(prev) && prev > 0 ? (px / prev - 1) * 100 : 0, type };
        if (snap[t] && snap[t].type === 'crypto' && type === 'stock') return;
        snap[t] = entry;
      });
    };
    fill(main, 'crypto');
    fill(xyz, 'stock');
    if (!Object.keys(snap).length) return Response.json({ error: 'empty snapshot' }, { status: 502 });
    cache = snap;
    cacheAt = Date.now();
    return Response.json(snap);
  } catch (e) {
    return Response.json({ error: String(e && e.message || e) }, { status: 502 });
  }
}
