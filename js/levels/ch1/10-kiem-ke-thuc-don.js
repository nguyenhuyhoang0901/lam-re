/* Chương 1 · Ải 14: Đếm số — 100 số rải rác, tap đúng thứ tự 1 → 100.
   Chống click oan khi kéo + tự sắp xếp lại khi resize. */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound, Input} = LR;
const {rnd, clamp, TAU, INK} = LR.util;

const mod = (function(){
  const N           = 100;
  const TIME        = 200;
  const WRONG_COST  = 1.5;
  const HIT_PAD     = 6;
  const COLS        = 10;
  const ROWS        = 10;

  const TAP_MOVE_TOUCH = 22;
  const TAP_MOVE_MOUSE = 6;
  const TAP_TIME_MAX   = 800;

  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let ctx = null, W = 360, H = 640, dpr = 1, u = 1;
  let arena = {x0:0,y0:0,x1:0,y1:0};
  let clock = 0, left = TIME, done = false, shake = 0;
  let nums = [], nextN = 1, mistakes = 0;
  let pops = [], bits = [], ripples = [];

  let _downX = 0, _downY = 0, _downT = 0;
  let _moved = false, _tol = TAP_MOVE_TOUCH;

  /* Debounce resize để không layout lại liên tục khi kéo cửa sổ */
  let _resizeTimer = 0;

  function sfx(name){ try{ if(Sound.sfx && Sound.sfx[name]) Sound.sfx[name](); }catch(e){} }
  function vibrate(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

  /* ═══════════════════════════════════════════════════════════
     RESIZE — cập nhật arena, sắp xếp lại toàn bộ số
     ═══════════════════════════════════════════════════════════ */
  function resize(){
    ctx = G.ctx; W = G.W; H = G.H; dpr = G.dpr; u = G.u;
    arena = {x0:14*u, y0:G.top + 14*u, x1:W - 14*u, y1:H - 14*u};

    if(nums.length === 0){ layout(null); return; }

    /* Lưu trạng thái các số đã click đúng */
    const doneMap = {};
    for(const it of nums) if(it.done) doneMap[it.n] = true;

    /* Sắp xếp lại vị trí với cùng trật tự nhãn cũ */
    layout(doneMap);
  }

  /* layout(doneMap):
     - doneMap = null → tạo mới (xáo trộn ngẫu nhiên)
     - doneMap = {n:true} → giữ nguyên nhãn cũ (theo nums[i].n), chỉ đổi vị trí  */
  function layout(doneMap){
    const aw = arena.x1 - arena.x0;
    const ah = arena.y1 - arena.y0;
    const cw = aw / COLS;
    const ch = ah / ROWS;
    const r  = Math.min(cw, ch) * 0.42;

    /* Danh sách nhãn theo thứ tự ô 0..99 */
    let labels;
    if(doneMap === null || nums.length === 0){
      /* Lần đầu: xáo trộn ngẫu nhiên */
      labels = [];
      for(let i = 1; i <= N; i++) labels.push(i);
      for(let i = labels.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        const t = labels[i]; labels[i] = labels[j]; labels[j] = t;
      }
    } else {
      /* Đã có: giữ nguyên trật tự nhãn theo ô (chỉ đổi vị trí pixel) */
      labels = nums.map(it => it.n);
    }

    nums = [];
    for(let i = 0; i < N; i++){
      const col = i % COLS, row = Math.floor(i / COLS);
      const pad = r + 1.5*u;
      const jx = rnd(pad, cw - pad);
      const jy = rnd(pad, ch - pad);
      const n = labels[i];
      nums.push({
        n,
        x: arena.x0 + col * cw + jx,
        y: arena.y0 + row * ch + jy,
        r,
        hitR: r + HIT_PAD * u,
        done: !!(doneMap && doneMap[n]),
        pulse: 0,
        wrong: 0
      });
    }
  }

  function enter(){
    ctx = G.ctx;
    nums = [];
    resize();
    clock = 0; left = TIME; done = false; shake = 0;
    nextN = 1; mistakes = 0;
    pops = []; bits = []; ripples = [];
    _moved = false;
    hud();
  }
  function exit(){
    if(_resizeTimer){ clearTimeout(_resizeTimer); _resizeTimer = 0; }
  }

  function hud(){
    G.hud.set([
      {l:'Tìm', v: nextN + '/' + N},
      {l:'Giờ', v: Math.max(0, Math.ceil(left)), w: left <= 10}
    ]);
  }

  const addPop = (x,y,text,color)=> pops.push({x,y,text,color,t:0});

  /* ═══════════════════════════════════════════════════════════
     POINTER — chỉ xử lý TAP, bỏ qua DRAG
     ═══════════════════════════════════════════════════════════ */
  function pointerDown(x, y, e){
    if(done) return;
    _downX = x; _downY = y;
    _downT = performance.now();
    _moved = false;
    _tol = (e && e.pointerType === 'touch') ? TAP_MOVE_TOUCH : TAP_MOVE_MOUSE;
  }

  function pointerMove(x, y){
    if(_moved || done) return;
    if(Math.hypot(x - _downX, y - _downY) > _tol) _moved = true;
  }

  function pointerUp(x, y){
    if(done || _moved) return;
    if(performance.now() - _downT > TAP_TIME_MAX) return;
    if(Math.hypot(x - _downX, y - _downY) > _tol) return;
    handleTap(x, y);
  }

  function handleTap(x, y){
    let hit = null, bestD = Infinity;
    for(const it of nums){
      if(it.done) continue;
      const d = Math.hypot(it.x - x, it.y - y);
      if(d < it.hitR && d < bestD){ bestD = d; hit = it; }
    }
    if(!hit) return;

    if(hit.n === nextN){
      hit.done = true;
      hit.pulse = 0.55;
      nextN++;
      addPop(hit.x, hit.y - 26*u, '' + hit.n, '#0f7a43');
      sfx('catchOk'); vibrate(12);
      if(nextN > N){ hud(); return win(); }
    } else {
      hit.wrong = 0.55;
      mistakes++;
      left -= WRONG_COST;
      if(!reduceMotion) shake = 0.22;
      addPop(hit.x, hit.y - 26*u, '−' + WRONG_COST + 's', '#c62828');
      sfx('thud'); vibrate(30);
      if(left <= 0){ left = 0; hud(); return lose(); }
    }
    hud();
  }

  /* ═══════════════════════════════════════════════════════════ */

  function update(dt){
    clock += dt; left -= dt;
    if(left <= 0){ left = 0; hud(); return lose(); }

    for(const it of nums){
      it.pulse = Math.max(0, it.pulse - dt);
      it.wrong = Math.max(0, it.wrong - dt);
    }
    for(const q of pops) q.t += dt;
    pops = pops.filter(q => q.t < 1.1);
    for(const r of ripples) r.t += dt;
    ripples = ripples.filter(r => r.t < 0.35);
    for(const b of bits){
      b.t += dt; b.x += b.vx*dt; b.y += b.vy*dt;
      b.vx *= .95; b.vy *= .95; b.rot += b.vr*dt;
    }
    bits = bits.filter(b => b.t < b.life);
    shake = Math.max(0, shake - dt);
    hud();
  }

  function win(){
    if(done) return; done = true;
    const t = Math.max(0, Math.round(left));
    const stars = left >= 90 ? 3 : left >= 40 ? 2 : 1;
    G.finish({
      win:true,
      score: Math.round(left * 10) + (N - mistakes) * 5,
      stars,
      title:'Đếm đủ 100 số!',
      msg:'Nhà vợ gật gù: chàng rể vừa nhanh vừa tinh mắt.',
      rows:[
        ['Thời gian còn lại', t + ' giây'],
        ['Số lần click sai', mistakes]
      ]
    });
  }
  function lose(){
    if(done) return; done = true;
    G.finish({
      win:false, score: null,
      title:'Hết giờ!',
      msg:'Mới đếm được ' + (nextN - 1) + '/' + N + ' số.',
      rows:[
        ['Số đã đếm', (nextN - 1) + '/' + N],
        ['Số lần click sai', mistakes]
      ]
    });
  }

  /* ── Vẽ ── */
  function drawCircle(it){
    const scale = it.pulse > 0 ? (1 + 0.45 * (it.pulse / 0.55)) : 1;
    const r = it.r * scale;
    const wrongShake = (it.wrong > 0 && !reduceMotion) ? rnd(-2, 2) * u : 0;

    ctx.save();
    ctx.translate(it.x + wrongShake, it.y);

    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath(); ctx.ellipse(0, r*0.28, r*0.95, r*0.85, 0, 0, TAU); ctx.fill();

    let fill = '#fbf6e0';
    if(it.done)           fill = '#fbe6e6';
    else if(it.wrong > 0) fill = '#f8d0c0';
    ctx.fillStyle = fill;
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.stroke();

    const digits = String(it.n).length;
    const fs = digits >= 3 ? r * 0.90 : (digits === 2 ? r * 1.15 : r * 1.40);
    ctx.font = '900 ' + Math.round(fs) + 'px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = it.done ? '#c62828' : (it.wrong > 0 ? '#c62828' : INK);
    ctx.fillText(String(it.n), 0, 1*u);

    if(it.done){
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 3*u, 0, TAU); ctx.stroke();
    }

    if(it.wrong > 0){
      const a = it.wrong / 0.55;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r*0.65, -r*0.65); ctx.lineTo(r*0.65, r*0.65);
      ctx.moveTo( r*0.65, -r*0.65); ctx.lineTo(-r*0.65, r*0.65);
      ctx.stroke();
      ctx.restore();
    }

    if(it.pulse > 0){
      const k = 1 - it.pulse / 0.55;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.75;
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r + k * 20*u, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawGround(){
    ctx.fillStyle = '#d9c08a'; ctx.fillRect(0,0,W,H);
    const {x0,y0,x1,y1} = arena;
    ctx.fillStyle = '#ecdcae'; ctx.fillRect(x0,y0,x1-x0,y1-y0);
    const th = 11*u;
    ctx.fillStyle = '#a8743a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillRect(x0-th, y0-th, x1-x0+2*th, th); ctx.strokeRect(x0-th, y0-th, x1-x0+2*th, th);
    ctx.fillRect(x0-th, y1,    x1-x0+2*th, th); ctx.strokeRect(x0-th, y1,    x1-x0+2*th, th);
    ctx.fillRect(x0-th, y0, th, y1-y0);         ctx.strokeRect(x0-th, y0, th, y1-y0);
    ctx.fillRect(x1,    y0, th, y1-y0);         ctx.strokeRect(x1,    y0, th, y1-y0);
    ctx.fillStyle = '#7d5226';
    for(let x = x0; x <= x1; x += 26*u){
      ctx.fillRect(x-2*u, y0-th-3*u, 4*u, th+6*u);
      ctx.fillRect(x-2*u, y1-3*u,   4*u, th+6*u);
    }
    for(let y = y0; y <= y1; y += 26*u){
      ctx.fillRect(x0-th-3*u, y-2*u, th+6*u, 4*u);
      ctx.fillRect(x1-3*u,    y-2*u, th+6*u, 4*u);
    }
  }

  function drawPop(q){
    const k = q.t / 1.1, y = q.y - 40*u*k;
    ctx.save();
    ctx.globalAlpha = k < .7 ? 1 : (1-k)/.3;
    ctx.font = '700 ' + Math.round(19*u) + 'px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const x = clamp(q.x, 90, W-90);
    ctx.lineJoin = 'round'; ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,250,235,.96)';
    ctx.strokeText(q.text, x, y);
    ctx.fillStyle = q.color; ctx.fillText(q.text, x, y);
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
    for(const it of nums) drawCircle(it);
    for(const q of pops) drawPop(q);
    ctx.restore();
  }

  return {enter, exit, update, draw, resize, pointerDown, pointerMove, pointerUp};
})();

LR.level('ch1', {
  n: 10, id: 'dem-so', legacy: 'count100',
  title: 'Kiểm kê thực đơn', status: 'ready', pad: false,
  desc: 'Kiểm kê số lượng thực đơn.',
  rules: [
    '<b>Cách chơi:</b> Click/tap vào số theo đúng thứ tự tăng dần.',
    'Số click đúng sẽ được <b>khoanh đỏ</b> và ở lại trên sân.',
    'Click sai số → <b>trừ 1,5 giây</b> và hiện dấu X đỏ.',
    'Đếm đủ <b>100 số</b> trong <b>200 giây</b> để thắng.',
    '<b>Kéo rê</b> chuột/ngón tay sẽ không tính là click — tránh click oan.',
    'Xoay màn hình / đổi kích thước cửa sổ — các số tự sắp xếp lại, trạng thái đã click vẫn giữ nguyên.'
  ],
  mod
});
})();