/* Service worker tối giản: lưu vỏ ứng dụng để mở lại nhanh/ngoại tuyến.
   Khi thêm file ải mới: thêm vào SHELL và tăng số phiên bản CACHE. */
const CACHE = 'chuyen-lam-re-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/chapters.js',
  './js/cloud.js',
  './js/config.js',
  './js/engine.js',
  './js/input.js',
  './js/main.js',
  './js/registry.js',
  './js/sound.js',
  './js/store.js',
  './js/ui.js',
  './js/util.js',
  './js/levels/ch1/01-gio.js',
  './js/levels/ch1/02-ga.js',
  './js/levels/ch1/03-thit-xien.js',
  './js/levels/ch1/04-xoi.js',
  './js/levels/ch1/05-canh-mang.js',
  './js/levels/ch1/06-nom.js',
  './js/levels/ch1/07-tom.js',
  './js/levels/ch1/08-hoa-qua.js',
  './js/levels/ch1/09-chuoi-nau.js',
  './js/levels/ch1/10-kiem-ke-thuc-don.js',
  './js/levels/ch1/11-don-mam.js',
  './js/levels/ch1/12-chuc-ruou.js',
  './js/levels/ch1/13-don-dep.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;          // không cache cloud
  e.respondWith(
    fetch(req).then(res => {
      if (url.origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
