/* js/input.js — Bàn phím, pad ảo (mobile). Ải dùng Input.vec() để lấy hướng đi, Input.consumeAct() để lấy nút hành động. */
(function(){
'use strict';
const LR = window.LR;
const {$} = LR.util;
const Input = {
  keys: new Set(), pad:{up:false,down:false,left:false,right:false}, act:false,
  isTouch: (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window),
  vec(){
    const k = this.keys, p = this.pad;
    let x = 0, y = 0;
    if(k.has('ArrowLeft')  || k.has('KeyA') || p.left)  x--;
    if(k.has('ArrowRight') || k.has('KeyD') || p.right) x++;
    if(k.has('ArrowUp')    || k.has('KeyW') || p.up)    y--;
    if(k.has('ArrowDown')  || k.has('KeyS') || p.down)  y++;
    const l = Math.hypot(x,y);
    return l ? {x:x/l, y:y/l, m:1} : {x:0, y:0, m:0};
  },
  consumeAct(){ const a = this.act; this.act = false; return a; },
  clear(){ this.keys.clear(); this.act = false; for(const k in this.pad) this.pad[k] = false; document.querySelectorAll('#pad .on').forEach(b=> b.classList.remove('on')); }
};
const GAME_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyZ','KeyJ'];
window.addEventListener('keydown', e=>{
  if(LR.G.state !== 'play' && LR.G.state !== 'pause') return;
  if(GAME_KEYS.includes(e.code)) e.preventDefault();
  if(e.code === 'Escape' || e.code === 'KeyP'){ if(!e.repeat) LR.G.pause(LR.G.state === 'play'); return; }
  if(LR.G.state !== 'play') return;
  const m = LR.G.mod;
  if(m && m.keyDown && m.keyDown(e.code, e.repeat)) return;   // ải tự xử lý phím (vd. R, H trong ải Dọn dẹp)
  if(e.repeat) return;
  if(e.code === 'KeyR'){ LR.G.restart(); return; }
  Input.keys.add(e.code);
  if(e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyJ') Input.act = true;
});
window.addEventListener('keyup', e=> Input.keys.delete(e.code));
window.addEventListener('blur', ()=> Input.clear());
(function bindPad(){
  document.querySelectorAll('#pad .dpad button').forEach(b=>{
    const k = b.dataset.k;
    const on = e=>{ e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(_){} Input.pad[k] = true; b.classList.add('on'); Input.isTouch = true; };
    const off = e=>{ e.preventDefault(); Input.pad[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup','pointercancel','lostpointercapture'].forEach(ev=> b.addEventListener(ev, off));
    b.addEventListener('contextmenu', e=> e.preventDefault());
  });
  const a = $('abil');
  a.addEventListener('pointerdown', e=>{ e.preventDefault(); Input.act = true; a.classList.add('on'); });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=> a.addEventListener(ev, ()=> a.classList.remove('on')));
  a.addEventListener('contextmenu', e=> e.preventDefault());
})();
window.addEventListener('touchstart', ()=>{ Input.isTouch = true; }, {passive:true, once:true});
LR.Input = Input;
})();
