/* js/levels/ch1/20-xep-vua.js — Ải 20: Xếp Vua */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

const COLORS = ['#f4a6a0','#f6c177','#f2e394','#a8d8a0','#8fd3d0','#9cc3f0','#b9a7ee','#e7a7d6','#cfc7b2'];
const LABEL = ['','Dễ','Vừa','Khó','Rất khó','Cực khó'];

const MODES = {
  easy:   { n: 7, adj: false, level: 3, name: '7×7', desc: 'Vừa phải' },
  medium: { n: 8, adj: false, level: 4, name: '8×8', desc: 'Khó' },
  hard:   { n: 9, adj: false, level: 4, name: '9×9', desc: 'Siêu khó' }
};

/* ================= STATE ================= */
let gs = null;   // game state
let L = null;    // layout

/* ================= HELPERS ================= */
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

/* ================= PUZZLE GEN ================= */
function genSolution(n, adj) {
  const cols=[], used=new Set();
  (function bt(r){
    if (r===n) return true;
    for (const c of shuffle([...Array(n).keys()])) {
      if (used.has(c)) continue;
      if (adj && r>0 && Math.abs(c-cols[r-1])<=1) continue;
      cols[r]=c; used.add(c);
      if (bt(r+1)) return true;
      used.delete(c);
    }
    return false;
  })(0);
  return cols;
}

function neighbors(i, n) {
  const r=Math.floor(i/n), c=i%n, o=[];
  if (r>0) o.push(i-n);
  if (r<n-1) o.push(i+n);
  if (c>0) o.push(i-1);
  if (c<n-1) o.push(i+1);
  return o;
}

function grow(n, sol) {
  const g = Array(n*n).fill(-1);
  sol.forEach((c,r)=>g[r*n+c]=r);
  let left = n*n - n;
  while (left > 0) {
    const opts=[];
    for (let i=0;i<n*n;i++) {
      if (g[i]<0) continue;
      for (const j of neighbors(i,n)) if (g[j]<0) opts.push([i,j]);
    }
    const [i,j] = opts[Math.floor(Math.random()*opts.length)];
    g[j]=g[i]; left--;
  }
  return g;
}

function solve(g, n, adj, limit) {
  const sols=[], cols=[];
  let cm=0, rm=0;
  (function bt(r){
    if (sols.length>=limit) return;
    if (r===n) { sols.push(cols.slice()); return; }
    for (let c=0;c<n;c++) {
      if (cm>>c&1) continue;
      const k=g[r*n+c];
      if (rm>>k&1) continue;
      if (adj && r>0 && Math.abs(c-cols[r-1])<=1) continue;
      cols[r]=c; cm|=1<<c; rm|=1<<k;
      bt(r+1);
      cm&=~(1<<c); rm&=~(1<<k);
    }
  })(0);
  return sols;
}

function staysConnected(g, n, cell) {
  const k=g[cell], cells=[];
  for (let i=0;i<n*n;i++) if (g[i]===k && i!==cell) cells.push(i);
  if (!cells.length) return false;
  const seen=new Set([cells[0]]), q=[cells[0]];
  while (q.length) {
    const x=q.pop();
    for (const y of neighbors(x,n)) if (y!==cell && g[y]===k && !seen.has(y)) { seen.add(y); q.push(y); }
  }
  return seen.size === cells.length;
}

function mutate(g, n, s1, s2) {
  const rows = shuffle([...Array(n).keys()].filter(r=>s1[r]!==s2[r]));
  for (const r of rows) {
    const cell = r*n + s2[r];
    const ns = shuffle(neighbors(cell,n).filter(j=>g[j]!==g[cell]));
    for (const j of ns) {
      if (!staysConnected(g,n,cell)) break;
      g[cell]=g[j]; return true;
    }
  }
  return false;
}

function baseUnique(n, adj) {
  const s = genSolution(n,adj);
  const g = grow(n,s);
  for (let it=0; it<500; it++) {
    const sols = solve(g,n,adj,2);
    if (sols.length === 1) return { sol:s, reg:g };
    const other = sols.find(x=>x.some((c,r)=>c!==s[r]));
    if (!other || !mutate(g,n,s,other)) return null;
  }
  return null;
}

