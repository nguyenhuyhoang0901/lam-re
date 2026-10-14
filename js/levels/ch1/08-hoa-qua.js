/* Chương 1 · Ải 8: Hoa quả — năm viên ngọc ứng với ngũ hành. Puzzle kéo ngọc tự do (kiểu Puzzle & Dragons).
   - Lưới 6 cột x 5 hàng. Kéo một ngọc qua các ô: ngọc bị chạm tới đổi chỗ với ngọc đang kéo.
   - Thả tay (hoặc hết giờ kéo) thì các đường >= 3 ngọc cùng hành, thẳng ngang/dọc, được tính điểm và biến mất;
     ngọc phía trên rơi xuống, ngọc mới sinh ra từ trên; kiểm tra lại chuỗi combo.
   - 5 màn nối tiếp, điểm cộng dồn. Mỗi màn có một hành chủ đề: ngọc tương sinh x2, tương khắc x0.5.
   - Qua màn 5 đạt mục tiêu là qua ải. Hết lượt mà chưa đạt mục tiêu của màn: thua, chơi lại từ màn 1.
   Khối "LUẬT CHƠI" ở đầu file là hàm thuần (không đụng giao diện) nên dễ chỉnh số liệu và kiểm thử. */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound, Input} = LR;
const {clamp, TAU, INK} = LR.util;

/* =====================================================================
   LUẬT CHƠI (hàm thuần)
   ===================================================================== */
const COLS = 6, ROWS = 5;
const ELEMS = ['kim', 'thuy', 'moc', 'hoa', 'tho'];       // chỉ số 0..4 = loại ngọc
const INFO = {
  kim:  {name:'Kim',  fruit:'Thanh long',  col:'#aeb6bd', 	note:'Quả thanh long'},
  thuy: {name:'Thủy', fruit:'Dưa hấu',	   col:'#3b7dd8', 	note:'Quả dưa hấu'},
  moc:  {name:'Mộc',  fruit:'Xoài',		    col:'#3f9a4e', 	note:'Quả xoài'},
  hoa:  {name:'Hỏa',  fruit:'Cam',		  col:'#e24a33', 	note:'Quả cam'},
  tho:  {name:'Thổ',  fruit:'Chuối',	   col:'#c9953a', 	note:'Quả chuối'}
};
// Tương sinh: Mộc → Hỏa → Thổ → Kim → Thủy → Mộc.  Tương khắc: Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim, Kim khắc Mộc.
const SINH = {moc:'hoa', hoa:'tho', tho:'kim', kim:'thuy', thuy:'moc'};      // a sinh b
const KHAC = {moc:'tho', tho:'thuy', thuy:'hoa', hoa:'kim', kim:'moc'};      // a khắc b

// Hệ số của ngọc `e` so với hành chủ đề `theme`: sinh ra chủ đề x2, khắc chủ đề x0.5, còn lại x1
function wxMult(theme, e){
  if(e === theme) return 1;
  if(SINH[e] === theme) return 2;
  if(KHAC[e] === theme) return .5;
  return 1;
}

// 5 màn nối tiếp. target = mục tiêu điểm TÍCH LŨY (đã chỉnh bằng mô phỏng người chơi các trình độ),
// diff = hệ số độ khó nhân vào điểm, drag = số giây cho mỗi lần kéo.
const STAGES = [
  {theme:'moc',  moves:12, target:3000,  diff:1.00, drag:6},
  {theme:'hoa',  moves:12, target:7000, diff:.95,  drag:5.5},
  {theme:'tho',  moves:11, target:12000, diff:.90,  drag:5},
  {theme:'kim',  moves:11, target:17500, diff:.85,  drag:4.5},
  {theme:'thuy', moves:10, target:23000, diff:.80,  drag:4}
];

const randE = () => Math.floor(Math.random() * 5);

// Bàn khởi đầu: không có sẵn đường nào
function newBoard(){
  const g = [];
  for(let r=0;r<ROWS;r++){
    const row = [];
    for(let c=0;c<COLS;c++){
      let e;
      do { e = randE(); }
      while((c>=2 && row[c-1]===e && row[c-2]===e) || (r>=2 && g[r-1][c]===e && g[r-2][c]===e));
      row.push(e);
    }
    g.push(row);
  }
  return g;
}

// Chỉ tính đường THẲNG >= 3 liên tiếp theo hàng ngang hoặc cột dọc (L, T-lẻ, vuông, khối không tính).
// g[r][c] = loại ngọc (-1 = ô trống). Trả về danh sách đường {e, dir, cells:[[r,c],...]}
function findLines(g){
  const lines = [];
  for(let r=0;r<ROWS;r++){
    let c = 0;
    while(c < COLS){
      let j = c; const e = g[r][c];
      while(e >= 0 && j+1 < COLS && g[r][j+1] === e) j++;
      if(e >= 0 && j-c+1 >= 3){ const cells = []; for(let k=c;k<=j;k++) cells.push([r,k]); lines.push({e, dir:'h', cells}); }
      c = j+1;
    }
  }
  for(let c=0;c<COLS;c++){
    let r = 0;
    while(r < ROWS){
      let j = r; const e = g[r][c];
      while(e >= 0 && j+1 < ROWS && g[j+1][c] === e) j++;
      if(e >= 0 && j-r+1 >= 3){ const cells = []; for(let k=r;k<=j;k++) cells.push([k,c]); lines.push({e, dir:'v', cells}); }
      r = j+1;
    }
  }
  return lines;
}

// Điểm một đường: số ngọc x 10 x hệ số ngũ hành x (1 + combo x 0.25) x hệ số độ khó của màn
const lineScore = (len, theme, e, comboIndex, diff) => Math.round(len * 10 * wxMult(theme, e) * (1 + comboIndex * .25) * diff);

/* =====================================================================
   MÀN CHƠI
   ===================================================================== */
