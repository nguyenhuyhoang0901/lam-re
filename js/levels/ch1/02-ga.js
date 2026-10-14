/* Chương 1 · Ải 2: Gà — bản khó đầy đủ (10 gà, 1 đợt)
   Cơ chế: gà né dive · gà trống phản công · stack tốc độ · gà bay
   MỚI: gà trống gáy (làm player đứng hình) · gà mái đẻ trứng (dẫm phải bị chậm)
   UPDATE: Floating Joystick bên trái + Nút VỒ tròn bên phải cho giao diện Mobile */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound, Input} = LR;
const {rnd, clamp, TAU, INK} = LR.util;

const mod = (function(){
  /* ── Độ khó ── */
  const N_TOTAL   = 10;
  const TIME      = 90;
  const SP        = 185;
  const DIVE_SP   = 510;
  const DIVE_T    = 0.22;
  const DIVE_CD   = 0.35;
  const STUN_T    = 0.9;
  const MISS_COST = 3;
  const TAP_ASSIST_R = 85;
  const PANIC_MUL = 1.20;
  const STACK_MUL = 1.08;
  const DODGE_CHANCE = 0.75;
  const DODGE_CD     = 0.4;
  const DODGE_RANGE  = 165;
  const PECK_RANGE = 45;
  const PECK_DELAY = 0.45;
  const PECK_CD = 2.5;

  /* ── Cơ chế bay ── */
  const FLY_RANGE_ROO  = 115;
  const FLY_RANGE_HEN  = 105;
  const FLY_SP_ROO     = 470;
  const FLY_SP_HEN     = 425;
  const FLY_T_ROO      = 0.55;
  const FLY_T_HEN      = 0.48;
  const FLY_CD_ROO     = 1.2;
  const FLY_CD_HEN     = 1.6;
  const FLY_STAM_COST  = 0.28;
  const FLY_RECOVER_T  = 0.60;
  const FLY_STAM_GATE  = 0.30;

  /* ── Gà trống GÁY ── */
  const CROW_CD_MIN   = 5.0;   // hồi chiêu tối thiểu
  const CROW_CD_MAX   = 7.0;   // hồi chiêu tối đa
  const CROW_WINDUP   = 0.75;  // thời gian cảnh báo (gà đứng yên, "!!")
  const CROW_ACTIVE   = 0.55;  // thời gian hiệu ứng gáy
  const CROW_RANGE    = 195;   // tầm ảnh hưởng (×u)
  const CROW_FREEZE   = 1.30;  // thời gian player bị đứng hình (nếu trong tầm)
  const CROW_TRIGGER  = 1.3;   // hệ số kích hoạt: gáy khi player trong CROW_RANGE*1.3

  /* ── Gà mái ĐẺ TRỨNG ── */
  const EGG_CD_MIN    = 1.5;   // hồi đẻ tối thiểu
  const EGG_CD_MAX    = 4.5;   // hồi đẻ tối đa
  const EGG_LIFE      = 12.0;  // thời gian tồn tại
  const EGG_R         = 9;     // bán kính trứng (×u)
  const EGG_SLOW_T    = 1.6;   // thời gian bị chậm sau khi dẫm
  const EGG_SLOW_MUL  = 0.45;  // hệ số tốc độ (chậm 55%)
  const EGG_MAX       = 15;    // số trứng tối đa trên sân

  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx = null, W = 360, H = 640, dpr = 1, u = 1;
  let arena = {x0:0,y0:0,x1:0,y1:0}, obs = [], tufts = [];
  let clock = 0, left = TIME, caught = 0, misses = 0, done = false, shake = 0;
  let P = null, chickens = [], pops = [], bits = [], ripples = [];
  let eggs = [], rings = [];
  let aim = null, stackMul = 1;

  /* ── Floating Joystick (Trái) & Nút VỒ (Phải) cho Mobile ── */
  let isMobile = false;
  const joy = {
    active: false, id: null,
    cx: 0, cy: 0, x: 0, y: 0,
    r: 50, knobR: 22,
    vx: 0, vy: 0, m: 0,
    usedOnce: false
  };
  const diveBtn = {
    x: 0, y: 0, r: 38,
    pressed: false, id: null
  };
  let customMobileStyle = null;

  const OBS_DEF = [
    {fx:.2,  fy:.26, r:32, t:'hay'},
    {fx:.8,  fy:.24, r:24, t:'jar'},
    {fx:.5,  fy:.50, r:30, t:'banana'},
    {fx:.82, fy:.68, r:30, t:'hay'},
    {fx:.18, fy:.70, r:22, t:'jar'}
  ];

  function normAngle(a){
    while(a >  Math.PI) a -= TAU;
    while(a < -Math.PI) a += TAU;
    return a;
  }

  function checkMobile(){
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
           (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
           (window.innerWidth <= 820);
  }

  function resize(){
    ctx = G.ctx; W = G.W; H = G.H; dpr = G.dpr; u = G.u;
    isMobile = checkMobile();
    arena = {x0:14*u, y0:G.top + 14*u, x1:W - 14*u, y1:H - 14*u};
    const aw = arena.x1 - arena.x0, ah = arena.y1 - arena.y0;
    obs = OBS_DEF.map(o=> ({x:arena.x0 + o.fx*aw, y:arena.y0 + o.fy*ah, r:o.r*u, t:o.t}));
    tufts = [];
    for(let i=0;i<70;i++) tufts.push({
      x:rnd(arena.x0,arena.x1), y:rnd(arena.y0,arena.y1),
      s:rnd(.7,1.3), c:Math.random()<.6?'#6e9a54':'#b99a55'
    });

    /* Kích thước Floating Joystick bên trái */
    joy.r = 48 * u;
    joy.knobR = 21 * u;

    /* Định vị nút VỒ ở góc dưới bên phải */
    diveBtn.r = 38 * u;
    diveBtn.x = arena.x1 - diveBtn.r - 20 * u;
    diveBtn.y = arena.y1 - diveBtn.r - 22 * u;

    if(P){
      clampIn(P, 14*u);
      chickens.forEach(c=> clampIn(c, c.r));
    }
  }

  /* ── Xử lý Multi-touch cho Floating Joystick (Trái) & Nút VỒ (Phải) ── */
  function getCanvasPos(touch){
    const cv = ctx && ctx.canvas;
    if(!cv) return {x: touch.clientX, y: touch.clientY};
    const rect = cv.getBoundingClientRect();
    return {
      x: (touch.clientX - rect.left) * (W / rect.width),
      y: (touch.clientY - rect.top)  * (H / rect.height)
    };
  }

  function isLeftHalfZone(px, py){
    return py >= arena.y0 && px <= W * 0.50;
  }

  function isOnDiveBtn(px, py){
    return Math.hypot(px - diveBtn.x, py - diveBtn.y) <= diveBtn.r * 1.3;
  }

  function updateJoyKnob(px, py){
    const dx = px - joy.cx, dy = py - joy.cy;
    const dist = Math.hypot(dx, dy);
    const maxD = joy.r;
    if(dist > 4 * u){
      const clamped = Math.min(dist, maxD);
      const ang = Math.atan2(dy, dx);
      joy.x = joy.cx + Math.cos(ang) * clamped;
      joy.y = joy.cy + Math.sin(ang) * clamped;
      joy.vx = Math.cos(ang);
      joy.vy = Math.sin(ang);
      joy.m  = clamped / maxD;
    } else {
      joy.x = px; joy.y = py;
      joy.vx = 0; joy.vy = 0; joy.m = 0;
    }
  }

  function resetJoy(){
    joy.active = false;
    joy.id = null;
    joy.vx = 0;
    joy.vy = 0;
    joy.m = 0;
  }

  /* Vồ theo hướng mặt/di chuyển hiện tại (có hỗ trợ tự khóa mục tiêu ở gần trước mặt) */
  function triggerButtonDive(){
    if(!P || P.stun > 0 || P.diveT > 0 || P.diveCd > 0 || P.crowFreeze > 0) return;
    let bestAng = P.dir;
    let bestD = Infinity;
    const assistR = 125 * u;
    for(const c of chickens){
      if(c.caught) continue;
      const dx = c.x - P.x, dy = c.y - P.y;
      const d = Math.hypot(dx, dy);
      if(d < assistR){
        const ang = Math.atan2(dy, dx);
        if(Math.abs(normAngle(ang - P.dir)) < 0.85 && d < bestD){
          bestD = d;
          const lead = 0.08;
          bestAng = Math.atan2((c.y + c.vy * lead) - P.y, (c.x + c.vx * lead) - P.x);
        }
      }
    }
    aim = bestAng;
  }

  function onTouchStart(e){
    if(!isMobile || done || !P) return;
    for(let i = 0; i < e.changedTouches.length; i++){
      const t = e.changedTouches[i];
      const pos = getCanvasPos(t);

      // 1. Kiểm tra nếu bấm vào nút VỒ bên phải
      if(isOnDiveBtn(pos.x, pos.y)){
        diveBtn.pressed = true;
        diveBtn.id = t.identifier;
        triggerButtonDive();
        if(e.cancelable) e.preventDefault();
        continue;
      }

      // 2. Nếu chạm vào nửa trái màn hình -> đặt tâm Floating Joystick
      if(!joy.active && isLeftHalfZone(pos.x, pos.y)){
        joy.active = true;
        joy.usedOnce = true;
        joy.id = t.identifier;
        const pad = joy.r + 6 * u;
        joy.cx = clamp(pos.x, arena.x0 + pad, W * 0.48);
        joy.cy = clamp(pos.y, arena.y0 + pad, arena.y1 - pad);
        updateJoyKnob(pos.x, pos.y);
        if(e.cancelable) e.preventDefault();
      } else {
        // 3. Chạm vào vùng sân bên phải ngoài nút VỒ -> Vồ thẳng tới điểm chạm
        if(pos.y >= arena.y0 && pos.y <= arena.y1){
          triggerDiveAt(pos.x, pos.y);
          if(e.cancelable) e.preventDefault();
        }
      }
    }
  }

  function onTouchMove(e){
    if(!joy.active) return;
    for(let i = 0; i < e.changedTouches.length; i++){
      const t = e.changedTouches[i];
      if(t.identifier === joy.id){
        const pos = getCanvasPos(t);
        updateJoyKnob(pos.x, pos.y);
        if(e.cancelable) e.preventDefault();
        break;
      }
    }
  }

  function onTouchEnd(e){
    for(let i = 0; i < e.changedTouches.length; i++){
      const id = e.changedTouches[i].identifier;
      if(joy.active && id === joy.id){
        resetJoy();
      }
      if(diveBtn.pressed && id === diveBtn.id){
        diveBtn.pressed = false;
        diveBtn.id = null;
      }
    }
  }

  function setupMobileControlsDOM(){
    if(!isMobile || customMobileStyle) return;
    customMobileStyle = document.createElement('style');
    /* Ẩn cụm D-pad 4 nút và đẩy nút VỒ DOM (nếu có) sang phải, hoặc ẩn để dùng nút VỒ trên Canvas */
    customMobileStyle.textContent = `
      @media (max-width: 820px), (pointer: coarse) {
        .dpad, .pad-dirs, .dir-pad, #dpad,
        [data-dir], [data-key="ArrowUp"], [data-key="ArrowDown"], [data-key="ArrowLeft"], [data-key="ArrowRight"] {
          display: none !important;
        }
        .pad, #pad, .controls, .touch-controls {
          justify-content: flex-end !important;
        }
      }
    `;
    document.head.appendChild(customMobileStyle);

    // Ẩn các nút mũi tên và nút VỒ DOM cũ trên mobile để dùng bộ nút Canvas đồng bộ
    document.querySelectorAll('button, .btn, [role="button"]').forEach(el => {
      const txt = (el.textContent || '').trim().toUpperCase();
      if(['◀','▲','▼','▶','⬅','⬆','⬇','➡','VỒ','VO'].includes(txt)){
        el.dataset.lrHiddenBtn = el.style.display || '';
        el.style.display = 'none';
      }
    });
  }

  function restoreMobileControlsDOM(){
    if(customMobileStyle){
      customMobileStyle.remove();
      customMobileStyle = null;
    }
    document.querySelectorAll('[data-lr-hidden-btn]').forEach(el => {
      el.style.display = el.dataset.lrHiddenBtn;
      delete el.dataset.lrHiddenBtn;
    });
  }

  function clampIn(e, rad){
    const m = rad + 6*u;
    e.x = clamp(e.x, arena.x0 + m, arena.x1 - m);
    e.y = clamp(e.y, arena.y0 + m, arena.y1 - m);
  }
  function pushOut(e, rad){
    for(const o of obs){
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx,dy) || 1, min = o.r*.85 + rad;
      if(d < min){ e.x = o.x + dx/d*min; e.y = o.y + dy/d*min; }
    }
    clampIn(e, rad);
  }
  function freePoint(rad){
    for(let i=0;i<12;i++){
      const x = rnd(arena.x0+30*u, arena.x1-30*u), y = rnd(arena.y0+30*u, arena.y1-30*u);
      if(!obs.every(o=> Math.hypot(x-o.x,y-o.y) > o.r + rad + 14*u)) continue;
      return {x,y};
    }
    return {x:(arena.x0+arena.x1)/2, y:(arena.y0+arena.y1)/2};
  }

  function enter(){
    ctx = G.ctx; resize();
    clock = 0; left = TIME; caught = 0; misses = 0; done = false; shake = 0;
    pops = []; bits = []; ripples = []; eggs = []; rings = [];
    aim = null; stackMul = 1;
    joy.usedOnce = false;
    diveBtn.pressed = false; diveBtn.id = null;
    resetJoy();
    P = {
      x:(arena.x0+arena.x1)/2, y:arena.y1 - 50*u, r:14*u,
      dir:-Math.PI/2, face:1, walk:0, diveT:0, diveCd:0, stun:0, hit:false,
      crowFreeze:0, slowT:0
    };
    chickens = [];
    spawnAll();
    addPop(W/2, G.top + 60*u, 'Bắt ' + N_TOTAL + ' con gà!', '#9d2118');
    hud();

    setupMobileControlsDOM();
    const cv = ctx && ctx.canvas;
    if(cv){
      cv.addEventListener('touchstart', onTouchStart, {passive: false});
      window.addEventListener('touchmove', onTouchMove, {passive: false});
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchcancel', onTouchEnd);
    }
  }

  function exit(){
    restoreMobileControlsDOM();
    const cv = ctx && ctx.canvas;
    if(cv){
      cv.removeEventListener('touchstart', onTouchStart);
    }
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    resetJoy();
    diveBtn.pressed = false; diveBtn.id = null;
  }

  function spawnAll(){
    const aw = arena.x1 - arena.x0, ah = arena.y1 - arena.y0;
    const types = ['rooster','hen','rooster','hen','hen','rooster','hen','rooster','hen','hen'];
    for(let i=0;i<N_TOTAL;i++){
      const tp = types[i % types.length];
      const fx = 0.12 + 0.76 * (i + 0.5) / N_TOTAL;
      const fy = 0.15 + Math.random() * 0.35;
      const c = {
        type:tp,
        x: arena.x0 + aw*fx, y: arena.y0 + ah*fy, r:12*u,
        base: tp === 'rooster' ? 168 : 150,
        stamina:1, tired:0, burst:0, burstCd:rnd(.3,1), burstDir:1,
        vx:0, vy:0, face:1, ph:rnd(0,TAU), wt:0, tx:0, ty:0,
        lastCluck:-9, fleeing:false, caught:false,
        dodgeCd:0, dodgeTimer:0, dodgeX:0, dodgeY:0,
        peckCd:0, peckTimer:0, angry:0,
        flyTimer:0, flyCd:0, flyDir:0, flySp:0, wingPhase:0,
        /* gáy */
        crowCd: rnd(CROW_CD_MIN, CROW_CD_MAX),
        crowWindup: 0, crowActive: 0,
        /* đẻ trứng */
        eggCd: rnd(EGG_CD_MIN, EGG_CD_MAX),
        layFlash: 0
      };
      const fp = freePoint(c.r); c.tx = fp.x; c.ty = fp.y; c.wt = rnd(1.5,3.5);
      pushOut(c, c.r);
      chickens.push(c);
    }
  }

  function hud(){
    G.hud.set([
      {l:'Gà', v: caught + '/' + N_TOTAL},
      {l:'Giờ', v: Math.max(0, Math.ceil(left)), w: left <= 10}
    ]);
  }

  const addPop = (x,y,text,color)=> pops.push({x,y,text,color,t:0});
  function feathers(x,y,col){
    for(let i=0;i<9;i++){
      const a = rnd(0,TAU), s = rnd(50,170)*u;
      bits.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,rot:rnd(0,TAU),vr:rnd(-10,10),t:0,life:.9,col});
    }
  }
  function vibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

  /* ── GÀ TRỐNG GÁY ── */
  function fireCrow(c){
    rings.push({ x: c.x, y: c.y, t:0, life: 0.85 });
    addPop(c.x, c.y - 44*u, 'CỤC TÁC!', '#c8352b');
    Sound.sfx.cluck();
    if(Sound.sfx.dive) Sound.sfx.dive();
    vibrate(60);
    if(!reduceMotion) shake = Math.max(shake, .3);

    const d = Math.hypot(P.x - c.x, P.y - c.y);
    if(d < CROW_RANGE * u && P.crowFreeze <= 0){
      P.crowFreeze = CROW_FREEZE;
      P.diveT = 0; P.diveCd = DIVE_CD;
      P.stun = 0;
      addPop(P.x, P.y - 42*u, 'Đứng hình!', '#c62828');
    }
  }

  /* ── GÀ MÁI ĐẺ TRỨNG ── */
  function layEgg(c){
    if(eggs.length >= EGG_MAX) return;
    const behind = -c.face;
    for(let t = 0; t < 6; t++){
      const ex = c.x + behind * rnd(8, 20) * u + rnd(-4, 4) * u;
      const ey = c.y + rnd(6, 16) * u;
      if(!obs.every(o => Math.hypot(ex - o.x, ey - o.y) > o.r + EGG_R * u + 6 * u)) continue;
      if(Math.hypot(ex - P.x, ey - P.y) < 30 * u) continue;
      if(!eggs.every(e => Math.hypot(ex - e.x, ey - e.y) > e.r + EGG_R * u + 4 * u)) continue;
      eggs.push({ x: ex, y: ey, r: EGG_R * u, t: 0, life: EGG_LIFE, ph: rnd(0, TAU) });
      c.layFlash = 0.4;
      addPop(c.x, c.y - 22 * u, 'Đẻ trứng!', '#f39c12');
      Sound.sfx.cluck();
      return;
    }
  }

  function tryDive(angle){
    if(P.stun > 0 || P.diveT > 0 || P.diveCd > 0 || P.crowFreeze > 0) return;

    for(const c of chickens){
      if(c.caught || c.tired > 0 || c.flyTimer > 0) continue;
      if(c.dodgeCd > 0) continue;
      if(c.crowWindup > 0 || c.crowActive > 0) continue;
      const dxc = c.x - P.x, dyc = c.y - P.y;
      const dc = Math.hypot(dxc, dyc);
      if(dc > DODGE_RANGE*u) continue;
      const a2c = Math.atan2(dyc, dxc);
      if(Math.abs(normAngle(a2c - angle)) > 0.75) continue;
      if(Math.random() > DODGE_CHANCE) continue;

      const side = Math.random() < .5 ? 1 : -1;
      const perp = a2c + side * Math.PI/2;
      c.dodgeX = Math.cos(perp);
      c.dodgeY = Math.sin(perp);
      c.dodgeTimer = 0.32;
      c.dodgeCd = DODGE_CD;
      if(c.x - arena.x0 < 50*u) c.dodgeX = Math.abs(c.dodgeX);
      if(arena.x1 - c.x < 50*u) c.dodgeX = -Math.abs(c.dodgeX);
      if(c.y - arena.y0 < 50*u) c.dodgeY = Math.abs(c.dodgeY);
      if(arena.y1 - c.y < 50*u) c.dodgeY = -Math.abs(c.dodgeY);
      const l = Math.hypot(c.dodgeX, c.dodgeY) || 1;
      c.dodgeX /= l; c.dodgeY /= l;
      addPop(c.x, c.y - 22*u, 'Né!', '#f39c12');
    }

    P.dir = angle; P.diveT = DIVE_T; P.hit = false;
    if(Math.abs(Math.cos(angle)) > .2) P.face = Math.cos(angle) > 0 ? 1 : -1;
    Sound.sfx.dive();
  }

  function triggerDiveAt(x, y){
    if(!P || P.stun > 0 || P.diveT > 0 || P.diveCd > 0 || P.crowFreeze > 0) return;
    const dx0 = x - P.x, dy0 = y - P.y;
    const near = (12*u)*(12*u);

    if(dx0*dx0 + dy0*dy0 < near){
      aim = P.dir;
    } else {
      let target = null, bestD = Infinity;
      const maxR = TAP_ASSIST_R * u;
      for(const c of chickens){
        if(c.caught) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if(d < bestD && d < maxR){ bestD = d; target = c; }
      }
      if(target){
        const lead = 0.09;
        const tx = target.x + target.vx * lead;
        const ty = target.y + target.vy * lead;
        aim = Math.atan2(ty - P.y, tx - P.x);
      } else {
        aim = Math.atan2(dy0, dx0);
      }
    }
    ripples.push({x, y, t:0});
  }

  function pointerDown(x, y){
    if(isMobile){
      // Trên mobile, sự kiện touch đã được xử lý riêng qua Multi-touch (onTouchStart)
      if(isOnDiveBtn(x, y)){
        triggerButtonDive();
        return;
      }
      if(isLeftHalfZone(x, y)) return;
    }
    triggerDiveAt(x, y);
  }

  function updateChicken(c, dt){
    c.dodgeCd = Math.max(0, c.dodgeCd - dt);
    c.peckCd  = Math.max(0, c.peckCd  - dt);
    c.angry   = Math.max(0, c.angry   - dt);
    c.flyCd   = Math.max(0, c.flyCd   - dt);
    c.layFlash = Math.max(0, c.layFlash - dt);

    /* ═══════ GÀ TRỐNG GÁY ═══════ */
    if(c.type === 'rooster'){
      c.crowCd = Math.max(0, c.crowCd - dt);

      if(c.crowActive > 0){
        c.crowActive -= dt;
        c.vx = 0; c.vy = 0;
        c.wingPhase += dt * 30;
        return;
      }
      if(c.crowWindup > 0){
        c.crowWindup -= dt;
        c.vx = 0; c.vy = 0;
        if(c.crowWindup <= 0){
          c.crowActive = CROW_ACTIVE;
          c.crowWindup = 0;
          fireCrow(c);
        }
        return;
      }
      if(c.crowCd <= 0){
        const dp = Math.hypot(P.x - c.x, P.y - c.y);
        if(dp < CROW_RANGE * u * CROW_TRIGGER && P.crowFreeze <= 0){
          c.crowWindup = CROW_WINDUP;
          c.crowCd = rnd(CROW_CD_MIN, CROW_CD_MAX);
          addPop(c.x, c.y - 34*u, 'Sắp gáy!', '#c8352b');
          Sound.sfx.cluck();
          vibrate(15);
        }
      }
    }

    /* ═══════ GÀ MÁI ĐẺ TRỨNG ═══════ */
    if(c.type === 'hen'){
      c.eggCd = Math.max(0, c.eggCd - dt);
      if(c.eggCd <= 0 && c.flyTimer <= 0 && c.dodgeTimer <= 0 && !c.tired){
        if(Math.hypot(c.vx, c.vy) < 120 * u || Math.random() < 0.6){
          layEgg(c);
          c.eggCd = rnd(EGG_CD_MIN, EGG_CD_MAX);
        } else {
          c.eggCd = 0.3;
        }
      }
    }

    /* ── ĐANG BAY ── */
    if(c.flyTimer > 0){
      c.flyTimer -= dt;
      c.wingPhase += dt * 26;

      const k = Math.min(1, c.flyTimer / 0.12);
      const spd = c.flySp * u * k;
      c.vx = Math.cos(c.flyDir) * spd;
      c.vy = Math.sin(c.flyDir) * spd;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if(Math.abs(c.vx) > 6*u) c.face = c.vx > 0 ? 1 : -1;
      pushOut(c, c.r);

      if(!reduceMotion && Math.random() < .55){
        bits.push({
          x: c.x - Math.cos(c.flyDir)*10*u + rnd(-3,3)*u,
          y: c.y - Math.sin(c.flyDir)*10*u + rnd(-3,3)*u,
          vx: -Math.cos(c.flyDir)*rnd(20,50)*u + rnd(-15,15)*u,
          vy: -Math.sin(c.flyDir)*rnd(20,50)*u + rnd(-15,15)*u,
          rot: rnd(0,TAU), vr: rnd(-4,4), t:0, life:.55,
          col: 'rgba(200,175,120,.85)'
        });
      }

      if(c.flyTimer <= 0){
        c.flyTimer = 0; c.vx *= 0.25; c.vy *= 0.25;
        c.tired = FLY_RECOVER_T;
        c.stamina = Math.max(0, c.stamina - .1);
        feathers(c.x, c.y - 4*u, c.type === 'rooster' ? '#d9692a' : '#f3e6c4');
        vibrate(20);
      }
      return;
    }

    /* ── ĐANG NÉ ── */
    if(c.dodgeTimer > 0){
      c.dodgeTimer -= dt;
      const k = Math.min(1, dt*20);
      c.vx += (c.dodgeX * 270*u - c.vx) * k;
      c.vy += (c.dodgeY * 270*u - c.vy) * k;
      c.x += c.vx*dt; c.y += c.vy*dt;
      if(Math.abs(c.vx) > 6*u) c.face = c.vx > 0 ? 1 : -1;
      pushOut(c, c.r);
      c.fleeing = true;
      return;
    }

    /* ── Kích hoạt bay ── */
    if(!c.tired && c.stamina > FLY_STAM_GATE){
      const dxp = c.x - P.x, dyp = c.y - P.y, dp = Math.hypot(dxp,dyp) || 1;
      const range = (c.type === 'rooster' ? FLY_RANGE_ROO : FLY_RANGE_HEN) * u;
      if(dp < range && c.flyCd <= 0){
        const rooster = c.type === 'rooster';
        let flyAng = Math.atan2(dyp, dxp) + rnd(-0.5, 0.5);
        const cx = (arena.x0+arena.x1)/2, cy = (arena.y0+arena.y1)/2;
        const toCenter = Math.atan2(cy - c.y, cx - c.x);
        const wallMargin = 70*u;
        const nearWall = (c.x - arena.x0 < wallMargin) || (arena.x1 - c.x < wallMargin) ||
                         (c.y - arena.y0 < wallMargin) || (arena.y1 - c.y < wallMargin);
        if(nearWall) flyAng = flyAng*0.35 + toCenter*0.65;

        c.flyDir = flyAng;
        c.flyTimer = rooster ? FLY_T_ROO : FLY_T_HEN;
        c.flySp    = rooster ? FLY_SP_ROO : FLY_SP_HEN;
        c.flyCd    = rooster ? FLY_CD_ROO : FLY_CD_HEN;
        c.stamina -= FLY_STAM_COST;
        c.burst = 0;
        c.wingPhase = 0;

        addPop(c.x, c.y - 26*u, 'Bay!', '#2f7d57');
        Sound.sfx.cluck();
        if(Sound.sfx.dive) Sound.sfx.dive();
        vibrate(15);

        for(let i=0;i<6;i++){
          const a = rnd(0,TAU);
          bits.push({
            x: c.x, y: c.y + 6*u,
            vx: Math.cos(a)*rnd(30,90)*u, vy: Math.sin(a)*rnd(30,90)*u - 30*u,
            rot: rnd(0,TAU), vr: rnd(-6,6), t:0, life:.5,
            col: 'rgba(200,175,120,.8)'
          });
        }
        return;
      }
    }

    /* ── AI chạy trốn / lang thang ── */
    const dx = c.x - P.x, dy = c.y - P.y, d = Math.hypot(dx,dy) || 1;
    const scare = (c.type === 'rooster' ? 255 : 225) * u;
    let tx, ty, speed;
    let fleeing = false;

    if(c.tired > 0){
      c.tired -= dt; c.stamina = Math.min(1, c.stamina + dt*.18);
      speed = 42*u;
      if(d < 100*u){ tx = dx/d; ty = dy/d; } else { tx = 0; ty = 0; speed = 0; }
    } else if(d < scare){
      fleeing = true;
      let ax = dx/d, ay = dy/d;
      const m = 70*u;
      if(c.x - arena.x0 < m) ax += (1 - (c.x - arena.x0)/m) * 1.7;
      if(arena.x1 - c.x < m) ax -= (1 - (arena.x1 - c.x)/m) * 1.7;
      if(c.y - arena.y0 < m) ay += (1 - (c.y - arena.y0)/m) * 1.7;
      if(arena.y1 - c.y < m) ay -= (1 - (arena.y1 - c.y)/m) * 1.7;
      for(const o of obs){
        const odx = c.x - o.x, ody = c.y - o.y, od = Math.hypot(odx,ody) || 1, rng = o.r + c.r + 55*u;
        if(od < rng){ const k = (1 - od/rng) * 1.5; ax += odx/od*k; ay += ody/od*k; }
      }
      c.burstCd -= dt;
      if(c.burstCd <= 0 && d < 120*u){
        c.burst = .25; c.burstDir = Math.random() < .5 ? 1 : -1;
        c.burstCd = rnd(.7, 1.3);
      }
      if(c.burst > 0){
        c.burst -= dt;
        const a = c.burstDir * 1.0, ca = Math.cos(a), sa = Math.sin(a);
        const nx = ax*ca - ay*sa, ny = ax*sa + ay*ca; ax = nx; ay = ny;
      }
      const l = Math.hypot(ax,ay) || 1; tx = ax/l; ty = ay/l;
      const panic = chickens.length === 1 ? PANIC_MUL : 1;
      speed = c.base * stackMul * panic * (c.burst > 0 ? 1.7 : 1) * (1 + .25*(1 - d/scare));
      c.stamina -= dt * (c.burst > 0 ? .5 : .22);
      if(c.stamina <= 0){ c.stamina = 0; c.tired = 1.0; }
    } else {
      c.stamina = Math.min(1, c.stamina + dt*.3);
      c.wt -= dt;
      const wd = Math.hypot(c.tx - c.x, c.ty - c.y);
      if(wd < 14*u || c.wt <= 0){
        const fp = freePoint(c.r); c.tx = fp.x; c.ty = fp.y; c.wt = rnd(1.5,3.5);
      }
      const l = Math.hypot(c.tx - c.x, c.ty - c.y) || 1;
      tx = (c.tx - c.x)/l; ty = (c.ty - c.y)/l;
      speed = 55;
    }

    const k = Math.min(1, dt*10);
    c.vx += (tx*speed*u - c.vx) * k;
    c.vy += (ty*speed*u - c.vy) * k;
    c.x += c.vx*dt; c.y += c.vy*dt;
    if(Math.abs(c.vx) > 6*u) c.face = c.vx > 0 ? 1 : -1;
    pushOut(c, c.r);

    /* ── Gà trống phản công ── */
    if(c.type === 'rooster' && !fleeing && d < PECK_RANGE*u
       && P.diveT <= 0 && P.diveCd <= 0.05 && P.stun <= 0 && P.crowFreeze <= 0
       && c.crowWindup <= 0 && c.crowActive <= 0){
      c.peckTimer += dt;
      if(c.peckTimer > PECK_DELAY && c.peckCd <= 0){
        const pushAng = Math.atan2(P.y - c.y, P.x - c.x);
        P.x += Math.cos(pushAng) * 55*u;
        P.y += Math.sin(pushAng) * 55*u;
        pushOut(P, P.r);
        P.stun = 0.55;
        c.peckCd = PECK_CD;
        c.peckTimer = 0;
        c.angry = 0.6;
        addPop(P.x, P.y - 34*u, 'Bị mổ!', '#c62828');
        Sound.sfx.thud(); vibrate(50);
        if(!reduceMotion) shake = Math.max(shake, .18);
      }
    } else {
      c.peckTimer = 0;
    }

    if(fleeing && !c.fleeing && clock - c.lastCluck > 1.6){
      Sound.sfx.cluck(); c.lastCluck = clock;
    }
    c.fleeing = fleeing;
  }

  /* ── Lấy vector di chuyển kết hợp từ Floating Joystick & Bàn phím ── */
  function getMoveVec(){
    if(joy.active && joy.m > 0){
      return { x: joy.vx * joy.m, y: joy.vy * joy.m, m: joy.m };
    }
    return Input.vec();
  }

  function update(dt){
    clock += dt; left -= dt;
    const act = Input.consumeAct();
    if(left <= 0){ left = 0; hud(); return lose(); }

    P.diveCd = Math.max(0, P.diveCd - dt);
    P.slowT  = Math.max(0, P.slowT - dt);

    /* ── DẪM TRỨNG ── */
    for(let i = eggs.length - 1; i >= 0; i--){
      const e = eggs[i];
      if(Math.hypot(e.x - P.x, e.y - P.y) < e.r + P.r){
        eggs.splice(i, 1);
        P.slowT = EGG_SLOW_T;
        addPop(P.x, P.y - 36*u, 'Dẫm trứng! Chậm!', '#f39c12');
        for(let k=0;k<8;k++){
          const a = rnd(0,TAU), s = rnd(50,150)*u;
          bits.push({
            x: e.x, y: e.y,
            vx: Math.cos(a)*s, vy: Math.sin(a)*s - 50*u,
            rot: rnd(0,TAU), vr: rnd(-8,8), t:0, life:.65,
            col: '#f7e58a'
          });
        }
        Sound.sfx.thud(); vibrate(25);
      }
    }

    /* ── PLAYER UPDATE ── */
    if(P.crowFreeze > 0){
      P.crowFreeze -= dt;
      P.walk = 0;
    } else if(P.stun > 0){
      P.stun -= dt; aim = null;
    } else if(P.diveT > 0){
      P.x += Math.cos(P.dir) * DIVE_SP * u * dt;
      P.y += Math.sin(P.dir) * DIVE_SP * u * dt;
      pushOut(P, P.r);

      for(const c of chickens){
        if(c.caught) continue;
        if(Math.hypot(c.x - P.x, c.y - P.y) < P.r + c.r + 8*u){
          c.caught = true; caught++; P.hit = true;
          stackMul *= STACK_MUL;
          feathers(c.x, c.y, c.type === 'rooster' ? '#d9692a' : '#f3e6c4');
          addPop(c.x, c.y - 24*u, 'Bắt được gà!', '#0f7a43');
          Sound.sfx.catchOk(); vibrate(30);
        }
      }
      P.diveT -= dt;
      if(P.diveT <= 0){
        P.diveT = 0; P.diveCd = DIVE_CD;
        if(!P.hit){
          misses++; P.stun = STUN_T; left -= MISS_COST;
          if(!reduceMotion) shake = .25;
          addPop(P.x, P.y - 34*u, 'Vồ trượt! −' + MISS_COST + 's', '#c62828');
          Sound.sfx.thud(); vibrate(40);
        }
      }
      chickens = chickens.filter(c=> !c.caught);
      if(caught >= N_TOTAL){ hud(); return win(); }
    } else {
      const v = getMoveVec();
      const eggMul = P.slowT > 0 ? EGG_SLOW_MUL : 1;
      P.x += v.x * SP * u * eggMul * dt;
      P.y += v.y * SP * u * eggMul * dt;
      if(v.m){
        P.dir = Math.atan2(v.y, v.x);
        if(Math.abs(v.x) > .2) P.face = v.x > 0 ? 1 : -1;
        P.walk += dt * 12 * eggMul;
      }
      pushOut(P, P.r);
      if(aim !== null){ tryDive(aim); aim = null; }
      else if(act) triggerButtonDive(), (aim !== null && (tryDive(aim), aim = null));
    }

    for(const c of chickens) updateChicken(c, dt);

    /* ── Cập nhật trứng ── */
    for(const e of eggs){ e.t += dt; e.ph += dt; }
    eggs = eggs.filter(e => e.t < e.life);

    /* ── Cập nhật ring gáy ── */
    for(const r of rings) r.t += dt;
    rings = rings.filter(r => r.t < r.life);

    for(const q of pops) q.t += dt;
    pops = pops.filter(q=> q.t < 1.1);
    for(const r of ripples) r.t += dt;
    ripples = ripples.filter(r=> r.t < 0.35);
    for(const b of bits){
      b.t += dt; b.x += b.vx*dt; b.y += b.vy*dt;
      b.vx *= .95; b.vy *= .95; b.rot += b.vr*dt;
    }
    bits = bits.filter(b=> b.t < b.life);
    shake = Math.max(0, shake - dt);
    hud();
  }

  function win(){
    if(done) return; done = true;
    const t = Math.max(0, Math.round(left));
    const stars = left >= 22 ? 3 : left >= 10 ? 2 : 1;
    G.finish({
      win:true, score: Math.round(left*10), stars,
      title:'Bắt đủ gà rồi!',
      msg:'Nhà vợ khen chàng rể nhanh tay nhanh chân.',
      rows:[['Thời gian còn lại', t + ' giây'], ['Số lần vồ trượt', misses]]
    });
  }
  function lose(){
    if(done) return; done = true;
    G.finish({
      win:false, score: null,
      title:'Hết giờ!',
      msg:'Còn ' + (N_TOTAL - caught) + ' con chưa bắt được.',
      rows:[
        ['Gà đã bắt', caught + '/' + N_TOTAL],
        ['Số lần vồ trượt', misses]
      ]
    });
  }

  /* ── Vẽ nền ── */
  function drawGround(){
    ctx.fillStyle = '#d9c08a'; ctx.fillRect(0,0,W,H);
    const {x0,y0,x1,y1} = arena;
    ctx.fillStyle = '#ecdcae'; ctx.fillRect(x0,y0,x1-x0,y1-y0);
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for(const t of tufts){
      ctx.strokeStyle = t.c; ctx.beginPath();
      ctx.moveTo(t.x-4*u*t.s, t.y); ctx.lineTo(t.x-2*u*t.s, t.y-6*u*t.s);
      ctx.moveTo(t.x, t.y);         ctx.lineTo(t.x, t.y-8*u*t.s);
      ctx.moveTo(t.x+4*u*t.s, t.y); ctx.lineTo(t.x+2*u*t.s, t.y-6*u*t.s);
      ctx.stroke();
    }
    const th = 11*u;
    ctx.fillStyle = '#a8743a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillRect(x0-th, y0-th, x1-x0+2*th, th); ctx.strokeRect(x0-th, y0-th, x1-x0+2*th, th);
    ctx.fillRect(x0-th, y1, x1-x0+2*th, th);    ctx.strokeRect(x0-th, y1, x1-x0+2*th, th);
    ctx.fillRect(x0-th, y0, th, y1-y0);         ctx.strokeRect(x0-th, y0, th, y1-y0);
    ctx.fillRect(x1, y0, th, y1-y0);            ctx.strokeRect(x1, y0, th, y1-y0);
    ctx.fillStyle = '#7d5226';
    for(let x=x0; x<=x1; x+=26*u){
      ctx.fillRect(x-2*u, y0-th-3*u, 4*u, th+6*u);
      ctx.fillRect(x-2*u, y1-3*u,    4*u, th+6*u);
    }
    for(let y=y0; y<=y1; y+=26*u){
      ctx.fillRect(x0-th-3*u, y-2*u, th+6*u, 4*u);
      ctx.fillRect(x1-3*u,    y-2*u, th+6*u, 4*u);
    }
  }

  function drawObstacle(o){
    ctx.save(); ctx.translate(o.x,o.y); ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ctx.fillStyle = 'rgba(0,0,0,.15)';
    ctx.beginPath(); ctx.ellipse(4*u, o.r*.7, o.r, o.r*.45, 0, 0, TAU); ctx.fill();
    if(o.t === 'hay'){
      ctx.fillStyle = '#e6b422';
      ctx.beginPath(); ctx.moveTo(-o.r, o.r*.6);
      ctx.quadraticCurveTo(-o.r*.9, -o.r*.9, 0, -o.r*1.1);
      ctx.quadraticCurveTo(o.r*.9, -o.r*.9, o.r, o.r*.6);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#a77f12'; ctx.lineWidth = 1.5;
      for(let i=-2;i<=2;i++){
        ctx.beginPath();
        ctx.moveTo(i*o.r*.3, -o.r*.9 + Math.abs(i)*o.r*.15);
        ctx.lineTo(i*o.r*.42, o.r*.55);
        ctx.stroke();
      }
    } else if(o.t === 'jar'){
      ctx.fillStyle = '#7a4a2a';
      ctx.beginPath(); ctx.ellipse(0, 0, o.r*.9, o.r, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2f4a7a';
      ctx.beginPath(); ctx.ellipse(0, -o.r*.75, o.r*.6, o.r*.22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#3f7d4e';
      for(let i=-2;i<=2;i++){
        ctx.save(); ctx.rotate(i*.45);
        ctx.beginPath(); ctx.ellipse(0, -o.r*.55, o.r*.22, o.r*.8, 0, 0, TAU);
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.restore();
  }

  /* ── Vẽ trứng ── */
  function drawEgg(e){
    const k = e.t / e.life;
    const aboutExpire = k > 0.72;
    const alpha = aboutExpire ? 0.9 - 0.5 * Math.sin(clock * 20) * (k - 0.72) / 0.28 : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, alpha);

    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 5*u, 7*u, 2.6*u, 0, 0, TAU); ctx.fill();

    const wob = reduceMotion ? 0 : Math.sin(e.ph * 3) * 0.6 * u;
    ctx.translate(e.x, e.y + wob);

    ctx.fillStyle = '#f6efd8';
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7*u, 9*u, 0, 0, TAU);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath();
    ctx.ellipse(-2*u, -2.5*u, 2.4*u, 3.2*u, -0.35, 0, TAU);
    ctx.fill();

    if(aboutExpire){
      ctx.strokeStyle = 'rgba(160, 60, 30, .75)'; ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-4*u, -3*u); ctx.lineTo(-2*u, -1*u);
      ctx.lineTo(-4*u, 1*u); ctx.lineTo(-2*u, 3*u);
      ctx.moveTo(2*u, -4*u); ctx.lineTo(3*u, -1*u);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ── Vẽ gà (có cánh, có gáy) ── */
  function drawChicken(c){
    const flying = c.flyTimer > 0;
    const crowing = c.crowActive > 0;
    const warning = c.crowWindup > 0;
    const lift = flying ? 9*u * Math.min(1, c.flyTimer/0.15) : 0;
    const crowShake = crowing && !reduceMotion ? rnd(-1,1) * 1.4*u : 0;

    ctx.save(); ctx.translate(c.x + crowShake, c.y);

    ctx.save();
    if(flying){
      ctx.globalAlpha = 0.5 + 0.4 * Math.min(1, c.flyTimer/0.15);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(0, 11*u, 9*u, 3.5*u, 0, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.beginPath(); ctx.ellipse(0, 11*u, 14*u, 5*u, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();

    const sp = Math.hypot(c.vx, c.vy);
    const run = sp > 20*u || flying;
    const bob = flying
      ? Math.sin(c.wingPhase * 0.8) * 1.5*u
      : (crowing
          ? Math.sin(clock * 22) * 1.2*u
          : (run
              ? Math.sin(clock*(c.burst > 0 || c.dodgeTimer > 0 ? 34 : 22) + c.ph)*2*u
              : (c.tired > 0 ? Math.sin(clock*14)*1.2*u : 0)));
    ctx.translate(0, bob - lift);
    ctx.scale(u*c.face, u);
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    const rooster = c.type === 'rooster';

    if(flying){
      const flap = Math.sin(c.wingPhase);
      ctx.save();
      ctx.translate(-3, -2);
      ctx.rotate(-flap * 0.6);
      ctx.fillStyle = rooster ? '#b34a1e' : '#d9c18a';
      ctx.beginPath();
      ctx.ellipse(-9, -1, 11, 4.5, -0.35, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    if(rooster){
      const cols = ['#2f7d57','#c8352b','#e6b422'];
      for(let i=0;i<3;i++){
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(-9,-1);
        ctx.quadraticCurveTo(-24 - i*2, -14 + i*5, -20 + i*3, -22 + i*2);
        ctx.quadraticCurveTo(-12, -8, -9, 3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#c9a15a';
      ctx.beginPath();
      ctx.moveTo(-9,0); ctx.quadraticCurveTo(-19,-6,-17,-12);
      ctx.quadraticCurveTo(-11,-6,-8,4); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    const sw = run && !flying ? Math.sin(clock*(c.burst > 0 ? 34 : 22) + c.ph)*5 : 0;
    ctx.strokeStyle = '#c98a1a'; ctx.lineWidth = 2;
    if(flying){
      ctx.beginPath();
      ctx.moveTo(-2,8); ctx.lineTo(-4,13);
      ctx.moveTo(4,8);  ctx.lineTo(6,13);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-2,8); ctx.lineTo(-2+sw,15);
      ctx.moveTo(4,8);  ctx.lineTo(4-sw,15);
      ctx.stroke();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;

    ctx.fillStyle = rooster ? '#d9692a' : '#f6ecd0';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = rooster ? '#a8431a' : '#e3cf9a';
    ctx.beginPath(); ctx.ellipse(-2, 1, 7, 5, -.2, 0, TAU); ctx.fill(); ctx.stroke();

    const headUp = (crowing || warning) ? -3 : 0;
    ctx.fillStyle = rooster ? '#d9692a' : '#f6ecd0';
    ctx.beginPath(); ctx.arc(11, -7 + headUp, 5.5, 0, TAU); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#c8352b';
    for(let i=0;i<3;i++){
      ctx.beginPath();
      ctx.arc(9 + i*2.4, -12.6 + (i===1?-1.2:0) + headUp, 2.3, 0, TAU);
      ctx.fill(); ctx.stroke();
    }

    ctx.fillStyle = '#e6b422';
    const open = crowing ? 6 : (warning ? 4 : (c.tired > 0 ? 3 : (c.angry > 0 ? 4 : 0)));
    ctx.beginPath();
    ctx.moveTo(15.5, -8 - open*.4 + headUp);
    ctx.lineTo(21, -7 + headUp);
    ctx.lineTo(15.5, -6 + open + headUp);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#c8352b';
    ctx.beginPath(); ctx.ellipse(14.2, -3 + headUp, 1.8, 2.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = INK;
    if(crowing){
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(11.5, -8 + headUp); ctx.lineTo(13.5, -8 + headUp);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(12.5, -8 + headUp, 1.2, 0, TAU); ctx.fill();
    }

    if(c.angry > 0 || (rooster && c.peckTimer > PECK_DELAY*0.5)){
      ctx.strokeStyle = '#8a1a10'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8.5, -11.5 + headUp); ctx.lineTo(13.5, -10 + headUp);
      ctx.stroke();
    }

    if(flying){
      const flap = Math.sin(c.wingPhase);
      ctx.save();
      ctx.translate(0, -1);
      ctx.rotate(flap * 0.7);
      ctx.fillStyle = rooster ? '#e07a34' : '#f0dca8';
      ctx.beginPath();
      ctx.ellipse(-4, -3, 12, 5, -0.4, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = rooster ? '#8a3010' : '#b99a55';
      ctx.lineWidth = 1.2;
      for(let i=-1;i<=1;i++){
        ctx.beginPath();
        ctx.moveTo(-6 + i*3, -6);
        ctx.lineTo(-10 + i*3, 0);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    }

    if(c.layFlash > 0){
      ctx.save();
      ctx.globalAlpha = c.layFlash / 0.4 * 0.7;
      ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    if(warning){
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock * 30);
      ctx.fillStyle = '#c8352b';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.font = '900 ' + Math.round(26*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeText('!!', c.x, c.y - 28*u);
      ctx.fillText('!!', c.x, c.y - 28*u);
      ctx.restore();
    }

    if(crowing){
      ctx.save();
      const kk = 1 - c.crowActive / CROW_ACTIVE;
      ctx.globalAlpha = (1 - kk) * 0.8;
      ctx.strokeStyle = '#c8352b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y - 6*u, 18*u + kk * 22*u, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    if(rooster && !flying && !warning && !crowing && c.peckTimer > PECK_DELAY*0.5 && c.peckCd <= 0){
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4*Math.sin(clock*20);
      ctx.fillStyle = '#ff3b1f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.font = '900 ' + Math.round(22*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeText('!', c.x, c.y - 22*u);
      ctx.fillText('!', c.x, c.y - 22*u);
      ctx.restore();
    }

    if(c.tired > 0 && !flying){
      ctx.save();
      ctx.translate(c.x + c.face*14*u, c.y - 20*u + Math.sin(clock*8)*2*u);
      ctx.fillStyle = '#5aa0e0'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -6*u);
      ctx.quadraticCurveTo(5*u, 0, 0, 4*u);
      ctx.quadraticCurveTo(-5*u, 0, 0, -6*u);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Vẽ ring gáy (sóng âm thanh) ── */
  function drawCrowRing(r){
    const k = r.t / r.life;
    ctx.save();
    for(let i = 0; i < 3; i++){
      const offset = i * 0.15;
      if(k < offset) continue;
      const kk = (k - offset) / (1 - offset);
      ctx.globalAlpha = (1 - kk) * 0.85;
      ctx.strokeStyle = '#f4ead2';
      ctx.lineWidth = 4 * (1 - kk) + 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 22*u + kk * CROW_RANGE * u * 0.9, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── Vẽ player ── */
  function drawPlayer(){
    const p = P;
    const frozen = p.crowFreeze > 0;
    const slow = p.slowT > 0;

    ctx.save();
    if(frozen && !reduceMotion){
      ctx.translate(p.x + rnd(-1,1)*1.6*u, p.y);
    } else {
      ctx.translate(p.x, p.y);
    }

    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(0, 18*u, 15*u, 5*u, 0, 0, TAU); ctx.fill();

    if(frozen){
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(clock * 24);
      ctx.strokeStyle = '#c8352b'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 28*u, 0, TAU); ctx.stroke();
      ctx.restore();
    } else if(slow){
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock * 14);
      ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 26*u, 0, TAU); ctx.stroke();
      ctx.restore();
    } else if(p.stun > 0){
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 26*u, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.lineJoin = 'round';

    if(frozen){
      ctx.scale(u*p.face, u);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4,10); ctx.lineTo(-4,19);
      ctx.moveTo(4,10);  ctx.lineTo(4,19);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.fillStyle = '#c8352b';
      ctx.beginPath();
      ctx.moveTo(-8,-6); ctx.lineTo(8,-6); ctx.lineTo(11,14); ctx.lineTo(-11,14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e6b422';
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.arc(0, -2 + i*5, 1.4, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#f0c48f'; ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-6,-6); ctx.lineTo(-14,-18);
      ctx.moveTo(6,-6);  ctx.lineTo(14,-18);
      ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillStyle = '#f0c48f';
      ctx.beginPath(); ctx.arc(0, -13, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; rrect(-7,-24,16,8,3); ctx.fill();
      ctx.fillStyle = '#e6b422'; ctx.fillRect(-7,-17,16,2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-3, -13); ctx.lineTo(-1, -13);
      ctx.moveTo(1, -13);  ctx.lineTo(3, -13);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(2, -9, 1.8, 0, TAU); ctx.stroke();
    } else if(p.stun > 0){
      ctx.scale(u*p.face, u);
      ctx.fillStyle = '#c8352b';
      ctx.beginPath(); ctx.ellipse(0, 8, 20, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0c48f';
      ctx.beginPath(); ctx.arc(22, 6, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(16, -1, 12, 5);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-18,10); ctx.lineTo(-30,14);
      ctx.moveTo(-18,6);  ctx.lineTo(-30,4);
      ctx.stroke();
      for(let i=0;i<3;i++){
        const a = clock*6 + i*2.1;
        ctx.fillStyle = '#e6b422';
        ctx.beginPath();
        ctx.arc(22 + Math.cos(a)*13, -10 + Math.sin(a)*4, 3, 0, TAU);
        ctx.fill(); ctx.stroke();
      }
    } else if(p.diveT > 0){
      ctx.rotate(p.dir); ctx.scale(u, u);
      ctx.fillStyle = '#c8352b';
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0c48f';
      ctx.beginPath(); ctx.arc(22, 0, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(20, 0, 7, -Math.PI*.6, Math.PI*.6, false); ctx.fill();
      ctx.strokeStyle = '#f0c48f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(10, -6); ctx.lineTo(36, -9);
      ctx.moveTo(10, 6);  ctx.lineTo(36, 9);
      ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-17,-3); ctx.lineTo(-32,-6);
      ctx.moveTo(-17,3);  ctx.lineTo(-32,6);
      ctx.stroke();
    } else {
      ctx.scale(u*p.face, u);
      const moving = getMoveVec().m;
      const walkSpd = slow ? 0.5 : 1;
      const sw = moving ? Math.sin(p.walk) * 6 * walkSpd : 0;
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4,10); ctx.lineTo(-4+sw,19);
      ctx.moveTo(4,10);  ctx.lineTo(4-sw,19);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.fillStyle = '#c8352b';
      ctx.beginPath();
      ctx.moveTo(-8,-6); ctx.lineTo(8,-6); ctx.lineTo(11,14); ctx.lineTo(-11,14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e6b422';
      for(let i=0;i<3;i++){
        ctx.beginPath(); ctx.arc(0, -2 + i*5, 1.4, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = '#f0c48f'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(6,-3); ctx.lineTo(11 - sw*.4, 5); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.fillStyle = '#f0c48f';
      ctx.beginPath(); ctx.arc(1, -13, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; rrect(-7,-24,16,8,3); ctx.fill();
      ctx.fillStyle = '#e6b422'; ctx.fillRect(-7,-17,16,2);
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(4, -13, 1.1, 0, TAU); ctx.fill();
    }
    ctx.restore();

    if(frozen){
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(clock * 24);
      ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.font = '900 ' + Math.round(24*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeText('!!', p.x, p.y - 38*u);
      ctx.fillText('!!', p.x, p.y - 38*u);
      ctx.restore();
    }

    if(slow && !frozen){
      ctx.save();
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(clock * 10);
      ctx.fillStyle = '#f39c12'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.font = '900 ' + Math.round(16*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.strokeText('SLOW', p.x, p.y - 36*u);
      ctx.fillText('SLOW', p.x, p.y - 36*u);
      ctx.restore();
    }
  }

  /* ── Vẽ Floating Joystick (Trái) & Nút VỒ (Phải) trên Mobile ── */
  function drawMobileControls(){
    if(!isMobile) return;

    /* 1. Vẽ nút VỒ ở góc dưới bên phải */
    ctx.save();
    const disabled = P && (P.stun > 0 || P.crowFreeze > 0 || P.diveCd > 0 || P.diveT > 0);
    const scale = diveBtn.pressed ? 0.92 : 1.0;

    ctx.translate(diveBtn.x, diveBtn.y);
    ctx.scale(scale, scale);

    // Đổ bóng nút VỒ
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.arc(0, 4 * u, diveBtn.r, 0, TAU);
    ctx.fill();

    // Nền nút VỒ
    ctx.globalAlpha = disabled ? 0.45 : 0.88;
    ctx.fillStyle = diveBtn.pressed ? '#9d2118' : '#c8352b';
    ctx.strokeStyle = '#f6efd8';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(0, 0, diveBtn.r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Vòng trong trang trí
    ctx.strokeStyle = 'rgba(230, 180, 34, 0.65)';
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.arc(0, 0, diveBtn.r * 0.82, 0, TAU);
    ctx.stroke();

    // Vòng hồi chiêu nếu đang cooldown
    if(P && P.diveCd > 0){
      const cdRatio = clamp(P.diveCd / DIVE_CD, 0, 1);
      ctx.strokeStyle = '#e6b422';
      ctx.lineWidth = 4 * u;
      ctx.beginPath();
      ctx.arc(0, 0, diveBtn.r, -Math.PI/2, -Math.PI/2 + TAU * (1 - cdRatio));
      ctx.stroke();
    }

    // Chữ "VỒ"
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 * u;
    ctx.font = '900 ' + Math.round(18 * u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('VỒ', 0, 1 * u);
    ctx.fillText('VỒ', 0, 1 * u);
    ctx.restore();

    /* 2. Vẽ Floating Joystick ở nửa bên trái */
    if(!joy.active){
      if(!joy.usedOnce && clock < 4.0){
        const hx = arena.x0 + joy.r + 18 * u;
        const hy = arena.y1 - joy.r - 18 * u;
        const fade = clock > 3.0 ? (4.0 - clock) : 1;
        ctx.save();
        ctx.globalAlpha = 0.28 * fade;
        ctx.fillStyle = 'rgba(60, 40, 20, 0.3)';
        ctx.strokeStyle = 'rgba(255, 245, 220, 0.85)';
        ctx.lineWidth = 2 * u;
        ctx.setLineDash([5 * u, 4 * u]);
        ctx.beginPath(); ctx.arc(hx, hy, joy.r * 0.85, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#e6b422';
        ctx.beginPath(); ctx.arc(hx, hy, joy.knobR * 0.8, 0, TAU); ctx.fill();
        ctx.restore();
      }
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.88;

    // Vòng tròn đế lớn xuất hiện tại điểm chạm bên trái
    ctx.fillStyle = 'rgba(60, 40, 20, 0.28)';
    ctx.strokeStyle = 'rgba(255, 245, 220, 0.85)';
    ctx.lineWidth = 2.5 * u;
    ctx.beginPath();
    ctx.arc(joy.cx, joy.cy, joy.r, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Vòng tròn rãnh bên trong
    ctx.strokeStyle = 'rgba(255, 245, 220, 0.3)';
    ctx.lineWidth = 1.5 * u;
    ctx.beginPath();
    ctx.arc(joy.cx, joy.cy, joy.r * 0.62, 0, TAU);
    ctx.stroke();

    // Đường nối từ tâm tới núm xoay
    ctx.strokeStyle = 'rgba(230, 180, 34, 0.55)';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(joy.cx, joy.cy);
    ctx.lineTo(joy.x, joy.y);
    ctx.stroke();

    // 4 chấm định hướng nhỏ trên vành
    ctx.fillStyle = 'rgba(255, 245, 220, 0.6)';
    for(let i = 0; i < 4; i++){
      const a = i * Math.PI / 2;
      const dx = Math.cos(a) * (joy.r - 7 * u);
      const dy = Math.sin(a) * (joy.r - 7 * u);
      ctx.beginPath();
      ctx.arc(joy.cx + dx, joy.cy + dy, 2.2 * u, 0, TAU);
      ctx.fill();
    }

    // Núm gạt tròn theo ngón tay
    ctx.fillStyle = '#c8352b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2 * u;
    ctx.beginPath();
    ctx.arc(joy.x, joy.y, joy.knobR, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // Điểm bóng sáng trên núm tròn
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(joy.x - 5 * u, joy.y - 5 * u, joy.knobR * 0.38, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function rrect(x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawPop(q){
    const k = q.t / 1.1, y = q.y - 40*u*k;
    ctx.save();
    ctx.globalAlpha = k < .7 ? 1 : (1-k)/.3;
    ctx.font = '700 ' + Math.round(19*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const x = clamp(q.x, 90, W-90);
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,250,235,.96)';
    ctx.strokeText(q.text, x, y);
    ctx.fillStyle = q.color; ctx.fillText(q.text, x, y);
    ctx.restore();
  }

  function drawRipple(r){
    const k = r.t / 0.35;
    ctx.save();
    ctx.globalAlpha = (1 - k) * 0.7;
    ctx.strokeStyle = '#c8352b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 8*u + k*30*u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shake > 0 && !reduceMotion){
      ctx.translate(rnd(-1,1)*shake*16, rnd(-1,1)*shake*16);
    }
    drawGround();

    for(const e of eggs) drawEgg(e);

    const list = [];
    obs.forEach(o=> list.push({y:o.y, f:()=>drawObstacle(o)}));
    chickens.forEach(c=> list.push({y:c.y, f:()=>drawChicken(c)}));
    list.push({y:P.y, f:drawPlayer});
    list.sort((a,b)=> a.y - b.y).forEach(i=> i.f());

    for(const r of rings) drawCrowRing(r);

    for(const b of bits){
      ctx.save();
      ctx.globalAlpha = 1 - b.t/b.life;
      ctx.translate(b.x,b.y); ctx.rotate(b.rot);
      ctx.fillStyle = b.col; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0,0,5*u,2.4*u,0,0,TAU);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    for(const r of ripples) drawRipple(r);
    for(const q of pops)    drawPop(q);

    ctx.restore();

    // Vẽ Floating Joystick (Trái) & Nút VỒ (Phải) ngoài cùng để cố định khi camera rung
    drawMobileControls();
  }

  return {enter, exit, update, draw, resize, pointerDown};
})();

LR.level('ch1', {
  n: 2, id: 'ga', legacy: 'chicken',
  title: 'Gà', status: 'ready', pad: true,
  desc: 'Bắt đủ con gà trong vườn để làm mâm cỗ!',
  rules: [
    '<b>Di chuyển:</b> mũi tên / WASD, hoặc chạm giữ nửa trái màn hình để xoay Joystick tròn.',
    '<b>Vồ gà:</b> Space / Z / nút <b>VỒ</b> ở góc phải — hoặc chạm trực tiếp vào nửa phải sân.',
    '<b>Vồ trượt:</b> choáng 0,9s và trừ 3s.',
    '<b>Gà né dai:</b> xác suất né cao — hãy đón đầu, đừng vồ thẳng.',
    '<b>Gà vỗ cánh bay:</b> khi bị dồn sát, gà bay xa ~250px. Đợi nó hạ cánh rồi hãy vồ!',
    '<b>🐓 Gà trống GÁY:</b> báo hiệu bằng "!!" đỏ — 0,75s sau sẽ gáy. Nếu bạn trong tầm 195px, bị <b>đứng hình 1,3 giây</b>. Lúc nó đang gáy thì đứng yên, tranh thủ vồ!',
    '<b>🥚 Gà mái ĐẺ TRỨNG:</b> trứng rơi xuống sân, tồn tại 12 giây. Dẫm phải → chậm 55% trong 1,6 giây. Quan sát trứng vàng mờ dần để tránh!',
    '<b>Gà trống mổ:</b> đứng gần gà trống quá lâu mà không vồ là bị mổ choáng.',
    '<b>Stack tốc độ:</b> mỗi con bắt được, những con còn lại chạy nhanh hơn 8%.'
  ],
  mod
});
})();