function mutateCopy(g, n, sol) {
  const kingSet = new Set(sol.map((c,r)=>r*n+c));
  for (let t=0; t<30; t++) {
    const i = Math.floor(Math.random()*n*n);
    if (kingSet.has(i)) continue;
    const ns = shuffle(neighbors(i,n).filter(j=>g[j]!==g[i]));
    if (!ns.length || !staysConnected(g,n,i)) continue;
    const ng = g.slice(); ng[i]=g[ns[0]]; return ng;
  }
  return null;
}

/* ================= SOLVER for HINTS ================= */
const KINDS = ['row','col','reg'];
const NAME = { row:'hàng', col:'cột', reg:'mảng màu' };

function makeCtx(n, g, adj) {
  const U = { row:[], col:[], reg:[] };
  for (let k=0;k<n;k++) { U.row.push([]); U.col.push([]); U.reg.push([]); }
  for (let i=0;i<n*n;i++) {
    U.row[Math.floor(i/n)].push(i);
    U.col[i%n].push(i);
    U.reg[g[i]].push(i);
  }
  return { n, g, adj, U };
}

const lineOf = (c, kind, i) => kind==='row' ? Math.floor(i/c.n) : kind==='col' ? i%c.n : c.g[i];

function newState(ctx) {
  const n = ctx.n;
  return { ctx, cand: new Uint8Array(n*n).fill(1), done:{ row:new Uint8Array(n), col:new Uint8Array(n), reg:new Uint8Array(n) }, placed:0 };
}

function cloneState(S) {
  return { ctx:S.ctx, cand:S.cand.slice(), done:{ row:S.done.row.slice(), col:S.done.col.slice(), reg:S.done.reg.slice() }, placed:S.placed };
}

function placeK(S, i) {
  const c=S.ctx, n=c.n, r=Math.floor(i/n), cc=i%n, k=c.g[i];
  S.done.row[r]=1; S.done.col[cc]=1; S.done.reg[k]=1; S.placed++;
  for (let j=0;j<n*n;j++) {
    const rj=Math.floor(j/n), cj=j%n;
    if (rj===r || cj===cc || c.g[j]===k || (c.adj && Math.abs(rj-r)<=1 && Math.abs(cj-cc)<=1)) S.cand[j]=0;
  }
}

const candList = (S,kind,u) => S.ctx.U[kind][u].filter(i=>S.cand[i]);

function openUnits(S, kind) {
  const o=[]; for (let u=0;u<S.ctx.n;u++) if (!S.done[kind][u]) o.push(u); return o;
}

function combos(arr, k) {
  const out = [];
  (function rec(st, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i=st; i<arr.length; i++) { cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
  })(0, []);
  return out;
}

const rcOf = (n,i) => `hàng ${Math.floor(i/n)+1}, cột ${i%n+1}`;

function findSingles(S) {
  for (const kind of KINDS) for (const u of openUnits(S,kind)) {
    const cs = candList(S,kind,u);
    if (cs.length === 0) return { contra:true };
  }
  for (const kind of KINDS) for (const u of openUnits(S,kind)) {
    const cs = candList(S,kind,u);
    if (cs.length === 1) {
      const where = kind==='row' ? `Hàng ${u+1} chỉ còn một ô hợp lệ`
        : kind==='col' ? `Cột ${u+1} chỉ còn một ô hợp lệ`
        : 'Mảng màu này chỉ còn một ô hợp lệ';
      return { level:1, place:cs[0], target:cs, elim:[], msg:`${where}. Vua phải ở ${rcOf(S.ctx.n, cs[0])}.` };
    }
  }
  return null;
}

function findGroup(S, k) {
  const c = S.ctx;
  for (const A of KINDS) for (const B of KINDS) {
    if (A === B) continue;
    const open = openUnits(S, A);
    if (open.length <= k) continue;
    for (const combo of combos(open, k)) {
      const union = [];
      for (const u of combo) union.push(...candList(S, A, u));
      if (!union.length) continue;
      const bs = new Set(union.map(i=>lineOf(c,B,i)));
      if (bs.size !== k) continue;
      const elim = [];
      for (const b of bs) for (const i of c.U[B][b]) if (S.cand[i] && !combo.includes(lineOf(c,A,i))) elim.push(i);
      if (!elim.length) continue;
      const bl = [...bs].sort((x,y)=>x-y).map(x=>x+1).join(', ');
      const kB = B==='reg' ? (k===1?'mảng màu chứa các ô đó':`${k} mảng màu chứa các ô đó`) : `${NAME[B]} ${bl}`;
      return {
        level: k===1 ? 2 : k===2 ? 3 : 4,
        elim, target: union,
        msg: (k===1
          ? `Các ô hợp lệ còn lại của ${NAME[A]} (ô vàng) đều nằm trong ${kB}. Vua của ${NAME[A]} đó phải ở trong ${kB}`
          : `${k} ${NAME[A]} (ô vàng) chỉ còn ô hợp lệ nằm trong ${kB}. Các vua của ${k} ${NAME[A]} ấy lấp đầy ${kB}`)
          + `, nên các ô gạch đỏ còn lại trong đó không thể có vua.`
      };
    }
  }
  return null;
}

