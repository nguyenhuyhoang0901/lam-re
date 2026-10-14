/* Chương 1 · Ải 13: Dọn dẹp — Sokoban ngẫu nhiên.
   - Hộp = chổi quét nhà, ô đích = đống bụi bẩn. Đẩy chổi tới từng đống bụi để quét sạch.
   - 3 mức độ: Dễ (4 chổi), Vừa (6 chổi), Khó (7 chổi).
   - Map sinh ngẫu nhiên, đẩy lùi từ lời giải để chắc chắn giải được, rồi dùng A* kiểm chứng và chọn map khó nhất.
   - Thời gian qua bàn được lưu riêng cho từng mức (kỷ lục nhanh nhất).
   - Không có gợi ý. "Tự giải": máy tự quét sạch (chạy chậm để xem), rồi đổi sang căn phòng mới; lượt đó không tính thắng. */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound, Input} = LR;
const {$, clamp, TAU, INK, fmtTime} = LR.util;

/* =====================================================================
   THUẬT TOÁN SOKOBAN (sinh map + solver)
   ================================================================     */
const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
const irnd = n => Math.floor(Math.random()*n);

function attempt(n, lv){
  const L = Math.min(lv,3), w = lv>=4 ? 10 : 8+L+irnd(2), h = lv>=4 ? 10 : 7+L+irnd(2);
  const fl = Array.from({length:h}, ()=>Array(w).fill(false));
  let x = w>>1, y = h>>1, cnt = 0;
  const target = lv>=4 ? n*(lv>=5 ? 5 : 6) : Math.floor((w-2)*(h-2)*0.62);
  const carve = (a,b)=>{ if(a>=1 && b>=1 && a<w-1 && b<h-1 && !fl[b][a]){ fl[b][a] = true; cnt++; } };
  carve(x,y); let guard = 0;
  while(cnt < target && guard++ < 5000){
    const d = DIRS[irnd(4)]; const nx = x+d[0], ny = y+d[1];
    if(nx<1 || ny<1 || nx>w-2 || ny>h-2) continue;
    x = nx; y = ny; carve(x,y);
    if(Math.random() < .5){ carve(x+1,y); carve(x,y+1); carve(x+1,y+1); }
  }
  const flood = ()=>{
    let s = -1;
    for(let j=0;j<h && s<0;j++) for(let i=0;i<w;i++) if(fl[j][i]){ s = j*w+i; break; }
    const seen = new Set([s]), st = [s];
    while(st.length){
      const c = st.pop(), cx = c%w, cy = (c/w)|0;
      for(const d of DIRS){ const a = cx+d[0], b = cy+d[1]; if(a>=0 && b>=0 && a<w && b<h && fl[b][a] && !seen.has(b*w+a)){ seen.add(b*w+a); st.push(b*w+a); } }
    }
    return seen.size;
  };
  let want = lv>=4 ? 0 : Math.floor(cnt*(0.05+0.05*lv)), tries = 0;
  while(want>0 && tries++<400){
    const a = 1+irnd(w-2), b = 1+irnd(h-2);
    if(!fl[b][a]) continue;
    fl[b][a] = false; cnt--;
    if(flood() === cnt) want--; else { fl[b][a] = true; cnt++; }
  }
  const cells = [];
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) if(fl[j][i]) cells.push(j*w+i);
  for(let i=cells.length-1;i>0;i--){ const k = irnd(i+1); [cells[i],cells[k]] = [cells[k],cells[i]]; }
  const g = cells.slice(0,n);
  let b = g.slice(), p = cells[n];
  const isF = (i,j)=> i>=0 && j>=0 && i<w && j<h && fl[j][i];
  let pulls = 0;
  for(let s=0;s<2500+2500*lv;s++){
    const d = DIRS[irnd(4)];
    const px = p%w, py = (p/w)|0, qx = px+d[0], qy = py+d[1];
    if(!isF(qx,qy)) continue;
    const q = qy*w+qx;
    if(b.includes(q)) continue;
    const behind = (py-d[1])*w+(px-d[0]);
    const bi = b.indexOf(behind);
    if(bi>=0 && Math.random()<.7){ b[bi] = p; pulls++; }
    p = q;
  }
  const off = b.filter(i=>!g.includes(i)).length;
  return {w,h,fl,g,b,p,pulls,off,score:off*100+pulls};
}

