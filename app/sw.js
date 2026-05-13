const CACHE = 'replicator2-v11'
const FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/app.js',
  '/vases-data.js',
  '/main/png/main-croquis.png',
  '/main/png/maquette-croquis.png',
  '/main/png/mns-creps-croquis.png',
  '/main/png/podium-croquis.png',
  '/main/png/poene-croquiss.png',
  '/main/png/asa-croquis.png',
  '/diapo/vase-maquette/vase_maquette_01.jpg',
  '/diapo/vase-maquette/vase_maquette_02.jpg',
  '/diapo/vase-maquette/vase_maquette_03.jpg',
  '/diapo/vase-maquette/vase_maquette_04.jpg',
  '/diapo/vase-maquette/vase_maquette_05.jpg',
  '/diapo/vase-maquette/vase_maquette_06.jpg',
  '/diapo/vase-maquette/vase_maquette_07.jpg',
  '/diapo/vase-mns-creps/vase-mns-creps_01.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_02.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_03.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_04.jpg',
  '/diapo/vase-mns-creps/vase-mns-creps_05.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_06.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_07.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_08.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_09.JPG',
  '/diapo/vase-mns-creps/vase-mns-creps_10.JPG',
  '/diapo/vase-poeme/vase-poeme-01.JPG',
  '/diapo/vase-poeme/vase-poeme-02.JPG',
  '/diapo/vase-poeme/vase-poeme-03.jpg',
  '/diapo/vase-poeme/vase-poeme-04.JPG',
  '/diapo/vase-podium/ektar-vase-podium-2.mp4',
  '/diapo/vase-podium/teaser-vase-podium-1.mp4',
  '/diapo/vase-asa/vase-asa.mp4',
  '/diapo/vase-asa/vase-asa-singature.mp4'
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