function findAdj(S) {
  const c = S.ctx;
  if (!c.adj) return null;
  const n = c.n;
  for (const kind of KINDS) for (const u of openUnits(S, kind)) {
    const C = candList(S, kind, u);
    if (C.length < 2 || C.length > 5) continue;
    const elim = [];
    for (let x=0;x<n*n;x++) {
      if (!S.cand[x] || C.includes(x)) continue;
      const rx = Math.floor(x/n), cx = x%n;
      if (C.every(y => Math.abs(Math.floor(y/n)-rx)<=1 && Math.abs(y%n-cx)<=1)) elim.push(x);
    }
    if (elim.length) return { level:3, elim, target:C, msg:`Mọi vị trí còn lại của ${NAME[kind]} này (ô vàng) đều kề ô gạch đỏ. Vua nào đặt ở đây cũng chạm các ô đỏ nên ô đỏ không thể có vua.` };
  }
  return null;
}

function findTrial(S) {
  const n = S.ctx.n;
  for (let x=0;x<n*n;x++) {
    if (!S.cand[x]) continue;
    const T = cloneState(S);
    placeK(T, x);
    let bad = false;
    for (let g=0; g<200; g++) {
      const s = findSingles(T);
      if (!s) break;
      if (s.contra) { bad = true; break; }
      placeK(T, s.place);
    }
    if (bad) return { level:5, elim:[x], target:[], msg:`Thử đặt vua vào ô gạch đỏ: các ô còn lại sẽ lần lượt bị ép và dẫn tới mâu thuẫn (có mảng, hàng hoặc cột hết chỗ). Vì vậy ô này không có vua.` };
  }
  return null;
}

function findStep(S, allowTrial) {
  return findSingles(S) || findGroup(S,1) || findGroup(S,2) || findAdj(S) || findGroup(S,3) || findGroup(S,4) || (allowTrial ? findTrial(S) : null);
}

function rate(n, g, adj, level) {
  const W = [0,1,4,14,40, level===3 ? -40 : -12];
  const ctx = makeCtx(n, g, adj), S = newState(ctx);
  let max = 0, score = 0;
  const cnt = [0,0,0,0,0,0];
  for (let it=0; it<400 && S.placed<n; it++) {
    const st = findStep(S, true);
    if (!st || st.contra) return { ok:false };
    if (st.place !== undefined) placeK(S, st.place);
    else for (const i of st.elim) S.cand[i] = 0;
    max = Math.max(max, st.level);
    score += W[st.level];
    cnt[st.level]++;
  }
  if (S.placed < n) return { ok:false };
  const cc = Array(n).fill(0);
  g.forEach(k=>cc[k]++);
  score -= 40 * cc.filter(x=>x===1).length;
  const meets = max >= (level===3 ? 3 : 4) && cnt[5] <= (level===3 ? 0 : 2);
  return { ok:true, max, score, cnt, meets, key: score + (meets ? 100000 : 0) };
}

