/* js/util.js — Hàm tiện ích dùng chung: const {rnd, lerp, clamp, TAU, INK} = LR.util; */
(function(){
'use strict';
window.LR.util = {
  $: id => document.getElementById(id),
  rnd: (a, b) => a + Math.random() * (b - a),
  lerp: (a, b, k) => a + (b - a) * k,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  TAU: Math.PI * 2,
  INK: '#1f1a17',
  // 83456 -> "1:23.4"  (tenths=false -> "1:23")
  fmtTime: (ms, tenths = true) => {
    ms = Math.max(0, Math.round(ms || 0));
    const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000), d = Math.floor(ms % 1000 / 100);
    return m + ':' + String(s).padStart(2, '0') + (tenths ? '.' + d : '');
  },
  reduceMotion: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)
};
})();