// Tìm trạng thái "xa đích nhất" bằng BFS ngược (kéo hộp), giới hạn bề rộng mỗi lớp
function deepest(r, ms){
  const w = r.w, h = r.h, N = w*h, dl = [-w,1,w,-1];
  const free = new Uint8Array(N), isBox = new Uint8Array(N), mark = new Int32Array(N), stk = new Int32Array(N);
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) free[j*w+i] = r.fl[j][i] ? 1 : 0;
  let stamp = 0;
  const flood = s=>{
    const S = ++stamp; let sp = 0, mn = s; stk[sp++] = s; mark[s] = S;
    while(sp){ const c = stk[--sp]; if(c<mn) mn = c; for(let k=0;k<4;k++){ const q = c+dl[k]; if(free[q] && !isBox[q] && mark[q]!==S){ mark[q] = S; stk[sp++] = q; } } }
    return mn;
  };
  const setB = (b,v)=>{ for(const x of b) isBox[x] = v; };
  const t0 = performance.now(), LW = ms>2000 ? 8000 : 3000;
  const start = r.g.slice().sort((a,b)=>a-b), seen = new Set();
  let layer = [];
  setB(start,1);
  for(let c=0;c<N;c++){ if(!free[c] || isBox[c]) continue; const rep = flood(c), key = start.join()+':'+rep; if(!seen.has(key)){ seen.add(key); layer.push({b:start,p:rep}); } }
  setB(start,0);
  let depth = 0, last = layer;
  outer: while(layer.length){
    const next = [], ns = new Set();
    for(const s of layer){
      if(performance.now()-t0 > ms) break outer;
      const bx = s.b; setB(bx,1); flood(s.p); const S = stamp;
      const cd = [];
      for(let i=0;i<bx.length;i++) for(let k=0;k<4;k++){ const e = dl[k], p = bx[i]-e, q = bx[i]-2*e; if(mark[p]===S && free[q] && !isBox[q]) cd.push(i,p,q); }
      setB(bx,0);
      for(let m=0;m<cd.length;m+=3){
        const nb = bx.slice(); nb[cd[m]] = cd[m+1]; nb.sort((a,b)=>a-b);
        setB(nb,1); const rep = flood(cd[m+2]); setB(nb,0);
        const key = nb.join()+':'+rep;
        if(!seen.has(key) && !ns.has(key)){ ns.add(key); next.push({b:nb,p:rep,key}); }
      }
    }
    if(!next.length) break;
    if(next.length > LW){ for(let i=0;i<LW;i++){ const j = i+irnd(next.length-i); [next[i],next[j]] = [next[j],next[i]]; } next.length = LW; }
    for(const s of next) seen.add(s.key);
    depth++; layer = next; last = next;
  }
  const s = last[irnd(last.length)];
  return {w,h,fl:r.fl,g:r.g,b:s.b.slice(),p:s.p,d:depth};
}

// Solver A* (đẩy hộp): trả về số lần đẩy tối ưu, số nút đã duyệt và đường đi
function solve(r, boxes, player, capN, ms){
  const w = r.w, h = r.h, N = w*h, dl = [-w,1,w,-1], n = r.g.length, INF = 99, BIG = 1e9;
  const free = new Uint8Array(N), isBox = new Uint8Array(N), mark = new Int32Array(N), stk = new Int32Array(N);
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) free[j*w+i] = r.fl[j][i] ? 1 : 0;
  const dg = r.g.map(g=>{
    const d = new Uint8Array(N).fill(INF); d[g] = 0; const q = [g];
    for(let a=0;a<q.length;a++){ const c = q[a]; for(let k=0;k<4;k++){ const e = dl[k], p = c-e; if(free[p] && free[p-e] && d[p]===INF){ d[p] = d[c]+1; q.push(p); } } }
    return d;
  });
  const dead = new Uint8Array(N);
  for(let c=0;c<N;c++) dead[c] = dg.every(d=>d[c]===INF) ? 1 : 0;
  const M = 1<<n, dp = new Int32Array(M), pc = new Uint8Array(M);
  for(let m=1;m<M;m++) pc[m] = pc[m>>1]+(m&1);
  const hh = bx=>{
    dp.fill(BIG); dp[0] = 0;
    for(let m=0;m<M-1;m++){
      if(dp[m]>=BIG) continue; const c = bx[pc[m]];
      for(let j=0;j<n;j++){ if(m>>j&1) continue; const d = dg[j][c]; if(d<INF){ const nm = m|1<<j, v = dp[m]+d; if(v<dp[nm]) dp[nm] = v; } }
    }
    return dp[M-1]>=BIG ? INF : dp[M-1];
  };
  const setB = (b,v)=>{ for(const x of b) isBox[x] = v; };
  let stamp = 0;
  const flood = s=>{
    const S = ++stamp; let sp = 0, mn = s; stk[sp++] = s; mark[s] = S;
    while(sp){ const c = stk[--sp]; if(c<mn) mn = c; for(let k=0;k<4;k++){ const q = c+dl[k]; if(free[q] && !isBox[q] && mark[q]!==S){ mark[q] = S; stk[sp++] = q; } } }
    return mn;
  };
  const hp = [];
  const push = x=>{ let i = hp.length; hp.push(x); while(i>0){ const p = (i-1)>>1; if(hp[p].k<=x.k) break; hp[i] = hp[p]; i = p; } hp[i] = x; };
  const pop = ()=>{ const t = hp[0], x = hp.pop(); if(hp.length){ let i = 0; for(;;){ let c = 2*i+1; if(c>=hp.length) break; if(c+1<hp.length && hp[c+1].k<hp[c].k) c++; if(hp[c].k>=x.k) break; hp[i] = hp[c]; i = c; } hp[i] = x; } return t; };
  const start = boxes.slice().sort((a,b)=>a-b);
  setB(start,1); const rep0 = flood(player); setB(start,0);
  const h0 = hh(start); if(h0>=INF) return null;
  const seen = new Map(); seen.set(start.join()+':'+rep0, 0);
  push({b:start,p:rep0,g:0,h:h0,k:h0*1000});
  const t0 = performance.now(); let it = 0;
  while(hp.length){
    if((++it&127)===0 && performance.now()-t0>ms) return null;
    const s = pop(), bx = s.b;
    if(seen.get(bx.join()+':'+s.p) < s.g) continue;
    if(s.h===0){ const path = []; for(let x=s;x.par;x=x.par) path.push([x.f,x.kk]); path.reverse(); return {P:s.g,nodes:it,path,h0}; }
    setB(bx,1); flood(s.p); const S = stamp, mv = [];
    for(let i=0;i<bx.length;i++) for(let k=0;k<4;k++){ const e = dl[k], b = bx[i], t = b+e; if(mark[b-e]===S && free[t] && !isBox[t] && !dead[t]) mv.push(i,k); }
    setB(bx,0);
    for(let m=0;m<mv.length;m+=2){
      const i = mv[m], b = bx[i], t = b+dl[mv[m+1]];
      const nb = bx.slice(); nb[i] = t; nb.sort((a,c)=>a-c);
      setB(nb,1); const rep = flood(b); setB(nb,0);
      const hv = hh(nb); if(hv>=INF) continue;
      const key = nb.join()+':'+rep, ng = s.g+1, o = seen.get(key);
      if(o!==undefined && o<=ng) continue;
      seen.set(key,ng); push({b:nb,p:rep,g:ng,h:hv,k:(ng+hv)*1000-ng,par:s,f:b,kk:mv[m+1]});
    }
    if(seen.size>capN) return null;
  }
  return null;
}

