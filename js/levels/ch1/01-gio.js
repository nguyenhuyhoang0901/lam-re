/* Chương 1 · Ải 1: Giò (đập ruồi). 3 mức độ, phải thắng cả 3 để mở ải sau. */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound} = LR;
const {rnd, lerp, clamp, TAU} = LR.util;

const mod = (function(){
  const DUR = 60;
  const DIFF = {
    easy:  {name:'Dễ',  lives:5, speed:65,  spawn:1.3, decoy:.18, hit:46, missPts:1, lock:.2,  decoyPts:10, eat:1.0, g:1.3},
    medium:{name:'Vừa', lives:4, speed:95,  spawn:.95, decoy:.27, hit:38, missPts:3, lock:.3,  decoyPts:20, eat:.7,  g:1},
    hard:  {name:'Khó', lives:3, speed:135, spawn:.65, decoy:.34, hit:30, missPts:5, lock:.4,  decoyPts:30, eat:.45, g:.6}
  };
  const TYPES = {fly:{pts:10,r:10}, circ:{pts:15,r:10}, fast:{pts:25,r:8}, big:{pts:30,r:17}};
  const LOOK = {
    fly: {body:'#23232b', thor:'#3a3a46', eye:'#e0243a', sc:1,    bw:6.5, bh:10,   flapF:70,  ww:5},
    circ:{body:'#6b3f17', thor:'#9a6430', eye:'#7b2cbf', sc:1.05, bw:6.5, bh:10,   flapF:60,  ww:5},
    fast:{body:'#0d6e5a', thor:'#1f9a80', eye:'#ff8a1f', sc:.9,   bw:5,   bh:10.5, flapF:110, ww:3.8},
    big: {body:'#2a2a33', thor:'#44444f', eye:'#e0243a', sc:1.8,  bw:6.5, bh:10,   flapF:50,  ww:5}
  };
  const SPLAT_COL = {fly:'#8fae2f', circ:'#a56a2a', fast:'#45b89a', big:'#7d8f2a', bee:'#f0b81c', bug:'#d63a3a'};
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isDecoy = k => k === 'bee' || k === 'bug';

  let ctx = null, W = 360, H = 640, dpr = 1, u = 1;
  let plate = {x:180, y:320, R:54}, bg = null;
  let modeId = 'medium', cfg = DIFF.medium;
  let clock = 0, tleft = DUR, spawnT = 0, score = 0, combo = 0, lives = 4, lockUntil = 0, done = false;
  let stats = {}, ents = [], swings = [], splats = [], pops = [], bits = [];
  let shake = 0, flash = 0, plateShake = 0, lastX = 0, lastY = 0, mouseIn = false, usingMouse = false;

  function resize(){
    ctx = G.ctx; W = G.W; H = G.H; dpr = G.dpr; u = G.u;
    plate.R = 54*u; plate.x = W/2; plate.y = (G.top + H) / 2;
    buildBg();
  }
  function buildBg(){
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(W*dpr)); off.height = Math.max(1, Math.round(H*dpr));
    const g = off.getContext('2d'); g.scale(dpr, dpr);
    g.fillStyle = '#f4ead2'; g.fillRect(0,0,W,H);
    const c = 44*u;
    g.fillStyle = '#c8352b'; g.globalAlpha = .24;
    for(let j=0; j*c < H; j+=2) g.fillRect(0, j*c, W, c);
    for(let i=0; i*c < W; i+=2) g.fillRect(i*c, 0, c, H);
    g.globalAlpha = 1; bg = off;
  }
  function enter(opts){
    modeId = opts.mode || 'medium'; cfg = DIFF[modeId];
    ctx = G.ctx; resize();
    clock = 0; tleft = DUR; spawnT = .7; score = 0; combo = 0; lives = cfg.lives; lockUntil = 0; done = false;
    stats = {killed:0, decoy:0, miss:0, bitten:0};
    ents = []; swings = []; splats = []; pops = []; bits = [];
    shake = flash = plateShake = 0; mouseIn = false;
    G.cv.style.cursor = 'none';
    hud();
  }
  function exit(){ G.cv.style.cursor = ''; Sound.buzzSet(0,0,false); }
  const multiplier = () => Math.min(5, 1 + Math.floor(combo/3));
  function hud(){
    const m = multiplier(), t = Math.max(0, Math.ceil(tleft));
    G.hud.set([
      {l:'Điểm', v: score + (m > 1 ? ' x' + m : '')},
      {l:'Giờ',  v: t, w: t <= 10},
      {l:'Giò', v: lives, w: lives <= 1}
    ]);
  }

  /* ----- spawn ----- */
  function edgePoint(){
    const e = Math.floor(Math.random()*4), m = 34;
    if(e===0) return {x:Math.random()*W, y:G.top - m};
    if(e===1) return {x:W+m, y:G.top + Math.random()*(H-G.top)};
    if(e===2) return {x:-m, y:G.top + Math.random()*(H-G.top)};
    return {x:Math.random()*W, y:H+m};
  }
  function makeFly(kind){
    const p = edgePoint();
    const e = {kind, x:p.x, y:p.y, r:TYPES[kind].r, hp: kind==='big' ? 2 : 1, hurt:0,
      phase:rnd(0,TAU), freq:rnd(3,6), amp:rnd(40,110),
      ox:rnd(-.5,.5)*plate.R, oy:rnd(-.5,.5)*plate.R,
      dartCd:rnd(0,1.5), dart:0, eat:0, eating:false, h:0, dead:false, stT:rnd(.4,1), stun:0, speed:cfg.speed};
    if(kind === 'fly'){ e.speed = cfg.speed*rnd(.85,1.25); }
    else if(kind === 'fast'){ e.speed = cfg.speed*rnd(2,2.4); e.amp = rnd(10,30); e.dartCd = rnd(.4,1.1); Sound.sfx.zip(); }
    else if(kind === 'big'){ e.speed = cfg.speed*rnd(.55,.7); e.amp = rnd(20,40); e.freq = rnd(1.5,2.5); }
    else if(kind === 'circ'){
      const dx = p.x - plate.x, dy = p.y - plate.y;
      e.rad = Math.hypot(dx,dy); e.ang = Math.atan2(dy,dx); e.dir = Math.random() < .5 ? 1 : -1;
      e.rs = cfg.speed*.4*rnd(.9,1.2); e.ts = cfg.speed*rnd(.9,1.2); e.freq = rnd(2,4);
    }
    ents.push(e);
  }
  function spawn(){
    if(ents.length > 14) return;
    if(Math.random() < cfg.decoy){
      const p = edgePoint();
      const kind = Math.random() < .5 ? 'bee' : 'bug';
      const tx = rnd(W*.15, W*.85), ty = rnd(H*.2, H*.8);
      const ang = Math.atan2(ty-p.y, tx-p.x);
      const sp = (kind==='bee' ? rnd(70,100) : rnd(45,70)) * u;
      ents.push({kind, x:p.x, y:p.y, r: kind==='bee'?13:12, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, phase:rnd(0,TAU), age:0, h:ang+Math.PI/2, dead:false});
      return;
    }
    const el = DUR - tleft, g = cfg.g;
    const w = [['fly',1]];
    if(el > 5*g)  w.push(['circ',.5]);
    if(el > 12*g) w.push(['fast',.45]);
    if(el > 20*g) w.push(['big',.35]);
    let tot = 0; w.forEach(x=> tot += x[1]);
    let r = Math.random()*tot, kind = 'fly';
    for(const x of w){ if((r -= x[1]) <= 0){ kind = x[0]; break; } }
    makeFly(kind);
  }

  /* ----- effects ----- */
  const addPop = (x,y,text,color)=> pops.push({x,y,text,color,t:0});
  function addSplat(x,y,kind,size){
    const blobs = [];
    if(kind !== 'ring' && kind !== 'dust'){
      for(let i=0;i<7;i++){ const a = rnd(0,TAU), d = rnd(4,20); blobs.push({dx:Math.cos(a)*d, dy:Math.sin(a)*d, r:rnd(3,8)}); }
    }
    splats.push({x,y,kind,color:SPLAT_COL[kind]||'#fff',blobs,size:size||1,t:0,life: kind==='ring'?.35 : kind==='dust'?.5 : 2.2});
  }
  function addBits(x,y,n){
    for(let i=0;i<n;i++){ const a = rnd(0,TAU), s = rnd(60,160)*u; bits.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,rot:rnd(0,TAU),vr:rnd(-12,12),t:0,life:.9}); }
  }
  function vibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }
  function penalty(){ flash = 1; if(!reduceMotion) shake = .3; }
  function loseCake(x,y,msg){
    lives--; combo = 0;
    addPop(x,y,msg,'#c62828'); plateShake = .4; vibrate(40);
    if(lives <= 0){ lives = 0; hud(); endGame('cake'); }
  }

  /* ----- swatting ----- */
  function resolveSwing(s){
    const R = cfg.hit * u;
    const flies = [], decs = [];
    for(const e of ents){
      if(e.dead) continue;
      if(Math.hypot(e.x - s.x, e.y - s.y) < R + e.r*u*.6) (isDecoy(e.kind) ? decs : flies).push(e);
    }
    addSplat(s.x, s.y, 'ring');
    if(!flies.length && !decs.length){
      stats.miss++; combo = 0;
      score = Math.max(0, score - cfg.missPts);
      lockUntil = clock + cfg.lock;
      addSplat(s.x, s.y, 'dust');
      addPop(s.x, s.y - 30*u, cfg.missPts ? 'Hụt! −' + cfg.missPts : 'Hụt!', '#7a5a00');
      Sound.sfx.miss(); vibrate(15);
      return;
    }
    for(const f of flies){
      if(f.kind === 'big' && f.hp > 1){
        f.hp = 1; f.hurt = .2; f.eating = false; f.eat = 0; f.stT = rnd(.3,.7);
        let ux = f.x - s.x, uy = f.y - s.y; const d = Math.hypot(ux,uy);
        if(d < 1){ ux = 0; uy = -1; } else { ux /= d; uy /= d; }
        f.x += ux*40*u; f.y += uy*40*u;
        score += 5; addBits(f.x, f.y, 6);
        addPop(f.x, f.y - 30*u, 'Trúng! Còn 1 lần', '#b35c00');
        Sound.sfx.hurtBig(); vibrate(25);
        continue;
      }
      const before = multiplier();
      const pts = TYPES[f.kind].pts * before;
      combo++; stats.killed++; score += pts; f.dead = true;
      addSplat(f.x, f.y, f.kind, f.kind==='big' ? 1.8 : 1);
      if(f.kind === 'big'){ addBits(f.x, f.y, 5); Sound.sfx.killBig(); } else Sound.sfx.splat();
      if(multiplier() > before) Sound.sfx.combo(multiplier());
      addPop(f.x, f.y - 20*u, '+' + pts, '#0f7a43');
    }
    for(const d of decs){
      d.dead = true; stats.decoy++;
      score = Math.max(0, score - cfg.decoyPts);
      addSplat(d.x, d.y, d.kind); penalty(); Sound.sfx.bad();
      loseCake(d.x, d.y - 20*u, (d.kind==='bee' ? 'Ong!' : 'Bọ rùa!') + ' −' + cfg.decoyPts + ' và mất giò');
      if(done) return;
    }
    ents = ents.filter(e=>!e.dead);
  }
  function bite(f){
    f.dead = true; stats.bitten++; penalty(); flash = .6; Sound.sfx.bite();
    loseCake(plate.x, plate.y - plate.R - 24*u, 'Ruồi ăn mất 1 miếng giò!');
  }
  function pointerDown(x,y,e){
    usingMouse = e.pointerType === 'mouse'; lastX = x; lastY = y;
    if(clock < lockUntil){ shake = Math.max(shake, .08); Sound.sfx.tick(); return; }
    swings.push({x, y, t:0, done:false}); Sound.sfx.swing();
  }
  function pointerMove(x,y,e){ lastX = x; lastY = y; usingMouse = e.pointerType === 'mouse'; mouseIn = true; }
  function pointerLeave(){ mouseIn = false; }

  /* ----- update ----- */
  function updateFly(e, dt, p){
    if(e.hurt > 0) e.hurt -= dt;
    if(e.eating){
      e.eat += dt;
      if(e.eat >= cfg.eat * (e.kind === 'big' ? 1.5 : 1)) bite(e);
      return;
    }
    if(e.kind === 'circ'){
      e.rad -= e.rs * u * (1 + .5*p) * dt;
      const minR = plate.R * .75;
      if(e.rad <= minR){ e.rad = minR; e.eating = true; return; }
      const angSp = Math.min(3.6, e.ts * u / Math.max(60*u, e.rad));
      e.ang += e.dir * angSp * dt;
      const rr = e.rad + Math.sin(clock*e.freq + e.phase) * 14 * u;
      const nx = plate.x + Math.cos(e.ang)*rr, ny = plate.y + Math.sin(e.ang)*rr;
      if(Math.hypot(nx-e.x, ny-e.y) > .01) e.h = Math.atan2(ny-e.y, nx-e.x) + Math.PI/2;
      e.x = nx; e.y = ny;
      return;
    }
    const tx = plate.x + e.ox, ty = plate.y + e.oy;
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx,dy) || 1;
    if(d < plate.R*.75){ e.eating = true; return; }
    const ux = dx/d, uy = dy/d, px = -uy, py = ux;
    let spMul = 1, ampMul = 1;
    const wounded = e.kind === 'big' && e.hp === 1;
    if(wounded){
      spMul = .5; ampMul = 2.4; e.stT -= dt;
      if(e.stT <= 0){ e.stun = rnd(.15,.35); e.stT = rnd(.8,1.6); }
      if(e.stun > 0){ e.stun -= dt; spMul *= .2; }
    } else {
      e.dartCd -= dt;
      if(e.dartCd <= 0){ e.dart = .22; e.dartCd = e.kind==='fast' ? rnd(.5,1.3) : rnd(.9,2.5); }
      if(e.dart > 0) e.dart -= dt;
    }
    const dm = e.kind === 'fast' ? 1.6 : 2.3;
    const sp = e.speed * u * (1 + .5*p) * spMul * (e.dart > 0 ? dm : 1);
    const wob = Math.sin(clock*e.freq*(wounded?1.6:1) + e.phase) * e.amp * ampMul * u;
    const vx = ux*sp + px*wob, vy = uy*sp + py*wob;
    e.x += vx*dt; e.y += vy*dt; e.h = Math.atan2(vy, vx) + Math.PI/2;
  }
  function update(dt){
    clock += dt; tleft -= dt;
    const p = clamp(1 - tleft/DUR, 0, 1);
    if(tleft <= 0){ tleft = 0; hud(); endGame('time'); return; }
    spawnT -= dt;
    if(spawnT <= 0){ spawn(); spawnT = cfg.spawn * (1 - .4*p) * rnd(.7,1.3); }
    for(const e of ents){
      if(e.dead) continue;
      if(!isDecoy(e.kind)){ updateFly(e, dt, p); if(done) return; }
      else {
        e.age += dt;
        const l = Math.sin(clock*2 + e.phase) * 28 * u;
        const sp = Math.hypot(e.vx, e.vy) || 1;
        const nx = -e.vy/sp, ny = e.vx/sp;
        const vx = e.vx + nx*l, vy = e.vy + ny*l;
        e.x += vx*dt; e.y += vy*dt; e.h = Math.atan2(vy, vx) + Math.PI/2;
        if(e.age > 1 && (e.x < -90 || e.x > W+90 || e.y < -90 || e.y > H+90)) e.dead = true;
      }
    }
    ents = ents.filter(e=>!e.dead);
    for(const s of swings){ s.t += dt; if(!s.done && s.t >= .085){ s.done = true; resolveSwing(s); if(done) return; } }
    swings = swings.filter(s=> s.t < .3);
    for(const s of splats) s.t += dt;
    splats = splats.filter(s=> s.t < s.life);
    for(const q of pops) q.t += dt;
    pops = pops.filter(q=> q.t < 1.1);
    for(const b of bits){ b.t += dt; b.x += b.vx*dt; b.y += b.vy*dt; b.vx *= .96; b.vy *= .96; b.rot += b.vr*dt; }
    bits = bits.filter(b=> b.t < b.life);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt*2.2); plateShake = Math.max(0, plateShake - dt);
    let n = 0, fast = 0;
    for(const e of ents) if(!isDecoy(e.kind)){ n++; if(e.kind === 'fast') fast++; }
    Sound.buzzSet(n, fast, true);
    hud();
  }
  function endGame(reason){
    if(done) return; done = true;
    const win = reason === 'time';
    let bonus = 0;
    if(win){ bonus = lives * 20; score += bonus; }
    const rows = [['Ruồi đã đập', stats.killed], ['Đập nhầm ong, bọ rùa', stats.decoy], ['Đập hụt', stats.miss], ['Miếng giò bị ruồi ăn', stats.bitten]];
    if(win) rows.push(['Thưởng giò còn lại', '+' + bonus]);
    G.finish({win, score,
      title: win ? 'Giữ được mâm giò!' : 'Giò bị ăn hết!',
      msg: win ? 'Hoàn thành mức ' + cfg.name + '.' : 'Ruồi đã ăn hết giò. Thử lại nhé.',
      rows});
  }

  /* ----- drawing ----- */
  function rrPath(x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function drawPlate(){
    const {x,y,R} = plate;
    ctx.save();
    let jx = 0; if(plateShake > 0 && !reduceMotion) jx = Math.sin(clock*70) * 3 * u;
    ctx.translate(x + jx, y);
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(4*u, 8*u, R+14*u, R+10*u, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0,0,R+12*u,0,TAU); ctx.fill();
    ctx.strokeStyle = '#d5dfdc'; ctx.lineWidth = 3*u;
    ctx.beginPath(); ctx.arc(0,0,R+12*u,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,R+3*u,0,TAU); ctx.stroke();
    const n = Math.max(1, cfg.lives);
    for(let i=0;i<n;i++){
      if(i >= lives) continue;
      const a0 = -Math.PI/2 + i*TAU/n, a1 = a0 + TAU/n;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R,a0,a1); ctx.closePath();
      ctx.fillStyle = '#f4ddd2'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5*u; ctx.stroke();
      const am = (a0+a1)/2;
      ctx.fillStyle = '#7a4b3a';
      for(let q=0;q<3;q++){ const aa = am + (q-1)*.2, rr = R*(.45 + .13*q); ctx.beginPath(); ctx.arc(Math.cos(aa)*rr, Math.sin(aa)*rr, 2.4*u, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#6fa05a'; ctx.lineWidth = 3.5*u; ctx.beginPath(); ctx.arc(0,0,R-1.8*u,a0+.04,a1-.04); ctx.stroke();
    }
    ctx.restore();
  }
  function drawFlySprite(f){
    const L = LOOK[f.kind], wounded = f.kind === 'big' && f.hp === 1;
    ctx.save();
    let jx = 0, jy = 0;
    if(f.eating){ jx = Math.sin(clock*60)*1.2*u; jy = Math.cos(clock*53)*1.2*u; }
    const bob = (wounded && !f.eating) ? Math.sin(clock*9 + f.phase)*2.5*u : 0;
    if(wounded){
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(f.x+7*u, f.y+14*u, 14*u*L.sc, 7*u*L.sc, 0, 0, TAU); ctx.fill();
    }
    ctx.translate(f.x + jx, f.y + jy + bob); ctx.rotate(f.eating ? 0 : f.h); ctx.scale(u*L.sc, u*L.sc);
    if(f.kind === 'fast' && !f.eating){
      ctx.strokeStyle = 'rgba(30,120,100,.3)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-3,14); ctx.lineTo(-3,30); ctx.moveTo(0,15); ctx.lineTo(0,36); ctx.moveTo(3,14); ctx.lineTo(3,30); ctx.stroke();
    }
    ctx.lineWidth = 1;
    if(wounded){
      const fl = Math.sin(clock*20 + f.phase)*.4;
      ctx.fillStyle = 'rgba(205,232,255,.6)'; ctx.strokeStyle = 'rgba(50,70,90,.55)';
      for(const s of [-1,1]){
        ctx.save(); ctx.translate(s*5,-1); ctx.rotate(s*(.9 + fl*(s>0 ? 1 : .4))); ctx.scale(s, s>0 ? 1 : .65);
        ctx.beginPath();
        ctx.moveTo(0,0); ctx.lineTo(5,5); ctx.lineTo(3,8); ctx.lineTo(7,12); ctx.lineTo(2,12); ctx.lineTo(3,18); ctx.lineTo(-2,13); ctx.lineTo(-4,16); ctx.lineTo(-4,6); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
      }
    } else {
      const flap = Math.sin(clock*L.flapF + f.phase) * .35;
      ctx.fillStyle = 'rgba(205,232,255,.75)'; ctx.strokeStyle = 'rgba(50,70,90,.45)';
      for(const s of [-1,1]){
        ctx.save(); ctx.translate(s*5,-1); ctx.rotate(s*(.7+flap));
        ctx.beginPath(); ctx.ellipse(0,6,L.ww,12,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.strokeStyle = L.body; ctx.lineWidth = 1.4;
    const lg = f.eating ? Math.sin(clock*40)*2 : 0;
    for(const s of [-1,1]){
      ctx.beginPath(); ctx.moveTo(s*4,-4); ctx.lineTo(s*11,-9+lg); ctx.moveTo(s*5,0); ctx.lineTo(s*12,0); ctx.moveTo(s*4,5); ctx.lineTo(s*10,10-lg); ctx.stroke();
    }
    ctx.fillStyle = L.body; ctx.beginPath(); ctx.ellipse(0,4,L.bw,L.bh,0,0,TAU); ctx.fill();
    ctx.fillStyle = L.thor; ctx.beginPath(); ctx.ellipse(0,-3,L.bw-.5,6,0,0,TAU); ctx.fill();
    if(f.kind === 'fast'){ ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(-1.5,-4,1.8,3,0,0,TAU); ctx.fill(); }
    if(f.kind === 'circ'){
      ctx.strokeStyle = 'rgba(255,200,120,.55)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-5,3); ctx.lineTo(5,3); ctx.moveTo(-5.5,8); ctx.lineTo(5.5,8); ctx.stroke();
    }
    ctx.fillStyle = L.body; ctx.beginPath(); ctx.arc(0,-10,4.5,0,TAU); ctx.fill();
    ctx.fillStyle = L.eye; ctx.beginPath(); ctx.arc(-3,-11,2.4,0,TAU); ctx.arc(3,-11,2.4,0,TAU); ctx.fill();
    if(f.hurt > 0){ ctx.globalAlpha = Math.min(1, f.hurt/.2); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0,2,8,13,0,0,TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawBee(b){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.h); ctx.scale(u*1.1,u*1.1);
    const flap = Math.sin(clock*60 + b.phase)*.3;
    ctx.fillStyle = 'rgba(235,245,255,.8)'; ctx.strokeStyle = 'rgba(50,70,90,.4)'; ctx.lineWidth = 1;
    for(const s of [-1,1]){
      ctx.save(); ctx.translate(s*6,-2); ctx.rotate(s*(.6+flap));
      ctx.beginPath(); ctx.ellipse(0,7,6,13,0,0,TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.beginPath(); ctx.ellipse(0,3,8,12,0,0,TAU); ctx.clip();
    ctx.fillStyle = '#f6c026'; ctx.fillRect(-10,-12,20,30);
    ctx.fillStyle = '#2a2112'; ctx.fillRect(-10,0,20,4); ctx.fillRect(-10,7,20,4);
    ctx.restore();
    ctx.fillStyle = '#2a2112';
    ctx.beginPath(); ctx.moveTo(-2,14); ctx.lineTo(2,14); ctx.lineTo(0,19); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(0,-10,5.5,0,TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2.5,-11,1.5,0,TAU); ctx.arc(2.5,-11,1.5,0,TAU); ctx.fill();
    ctx.strokeStyle = '#2a2112'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-2,-14); ctx.lineTo(-5,-19); ctx.moveTo(2,-14); ctx.lineTo(5,-19); ctx.stroke();
    ctx.restore();
  }
  function drawBug(b){
    ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.h); ctx.scale(u,u);
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.4;
    for(const s of [-1,1]){
      ctx.beginPath(); ctx.moveTo(s*8,-5); ctx.lineTo(s*14,-8); ctx.moveTo(s*10,0); ctx.lineTo(s*15,1); ctx.moveTo(s*8,6); ctx.lineTo(s*13,10); ctx.stroke();
    }
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.arc(0,-10,5,0,TAU); ctx.fill();
    ctx.fillStyle = '#d63a3a'; ctx.beginPath(); ctx.ellipse(0,2,10.5,12,0,0,TAU); ctx.fill();
    ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(0,14); ctx.stroke();
    ctx.fillStyle = '#1b1b1b';
    for(const [sx,sy] of [[-5,-2],[5,-2],[-5,6],[5,6]]){ ctx.beginPath(); ctx.arc(sx,sy,2.2,0,TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawSwatter(x,y,h,ang,sc,alpha,grey){
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x,y); ctx.rotate(ang); ctx.scale(sc,sc);
    const frame = grey ? '#8c9a96' : '#e8483f';
    ctx.fillStyle = 'rgba(0,0,0,.13)'; rrPath(-h+7, -h+11, 2*h, 2*h, h*.38); ctx.fill();
    const hw = h*.26;
    ctx.fillStyle = grey ? '#6f7c78' : '#22305b'; rrPath(-hw/2, h*.8, hw, h*1.9, hw/2); ctx.fill();
    ctx.fillStyle = frame; rrPath(-hw*.75, h*.7, hw*1.5, h*.4, 4); ctx.fill();
    ctx.save(); rrPath(-h,-h,2*h,2*h,h*.38);
    ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(34,48,91,.5)'; ctx.lineWidth = 1.2;
    const step = h/3.2; ctx.beginPath();
    for(let k=-h; k<=h; k+=step){ ctx.moveTo(k,-h); ctx.lineTo(k,h); ctx.moveTo(-h,k); ctx.lineTo(h,k); }
    ctx.stroke(); ctx.restore();
    rrPath(-h,-h,2*h,2*h,h*.38); ctx.lineWidth = h*.2; ctx.strokeStyle = frame; ctx.stroke();
    ctx.restore();
  }
  function drawSplat(s){
    const k = s.t / s.life;
    if(s.kind === 'ring'){
      ctx.save(); ctx.globalAlpha = (1-k)*.9; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4*u;
      ctx.beginPath(); ctx.arc(s.x,s.y, (cfg.hit*u)*(.5 + k*.9), 0, TAU); ctx.stroke(); ctx.restore(); return;
    }
    if(s.kind === 'dust'){
      ctx.save(); ctx.globalAlpha = (1-k)*.5; ctx.fillStyle = '#6c7b77';
      ctx.beginPath(); ctx.ellipse(s.x,s.y, 14*u*(1+k), 8*u*(1+k), 0, 0, TAU); ctx.fill(); ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = Math.min(1, (1-k)*1.4) * .85; ctx.translate(s.x,s.y); ctx.scale(u*s.size,u*s.size);
    ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(0,0,9,0,TAU); ctx.fill();
    for(const b of s.blobs){ ctx.beginPath(); ctx.arc(b.dx,b.dy,b.r,0,TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(30,30,30,.7)'; ctx.beginPath(); ctx.ellipse(0,0,4,2.5,.6,0,TAU); ctx.fill();
    ctx.restore();
  }
  function drawBit(b){
    ctx.save(); ctx.globalAlpha = 1 - b.t/b.life; ctx.translate(b.x,b.y); ctx.rotate(b.rot); ctx.scale(u,u);
    ctx.fillStyle = 'rgba(205,232,255,.9)'; ctx.strokeStyle = 'rgba(50,70,90,.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4,5); ctx.lineTo(0,2); ctx.lineTo(-4,6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawPop(q){
    const k = q.t / 1.1, y = q.y - 46*u*k;
    ctx.save(); ctx.globalAlpha = k < .7 ? 1 : (1-k)/.3;
    ctx.font = '700 ' + Math.round(19*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const x = clamp(q.x, 90, W-90);
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.strokeText(q.text, x, y);
    ctx.fillStyle = q.color; ctx.fillText(q.text, x, y); ctx.restore();
  }
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
    ctx.save();
    if(shake > 0 && !reduceMotion) ctx.translate(rnd(-1,1)*shake*22, rnd(-1,1)*shake*22);
    if(bg) ctx.drawImage(bg, 0, 0, W, H);
    for(const s of splats) drawSplat(s);
    drawPlate();
    for(const e of ents){ if(e.kind === 'bee') drawBee(e); else if(e.kind === 'bug') drawBug(e); else drawFlySprite(e); }
    for(const b of bits) drawBit(b);
    const h = cfg.hit * u;
    if(G.state === 'play'){
      if(clock < lockUntil){
        drawSwatter(lastX, lastY, h, -.1, 1, .7, true);
        const frac = (lockUntil - clock) / cfg.lock;
        ctx.save(); ctx.strokeStyle = '#e8483f'; ctx.lineWidth = 5*u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(lastX, lastY, h*1.35, -Math.PI/2, -Math.PI/2 + TAU*frac); ctx.stroke(); ctx.restore();
      } else if(!swings.length && usingMouse && mouseIn){
        drawSwatter(lastX, lastY, h, -.3, 1, .9, false);
      }
      for(const s of swings){
        let sc, ang, al;
        if(s.t < .085){ const k = s.t/.085; sc = lerp(1.45,1,k*k); ang = lerp(-.7,-.1,k); al = lerp(.8,1,k); }
        else { const k = Math.min(1,(s.t-.085)/.215); sc = lerp(1,1.1,k); ang = -.1; al = 1-k; }
        drawSwatter(s.x, s.y, h, ang, sc, al, false);
      }
    }
    for(const q of pops) drawPop(q);
    ctx.restore();
    if(flash > 0){ ctx.fillStyle = 'rgba(232,72,63,' + (flash*.32) + ')'; ctx.fillRect(0,0,W,H); }
  }

  /* ----- chú giải loài ruồi (dùng ở màn giới thiệu) ----- */
  function legend(box){
    const items = [
      {sp:['fly'],  text:'Ruồi thường', pt:'+10'},
      {sp:['circ'], text:'Ruồi nâu bay lòng vòng quanh đĩa', pt:'+15'},
      {sp:['fast'], text:'Ruồi xanh bay rất nhanh', pt:'+25'},
      {sp:['big'],  text:'Ruồi to: đập 2 lần mới chết', pt:'+30'},
      {sp:['bee','bug'], text:'Ong, bọ rùa: đừng đập!', pt:'Phạt'}
    ];
    const wrap = document.createElement('div'); wrap.className = 'legend';
    const old = {ctx, u, clock};
    items.forEach(it=>{
      const row = document.createElement('div'); row.className = 'lg';
      const c = document.createElement('canvas'); c.width = 88; c.height = 88;
      const t = document.createElement('span'); t.textContent = it.text;
      const p = document.createElement('b'); p.textContent = it.pt;
      row.append(c, t, p); wrap.appendChild(row);
      ctx = c.getContext('2d'); ctx.scale(2,2); clock = 0;
      const n = it.sp.length;
      it.sp.forEach((k,i)=>{
        u = n > 1 ? .55 : (k === 'big' ? .72 : .85);
        const o = {kind:k, x: n>1 ? (i ? 31 : 13) : 22, y:22, h:0, hp:2, phase:0, eating:false, hurt:0};
        if(k === 'bee') drawBee(o); else if(k === 'bug') drawBug(o); else drawFlySprite(o);
      });
    });
    ctx = old.ctx; u = old.u; clock = old.clock;
    box.appendChild(wrap);
  }
  return {enter, exit, update, draw, resize, pointerDown, pointerMove, pointerLeave, legend};
})();

LR.level('ch1', {
  n: 1, id: 'gio', legacy: 'fly',            // legacy: id cũ, để giữ tiến trình đã lưu từ bản trước
  title: 'Giò', status: 'ready', pad: false,
  desc: 'Bầy ruồi kéo đến ăn giò. Phải thắng đủ cả 3 mức mới mở được ải.',
  rules: [
    '<b>Chạm / bấm chuột</b> để đập vỉ. Đập liên tiếp để nhân điểm.',
    '<b>Đập nhầm ong, bọ rùa:</b> trừ điểm và mất một miếng giò.',
    '<b>Đập hụt:</b> trừ điểm, vỉ bị kẹt một lúc.',
    '<b>Ruồi ăn xong:</b> mất một miếng giò. Hết giò là thua.'
  ],
  modes: [
    {id: 'easy',   name: 'Dễ',  sub: '5 miếng giò · vỉ to · phạt nhẹ'},
    {id: 'medium', name: 'Vừa', sub: '4 miếng giò · phạt vừa'},
    {id: 'hard',   name: 'Khó', sub: '3 miếng giò · vỉ nhỏ · vỉ kẹt lâu'}
  ],
  mod
});
})();