/* ================= GENERATE WITH PROGRESS ================= */
function generate(n, adj, level, onProgress, onDone, isCancelled) {
  const budget = level===3 ? 2500 : 5000;
  const extra  = level===3 ? 500 : 1500;
  const tStart = Date.now();
  let best = null, cur = null, stagn = 0, metAt = 0;
  
  const upd = p => { if (!best || p.r.key > best.r.key) best = { sol:p.sol, reg:p.reg.slice(), r:p.r }; };
  
  function chunk() {
    if (isCancelled && isCancelled()) return;
    const end = Date.now() + 30;
    while (Date.now() < end) {
      if (!cur) {
        const b = baseUnique(n, adj);
        if (b) { const r = rate(n, b.reg, adj, level); if (r.ok) { cur = { sol:b.sol, reg:b.reg, r }; stagn = 0; upd(cur); } }
        continue;
      }
      const ng = mutateCopy(cur.reg, n, cur.sol);
      if (!ng) { stagn++; continue; }
      if (solve(ng, n, adj, 2).length !== 1) { stagn++; }
      else {
        const r = rate(n, ng, adj, level);
        if (r.ok && r.key >= cur.r.key) {
          if (r.key > cur.r.key) stagn = 0; else stagn++;
          cur = { sol:cur.sol, reg:ng, r };
          upd(cur);
        } else stagn++;
      }
      if (stagn > 250) cur = null;
    }
    const el = Date.now() - tStart;
    const met = best && best.r.meets;
    if (met && !metAt) metAt = Date.now();
    if (best && ((met && Date.now()-metAt > extra) || el > budget)) return onDone(best);
    if (!best && el > budget * 3) {
      const p = makePuzzleSimple(n, adj);
      return onDone({ sol:p.sol, reg:p.reg, r:rate(n,p.reg,adj,level) });
    }
    onProgress(Math.min(1, el/budget));
    setTimeout(chunk, 0);
  }
  chunk();
}

function makePuzzleSimple(n, adj) {
  for (;;) { const b = baseUnique(n, adj); if (b) return b; }
}

/* ================= GAME LOGIC ================= */
function kings() {
  const k = [];
  gs.cells.forEach((v,i) => { if (v===2) k.push(i); });
  return k;
}

function conflictSet() {
  const k = kings(), bad = new Set();
  for (let a=0;a<k.length;a++) for (let b=a+1;b<k.length;b++) {
    const ra = Math.floor(k[a]/gs.N), ca = k[a]%gs.N;
    const rb = Math.floor(k[b]/gs.N), cb = k[b]%gs.N;
    if (ra===rb || ca===cb || gs.reg[k[a]]===gs.reg[k[b]] || (gs.ADJ && Math.abs(ra-rb)<=1 && Math.abs(ca-cb)<=1)) {
      bad.add(k[a]); bad.add(k[b]);
    }
  }
  return bad;
}

function candidates() {
  const cand = Array(gs.N*gs.N).fill(true);
  for (const i of kings()) {
    const r = Math.floor(i/gs.N), c = i%gs.N;
    for (let j=0;j<gs.N*gs.N;j++) {
      const rj = Math.floor(j/gs.N), cj = j%gs.N;
      if (rj===r || cj===c || gs.reg[j]===gs.reg[i] || (gs.ADJ && Math.abs(rj-r)<=1 && Math.abs(cj-c)<=1)) cand[j] = false;
    }
  }
  return cand;
}

/* ================= HINTS ================= */
function getHint() {
  const rc = i => `hàng ${Math.floor(i/gs.N)+1}, cột ${i%gs.N+1}`;
  const K = kings();
  const wrong = K.filter(i => gs.sol[Math.floor(i/gs.N)] !== i%gs.N);
  if (wrong.length) {
    return {
      msg: wrong.length===1 ? `Vua ở ${rc(wrong[0])} đang sai. Hãy bỏ nó đi.` : `Có ${wrong.length} vua đặt sai (viền vàng). Hãy bỏ chúng đi.`,
      target: wrong, elim: []
    };
  }
  const wrongX = [];
  gs.cells.forEach((v,i) => { if (v===1 && gs.sol[Math.floor(i/gs.N)]===i%gs.N) wrongX.push(i); });
  if (wrongX.length) {
    return { msg: `Dấu × ở ${rc(wrongX[0])} đang sai: vua thật sự nằm ở đó. Hãy xóa dấu × này.`, target: wrongX, elim: [] };
  }
  if (K.length === gs.N) return { msg:'Bàn đã đủ vua.', target: [], elim: [] };
  const ctx = makeCtx(gs.N, gs.reg, gs.ADJ), S = newState(ctx);
  K.forEach(i => placeK(S, i));
  gs.cells.forEach((v,i) => { if (v===1) S.cand[i] = 0; });
  const step = findStep(S, true);
  if (step && !step.contra) {
    const lv = ['','cơ bản','nâng cao','nhóm 2 đường','nhóm 3 đường','thử giả định'][step.level];
    return {
      msg: (step.place !== undefined ? step.msg : step.msg + ' Hãy ghi × vào các ô gạch đỏ rồi xin gợi ý tiếp.') + ` (Kỹ thuật: ${lv})`,
      target: step.target, elim: step.elim
    };
  }
  // Last resort
  let best = null, bestN = 99;
  const cand = candidates();
  for (let r=0;r<gs.N;r++) {
    if (K.some(i => Math.floor(i/gs.N) === r)) continue;
    let n = 0;
    for (let c=0;c<gs.N;c++) if (cand[r*gs.N+c]) n++;
    if (n < bestN) { bestN = n; best = r; }
  }
  const cell = best*gs.N + gs.sol[best];
  return { msg: `Thế cờ này cần suy luận rất sâu. Thử đặt vua tại ${rc(cell)} (ô viền vàng).`, target: [cell], elim: [] };
}

