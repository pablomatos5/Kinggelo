// Service worker do painel: deixa instalar como app e abre a "casca" mesmo com internet ruim.
// Os dados (/api) nunca ficam guardados: sempre vêm do servidor.
const CACHE = 'kg-painel-v4';  // v4: manter conectado no login
const CASCA = ['/admin/', '/admin/app.js', '/admin/painel.css', '/admin/manifest.webmanifest', '/admin/icones/icone-192.png', '/img/cliente/logo-gelo.webp',
  '/fontes/fontes.css', '/fontes/outfit-latin-var.woff2', '/fontes/anton-latin.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('kg-painel-') && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  const ehPagina = req.mode === 'navigate';
  const daCasca = ehPagina || CASCA.includes(url.pathname);
  if (!daCasca) return;
  // rede primeiro (o painel sempre atualizado); sem internet, usa a última versão guardada
  e.respondWith(fetch(req).then((resp) => {
    if (resp.ok) {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(ehPagina ? '/admin/' : req, copia));
    }
    return resp;
  }).catch(() => caches.match(ehPagina ? '/admin/' : req)));
});

// toque na notificacao de interessado novo: abre (ou traz para a frente) o painel no cliente
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/admin/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abas) => {
    const aba = abas.find((a) => new URL(a.url).pathname.startsWith('/admin'));
    if (aba) { aba.navigate(url).catch(() => {}); return aba.focus(); }
    return self.clients.openWindow(url);
  }));
});