const mod = (function(){
  const CLEAR_STEP = .16;          // giây giữa hai đường khi tiêu diệt lần lượt (nghe từng nốt combo)
  const PENTA = {thuy:440, moc:330, hoa:392, tho:262, kim:294};   // 5 ngọc = 5 âm của gam ngũ cung (Vũ, Giốc, Chủy, Cung, Thương)
  const PAPER = '#f4ead2', PAPER2 = '#ecdcb8', PAPER3 = '#e0c98f', RED = '#c8352b', GOLD = '#e6b422', GREEN = '#3f7d4e';

  let ctx = null, W = 360, H = 640, dpr = 1, u = 1, clock = 0;
  let platform = 'pc', lay = null;
  let grid = [], stageIdx = 0, total = 0, shown = 0, moves = 0, phase = 'intro', step = 'find';
  let held = null, ptr = {x:0, y:0}, dragLeft = 0, dragMax = 6, swaps = 0, lastTick = 99;
  let lines = [], clearT = 0, comboN = 0, moveGain = 0, maxCombo = 0, bestMove = 0, finished = false;
  let pops = [], parts = [], banner = null, msg = '', msgT = 0, hoverCursor = '';
  let btn = {x:0, y:0, w:0, h:0}, landed = false;

  /* ----- nhận diện thiết bị ----- */
  function detectPlatform(){
    const ua = navigator.userAgent || '';
    const pts = navigator.maxTouchPoints || 0;
    const hasTouch = ('ontouchstart' in window) || pts > 0;
    const coarse = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua) || (/Macintosh/.test(ua) && pts > 1);   // iPadOS giả Mac
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const score = (hasTouch ? 1 : 0) + (coarse ? 2 : 0) + (mobileUA ? 2 : 0) + (small ? 1 : 0);
    const mobile = score >= 3;                       // cảm ứng thuần (laptop có màn cảm ứng vẫn là PC)
    document.body.classList.toggle('is-mobile', mobile);
    document.body.classList.toggle('is-pc', !mobile);
    return mobile ? 'mobile' : 'pc';
  }

  /* ----- âm thanh (WebAudio, dùng chung bộ Sound của game) ----- */
  const S = {
    pick(){ Sound.tone('sine', 620, 780, .07, .12); },
    swap(n){ Sound.tone('triangle', 420 + (n % 14)*32, 440 + (n % 14)*32, .05, .07); },
    line(e, ci){ const f = PENTA[e] * Math.pow(1.0595, Math.min(ci, 12)); Sound.tone('triangle', f, f*1.01, .24, .2); Sound.tone('sine', f*2, f*2, .12, .07, .02); Sound.noise(.07, .1, 'bandpass', 2400, 900, 0, 1.2); },
    land(){ Sound.noise(.08, .08, 'lowpass', 700, 250); },
    tick(){ Sound.tone('square', 880, 880, .03, .06); },
    timeout(){ Sound.tone('square', 520, 200, .25, .12); },
    none(){ Sound.tone('triangle', 220, 150, .16, .12); },
    big(){ [784, 988, 1319].forEach((f,i)=> Sound.tone('triangle', f, f, .12, .14, i*.06)); },
    clear(){ [523, 659, 784, 1047, 1319].forEach((f,i)=> Sound.tone('triangle', f, f, .18, .18, i*.09)); }
  };

  /* ----- bố cục ----- */
  function layout(){
    ctx = G.ctx; W = G.W; H = G.H; dpr = G.dpr; u = G.u;
    platform = detectPlatform();
    const m = 10*u, top = G.top + 8*u, wide = W >= 760 && W/H >= 1.1;
    if(wide){
      const sw = clamp(W*.30, 270, 370), areaW = W - sw - m*3, areaH = H - top - m - 36*u;
      const cs = Math.floor(Math.min(areaW/COLS, areaH/ROWS, 124)), bw = cs*COLS, bh = cs*ROWS;
      const ox = Math.round(m + (areaW - bw)/2), oy = Math.round(top + 36*u + (areaH - bh)/2);
      lay = {wide:true, cs, ox, oy, bw, bh, timer:{x:ox, y:oy - 32*u, w:bw, h:22*u}, side:{x:W - sw - m, y:top, w:sw, h:H - top - m}};
    } else {
      const panelH = 108*u, legendH = 66*u, timerH = 24*u, gap = 8*u;
      const csMax = (H - top - panelH - legendH - timerH - gap*4 - m) / ROWS;
      const cs = Math.floor(Math.min((W - 2*m)/COLS, csMax, 110)), bw = cs*COLS, bh = cs*ROWS;
      const stack = panelH + legendH + timerH + bh + gap*3;
      const y0 = top + Math.max(0, (H - top - m - stack)/2), ox = Math.round((W - bw)/2);
      lay = {wide:false, cs, ox, bw, bh,
        panel:{x:m, y:y0, w:W - 2*m, h:panelH},
        legend:{x:m, y:y0 + panelH + gap, w:W - 2*m, h:legendH},
        timer:{x:ox, y:y0 + panelH + legendH + gap*2, w:bw, h:timerH},
        oy:Math.round(y0 + panelH + legendH + timerH + gap*3)};
    }
    btn = {x:(W - 210*u)/2, y:0, w:210*u, h:50*u};
  }
  const resize = layout;

  /* ----- trạng thái ----- */
  function makeFruit(e, r, c){ return {e, x:c, y:r, vy:0, fall:false, s:1, clearAt:undefined, clr:0}; }
  function boardFromElems(g){ return g.map((row, r) => row.map((e, c) => makeFruit(e, r, c))); }
  const elems = () => grid.map(row => row.map(f => f ? f.e : -1));
  const stage = () => STAGES[stageIdx];
  const prevTarget = () => stageIdx > 0 ? STAGES[stageIdx-1].target : 0;
  const fmt = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function enter(){
    ctx = G.ctx; layout();
    Input.consumeAct();
    stageIdx = 0; total = 0; shown = 0; moves = stage().moves; maxCombo = 0; bestMove = 0; finished = false;
    grid = boardFromElems(newBoard());
    held = null; lines = []; pops = []; parts = []; banner = null; msg = ''; msgT = 0; clock = 0;
    phase = 'intro'; step = 'find';
    G.cv.style.cursor = platform === 'pc' ? 'default' : '';
    hud();
  }
  function exit(){
    G.cv.style.cursor = '';
    document.body.classList.remove('is-mobile', 'is-pc');
  }
  function hud(){
    G.hud.set([
      {l:'Màn',  v:(stageIdx+1) + '/' + STAGES.length},
      {l:'Lượt', v:moves, w:moves <= 2 && phase !== 'intro'},
      {l:'Điểm', v:fmt(shown)}
    ]);
  }
  const setMsg = (t, s) => { msg = t; msgT = s || 1.8; };

  /* ----- kéo thả ----- */
  const cellAt = (x, y) => ({c:Math.floor((x - lay.ox)/lay.cs), r:Math.floor((y - lay.oy)/lay.cs)});
  const inBoard = (x, y) => x >= lay.ox && x < lay.ox + lay.bw && y >= lay.oy && y < lay.oy + lay.bh;

  function pointerDown(x, y, e){
    ptr = {x, y};
    if(phase === 'intro' || phase === 'clear'){
      if(x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) panelOk();
      return;
    }
    if(phase !== 'idle' || !inBoard(x, y)) return;
    const {c, r} = cellAt(x, y), f = grid[r][c];
    if(!f) return;
    held = {r, c, f}; swaps = 0; dragMax = dragLeft = stage().drag; lastTick = 99;
    phase = 'drag'; S.pick();
    if(e && e.pointerType === 'mouse') G.cv.style.cursor = 'grabbing';
  }
  function pointerMove(x, y, e){
    ptr = {x, y};
    if(phase === 'idle' && e && e.pointerType === 'mouse'){
      const cur = inBoard(x, y) ? 'grab' : 'default';
      if(cur !== hoverCursor){ hoverCursor = cur; G.cv.style.cursor = cur; }
    }
    if(phase !== 'drag' || !held) return;
    // Ô đích: ô chứa con trỏ (kẹp vào mép bàn); chỉ đổi khi con trỏ nằm sâu trong ô mới để không rung ở biên ô
    let c = Math.floor((x - lay.ox)/lay.cs), r = Math.floor((y - lay.oy)/lay.cs);
    c = clamp(c, 0, COLS-1); r = clamp(r, 0, ROWS-1);
    if(c === held.c && r === held.r) return;
    const cx = lay.ox + (c + .5)*lay.cs, cy = lay.oy + (r + .5)*lay.cs, lim = .4*lay.cs;
    const clampedX = clamp(x, lay.ox, lay.ox + lay.bw), clampedY = clamp(y, lay.oy, lay.oy + lay.bh);
    if(Math.abs(clampedX - cx) > lim || Math.abs(clampedY - cy) > lim) return;
    for(let guard=0; guard<12 && (held.c !== c || held.r !== r); guard++){
      const nr = held.r + Math.sign(r - held.r), nc = held.c + Math.sign(c - held.c);   // 8 hướng
      const other = grid[nr][nc];
      grid[held.r][held.c] = other; grid[nr][nc] = held.f;
      held.r = nr; held.c = nc; swaps++; S.swap(swaps);
    }
  }
  function pointerUp(){
    if(phase === 'drag') release(false);
  }
  function release(timeout){
    if(!held) return;
    held = null; G.cv.style.cursor = platform === 'pc' ? 'default' : ''; hoverCursor = '';
    if(timeout){ setMsg('Hết giờ kéo!', 1.6); S.timeout(); }
    if(swaps === 0){ phase = 'idle'; return; }          // thả ngay tại chỗ: không tốn lượt
    moves--; comboN = 0; moveGain = 0;
    phase = 'resolve'; step = 'find'; hud();
  }

  /* ----- vòng lặp ----- */
  function update(dt){
    clock += dt;
    shown += (total - shown) * Math.min(1, dt*8); if(Math.abs(total - shown) < .5) shown = total;
    if(msgT > 0) msgT -= dt;
    if(banner){ banner.t += dt; if(banner.t > 1) banner = null; }
    for(const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 1.1);
    for(const p of parts){ p.t += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 520*u*dt; }
    parts = parts.filter(p => p.t < p.life);
    animateFruits(dt);

    if(phase === 'intro' || phase === 'clear'){ if(Input.consumeAct()) panelOk(); hud(); return; }
    if(phase === 'drag'){
      dragLeft -= dt;
      const k = Math.ceil(dragLeft*2);
      if(dragLeft < 2 && k < lastTick){ lastTick = k; S.tick(); }
      if(dragLeft <= 0){ dragLeft = 0; release(true); }
    }
    if(phase === 'resolve') resolveStep(dt);
    hud();
  }
  function animateFruits(dt){
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      const f = grid[r][c]; if(!f || (held && held.f === f)) continue;
      if(f.fall){
        f.vy += 70*dt; f.y += f.vy*dt;
        if(f.y >= r){ f.y = r; f.vy = 0; f.fall = false; landed = true; }
        f.x += (c - f.x) * Math.min(1, dt*26);
      } else {
        const k = Math.min(1, dt*26);
        f.x += (c - f.x)*k; f.y += (r - f.y)*k;
        if(Math.abs(c - f.x) < .002) f.x = c;
        if(Math.abs(r - f.y) < .002) f.y = r;
      }
    }
  }

  /* ----- chuỗi tiêu diệt - rơi - kiểm tra lại ----- */
  function resolveStep(dt){
    const st = stage();
    if(step === 'find'){
      const L = findLines(elems());
      if(!L.length){ endMove(); return; }
      lines = L.map((ln, i) => ({e:ln.e, dir:ln.dir, cells:ln.cells, ci:comboN + i, delay:i*CLEAR_STEP, fired:false,
        score:lineScore(ln.cells.length, st.theme, ln.e, comboN + i, st.diff)}));
      comboN += L.length;
      for(const ln of lines) for(const [r,c] of ln.cells){
        const f = grid[r][c]; f.clearAt = f.clearAt === undefined ? ln.delay : Math.min(f.clearAt, ln.delay);
      }
      clearT = 0; step = 'clearing';
    } else if(step === 'clearing'){
      clearT += dt;
      for(const ln of lines) if(!ln.fired && clearT >= ln.delay) fireLine(ln);
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
        const f = grid[r][c]; if(!f || f.clearAt === undefined) continue;
        const tt = clearT - f.clearAt;
        f.s = tt <= 0 ? 1 : tt < .08 ? 1 + tt*2.5 : Math.max(0, 1.2 - (tt - .08)/.2*1.2);
        f.clr = Math.max(0, tt);
      }
      const last = lines[lines.length-1].delay;
      if(clearT >= last + .32){ dropAndRefill(); step = 'falling'; landed = false; }
    } else if(step === 'falling'){
      let any = false;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ const f = grid[r][c]; if(f && f.fall) any = true; }
      if(!any){ if(landed){ S.land(); landed = false; } step = 'find'; }
    }
  }
  function fireLine(ln){
    ln.fired = true;
    total += ln.score; moveGain += ln.score;
    let sr = 0, sc = 0; for(const [r,c] of ln.cells){ sr += r; sc += c; }
    const n = ln.cells.length, cx = lay.ox + (sc/n + .5)*lay.cs, cy = lay.oy + (sr/n + .5)*lay.cs;
    pops.push({x:cx, y:cy, t:0, text:'+' + ln.score, col:INFO[ELEMS[ln.e]].col});
    for(const [r,c] of ln.cells){
      for(let i=0;i<5;i++){
        const a = Math.random()*TAU, s = (90 + Math.random()*170)*u;
        parts.push({x:lay.ox + (c+.5)*lay.cs, y:lay.oy + (r+.5)*lay.cs, vx:Math.cos(a)*s, vy:Math.sin(a)*s - 120*u, t:0, life:.55 + Math.random()*.3, r:(2 + Math.random()*3)*u, col:INFO[ELEMS[ln.e]].col});
      }
    }
    S.line(ELEMS[ln.e], ln.ci);
    if(comboN >= 2){ banner = {t:0, text:'COMBO ' + comboN}; if(comboN >= 5 && ln.ci === comboN - 1) S.big(); }
    maxCombo = Math.max(maxCombo, comboN);
  }
  function dropAndRefill(){
    for(let c=0;c<COLS;c++){
      const keep = [];
      for(let r=ROWS-1;r>=0;r--){ const f = grid[r][c]; if(f && f.clearAt === undefined) keep.push(f); }
      const missing = ROWS - keep.length;
      for(let k=0;k<missing;k++){ const f = makeFruit(randE(), -1 - k, c); f.y = -1 - k; f.fall = true; keep.push(f); }
      for(let i=0;i<ROWS;i++){
        const r = ROWS - 1 - i, f = keep[i];
        grid[r][c] = f; f.clearAt = undefined; f.s = 1; f.clr = 0;
        if(f.y < r - .001){ f.fall = true; f.vy = f.vy || 0; }
      }
    }
    lines = [];
  }
  function endMove(){
    if(moveGain === 0){ setMsg('Không tạo được đường nào. Mất 1 lượt.', 2); S.none(); }
    bestMove = Math.max(bestMove, moveGain);
    if(moves > 0){ phase = 'idle'; return; }
    stageEnd();
  }

  /* ----- kết thúc màn ----- */
  function stageEnd(){
    const st = stage();
    if(total >= st.target){
      if(stageIdx === STAGES.length - 1){ win(); return; }
      phase = 'clear'; banner = null; S.clear();
    } else { banner = null; lose(); }
  }
  function win(){
    if(finished) return; finished = true; phase = 'over'; S.clear();
    const last = STAGES[STAGES.length-1].target;
    const stars = total >= last*1.25 ? 3 : total >= last*1.1 ? 2 : 1;
    G.finish({win:true, score:total, stars, title:'Đủ năm viên ngọc!', msg:'Ngũ hành sinh khắc hài hòa, năm viên ngọc tụ đủ. Nhà vợ khen hết lời.',
      rows:[['Tổng điểm', fmt(total)], ['Mục tiêu màn cuối', fmt(last)], ['Combo cao nhất', maxCombo], ['Điểm cao nhất một lượt', fmt(bestMove)]]});
  }
  function lose(){
    if(finished) return; finished = true; phase = 'over';
    const st = stage();
    G.finish({win:false, score:total, title:'Hết lượt!',
      msg:'Dừng ở màn ' + (stageIdx+1) + ' (' + INFO[st.theme].name + '): ' + fmt(total) + '/' + fmt(st.target) + ' điểm. Chơi lại từ màn 1 nhé.',
      rows:[['Tổng điểm', fmt(total)], ['Màn đã tới', (stageIdx+1) + '/' + STAGES.length], ['Combo cao nhất', maxCombo], ['Điểm cao nhất một lượt', fmt(bestMove)]]});
  }
  function panelOk(){
    if(phase === 'intro'){ phase = 'idle'; S.pick(); }
    else if(phase === 'clear'){ stageIdx++; moves = stage().moves; phase = 'intro'; S.pick(); }
  }

  /* =====================================================================
     VẼ NGỌC
     ===================================================================== */
  function ink(w){ ctx.strokeStyle = INK; ctx.lineWidth = w || .07; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }
  function lg(x0, y0, x1, y1, a, b, c){ const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, a); if(c){ g.addColorStop(.55, b); g.addColorStop(1, c); } else g.addColorStop(1, b); return g; }
  function rg(x, y, r0, r1, a, b, c){ const g = ctx.createRadialGradient(x, y, r0, x, y, r1); g.addColorStop(0, a); if(c){ g.addColorStop(.55, b); g.addColorStop(1, c); } else g.addColorStop(1, b); return g; }
  function shine(x, y, rx, ry, rot){
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  // Mỗi hành một kiểu cắt ngọc riêng (vẽ trong hệ toạ độ đơn vị -1..1).
  // Mỗi viên có: thân ngọc chuyển màu, các mặt cắt sáng/tối, mặt bàn sẫm ở giữa và BIỂU TƯỢNG NGŨ HÀNH nổi lên trên mặt bàn.
  function poly(pts){ ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function ring(n, r, rot){ const a = []; for(let i=0;i<n;i++){ const t = rot + i*TAU/n; a.push([Math.cos(t)*r, Math.sin(t)*r]); } return a; }
  // dải mặt cắt nối hai đa giác cùng số đỉnh (outer -> inner), tô lần lượt theo fills
  function facetBand(outer, inner, fills){
    for(let i=0;i<outer.length;i++){
      const j = (i+1) % outer.length;
      poly([outer[i], outer[j], inner[j], inner[i]]); ctx.fillStyle = fills[i % fills.length]; ctx.fill();
    }
  }
  // đường gờ sáng: viền đa giác + các đường nối đỉnh ngoài -> đỉnh trong
  function ridges(outer, inner, col, w){
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    poly(inner); ctx.stroke();
    ctx.beginPath(); for(let i=0;i<outer.length;i++){ ctx.moveTo(outer[i][0], outer[i][1]); ctx.lineTo(inner[i][0], inner[i][1]); } ctx.stroke();
  }
  function spark(x, y, r){      // tia sáng 4 cánh
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r*.14, -r*.14, r, 0); ctx.quadraticCurveTo(r*.14, r*.14, 0, r);
    ctx.quadraticCurveTo(-r*.14, r*.14, -r, 0); ctx.quadraticCurveTo(-r*.14, -r*.14, 0, -r); ctx.fill(); ctx.restore();
  }
  // Biểu tượng nổi: bóng đen mờ lệch xuống rồi nét trắng ngà phía trên
  function emboss(draw, x, y, s){
    ctx.save(); ctx.translate(x || 0, y || 0); ctx.scale(s || 1, s || 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(.025, .04); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.strokeStyle = 'rgba(0,0,0,.42)'; draw(); ctx.restore();
    ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = '#fffdf2'; draw(); ctx.restore();
  }
  const SYM = {
    kim(){ ctx.lineWidth = .075; ctx.beginPath(); ctx.arc(0, 0, .3, 0, TAU); ctx.stroke(); ctx.lineWidth = .06; ctx.strokeRect(-.1, -.1, .2, .2); },   // đồng tiền
    thuy(){ ctx.lineWidth = .075; for(const y of [-.2, .02, .24]){ ctx.beginPath(); ctx.moveTo(-.32, y); ctx.quadraticCurveTo(-.16, y-.15, 0, y); ctx.quadraticCurveTo(.16, y+.15, .32, y); ctx.stroke(); } },  // sóng nước
    moc(){                                                                                            // mầm cây
      ctx.lineWidth = .07; ctx.beginPath(); ctx.moveTo(0, .34); ctx.lineTo(0, -.02); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, .08); ctx.quadraticCurveTo(-.4, .04, -.36, -.3); ctx.quadraticCurveTo(-.02, -.28, 0, .08); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -.02); ctx.quadraticCurveTo(.4, -.04, .34, -.38); ctx.quadraticCurveTo(0, -.34, 0, -.02); ctx.fill();
    },
    hoa(){                                                                                            // ngọn lửa
      ctx.beginPath(); ctx.moveTo(0, .42);
      ctx.bezierCurveTo(-.36, .42, -.42, .06, -.26, -.14);          // thân trái, ngọn lửa nhỏ bên trái
      ctx.bezierCurveTo(-.22, -.04, -.16, 0, -.12, 0);
      ctx.bezierCurveTo(-.14, -.2, -.04, -.34, .08, -.48);          // ngọn lửa chính nhọn, lệch phải
      ctx.bezierCurveTo(.1, -.26, .32, -.12, .36, .12);
      ctx.bezierCurveTo(.4, .34, .2, .42, 0, .42); ctx.closePath(); ctx.fill();
    },
    tho(){ ctx.beginPath(); ctx.moveTo(-.4, .3); ctx.lineTo(-.13, -.26); ctx.lineTo(.08, .06); ctx.lineTo(.2, -.1); ctx.lineTo(.42, .3); ctx.closePath(); ctx.fill(); }   // núi đất
  };
  const sh = (x) => 'rgba(20,28,40,' + x + ')', wh = (x) => 'rgba(255,255,255,' + x + ')';

  function gemKim(){          // Kim: bạc cắt brilliant bát giác, mặt bàn thép sẫm, đồng tiền nổi
    const o = ring(8, .94, Math.PI/8), t = ring(8, .54, Math.PI/8);
    poly(o); ctx.fillStyle = lg(-.7, -.8, .7, .8, '#fbfdff', '#b4bcc4', '#566068'); ctx.fill();
    facetBand(o, t, [sh(.3), sh(.42), sh(.18), wh(.3), wh(.6), wh(.5), wh(.22), sh(.2)]);
    poly(t); ctx.fillStyle = lg(-.4, -.5, .4, .5, '#76818c', '#454d56', '#2a3037'); ctx.fill();
    ridges(o, t, wh(.55), .03);
    poly(o); ink(.07); ctx.stroke();
    emboss(SYM.kim);
    spark(.55, -.58, .17); shine(-.42, -.52, .07, .13, .7);
  }
  function dropPath(s, dy){
    ctx.beginPath(); ctx.moveTo(0, -.94*s + dy);
    ctx.bezierCurveTo(.62*s, -.7*s + dy, .9*s, -.18*s + dy, .76*s, .34*s + dy);
    ctx.bezierCurveTo(.6*s, .86*s + dy, -.6*s, .86*s + dy, -.76*s, .34*s + dy);
    ctx.bezierCurveTo(-.9*s, -.18*s + dy, -.62*s, -.7*s + dy, 0, -.94*s + dy); ctx.closePath();
  }
  function gemThuy(){         // Thủy: ngọc lam cắt giọt nước, ánh sóng, sóng nước nổi
    dropPath(1, 0); ctx.fillStyle = rg(-.25, -.35, .05, 1.05, '#c4e4ff', '#3b7dd8', '#12356f'); ctx.fill();
    dropPath(.7, .14); ctx.fillStyle = 'rgba(6,36,100,.5)'; ctx.fill(); ctx.strokeStyle = wh(.5); ctx.lineWidth = .035; ctx.stroke();
    ctx.strokeStyle = wh(.4); ctx.lineWidth = .045; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-.66, .05); ctx.quadraticCurveTo(-.72, .42, -.42, .66); ctx.stroke();            // ánh sáng viền trái
    ctx.beginPath(); ctx.moveTo(0, -.92); ctx.lineTo(0, -.58); ctx.moveTo(-.28, -.64); ctx.lineTo(-.18, -.46); ctx.moveTo(.28, -.64); ctx.lineTo(.18, -.46); ctx.stroke();
    dropPath(1, 0); ink(.07); ctx.stroke();
    emboss(SYM.thuy, 0, .14, 1);
    spark(.46, -.38, .16); shine(-.34, -.46, .07, .16, .5);
  }
  function octRect(w, h, b){ return [[-w+b, -h], [w-b, -h], [w, -h+b], [w, h-b], [w-b, h], [-w+b, h], [-w, h-b], [-w, -h+b]]; }
  function gemMoc(){          // Mộc: lục bảo cắt bậc thang (emerald cut), mầm cây nổi
    const o = octRect(.86, .86, .26), m = octRect(.68, .68, .2), t = octRect(.5, .5, .14);
    poly(o); ctx.fillStyle = lg(-.7, -.7, .7, .7, '#b8f2c2', '#3f9a4e', '#134a20'); ctx.fill();
    const f = [wh(.5), wh(.26), sh(.22), sh(.34), sh(.42), sh(.16), wh(.3), wh(.46)];
    facetBand(o, m, f); facetBand(m, t, f.map(c => c.replace(/[\d.]+\)$/, v => (parseFloat(v)*.7).toFixed(2) + ')')));
    poly(t); ctx.fillStyle = lg(-.4, -.4, .4, .4, '#2e7a3c', '#14572a', '#0b3a1a'); ctx.fill();
    ridges(o, m, wh(.5), .03); ridges(m, t, wh(.45), .028);
    poly(o); ink(.07); ctx.stroke();
    emboss(SYM.moc, 0, .02, .95);
    spark(.58, -.58, .15); shine(-.46, -.5, .06, .12, .75);
  }
  function gemHoa(){          // Hỏa: hồng ngọc cắt tam giác (trillion), ngọn lửa nổi
    const o = [[0, -.95], [.95, .7], [-.95, .7]], c = [0, .15], k = .6;
    const t = o.map(p => [c[0] + (p[0]-c[0])*k, c[1] + (p[1]-c[1])*k]);
    poly(o); ctx.fillStyle = lg(0, -.95, 0, .7, '#ffd2b4', '#e24a33', '#6c1006'); ctx.fill();
    facetBand(o, t, [sh(.28), sh(.44), wh(.42)]);
    poly(t); ctx.fillStyle = lg(0, -.4, 0, .5, '#a82a1c', '#6e0f0a', '#4a0805'); ctx.fill();
    ridges(o, t, wh(.5), .03);
    ctx.lineJoin = 'round'; poly(o); ink(.08); ctx.stroke();
    emboss(SYM.hoa, 0, .16, .74);
    ctx.save(); ctx.translate(0, .17); ctx.scale(.74, .74); ctx.fillStyle = 'rgba(150,30,20,.92)';   // lõi lửa sẫm
    ctx.beginPath(); ctx.moveTo(0, .34); ctx.bezierCurveTo(-.2, .34, -.22, .12, -.08, 0); ctx.bezierCurveTo(-.06, .1, 0, .1, .04, .02);
    ctx.bezierCurveTo(.1, .1, .2, .16, .2, .22); ctx.bezierCurveTo(.2, .3, .1, .34, 0, .34); ctx.closePath(); ctx.fill(); ctx.restore();
    spark(.52, .3, .14); shine(-.2, -.44, .06, .12, .35);
  }
  function gemTho(){          // Thổ: hổ phách cabochon tròn, vân đất, núi nổi
    ctx.beginPath(); ctx.arc(0, .02, .88, 0, TAU);
    ctx.fillStyle = rg(-.3, -.32, .05, 1.08, '#ffeaa8', '#d9a23e', '#6a410c'); ctx.fill();
    ctx.beginPath(); ctx.arc(0, .02, .68, 0, TAU); ctx.strokeStyle = wh(.35); ctx.lineWidth = .04; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, .02, .62, 0, TAU); ctx.fillStyle = 'rgba(96,52,10,.5)'; ctx.fill();
    ctx.fillStyle = 'rgba(255,225,150,.35)';
    for(const [x, y] of [[-.35, .3], [.3, .38], [.45, -.1], [-.42, -.2], [.12, -.42], [-.1, .52]]){ ctx.beginPath(); ctx.arc(x, y, .03, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, .02, .88, 0, TAU); ink(.07); ctx.stroke();
    emboss(SYM.tho, 0, .04, 1);
    spark(.52, -.56, .15); shine(-.42, -.4, .12, .22, .65);
  }
  const DRAW = [gemKim, gemThuy, gemMoc, gemHoa, gemTho];

  function drawFruit(e, cx, cy, r, opt){
    opt = opt || {};
    ctx.save(); ctx.translate(cx, cy);
    if(opt.shadow){ ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(r*.12, r*.95, r*.7, r*.2, 0, 0, TAU); ctx.fill(); }
    if(opt.disc !== false){ ctx.fillStyle = INFO[ELEMS[e]].col; ctx.globalAlpha = (opt.alpha == null ? 1 : opt.alpha) * .32; ctx.beginPath(); ctx.arc(0, 0, r*1.08, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
    if(opt.rot) ctx.rotate(opt.rot);
    ctx.scale(r, r); DRAW[e]();
    ctx.restore();
  }

  /* =====================================================================
     VẼ GIAO DIỆN
     ===================================================================== */
  const font = (px, w, serif) => (w || 600) + ' ' + Math.round(px) + 'px ' + (serif ? '"Playfair Display", Georgia, serif' : '"Be Vietnam Pro", system-ui, sans-serif');
  function rr(x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  }
  function card(x, y, w, h, fill){
    ctx.fillStyle = 'rgba(31,26,23,.9)'; rr(x+3, y+3, w, h, 10*u); ctx.fill();
    ctx.fillStyle = fill || PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(x, y, w, h, 10*u); ctx.fill(); ctx.stroke();
  }
  function text(t, x, y, px, w, col, align, serif){
    ctx.font = font(px, w, serif); ctx.fillStyle = col || INK; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y);
  }
  function fitText(t, x, y, px, w, col, align, maxW){
    let p = px; ctx.font = font(p, w);
    while(p > 9 && ctx.measureText(t).width > maxW){ p -= .5; ctx.font = font(p, w); }
    text(t, x, y, p, w, col, align);
  }
  function progressBar(x, y, w, h){
    const st = stage(), prev = prevTarget(), pct = clamp((total - prev)/(st.target - prev), 0, 1);
    ctx.fillStyle = PAPER3; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; rr(x, y, w, h, h/2); ctx.fill(); ctx.stroke();
    if(pct > 0.01){ ctx.fillStyle = total >= st.target ? GREEN : RED; rr(x+2, y+2, Math.max(h-4, (w-4)*pct), h-4, (h-4)/2); ctx.fill(); }
    text(Math.round(pct*100) + '%', x + w/2, y + h/2 + 1, h*.72, 700, pct > .5 ? '#fff6e6' : INK, 'center');
  }
  const multCol = m => m > 1 ? '#1b8a52' : m < 1 ? '#c62828' : '#6b5b45';
  const multTxt = m => 'x' + m.toFixed(1);

  function drawPanelNarrow(){
    const p = lay.panel, st = stage(), x = p.x, y = p.y;
    card(p.x, p.y, p.w, p.h);
    fitText('ĐIỂM: ' + fmt(shown) + ' / ' + fmt(st.target), x + 12*u, y + 22*u, 22*u, 800, INK, 'left', p.w*.64);
    text('LƯỢT: ' + moves, x + p.w - 12*u, y + 22*u, 20*u, 800, moves <= 2 ? RED : INK, 'right');
    progressBar(x + 12*u, y + 42*u, p.w - 24*u, 20*u);
    const th = INFO[st.theme];
    ctx.fillStyle = th.col; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 24*u, y + 84*u, 13*u, 0, TAU); ctx.fill(); ctx.stroke();
    drawFruit(ELEMS.indexOf(st.theme), x + 24*u, y + 84*u, 9*u, {disc:false});
    text('Màn ' + (stageIdx+1) + '/' + STAGES.length + ' · ' + th.name.toUpperCase() + ' (' + th.fruit + ')', x + 46*u, y + 84*u, 15*u, 800, INK, 'left');
    text('Độ khó x' + st.diff.toFixed(2), x + p.w - 12*u, y + 84*u, 12.5*u, 600, '#6b5b45', 'right');
    // chú giải hệ số
    const l = lay.legend; card(l.x, l.y, l.w, l.h, PAPER2);
    const sw = l.w/5;
    for(let i=0;i<5;i++){
      const m = wxMult(st.theme, ELEMS[i]), cx = l.x + sw*(i + .5);
      drawFruit(i, cx, l.y + 20*u, 13*u, {disc:true});
      text(multTxt(m), cx, l.y + 44*u, 14*u, 800, multCol(m), 'center');
      text(INFO[ELEMS[i]].name, cx, l.y + 57*u, 10*u, 600, '#6b5b45', 'center');
    }
  }
  function drawSidebar(){
    const s = lay.side, st = stage(), th = INFO[st.theme], x = s.x, y = s.y, pad = 14*u;
    card(s.x, s.y, s.w, s.h);
    let yy = y + 24*u;
    text('MÀN ' + (stageIdx+1) + ' / ' + STAGES.length, x + pad, yy, 14*u, 700, '#6b5b45', 'left');
    text('Độ khó x' + st.diff.toFixed(2), x + s.w - pad, yy, 13*u, 600, '#6b5b45', 'right');
    yy += 34*u;
    ctx.fillStyle = th.col; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + pad + 22*u, yy, 24*u, 0, TAU); ctx.fill(); ctx.stroke();
    drawFruit(ELEMS.indexOf(st.theme), x + pad + 22*u, yy, 16*u, {disc:false});
    text('HÀNH ' + th.name.toUpperCase(), x + pad + 56*u, yy - 8*u, 24*u, 900, INK, 'left', true);
    text(th.fruit, x + pad + 56*u, yy + 14*u, 14*u, 600, '#6b5b45', 'left');
    yy += 50*u;
    fitText('ĐIỂM: ' + fmt(shown) + ' / ' + fmt(st.target), x + pad, yy, 22*u, 800, INK, 'left', s.w - pad*2);
    yy += 26*u; progressBar(x + pad, yy - 10*u, s.w - pad*2, 22*u);
    yy += 34*u;
    text('LƯỢT CÒN LẠI: ' + moves, x + pad, yy, 17*u, 800, moves <= 2 ? RED : INK, 'left');
    yy += 22*u;
    text('Mỗi lần kéo tối đa ' + st.drag + ' giây', x + pad, yy, 13*u, 600, '#6b5b45', 'left');
    yy += 22*u; ctx.strokeStyle = 'rgba(31,26,23,.3)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(x + pad, yy); ctx.lineTo(x + s.w - pad, yy); ctx.stroke(); ctx.setLineDash([]);
    yy += 18*u;
    text('Hệ số điểm theo hành ' + th.name, x + pad, yy, 14*u, 800, INK, 'left'); yy += 12*u;
    const rowH = Math.min(46*u, (y + s.h - yy - 40*u)/5);
    for(let i=0;i<5;i++){
      const e = ELEMS[i], m = wxMult(st.theme, e), cy = yy + rowH*(i + .5);
      drawFruit(i, x + pad + 18*u, cy, Math.min(15*u, rowH*.36), {disc:true});
      text(INFO[e].name + ' · ' + INFO[e].fruit, x + pad + 46*u, cy - 6*u, 13*u, 700, INK, 'left');
      text(m > 1 ? 'tương sinh' : m < 1 ? 'tương khắc' : (e === st.theme ? 'cùng hành' : 'bình thường'), x + pad + 46*u, cy + 10*u, 11*u, 500, '#6b5b45', 'left');
      text(multTxt(m), x + s.w - pad, cy, 17*u, 800, multCol(m), 'right');
    }
    text(platform === 'pc' ? 'Nhấn giữ chuột và kéo ngọc' : 'Chạm giữ và kéo ngọc', x + pad, y + s.h - 18*u, 12.5*u, 600, '#6b5b45', 'left');
  }
  function drawTimer(){
    const t = lay.timer;
    ctx.fillStyle = PAPER3; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; rr(t.x, t.y, t.w, t.h, t.h/2); ctx.fill(); ctx.stroke();
    let label;
    if(phase === 'drag'){
      const k = clamp(dragLeft/dragMax, 0, 1);
      ctx.fillStyle = k > .5 ? GREEN : k > .25 ? GOLD : RED;
      if(k > .01){ rr(t.x+2, t.y+2, Math.max(t.h-4, (t.w-4)*k), t.h-4, (t.h-4)/2); ctx.fill(); }
      label = 'Thời gian kéo: ' + dragLeft.toFixed(1) + ' giây';
    } else if(msgT > 0 && msg) label = msg;
    else label = 'Mỗi lần kéo có ' + stage().drag + ' giây · hết giờ hoặc thả tay là tính điểm';
    fitText(label, t.x + t.w/2, t.y + t.h/2 + 1, t.h*.62, 700, phase === 'drag' && dragLeft < dragMax*.25 ? '#fff6e6' : INK, 'center', t.w - 16*u);
  }
  function drawBoard(){
    const {cs, ox, oy, bw, bh} = lay, r = cs*.4;
    ctx.fillStyle = 'rgba(31,26,23,.9)'; rr(ox - 6*u + 3, oy - 6*u + 3, bw + 12*u, bh + 12*u, 10*u); ctx.fill();
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(ox - 6*u, oy - 6*u, bw + 12*u, bh + 12*u, 10*u); ctx.fill(); ctx.stroke();
    for(let rIdx=0;rIdx<ROWS;rIdx++) for(let c=0;c<COLS;c++){
      ctx.fillStyle = (rIdx + c) % 2 ? PAPER2 : '#e6d3a6'; ctx.fillRect(ox + c*cs, oy + rIdx*cs, cs, cs);
    }
    // ngọc (ngọc đang kéo vẽ sau cùng)
    for(let rIdx=0;rIdx<ROWS;rIdx++) for(let c=0;c<COLS;c++){
      const f = grid[rIdx][c]; if(!f || (held && held.f === f)) continue;
      if(f.s <= 0) continue;
      const px = ox + (f.x + .5)*cs, py = oy + (f.y + .5)*cs;
      if(f.y + .5 < -.2) continue;
      const clearing = f.clearAt !== undefined && f.clr > 0;
      drawFruit(f.e, px, py, r*f.s, {alpha: clearing ? Math.max(0, 1 - f.clr/.3) : 1, rot: clearing ? f.clr*6 : 0});
      if(clearing && f.clr < .09){ ctx.fillStyle = 'rgba(255,255,255,' + (.6 - f.clr*6) + ')'; ctx.beginPath(); ctx.arc(px, py, r*1.1, 0, TAU); ctx.fill(); }
    }
    // chỗ trống của ngọc đang kéo
    if(held){
      const hx = ox + (held.c + .5)*cs, hy = oy + (held.r + .5)*cs;
      ctx.strokeStyle = 'rgba(31,26,23,.4)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 2; rr(hx - cs*.45, hy - cs*.45, cs*.9, cs*.9, 8*u); ctx.stroke(); ctx.setLineDash([]);
      const px = clamp(ptr.x, ox - cs*.3, ox + bw + cs*.3), py = clamp(ptr.y, oy - cs*.3, oy + bh + cs*.3);
      drawFruit(held.f.e, px, py - cs*.12, r*1.2, {shadow:true});
    }
    for(const p of parts){
      ctx.globalAlpha = clamp(1 - p.t/p.life, 0, 1); ctx.fillStyle = p.col; ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for(const p of pops){
      const k = p.t/1.1, y = p.y - 42*u*k;
      ctx.globalAlpha = k < .7 ? 1 : (1 - k)/.3;
      ctx.font = font(24*u, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = '#fff6e6'; ctx.fillText(p.text, p.x, y); ctx.globalAlpha = 1;
    }
    if(banner){
      const k = banner.t, sc = 1 + Math.max(0, .35 - k*1.2), a = k < .7 ? 1 : (1 - k)/.3;
      ctx.save(); ctx.translate(ox + bw/2, oy + bh*.12); ctx.scale(sc, sc); ctx.globalAlpha = a;
      ctx.font = font(34*u, 900, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeText(banner.text, 0, 0);
      ctx.fillStyle = GOLD; ctx.fillText(banner.text, 0, 0); ctx.restore();
    }
  }
  // Bảng giới thiệu màn / qua màn
  function drawPanel(){
    ctx.fillStyle = 'rgba(31,26,23,.55)'; ctx.fillRect(0, 0, W, H);
    const st = stage(), th = INFO[st.theme], intro = phase === 'intro';
    const pw = Math.min(W - 24*u, 460*u), lines = [];
    let ph;
    if(intro){
      lines.push(['Mục tiêu: tích lũy ≥ ' + fmt(st.target) + ' điểm', 800, 17]);
      lines.push(['Số lượt: ' + st.moves + '  ·  Mỗi lần kéo: ' + st.drag + ' giây  ·  Độ khó x' + st.diff.toFixed(2), 600, 13.5]);
      const me = ELEMS.find(e => SINH[e] === st.theme), ke = ELEMS.find(e => KHAC[e] === st.theme);
      lines.push([INFO[me].name + ' (' + INFO[me].fruit + ') sinh ' + th.name + ' → x2.0', 700, 14]);
      lines.push([INFO[ke].name + ' (' + INFO[ke].fruit + ') khắc ' + th.name + ' → x0.5', 700, 14]);
      if(stageIdx === 0){
        lines.push(['Mục tiêu các màn: ' + STAGES.map(s => fmt(s.target)).join(' → '), 500, 12.5]);
        lines.push([platform === 'pc' ? 'Nhấn giữ chuột lên ngọc rồi kéo; thả chuột để tính điểm.' : 'Chạm giữ một ngọc rồi kéo; nhấc tay để tính điểm.', 500, 12.5]);
      }
    } else {
      lines.push(['Điểm tích lũy: ' + fmt(total) + '  (mục tiêu ' + fmt(st.target) + ')', 800, 17]);
      lines.push(['Điểm KHÔNG bị reset, mang sang màn sau.', 500, 13.5]);
      const nx = STAGES[stageIdx+1], nth = INFO[nx.theme];
      lines.push(['Tiếp theo: màn ' + (stageIdx+2) + ' · hành ' + nth.name + ' · cần ' + fmt(nx.target), 700, 14]);
    }
    const textTop = 134*u, step = 26*u;
    ph = textTop + (lines.length - 1)*step + 26*u + btn.h + 18*u;      // chữ rồi mới tới nút
    const px = (W - pw)/2, py = Math.max(G.top + 8*u, (H - ph)/2);
    card(px, py, pw, ph);
    text(intro ? 'MÀN ' + (stageIdx+1) + ' · HÀNH ' + th.name.toUpperCase() : 'LEVEL CLEAR!', W/2, py + 34*u, 26*u, 900, intro ? INK : GREEN, 'center', true);
    if(intro){
      ctx.fillStyle = th.col; ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(W/2, py + 82*u, 26*u, 0, TAU); ctx.fill(); ctx.stroke();
      drawFruit(ELEMS.indexOf(st.theme), W/2, py + 82*u, 18*u, {disc:false});
    } else {
      const ratio = total / st.target, n = ratio >= 1.5 ? 3 : ratio >= 1.2 ? 2 : 1;
      text('★'.repeat(n) + '☆'.repeat(3 - n), W/2, py + 82*u, 34*u, 900, GOLD, 'center');
    }
    let ty = py + textTop;
    for(const [t, w, px2] of lines){ fitText(t, W/2, ty, px2*u, w, INK, 'center', pw - 24*u); ty += step; }
    btn.y = py + ph - 18*u - btn.h; btn.x = (W - btn.w)/2;
    ctx.fillStyle = RED; ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(btn.x, btn.y, btn.w, btn.h, 10*u); ctx.fill(); ctx.stroke();
    text(intro ? 'Bắt đầu' : 'Màn tiếp', W/2, btn.y + btn.h/2 + 1, 20*u, 800, '#fff6e6', 'center');
  }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PAPER3; ctx.fillRect(0, 0, W, H);
    if(lay.wide) drawSidebar(); else drawPanelNarrow();
    drawTimer(); drawBoard();
    if(phase === 'intro' || phase === 'clear') drawPanel();
  }

  return {enter, exit, update, draw, resize, pointerDown, pointerMove, pointerUp};
})();

LR.level('ch1', {
  n: 8, id: 'hoa-qua',
  title: 'Hoa quả', status: 'ready', pad: false,
  desc: 'Chuẩn bị đủ mâm ngũ quả nào. Mỗi quả tương ứng với mỗi hành. Vượt đủ ngũ hành thu thập đủ ngũ quả',
  rules: [
    '<b>Kéo ngọc</b> (chuột hoặc ngón tay): ngọc bị chạm tới đổi chỗ với ngọc đang kéo. Kéo liên tục để tạo đường.',
    '<b>Thả tay</b> (hoặc hết giờ kéo): các đường ≥ 3 ngọc cùng loại, thẳng ngang hoặc dọc, được tính điểm. Hình L, vuông, khối thì không.',
    '<b>Ngũ hành:</b> mỗi màn có một hành chủ đề. Ngọc tương sinh với hành đó ×2, ngọc tương khắc ×0,5. Combo càng dài điểm càng cao.',
    '<b>5 màn nối tiếp</b>, điểm cộng dồn. Mục tiêu tích lũy: 700 → 1.800 → 3.200 → 4.800 → 6.800.',
    'Hết lượt mà chưa đạt mục tiêu của màn là thua và chơi lại từ màn 1.'
  ],
  mod
});
})();