/* ================= LAYOUT ================= */
function computeLayout() {
  const G = LR.G;
  const W = G.W, H = G.H, top = G.top || 0;
  
  const bottomReserved = 110;
  const availH = H - top - bottomReserved;
  const availW = W - 24;
  const boardSize = Math.min(availH, availW);
  const bx = (W - boardSize) / 2;
  const by = top + 10;
  
  const btnH = 42, btnGap = 6;
  const btnRowY = by + boardSize + 12;
  const numBtns = 5;
  const btnW = Math.min(78, (W - 24 - btnGap * (numBtns-1)) / numBtns);
  const btnRowW = btnW * numBtns + btnGap * (numBtns-1);
  const btnX0 = (W - btnRowW) / 2;
  
  const btnLabels = [
    { id: 'hint', label: 'Gợi ý', color: '#b8860b' },
    { id: 'auto', label: '× Tự động', color: '#4a6fa5' },
    { id: 'undo', label: 'Hoàn tác', color: '#6b7280' },
    { id: 'clear', label: 'Xóa', color: '#6b7280' },
    { id: 'new', label: 'Ván mới', color: '#3a7d44' }
  ];
  
  const btnRects = btnLabels.map((b, i) => ({
    x: btnX0 + i * (btnW + btnGap),
    y: btnRowY, w: btnW, h: btnH,
    id: b.id, label: b.label, color: b.color
  }));
  
  return {
    bx, by, boardSize,
    cs: boardSize / gs.N,
    btnRowY, btnH,
    btnRects,
    msgY: btnRowY + btnH + 8
  };
}

