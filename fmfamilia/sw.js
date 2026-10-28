/* Service worker do Fruit Merge.
   O index.html é sempre buscado na rede primeiro, então não precisa mexer
   em nada para atualizar o jogo. Só troque VERSION se mudar ícones ou este arquivo. */
const VERSION = 'v4';
const CACHE = 'fruit-merge-' + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
// Bibliotecas e fonte externas: guardadas para o jogo abrir offline
const EXTERNAL = ['www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('fruit-merge-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Mostra o que está no cache e atualiza em segundo plano (stale-while-revalidate)
function swr(req, cacheKey) {
  return caches.open(CACHE).then(cache =>
    cache.match(cacheKey || req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(cacheKey || req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
}

function freshPage() {
  return caches.open(CACHE).then(cache => {
    // 'no-cache' = pergunta ao servidor se mudou; se não mudou, não baixa os 9 MB de novo
    const net = fetch('./index.html', { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put('./index.html', res.clone());
      return res;
    });
    const timeout = new Promise((_, rej) => setTimeout(rej, 4000));
    return Promise.race([net, timeout])
      .catch(() => cache.match('./index.html').then(hit => hit || net));
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Firestore, Auth e demais APIs: sempre direto na rede (nunca em cache)
  if (url.origin !== location.origin && !EXTERNAL.includes(url.hostname)) return;

  // Página do jogo: tenta a rede primeiro (versão nova na hora).
  // Sem internet ou conexão lenta (> 4 s): usa a cópia guardada.
  if (req.mode === 'navigate') {
    e.respondWith(freshPage());
    return;
  }
  e.respondWith(swr(req));
});
