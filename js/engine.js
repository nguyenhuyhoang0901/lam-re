/* js/engine.js — Lõi game: canvas, vòng lặp, tạm dừng, kết thúc ải. Mỗi ải chỉ cần cung cấp object {enter, exit, update, draw, resize, pointerDown…} */
(function(){
'use strict';
const LR = window.LR;
const {$, clamp} = LR.util;
const G = {
  cv: $('cv'), ctx: null, W:360, H:640, dpr:1, u:1, top:56,
  state:'idle', mod:null, cur:null, raf:0, last:0,
  hud:{
    last:'',
    set(items){
      const html = items.map(i=> '<div class="st' + (i.w ? ' warn' : '') + '"><span>' + i.l + '</span><b>' + i.v + '</b></div>').join('');
      if(html !== this.last){ this.last = html; $('hudStats').innerHTML = html; }
    }
  },
  resize(){
    G.W = Math.max(240, window.innerWidth); G.H = Math.max(320, window.innerHeight);
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    G.cv.width = Math.round(G.W * G.dpr); G.cv.height = Math.round(G.H * G.dpr);
    G.u = clamp(Math.min(G.W, G.H) / 480, .8, 1.4);
    const hud = $('hud');
    G.top = hud.hidden ? 0 : Math.max(48, hud.offsetHeight);
    if(G.mod && G.mod.resize) G.mod.resize();
  },
  start(chId, lvId, modeId){
    const ch = LR.chapterById(chId), lv = LR.levelById(ch, lvId);
    G.cur = {chId, lvId, modeId: modeId || null};
    G.mod = lv.mod;
    LR.Input.clear();
    $('hudTitle').textContent = lv.title;
    $('hudSub').textContent = modeId ? 'Mức ' + lv.modes.find(m=>m.id===modeId).name : ch.title;
    G.hud.last = ''; $('hudStats').innerHTML = '';
    $('hud').hidden = false;
    $('pad').hidden = !(lv.pad && LR.Input.isTouch);
    $('abil').textContent = lv.actLabel || 'VỒ';
    document.body.classList.add('playing');
    LR.UI.hideAll();
    G.ctx = G.cv.getContext('2d');
    G.state = 'play';
    G.resize();
    G.mod.enter({mode: modeId});
    G.cv.focus({preventScroll:true});
    G.last = performance.now();
    if(!G.raf) G.raf = requestAnimationFrame(G.loop);
  },
  loop(now){
    if(G.state === 'idle'){ G.raf = 0; return; }
    const dt = Math.min(.05, (now - G.last) / 1000); G.last = now;
    if(G.state === 'play') G.mod.update(dt);
    G.mod.draw();
    G.raf = requestAnimationFrame(G.loop);
  },
  pause(p){
    if(p && G.state === 'play'){ G.state = 'pause'; LR.Sound.buzzSet(0,0,false); LR.Input.clear(); LR.UI.modal('pause', true); }
    else if(!p && G.state === 'pause'){ G.state = 'play'; G.last = performance.now(); LR.UI.modal('pause', false); }
  },
  restart(){ if(G.cur) { LR.UI.modal('pause', false); LR.UI.modal('end', false); G.start(G.cur.chId, G.cur.lvId, G.cur.modeId); } },
  stop(){
    if(G.mod && G.mod.exit) G.mod.exit();
    G.state = 'idle'; G.mod = null;
    LR.Sound.buzzSet(0,0,false);
    $('hud').hidden = true; $('pad').hidden = true;
    document.body.classList.remove('playing');
    LR.Input.clear();
  },
  finish(res){
    if(G.state !== 'play') return;
    G.state = 'over';
    LR.Sound.buzzSet(0,0,false); LR.Input.clear();
    const {chId, lvId, modeId} = G.cur;
    let isNew = false, isNewTime = false, prog = null;
    if(res.score != null) isNew = LR.Store.setBest(chId, lvId, modeId, res.score);
    if(res.win && res.time != null) isNewTime = LR.Store.setBestTime(chId, lvId, modeId, res.time);
    if(res.win) prog = LR.Store.markWin(chId, lvId, modeId);
    (res.win ? LR.Sound.sfx.win : LR.Sound.sfx.lose)();
    setTimeout(()=> { if(G.state === 'over') LR.UI.showEnd(res, {isNew, isNewTime, prog}); }, res.delay != null ? res.delay : 700);
  }
};
window.addEventListener('resize', ()=>{ if(G.state !== 'idle') G.resize(); });
G.cv.addEventListener('pointerdown', e=>{
  if(G.state !== 'play' || !G.mod || !G.mod.pointerDown) return;
  e.preventDefault();
  try{ G.cv.setPointerCapture(e.pointerId); }catch(_){}      // giữ con trỏ khi kéo ra ngoài canvas
  const r = G.cv.getBoundingClientRect();
  G.mod.pointerDown(e.clientX - r.left, e.clientY - r.top, e);
});
// Nhả chuột/ngón tay (hoặc bị huỷ): ải kéo thả dùng mod.pointerUp(x, y, e)
['pointerup','pointercancel'].forEach(t=> G.cv.addEventListener(t, e=>{
  if(G.state === 'idle' || !G.mod || !G.mod.pointerUp) return;
  const r = G.cv.getBoundingClientRect();
  G.mod.pointerUp(e.clientX - r.left, e.clientY - r.top, e);
}));
G.cv.addEventListener('pointermove', e=>{
  if(G.state === 'idle' || !G.mod || !G.mod.pointerMove) return;
  const r = G.cv.getBoundingClientRect();
  G.mod.pointerMove(e.clientX - r.left, e.clientY - r.top, e);
});
G.cv.addEventListener('pointerleave', ()=>{ if(G.mod && G.mod.pointerLeave) G.mod.pointerLeave(); });
G.cv.addEventListener('contextmenu', e=> e.preventDefault());
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) G.pause(true); });
LR.G = G;
})();