/* ================= DRAW ================= */
function drawKingIcon(ctx, cx, cy, cellSize) {
  const s = cellSize * 0.68;
  const scale = s / 24;
  ctx.save();
  ctx.translate(cx - 12*scale, cy - 12*scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(3, 19, 18, 2);
  ctx.beginPath();
  ctx.moveTo(3, 7);
  ctx.lineTo(8, 12);
  ctx.lineTo(12, 5);
  ctx.lineTo(16, 12);
  ctx.lineTo(21, 7);
  ctx.lineTo(19, 17);
  ctx.lineTo(5, 17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawXIcon(ctx, cx, cy, cellSize) {
  const s = cellSize * 0.34;
  const hs = s / 2;
  const lw = Math.max(1.5, cellSize * 0.045);
  ctx.save();
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - hs, cy - hs);
  ctx.lineTo(cx + hs, cy + hs);
  ctx.moveTo(cx + hs, cy - hs);
  ctx.lineTo(cx - hs, cy + hs);
  ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx) {
  const { bx, by, cs } = L;
  const N = gs.N;
  const bad = conflictSet();
  const tgt = gs.hintInfo ? new Set(gs.hintInfo.target) : new Set();
  const el = gs.hintInfo ? new Set(gs.hintInfo.elim) : new Set();
  
  // Fill cells
  for (let r=0;r<N;r++) {
    for (let c=0;c<N;c++) {
      const i = r*N + c;
      ctx.fillStyle = COLORS[gs.reg[i]];
      ctx.fillRect(bx + c*cs, by + r*cs, cs, cs);
    }
  }
  
  // Draw grid lines
  ctx.strokeStyle = '#16202a';
  for (let r=0;r<=N;r++) {
    for (let c=0;c<N;c++) {
      const thick = (r === 0 || r === N) ? 3 : (gs.reg[(r-1)*N+c] !== gs.reg[r*N+c] ? 3 : 1);
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(bx + c*cs, by + r*cs);
      ctx.lineTo(bx + (c+1)*cs, by + r*cs);
      ctx.stroke();
    }
  }
  for (let c=0;c<=N;c++) {
    for (let r=0;r<N;r++) {
      const thick = (c === 0 || c === N) ? 3 : (gs.reg[r*N+c-1] !== gs.reg[r*N+c] ? 3 : 1);
      ctx.lineWidth = thick;
      ctx.beginPath();
      ctx.moveTo(bx + c*cs, by + r*cs);
      ctx.lineTo(bx + c*cs, by + (r+1)*cs);
      ctx.stroke();
    }
  }
  
  // Draw icons
  for (let r=0;r<N;r++) {
    for (let c=0;c<N;c++) {
      const i = r*N + c;
      const cx = bx + (c+0.5)*cs, cy = by + (r+0.5)*cs;
      
      if (gs.cells[i] === 2) {
        if (bad.has(i)) {
          ctx.save();
          ctx.strokeStyle = '#d23b3b';
          ctx.lineWidth = 3;
          ctx.strokeRect(bx + c*cs + 2, by + r*cs + 2, cs - 4, cs - 4);
          ctx.restore();
        }
        drawKingIcon(ctx, cx, cy, cs);
      } else if (gs.cells[i] === 1) {
        drawXIcon(ctx, cx, cy, cs);
      }
    }
  }
  
  // Hint overlays
  if (gs.hintInfo) {
    tgt.forEach(i => {
      const r = Math.floor(i/N), c = i % N;
      ctx.save();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 4;
      ctx.strokeRect(bx + c*cs + 2, by + r*cs + 2, cs - 4, cs - 4);
      ctx.restore();
    });
    el.forEach(i => {
      const r = Math.floor(i/N), c = i % N;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx + c*cs, by + r*cs, cs, cs);
      ctx.clip();
      ctx.strokeStyle = 'rgba(210,59,59,0.55)';
      ctx.lineWidth = 5;
      for (let k = -cs; k < cs * 2; k += 10) {
        ctx.beginPath();
        ctx.moveTo(bx + c*cs + k, by + r*cs);
        ctx.lineTo(bx + c*cs + k - cs, by + r*cs + cs);
        ctx.stroke();
      }
      ctx.restore();
    });
  }
}

function drawButtons(ctx) {
  for (const b of L.btnRects) {
    ctx.save();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    else ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w/2, b.y + b.h/2);
    ctx.restore();
  }
}

function drawMessage(ctx) {
  if (!gs.msg) return;
  ctx.save();
  ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#16202a';
  
  // Wrap text
  const maxW = LR.G.W - 24;
  const words = gs.msg.split(' ');
  let line = '', curY = L.msgY;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, LR.G.W/2, curY);
      curY += 16;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, LR.G.W/2, curY);
  ctx.restore();
}

function drawGenerating(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(10, 20, 30, 0.6)';
  ctx.fillRect(0, 0, LR.G.W, LR.G.H);
  ctx.fillStyle = '#fff';
  ctx.font = '900 22px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Đang tạo ván khó...', LR.G.W/2, LR.G.H/2 - 30);
  ctx.font = '600 14px "Be Vietnam Pro", sans-serif';
  ctx.fillText(Math.round(gs.genProgress * 100) + '%', LR.G.W/2, LR.G.H/2 + 10);
  
  // Progress bar
  const barW = Math.min(280, LR.G.W - 60);
  const barX = (LR.G.W - barW) / 2;
  const barY = LR.G.H/2 + 30;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(barX, barY, barW, 8);
  ctx.fillStyle = '#b8860b';
  ctx.fillRect(barX, barY, barW * gs.genProgress, 8);
  ctx.restore();
}

/* ================= RENDER ================= */
function render() {
  const G = LR.G, ctx = G.ctx;
  if (!ctx || !gs) return;
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, G.W, G.H);
  
  // Background
  ctx.fillStyle = '#eef1f4';
  ctx.fillRect(0, 0, G.W, G.H);
  
  if (gs.generating) {
    drawGenerating(ctx);
    return;
  }
  
  drawBoard(ctx);
  drawButtons(ctx);
  drawMessage(ctx);
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!gs || LR.G.state !== 'play') return;
  if (gs.generating) return;
  
  // Tick timer
  if (!gs.won) {
    gs.elapsed = (Date.now() - gs.startTime) / 1000;
    updateHUD();
  }
}

