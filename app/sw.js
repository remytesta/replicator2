const CACHE = 'replicator2-v4'
const FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/app.js',
  '/vases-data.js',
  '/vase/vase_illustration.png',
  '/vase/vase_argent_002.png',
  '/vase/vase_boulouris_001.png',
  '/vase/vase_bronze_005.png',
  '/vase/vase_maquette_007.png',
  '/vase/vase_MNS_v1_008.png',
  '/vase/vase_MNS_v2_006.png',
  '/vase/vase_or_004.png',
  '/vase/vase_poeme_003.png'
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .catch(() => caches.match(e.request))
  )
})
