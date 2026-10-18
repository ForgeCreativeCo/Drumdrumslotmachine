// Taiko Thunder service worker. The build (vite.config.ts) fills in the version
// and the list of built files, so the whole game is cached on install and plays
// offline. Google Fonts are cached as they load.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `taiko-${VERSION}`;
const FONTS = 'taiko-fonts';
// How long a page load waits for the network before falling back to the cache.
const NAV_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fromFontCache(event));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(page(req));
    return;
  }
  // Built files are content-hashed, so a cached copy is always the right one.
  event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
});

/** The latest page when the network answers quickly (so updates arrive), else the cached one. */
async function page(req) {
  const cached = () => caches.match('./', { ignoreSearch: true }).then((hit) => hit ?? caches.match('index.html'));
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
  try {
    const res = await Promise.race([fetch(req), timeout.then(() => null)]);
    return res ?? (await cached()) ?? fetch(req);
  } catch {
    return (await cached()) ?? Response.error();
  }
}

/** Serve fonts from cache straight away and refresh them in the background. */
async function fromFontCache(event) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') void cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => hit ?? Response.error());
  event.waitUntil(fresh.then(() => undefined));
  return hit ?? fresh;
}