function updateHUD() {
  if (!gs) return;
  const k = kings().length;
  const secs = Math.floor(gs.elapsed);
  const mm = String(Math.floor(secs/60)).padStart(2,'0');
  const ss = String(secs%60).padStart(2,'0');
  LR.G.hud.set([
    { l: 'Thời gian', v: mm + ':' + ss },
    { l: 'Vua', v: k + '/' + gs.N },
    { l: 'Gợi ý', v: gs.hints }
  ]);
}

/* ================= NEW GAME ================= */
function newGame() {
  gs.cancelled = true;
  // small delay to let old gen stop
  setTimeout(() => startNewPuzzle(), 50);
}

function startNewPuzzle() {
  if (!gs) return;
  gs.cancelled = false;
  gs.generating = true;
  gs.genProgress = 0;
  gs.cells = Array(gs.N * gs.N).fill(0);
  gs.hist = [];
  gs.hintInfo = null;
  gs.hints = 0;
  gs.won = false;
  gs.msg = '';
  
  const myToken = ++gs.token;
  
  generate(gs.N, gs.ADJ, gs.LEVEL, p => {
    if (gs.token === myToken) gs.genProgress = p;
  }, best => {
    if (gs.token !== myToken || gs.cancelled) return;
    gs.sol = best.sol;
    gs.reg = best.reg;
    gs.generating = false;
    gs.startTime = Date.now();
    gs.elapsed = 0;
    gs.msg = 'Chạm một ô: lần 1 đánh ×, lần 2 đặt vua, lần 3 xóa.';
    if (best.r && best.r.ok) gs.msg = `Độ khó: ${LABEL[best.r.max]}. ` + gs.msg;
    L = computeLayout();
    updateHUD();
  }, () => gs.cancelled);
}

/* ================= INPUT ================= */
function handleButton(id) {
  if (gs.won) return;
  if (id === 'hint') {
    gs.hintInfo = getHint();
    gs.hints++;
    gs.msg = gs.hintInfo.msg;
    Sound.tone('sine', 660, 880, 0.08, 0.12);
  } else if (id === 'auto') {
    const cand = candidates();
    gs.hist.push(gs.cells.slice());
    for (let i=0;i<gs.N*gs.N;i++) if (gs.cells[i]===0 && !cand[i]) gs.cells[i]=1;
    gs.hintInfo = null;
    gs.msg = 'Đã ghi × vào các ô không thể đặt vua.';
    Sound.tone('sine', 520, 520, 0.06, 0.1);
  } else if (id === 'undo') {
    if (!gs.hist.length) return;
    gs.cells = gs.hist.pop();
    gs.hintInfo = null;
    gs.msg = 'Đã hoàn tác.';
    Sound.tone('sine', 440, 340, 0.08, 0.1);
  } else if (id === 'clear') {
    gs.hist.push(gs.cells.slice());
    gs.cells = Array(gs.N * gs.N).fill(0);
    gs.hintInfo = null;
    gs.msg = 'Đã xóa bàn.';
    Sound.tone('sine', 340, 220, 0.12, 0.1);
  } else if (id === 'new') {
    newGame();
    return;
  }
  updateHUD();
}

function handleCellTap(i) {
  if (gs.won) return;
  gs.hist.push(gs.cells.slice());
  gs.cells[i] = (gs.cells[i] + 1) % 3;
  gs.hintInfo = null;
  
  if (gs.cells[i] === 2) Sound.tone('triangle', 523, 523, 0.08, 0.15);
  else if (gs.cells[i] === 1) Sound.tone('sine', 700, 700, 0.05, 0.1);
  else Sound.tone('sine', 400, 300, 0.05, 0.08);
  
  const bad = conflictSet();
  if (bad.size > 0) {
    gs.msg = 'Có vua xung đột (viền đỏ). Hai vua không được cùng hàng, cột, mảng màu.';
  } else {
    gs.msg = 'Chạm một ô: lần 1 đánh ×, lần 2 đặt vua, lần 3 xóa.';
  }
  
  checkWin();
  updateHUD();
}