/* =====================================================================
   MÀN CHƠI
   ===================================================================== */
const mod = (function(){
  // Ngân sách tìm map (ms), số chổi, mức độ sinh map. "early": dừng sớm khi map đủ khó.
  const MODES = {
    easy:   {lv:4, boxes:4, T:15000},
    medium: {lv:5, boxes:6, T:30000},
    hard:   {lv:6, boxes:7, T:90000, early:26}
  };
  const AUTO_STEP = .3;         // giây giữa hai bước khi máy tự giải (càng lớn càng chậm)
  const SOLVE_MS = 1500;        // thời gian tối đa kiểm chứng mỗi map ứng viên
  const CK = 'chuot-don-dep-map-';
  const C = {out:'#e0c98f', floorA:'#ecdcb8', floorB:'#e6d3a6', wall:'#7d5226', wallHi:'#9a6c3a', red:'#c8352b', gold:'#e6b422', green:'#3f7d4e'};
  const BTNS = [
    {id:'undo',  ic:'↶', lb:'Hoàn tác'},
    {id:'reset', ic:'⟳', lb:'Làm lại'},
    {id:'auto',  ic:'▶', lb:'Tự giải'},
    {id:'new',   ic:'✦', lb:'Map mới'}
  ];

  let ctx = null, CW = 360, CH = 640, dpr = 1, u = 1, clock = 0;
  let modeId = 'easy', mcfg = MODES.easy, phase = 'gen';
  let gen = null;
  let MW = 0, MH = 0, wall = null, near = null, goals = [], boxes0 = [], pl0 = 0, par = 0, mvp = 0;
  let boxes = [], pl = 0, hist = [], moves = 0, pushes = 0, won = false, face = 2;
  let elapsed = 0, usedAuto = false, finished = false, swapT = 0;
  let heldDir = -1, repeatT = 0;
  let job = null, autoPushes = [], autoDirs = [], autoT = 0;
  let msg = '', msgT = 0, armed = null;
  let swipe = null, fx = [];
  let tb = {x:0,y:0,w:0,h:0,btns:[]}, bs = {cs:30,ox:0,oy:0};
  const mem = {};

  /* ----- âm thanh riêng của ải ----- */
  const S = {
    step(){ Sound.noise(.05, .05, 'lowpass', 900, 300); },
    push(){ Sound.noise(.13, .2, 'bandpass', 2000, 600, 0, 1.1); Sound.tone('sine', 140, 90, .09, .22); },
    clean(){ [880, 1175, 1568].forEach((f,i)=> Sound.tone('triangle', f, f*1.02, .14, .15, i*.06)); },
    dirty(){ Sound.tone('triangle', 520, 380, .1, .1); },
    bump(){ Sound.tone('square', 150, 110, .05, .07); },
    undo(){ Sound.tone('sine', 640, 420, .09, .12); },
    ready(){ Sound.tone('triangle', 523, 784, .12, .13); Sound.tone('triangle', 784, 1047, .14, .13, .1); },
    arm(){ Sound.tone('square', 700, 700, .04, .06); }
  };

  /* ----- lưu map để chơi lại cùng một căn phòng (so sánh thời gian công bằng) ----- */
  function readCache(m){
    if(mem[m]) return mem[m];
    try{
      const o = JSON.parse(localStorage.getItem(CK + m));
      if(!o || o.v !== 1 || !Array.isArray(o.rows) || o.rows.length !== o.h) return null;
      const fl = o.rows.map(r => [...r].map(c => c === '1'));
      if(fl.some(r => r.length !== o.w)) return null;
      const N = o.w * o.h, okIdx = a => Array.isArray(a) && a.every(i => Number.isInteger(i) && i >= 0 && i < N);
      if(!okIdx(o.g) || !okIdx(o.b) || o.g.length !== MODES[m].boxes || o.b.length !== o.g.length || !Number.isInteger(o.p)) return null;
      return mem[m] = {w:o.w, h:o.h, fl, g:o.g, b:o.b, p:o.p, d:o.d || 0, ex:o.ex || 0};
    }catch(e){ return null; }
  }
  function writeCache(m, map){
    mem[m] = map;
    try{ localStorage.setItem(CK + m, JSON.stringify({v:1, w:map.w, h:map.h, rows:map.fl.map(r => r.map(v => v ? '1' : '0').join('')), g:map.g, b:map.b, p:map.p, d:map.d, ex:map.ex})); }catch(e){}
  }
  function clearCache(m){ delete mem[m]; try{ localStorage.removeItem(CK + m); }catch(e){} }

  /* ----- khởi tạo ----- */
  function enter(opts){
    ctx = G.ctx; modeId = (opts && opts.mode) || 'easy'; mcfg = MODES[modeId];
    clock = 0; msg = ''; msgT = 0; armed = null; swipe = null; fx = []; finished = false;
    job = null; autoPushes = []; autoDirs = []; swapT = 0;
    layout();
    const cached = readCache(modeId);
    if(cached){ applyMap(cached); startPlay(); } else startGen();
  }
  function exit(){ job = null; }
  function startGen(notice){
    phase = 'gen'; MW = 0; msg = ''; msgT = 0; swapT = 0; armed = null;
    gen = {t0:Date.now(), best:null, fb:null, k:0, skip:2, notice:notice || ''};
    layout();
  }
  function finishGen(){
    const map = gen.best || Object.assign({}, gen.fb, {d:0, ex:0});
    if(map.d > 0) writeCache(modeId, map);
    const note = gen.notice;
    applyMap(map); startPlay();
    if(note) setMsg('Căn phòng mới! Chúc bạn quét sạch bụi.', 4);
  }
  function applyMap(m){
    MW = m.w; MH = m.h;
    wall = m.fl.map(r => r.map(v => !v));
    near = wall.map((r,j) => r.map((_,i) => {
      for(let dj=-1; dj<=1; dj++) for(let di=-1; di<=1; di++){ const a = i+di, b = j+dj; if(a>=0 && b>=0 && a<MW && b<MH && !wall[b][a]) return true; }
      return false;
    }));
    goals = m.g.slice(); boxes0 = m.b.slice(); pl0 = m.p; par = m.d || 0; mvp = m.ex || 0;
  }
  function startPlay(){
    phase = 'play'; resetBoard(); layout(); S.ready();
  }
  function resetBoard(){
    boxes = boxes0.slice(); pl = pl0; hist = []; moves = 0; pushes = 0; won = false; face = 2;
    elapsed = 0; usedAuto = false; finished = false; swapT = 0;
    job = null; autoPushes = []; autoDirs = []; heldDir = -1; fx = [];
  }
  function setMsg(t, sec){ msg = t; msgT = sec || 3; }

  /* ----- bố cục ----- */
  function layout(){
    ctx = G.ctx; CW = G.W; CH = G.H; dpr = G.dpr; u = G.u;
    const tw = Math.min(CW - 16*u, 540*u), gap = 6*u, n = BTNS.length, bw = (tw - gap*(n-1)) / n;
    tb = {x:(CW - tw)/2, y:G.top + 6*u, w:tw, h:46*u, btns:[]};
    BTNS.forEach((b,i)=> tb.btns.push(Object.assign({}, b, {x:tb.x + i*(bw+gap), y:tb.y, w:bw, h:tb.h})));
    if(MW){
      const top = tb.y + tb.h + 22*u, bottom = $('pad').hidden ? 12*u : 208;
      const aw = CW - 12*u, ah = Math.max(120, CH - top - bottom);
      const cs = Math.max(14, Math.floor(Math.min(aw/MW, ah/MH, 64*u)));
      bs = {cs, ox:Math.floor((CW - MW*cs)/2), oy:Math.floor(top + (ah - MH*cs)/2)};
    }
  }
  const resize = layout;

  /* ----- luật chơi ----- */
  function particles(cell){
    const gx = cell % MW, gy = (cell / MW) | 0;
    for(let i=0;i<9;i++){
      const a = Math.random()*TAU, s = .6 + Math.random()*1.2;
      fx.push({x:gx+.5, y:gy+.5, vx:Math.cos(a)*s, vy:Math.sin(a)*s - .4, t:0, life:.8, c:i%2 ? C.gold : '#7fd36a'});
    }
  }
  function move(di){
    if(won || phase !== 'play') return false;
    face = di;
    const d = DIRS[di], px = pl % MW, py = (pl / MW) | 0, nx = px+d[0], ny = py+d[1];
    if(wall[ny][nx]){ S.bump(); return false; }
    const t = ny*MW + nx, bi = boxes.indexOf(t);
    const snap = {pl, boxes:boxes.slice(), moves, pushes};
    let pushed = false;
    if(bi >= 0){
      const bx = nx+d[0], by = ny+d[1];
      if(wall[by][bx] || boxes.includes(by*MW + bx)){ S.bump(); return false; }
      const bt = by*MW + bx, wasOn = goals.includes(t);
      boxes[bi] = bt; pushes++; pushed = true;
      if(goals.includes(bt)){ S.clean(); particles(bt); }
      else if(wasOn) S.dirty();
      else S.push();
    } else S.step();
    hist.push(snap); pl = t; moves++;
    if(pushed) fx.push({x:nx+.5, y:ny+.5, vx:d[0]*1.2, vy:d[1]*1.2, t:0, life:.35, c:'#c9b48a'});
    won = boxes.every(b => goals.includes(b));
    if(won) onWin();
    return true;
  }
  const autoBusy = () => autoPushes.length > 0 || autoDirs.length > 0 || !!job;
  function undo(){
    if(autoBusy() || phase !== 'play') return;            // máy đang tự giải: không can thiệp
    const s = hist.pop(); if(!s) return;
    pl = s.pl; boxes = s.boxes; moves = s.moves; pushes = s.pushes; won = false; S.undo();
  }
  function cancelAuto(){ autoPushes = []; autoDirs = []; }
  function userMove(d){ if(autoBusy()) return; move(d); }

  function onWin(){
    if(finished) return; finished = true;
    if(usedAuto){
      // Máy vừa tự giải xong: báo rồi đổi sang căn phòng mới (không tính thắng, không lưu giờ)
      swapT = 1.6;
      setMsg('Máy đã quét xong! Đang đổi sang căn phòng mới…', 99);
      LR.UI.toast('Máy đã quét xong! Đang đổi sang căn phòng mới…', 3600);
      return;
    }
    const stars = par > 0 ? (pushes <= par ? 3 : pushes <= Math.ceil(par*1.25) ? 2 : 1) : 1;
    const rows = [['Thời gian', fmtTime(elapsed*1000)], ['Số bước', moves], ['Số lần đẩy', pushes]];
    if(par) rows.push(['Tối ưu (đã kiểm chứng)', par + ' lần đẩy']);
    G.finish({win:true, stars, time:Math.round(elapsed*1000),
      title:'Nhà sạch bóng!', msg:'Mọi đống bụi đã được quét sạch, nhà vợ hài lòng.', rows});
  }

  /* ----- tự giải ----- */
  function curSol(){
    return solve({w:MW, h:MH, fl:wall.map(r => r.map(v => !v)), g:goals}, boxes, pl, 600000, 4000);
  }
  function route(target){
    const prev = new Map([[pl, null]]), q = [pl];
    for(let a=0;a<q.length;a++){
      const c = q[a]; if(c === target) break;
      for(let k=0;k<4;k++){
        const d = DIRS[k], x = c%MW + d[0], y = ((c/MW)|0) + d[1];
        if(wall[y][x]) continue;
        const t = y*MW + x;
        if(prev.has(t) || boxes.includes(t)) continue;
        prev.set(t, [c,k]); q.push(t);
      }
    }
    if(!prev.has(target)) return null;
    const out = [];
    for(let c=target; prev.get(c); c=prev.get(c)[0]) out.push(prev.get(c)[1]);
    return out.reverse();
  }
  function requestAuto(){
    if(won || autoBusy()) return;
    job = {wait:1};                            // chờ 1 khung hình để vẽ dòng "Đang tính…" trước khi giải
    setMsg('Đang tính lời giải…', 99);
  }
  function runJob(){
    job = null;
    const s = curSol();
    if(!s || !s.path.length){ setMsg('Không tìm được lời giải từ thế này (có thể chổi đã kẹt). Thử Hoàn tác hoặc Làm lại.', 5); return; }
    usedAuto = true; autoPushes = s.path.slice(); autoDirs = []; autoT = AUTO_STEP;
    setMsg('Máy đang quét giúp bạn…', 99);
  }
  function autoStep(dt){
    if(!autoPushes.length && !autoDirs.length) return;
    autoT -= dt; if(autoT > 0) return; autoT = AUTO_STEP;
    if(!autoDirs.length){
      const [f,k] = autoPushes.shift(), e = DIRS[k];
      const r = route((((f/MW)|0) - e[1])*MW + (f%MW - e[0]));
      if(!r){ autoPushes = []; return; }
      autoDirs = [...r, k];
    }
    move(autoDirs.shift());
  }

  /* ----- nút trên canvas ----- */
  function arm(id, text){
    if(armed && armed.id === id && armed.t > 0){ armed = null; return true; }
    armed = {id, t:2.5}; setMsg(text, 2.5); S.arm(); return false;
  }
  function tool(id){
    if(phase !== 'play') return;
    if(id === 'undo') undo();
    else if(id === 'reset'){ cancelAuto(); job = null; resetBoard(); setMsg('Đã làm lại căn phòng.', 2); S.undo(); }
    else if(id === 'auto'){
      if(won || autoBusy()) return;
      if(arm('auto', 'Tự giải sẽ không tính thắng và đổi sang căn phòng mới. Bấm lần nữa để xem máy quét.')) requestAuto();
    }
    else if(id === 'new'){
      if(arm('new', 'Tạo căn phòng mới? Bấm lần nữa để xác nhận.')){ cancelAuto(); job = null; clearCache(modeId); startGen(); }
    }
  }
  const inRect = (x,y,r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  /* ----- đầu vào ----- */
  function readDir(){
    const v = Input.vec(); if(!v.m) return -1;
    const ax = Math.abs(v.x), ay = Math.abs(v.y);
    if(Math.abs(ax - ay) < 1e-3) return -1;          // đi chéo: bỏ qua
    return ax > ay ? (v.x > 0 ? 1 : 3) : (v.y > 0 ? 2 : 0);
  }
  function keyDown(code, rep){
    if(phase === 'gen'){ if(code === 'KeyR' || code === 'KeyU') return true; return false; }
    if(code === 'KeyR'){ if(!rep) tool('reset'); return true; }
    if(code === 'KeyU'){ if(!rep) undo(); return true; }
    if(code === 'KeyN'){ if(!rep) tool('new'); return true; }
    return false;
  }
  function pointerDown(x, y){
    if(phase === 'gen') return;
    for(const b of tb.btns) if(inRect(x,y,b)){ tool(b.id); return; }
    swipe = {x, y};
  }
  function pointerMove(x, y, e){
    if(!swipe || phase !== 'play') return;
    if(!(e.buttons & 1)){ swipe = null; return; }
    const dx = x - swipe.x, dy = y - swipe.y;
    if(Math.max(Math.abs(dx), Math.abs(dy)) >= 26*u){
      swipe = {x, y};
      userMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  }

  /* ----- vòng lặp ----- */
  function genUpdate(){
    if(gen.skip > 0){ gen.skip--; return; }
    const r = deepest(attempt(mcfg.boxes, mcfg.lv), 250); gen.k++; gen.fb = r;
    const sol = solve(r, r.b, r.p, 400000, SOLVE_MS);
    if(sol){
      const ex = sol.P - sol.h0, sc = ex*1e5 + sol.nodes;
      if(!gen.best || sc > gen.best.sc) gen.best = Object.assign({}, r, {d:sol.P, sc, nodes:sol.nodes, ex});
    }
    const el = Date.now() - gen.t0;
    if(gen.best && (el >= mcfg.T || (mcfg.early && gen.best.ex >= mcfg.early))) finishGen();
    else if(!gen.best && gen.k > 200) finishGen();
  }
  function hud(){
    if(phase === 'gen'){ G.hud.set([{l:'Đang tạo', v: Math.round((Date.now() - gen.t0)/1000) + 's'}]); return; }
    const cleaned = boxes.filter(b => goals.includes(b)).length;
    G.hud.set([
      {l:'Giờ', v: fmtTime(elapsed*1000, false)},
      {l:'Bụi sạch', v: cleaned + '/' + goals.length},
      {l:'Đẩy', v: pushes}
    ]);
  }
  function update(dt){
    clock += dt;
    if(phase === 'gen'){ genUpdate(); hud(); return; }
    if(msgT > 0){ msgT -= dt; if(msgT <= 0) msg = ''; }
    if(armed){ armed.t -= dt; if(armed.t <= 0) armed = null; }
    if(swapT > 0){ swapT -= dt; if(swapT <= 0){ clearCache(modeId); startGen('Máy đã quét xong căn phòng cũ. Đây là căn phòng mới!'); return; } }
    if(!won) elapsed += dt;
    for(const p of fx){ p.t += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 1.6*dt; }
    fx = fx.filter(p => p.t < p.life);
    const act = Input.consumeAct();
    if(job){ if(job.wait-- <= 0) runJob(); }
    const d = readDir();
    if(d >= 0){
      if(d !== heldDir){ heldDir = d; repeatT = .26; userMove(d); }
      else { repeatT -= dt; if(repeatT <= 0){ repeatT = .11; userMove(d); } }
    } else heldDir = -1;
    if(act) undo();                             // Space / Z / nút Hoàn tác trên điện thoại
    autoStep(dt);
    hud();
  }

  /* ----- vẽ ----- */
  function rr(x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath();
  }
  const hash = (n, k) => Math.abs(Math.sin(n*12.9898 + k*78.233)*43758.5453) % 1;
  const font = (px, w) => (w || 600) + ' ' + Math.round(px) + 'px "Be Vietnam Pro", system-ui, sans-serif';

  function drawDust(x, y, cs, idx, swept){
    const cx = x + cs/2, cy = y + cs/2;
    ctx.save();
    ctx.globalAlpha = swept ? .35 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.ellipse(cx, cy + cs*.14, cs*.32, cs*.11, 0, 0, TAU); ctx.fill();
    const cols = ['#8a7355', '#6b5a41', '#a89472', '#7a6548'];
    const scale = swept ? .55 : 1;
    for(let q=0;q<6;q++){
      const a = hash(idx, q)*TAU, r = (.04 + .13*hash(idx, q+9))*cs*scale;
      const bx = cx + Math.cos(a)*r, by = cy + Math.sin(a)*r*.7 + cs*.04;
      ctx.fillStyle = cols[q % 4]; ctx.beginPath(); ctx.arc(bx, by, (.09 + .06*hash(idx, q+3))*cs*scale, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#5a4a35';
    for(let q=0;q<5;q++){ const a = hash(idx, q+20)*TAU, r = (.2 + .12*hash(idx, q+30))*cs*scale; ctx.beginPath(); ctx.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r*.8, cs*.022, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawBroom(x, y, cs, ok){
    ctx.save(); ctx.translate(x + cs/2, y + cs/2);
    if(ok){ ctx.fillStyle = 'rgba(80,190,100,.28)'; ctx.beginPath(); ctx.arc(0, 0, cs*.46, 0, TAU); ctx.fill(); }
    ctx.rotate(-.35);
    const s = cs, lw = Math.max(1.5, s*.04);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(s*.04, s*.38, s*.3, s*.07, 0, 0, TAU); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INK;
    ctx.fillStyle = '#a8743a'; rr(-.045*s, -.46*s, .09*s, .56*s, .04*s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ok ? '#9bd36a' : '#e0b04a';
    ctx.beginPath(); ctx.moveTo(-.12*s, .12*s); ctx.lineTo(.12*s, .12*s); ctx.lineTo(.28*s, .42*s); ctx.lineTo(-.28*s, .42*s); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(31,26,23,.55)'; ctx.lineWidth = Math.max(1, s*.02);
    ctx.beginPath();
    for(let k=-2;k<=2;k++){ ctx.moveTo(k*.04*s, .14*s); ctx.lineTo(k*.1*s, .42*s); }
    ctx.stroke();
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.fillStyle = C.red;
    rr(-.14*s, .06*s, .28*s, .08*s, .02*s); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function drawPlayer(x, y, cs){
    const cx = x + cs/2, cy = y + cs/2, lw = Math.max(1.5, cs*.04);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = INK;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(cx, cy + cs*.38, cs*.26, cs*.07, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.moveTo(cx - cs*.17, cy); ctx.lineTo(cx + cs*.17, cy); ctx.lineTo(cx + cs*.27, cy + cs*.38); ctx.lineTo(cx - cs*.27, cy + cs*.38); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.gold;
    for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(cx, cy + cs*(.07 + i*.1), cs*.025, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f0c48f'; ctx.beginPath(); ctx.arc(cx, cy - cs*.13, cs*.17, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; rr(cx - cs*.21, cy - cs*.4, cs*.42, cs*.17, cs*.05); ctx.fill();
    ctx.fillStyle = C.gold; ctx.fillRect(cx - cs*.21, cy - cs*.26, cs*.42, cs*.03);
    const d = DIRS[face], ex = d[0]*cs*.04, ey = d[1]*cs*.025;
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(cx - cs*.06 + ex, cy - cs*.12 + ey, cs*.022, 0, TAU); ctx.arc(cx + cs*.06 + ex, cy - cs*.12 + ey, cs*.022, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawBoard(){
    const {cs, ox, oy} = bs;
    for(let j=0;j<MH;j++) for(let i=0;i<MW;i++){
      const x = ox + i*cs, y = oy + j*cs;
      if(!wall[j][i]){
        ctx.fillStyle = (i+j) % 2 ? C.floorA : C.floorB; ctx.fillRect(x, y, cs, cs);
        ctx.strokeStyle = 'rgba(120,90,40,.12)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, cs - 1, cs - 1);
      } else if(near[j][i]){
        ctx.fillStyle = C.wall; ctx.fillRect(x, y, cs, cs);
        ctx.fillStyle = C.wallHi; ctx.fillRect(x + cs*.08, y + cs*.08, cs*.84, cs*.12);
        ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, cs*.04); ctx.strokeRect(x + .5, y + .5, cs - 1, cs - 1);
      }
    }
    goals.forEach(g => drawDust(ox + (g % MW)*cs, oy + ((g/MW)|0)*cs, cs, g, boxes.includes(g)));
    boxes.forEach(b => drawBroom(ox + (b % MW)*cs, oy + ((b/MW)|0)*cs, cs, goals.includes(b)));
    drawPlayer(ox + (pl % MW)*cs, oy + ((pl/MW)|0)*cs, cs);
    for(const p of fx){
      const k = 1 - p.t/p.life, px = ox + p.x*cs, py = oy + p.y*cs, r = cs*.07*(.5 + k);
      ctx.globalAlpha = k; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.moveTo(px, py - r*1.6); ctx.lineTo(px + r*.5, py - r*.5); ctx.lineTo(px + r*1.6, py); ctx.lineTo(px + r*.5, py + r*.5);
      ctx.lineTo(px, py + r*1.6); ctx.lineTo(px - r*.5, py + r*.5); ctx.lineTo(px - r*1.6, py); ctx.lineTo(px - r*.5, py - r*.5); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  function drawToolbar(){
    for(const b of tb.btns){
      const on = armed && armed.id === b.id;
      ctx.fillStyle = on ? C.gold : '#f4ead2'; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
      rr(b.x, b.y, b.w, b.h, 8*u); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = font(18*u, 700); ctx.fillText(b.ic, b.x + b.w/2, b.y + b.h*.36);
      ctx.font = font(10.5*u, 600); ctx.fillText(b.lb, b.x + b.w/2, b.y + b.h*.76);
    }
  }
  function drawStatus(){
    let t = msgT > 0 && msg ? msg : (par ? 'Tối ưu đã kiểm chứng: ' + par + ' lần đẩy' + (mvp ? ' (' + mvp + ' lần phải đi vòng)' : '') : 'Đẩy chổi tới các đống bụi');
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let px = 12*u; ctx.font = font(px, 600);
    while(px > 9 && ctx.measureText(t).width > CW - 16){ px -= .5; ctx.font = font(px, 600); }
    ctx.fillText(t, CW/2, tb.y + tb.h + 12*u);
  }
  function drawGen(){
    const el = Date.now() - gen.t0, p = clamp(el / mcfg.T, 0, 1);
    ctx.fillStyle = C.floorA; ctx.fillRect(0, 0, CW, CH);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.font = '900 ' + Math.round(26*u) + 'px "Playfair Display", Georgia, serif';
    ctx.fillText('Đang tìm căn phòng bừa nhất…', CW/2, CH*.26);
    if(gen.notice){
      let px = 15*u; ctx.font = font(px, 700);
      while(px > 10 && ctx.measureText(gen.notice).width > CW - 20){ px -= .5; ctx.font = font(px, 700); }
      ctx.fillStyle = C.red; ctx.fillText(gen.notice, CW/2, CH*.17); ctx.fillStyle = INK;
    }
    const bw = Math.min(CW - 60*u, 360*u), bh = 16*u, bx = (CW - bw)/2, by = CH*.38;
    ctx.fillStyle = '#e0c98f'; ctx.strokeStyle = INK; ctx.lineWidth = 3; rr(bx, by, bw, bh, 8*u); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.red; if(p > .02){ rr(bx + 2, by + 2, (bw - 4)*p, bh - 4, 6*u); ctx.fill(); }
    ctx.fillStyle = INK; ctx.font = font(14*u, 600);
    ctx.fillText(gen.best ? 'Tốt nhất hiện tại: ' + gen.best.d + ' lần đẩy tối ưu (' + gen.best.ex + ' lần phải đi vòng)' : 'Đang kiểm chứng căn phòng… (' + gen.k + ')', CW/2, CH*.46);
    ctx.fillStyle = '#5b4a30'; ctx.font = font(12.5*u, 500);
    ctx.fillText('Máy sinh nhiều căn phòng rồi giữ căn khó nhất giải được.', CW/2, CH*.51);
    ctx.fillText('Căn này sẽ được lưu lại để bạn so sánh thời gian.', CW/2, CH*.545);
  }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.out; ctx.fillRect(0, 0, CW, CH);
    if(phase === 'gen'){ drawGen(); return; }
    drawBoard(); drawToolbar(); drawStatus();
  }

  return {enter, exit, update, draw, resize, pointerDown, pointerMove, keyDown};
})();

LR.level('ch1', {
  n: 13, id: 'don-dep',
  title: 'Dọn dẹp', status: 'ready', pad: true, actLabel: 'Hoàn tác',
  desc: 'Tiệc xong, nhà cửa bừa bộn. Dùng chổi quét sạch bụi. Phải qua đủ 3 mức để vượt ải.',
  rules: [
    '<b>Đi:</b> mũi tên / WASD, nút ◀ ▲ ▼ ▶, hoặc vuốt trên màn hình.',
    '<b>Đẩy chổi</b> tới đống bụi. Chỉ đẩy được, không kéo được, và không đẩy được hai chổi liền nhau.',
    '<b>Hoàn tác:</b> Space / Z / U hoặc nút Hoàn tác. <b>Làm lại:</b> R.',
    '<b>Thời gian qua bàn</b> được lưu riêng cho từng mức.',
    '<b>Tự giải:</b> máy sẽ quét thay bạn (chậm để bạn xem) rồi đổi sang căn phòng mới. Lượt đó không tính thắng.',
    'Lần đầu mỗi mức, máy cần một lúc để tìm căn phòng khó. Căn đó được lưu lại cho các lần chơi sau.'
  ],
  modes: [
    {id: 'easy',   name: 'Dễ',     sub: '4 chổi · tìm phòng tối đa 15 giây'},
    {id: 'medium', name: 'Vừa',    sub: '6 chổi · tìm phòng tối đa 30 giây'},
    {id: 'hard',   name: 'Khó',    sub: '7 chổi · tìm phòng tối đa 90 giây'}
  ],
  mod
});
})();