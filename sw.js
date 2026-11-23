/* Painel ETE Silo · funciona sem internet: guarda o painel, as fotos e a última leitura da planilha neste aparelho */
const SHELL = 'shell-v1', DADOS = 'dados-v1', FOTOS = 'fotos-v1';
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

const chaveGviz = u => { const p = u.searchParams; return 'https://cache.local/gviz/' + u.pathname.split('/')[3] + '/' + p.get('gid') + '/' + p.get('range'); };
const cbDe = u => { const m = (u.searchParams.get('tqx') || '').match(/responseHandler:([^;]+)/); return m ? m[1] : null; };

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // planilha (JSONP do Google): rede primeiro; sem rede, devolve a última leitura guardada
  if (u.hostname === 'docs.google.com' && u.pathname.includes('/gviz/tq') && cbDe(u)) {
    const cb = cbDe(u), key = chaveGviz(u);
    e.respondWith((async () => {
      try {
        const r = await fetch(req.url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
        const txt = await r.text();
        if (r.ok && txt.includes(cb + '(')) { const c = await caches.open(DADOS); await c.put(key, new Response(txt.replace(cb + '(', '__CB__('), { headers: { 'x-saved': String(Date.now()) } })); }
        return new Response(txt, { status: r.status, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
      } catch (err) {
        const hit = await (await caches.open(DADOS)).match(key);
        if (hit) { const t = await hit.text(); return new Response(t.replace('__CB__(', cb + '('), { headers: { 'Content-Type': 'application/javascript; charset=utf-8' } }); }
        return fetch(req);
      }
    })());
    return;
  }
  // fotos do Drive: mostra a guardada na hora e atualiza por trás
  if (u.hostname === 'drive.google.com' && u.pathname.startsWith('/thumbnail')) {
    e.respondWith((async () => {
      const c = await caches.open(FOTOS), hit = await c.match(req);
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
    return;
  }
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('version.json')) return;
  // o próprio painel: rede primeiro (pega a versão nova), sem rede usa a guardada
  if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html')) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); return r; })));
});