function checkWin() {
  if (gs.won) return;
  if (kings().length === gs.N && conflictSet().size === 0) {
    gs.won = true;
    const secs = Math.floor((Date.now() - gs.startTime) / 1000);
    const baseScore = gs.N * 200;
    const timeScore = Math.max(0, 600 - secs * 2);
    const hintPenalty = gs.hints * 100;
    const score = Math.max(50, baseScore + timeScore - hintPenalty);
    const stars = gs.hints === 0 && secs < gs.N * 60 ? 3 : gs.hints <= 2 ? 2 : 1;
    Sound.sfx.win();
    setTimeout(() => {
      if (!gs || !gs.won) return;
      LR.G.finish({
        win: true,
        score: score,
        stars: stars,
        title: 'XẾP VUA THÀNH CÔNG!',
        msg: `Hoàn thành ${gs.N}×${gs.N} trong ${secs}s với ${gs.hints} gợi ý.`,
        rows: [
          ['Kích thước', gs.N + '×' + gs.N],
          ['Thời gian', Math.floor(secs/60) + 'm ' + (secs%60) + 's'],
          ['Gợi ý', gs.hints],
          ['Điểm', score]
        ]
      });
    }, 600);
  }
}

/* ================= MOD ================= */
const mod = {
  enter(opts) {
    const modeId = (opts && opts.mode) || 'easy';
    const mode = MODES[modeId] || MODES.easy;
    
    gs = {
      N: mode.n,
      ADJ: mode.adj,
      LEVEL: mode.level,
      sol: [],
      reg: [],
      cells: [],
      hist: [],
      hintInfo: null,
      hints: 0,
      elapsed: 0,
      startTime: 0,
      won: false,
      generating: true,
      genProgress: 0,
      cancelled: false,
      token: 0,
      msg: ''
    };
    L = computeLayout();
    Sound.init();
    startNewPuzzle();
    updateHUD();
  },
  exit() {
    if (gs) gs.cancelled = true;
    gs = null;
    L = null;
  },
  resize() {
    if (gs) L = computeLayout();
  },
  update(dt) { update(dt); },
  draw() { render(); },
  pointerDown(x, y, e) {
    if (!gs || gs.generating) return;
    Sound.init();
    
    // Check buttons first
    for (const b of L.btnRects) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        handleButton(b.id);
        return;
      }
    }
    
    // Check cells
    if (x >= L.bx && x <= L.bx + L.boardSize && y >= L.by && y <= L.by + L.boardSize) {
      const c = Math.floor((x - L.bx) / L.cs);
      const r = Math.floor((y - L.by) / L.cs);
      if (r >= 0 && r < gs.N && c >= 0 && c < gs.N) {
        handleCellTap(r * gs.N + c);
      }
    }
  },
  pointerUp() {},
  pointerMove() {},
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '👑 Mỗi mảng màu một vua. Mỗi hàng, mỗi cột có đúng một vua. Không có hai vua cùng hàng, cột hoặc mảng màu. ' +
      '<b>Chạm ô</b> để đổi trạng thái: × → vua → trống. ' +
      'Dùng nút <b>Gợi ý</b> nếu bí — ô viền vàng là nơi nên đặt vua, ô gạch đỏ có thể loại.</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '20-xep-vua',
  title: 'Xếp Vua',
  desc: 'Mỗi mảng màu một vua. Mỗi hàng và mỗi cột đúng một vua. Không có hai vua cùng hàng, cột hoặc mảng màu.',
  rules: [
    'Mỗi hàng có đúng một vua',
    'Mỗi cột có đúng một vua',
    'Mỗi mảng màu có đúng một vua',
    'Hai vua không được cùng hàng, cột hoặc mảng màu',
    'Chạm ô để đổi trạng thái: × → vua → trống',
    'Dùng Gợi ý, × Tự động, Hoàn tác khi cần'
  ],
  status: 'ready',
  pad: false,
  actLabel: '',
  modes: [
    { id: 'easy', name: '7×7', sub: 'Vừa phải — dễ thở' },
    { id: 'medium', name: '8×8', sub: 'Khó — đòi suy luận' },
    { id: 'hard', name: '9×9', sub: 'Siêu khó — thử thách cao' }
  ],
  mod
};

if (typeof LR.registerLevel === 'function') {
  LR.registerLevel('ch1', LEVEL);
} else {
  const ch = (LR.chapters || []).find(c => c.id === 'ch1');
  if (ch) {
    if (!ch.levels) ch.levels = [];
    const idx = ch.levels.findIndex(l => l && l.id === LEVEL.id);
    if (idx >= 0) ch.levels[idx] = LEVEL;
    else ch.levels.push(LEVEL);
  }
}
})();
