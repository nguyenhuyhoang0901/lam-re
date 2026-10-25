/* js/levels/ch1/20-xep-vua.js — Ải 20: Xếp Vua */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;
const {clamp} = LR.util;

/* ================= CONFIG ================= */
const COLORS = ['#f4a6a0','#f6c177','#f2e394','#a8d8a0','#8fd3d0','#9cc3f0','#b9a7ee','#e7a7d6','#cfc7b2'];
const INK = '#16202a';
const BG = '#eef1f4';

// Mọi mode đều level 5 = BẮT BUỘC dùng giả định thử-sai
const MODES = {
  'hard-7':  { n: 7, adj: false, level: 5 },
  'hard-8':  { n: 8, adj: false, level: 5 },
  'hard-9':  { n: 9, adj: false, level: 5 },
  'ultra-7': { n: 7, adj: true,  level: 5 },
  'ultra-8': { n: 8, adj: true,  level: 5 },
  'ultra-9': { n: 9, adj: true,  level: 5 }
};
const DEFAULT_MODE = 'hard-7';

function getBudget(cfg) {
  return 7000 + Math.max(0, cfg.n - 7) * 1000 + (cfg.adj ? 2000 : 0);
}
function getRateLimit(cfg) {
  return 1500 + cfg.n * 80;
}

/* ================= STATE ================= */
let st = null;
let geo = null;

function newState(modeId) {
  const cfg = MODES[modeId] || MODES[DEFAULT_MODE];
  return {
    modeId, cfg,
    state: 'loading',
    n: cfg.n, adj: cfg.adj, level: cfg.level,
    sol: [], reg: [],
    cells: [], hist: [],
    hint: null, hints: 0,
    time: 0, winTimer: 0,
    genToken: 0, genProgress: 0,
    buttons: [],
    trialHints: 0
  };
}

/* ================= PUZZLE GENERATION ================= */
const shuffle = a => { for (let i = a.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [a[i],a[j]] = [a[j],a[i]]; } return a; };

function neighbors(i, n) {
  const r = (i/n)|0, c = i%n, o = [];
  if (r > 0) o.push(i-n);
  if (r < n-1) o.push(i+n);
  if (c > 0) o.push(i-1);
  if (c < n-1) o.push(i+1);
  return o;
}

// ⭐ FIX #1: 1x1 region detection
function countOneCellRegions(g, n) {
  const cc = Array(n).fill(0);
  g.forEach(k => cc[k]++);
  return cc.filter(x => x === 1).length;
}

function genSolution(n, adj) {
  const cols = [], used = new Set();
  const ok = (function bt(r) {
    if (r === n) return true;
    for (const c of shuffle([...Array(n).keys()])) {
      if (used.has(c)) continue;
      if (adj && r > 0 && Math.abs(c - cols[r-1]) <= 1) continue;
      cols[r] = c; used.add(c);
      if (bt(r+1)) return true;
      used.delete(c);
    }
    return false;
  })(0);
  return ok ? cols : null;
}

// ⭐ FIX #1: grow() đảm bảo mỗi vùng lớn ≥2 ô ngay từ đầu
function grow(n, sol) {
  const g = new Array(n*n).fill(-1);
  sol.forEach((c, r) => g[r*n+c] = r);

  // PHASE 1: mỗi vùng phải lớn thêm 1 ô (chặn 1x1 từ đầu)
  const order = shuffle([...Array(n).keys()]);
  for (const k of order) {
    const kingPos = k*n + sol[k];
    const unfilled = neighbors(kingPos, n).filter(j => g[j] < 0);
    if (unfilled.length > 0) {
      const j = unfilled[(Math.random()*unfilled.length)|0];
      g[j] = k;
    }
  }

  // PHASE 2: fill ngẫu nhiên phần còn lại
  let left = g.filter(x => x < 0).length;
  while (left > 0) {
    const opts = [];
    for (let i = 0; i < n*n; i++) {
      if (g[i] < 0) continue;
      for (const j of neighbors(i, n)) if (g[j] < 0) opts.push([i, j]);
    }
    if (!opts.length) break;
    const [i, j] = opts[(Math.random()*opts.length)|0];
    g[j] = g[i];
    left--;
  }
  return g;
}

function solve(g, n, adj, limit) {
  const sols = [], cols = [];
  let cm = 0, rm = 0;
  (function bt(r) {
    if (sols.length >= limit) return;
    if (r === n) { sols.push(cols.slice()); return; }
    for (let c = 0; c < n; c++) {
      if (cm >> c & 1) continue;
      const k = g[r*n+c];
      if (rm >> k & 1) continue;
      if (adj && r > 0 && Math.abs(c - cols[r-1]) <= 1) continue;
      cols[r] = c; cm |= 1 << c; rm |= 1 << k;
      bt(r+1);
      cm &= ~(1 << c); rm &= ~(1 << k);
    }
  })(0);
  return sols;
}

function staysConnected(g, n, cell) {
  const k = g[cell], cells = [];
  for (let i = 0; i < n*n; i++) if (g[i] === k && i !== cell) cells.push(i);
  if (!cells.length) return false;
  const seen = new Set([cells[0]]), q = [cells[0]];
  while (q.length) {
    const x = q.pop();
    for (const y of neighbors(x, n)) {
      if (y !== cell && g[y] === k && !seen.has(y)) { seen.add(y); q.push(y); }
    }
  }
  return seen.size === cells.length;
}

// ⭐ FIX #2: mutate() không co vùng xuống 1 ô
function mutate(g, n, s1, s2) {
  const cc = Array(n).fill(0);
  g.forEach(k => cc[k]++);
  const rows = shuffle([...Array(n).keys()].filter(r => s1[r] !== s2[r]));
  for (const r of rows) {
    const cell = r*n + s2[r];
    if (cc[g[cell]] <= 2) continue;  // ⭐ Không cho vùng 2 ô mất 1 ô
    const ns = shuffle(neighbors(cell, n).filter(j => g[j] !== g[cell]));
    for (const j of ns) {
      if (!staysConnected(g, n, cell)) break;
      g[cell] = g[j];
      return true;
    }
  }
  return false;
}

function baseUnique(n, adj) {
  const s = genSolution(n, adj);
  if (!s || s.length !== n) return null;
  const g = grow(n, s);
  if (countOneCellRegions(g, n) > 0) return null;  // ⭐ Reject sớm
  for (let it = 0; it < 500; it++) {
    const sols = solve(g, n, adj, 2);
    if (sols.length === 1) {
      if (countOneCellRegions(g, n) > 0) return null;  // ⭐ Double-check
      return { sol: s, reg: g };
    }
    const other = sols.find(x => x.some((c, r) => c !== s[r]));
    if (!other || !mutate(g, n, s, other)) return null;
    if (countOneCellRegions(g, n) > 0) return null;  // ⭐ Sau mỗi mutation
  }
  return null;
}

// ⭐ FIX #3: mutateCopy() không co vùng xuống 1 ô
function mutateCopy(g, n, sol) {
  const kingSet = new Set(sol.map((c, r) => r*n + c));
  const cc = Array(n).fill(0);
  g.forEach(k => cc[k]++);
  for (let t = 0; t < 30; t++) {
    const i = (Math.random() * n * n) | 0;
    if (kingSet.has(i)) continue;
    if (cc[g[i]] <= 2) continue;  // ⭐ Không cho vùng 2 ô mất 1 ô
    const ns = shuffle(neighbors(i, n).filter(j => g[j] !== g[i]));
    if (!ns.length || !staysConnected(g, n, i)) continue;
    const ng = g.slice();
    ng[i] = g[ns[0]];
    return ng;
  }
  return null;
}

function makePuzzleSimple(n, adj) {
  for (let i = 0; i < 50; i++) {
    const b = baseUnique(n, adj);
    if (b) return b;
  }
  // Cực chẳng đã mới fallback
  const sol = genSolution(n, adj);
  if (sol && sol.length === n) return { sol, reg: grow(n, sol) };
  return null;
}

/* ================= REASONING ================= */
const KINDS = ['row', 'col', 'reg'];
const NAME = { row: 'hàng', col: 'cột', reg: 'mảng màu' };

function makeCtx(n, g, adj) {
  const U = { row: [], col: [], reg: [] };
  for (let k = 0; k < n; k++) { U.row.push([]); U.col.push([]); U.reg.push([]); }
  for (let i = 0; i < n*n; i++) {
    U.row[(i/n)|0].push(i);
    U.col[i%n].push(i);
    U.reg[g[i]].push(i);
  }
  return { n, g, adj, U };
}
const lineOf = (c, kind, i) => kind === 'row' ? (i/c.n)|0 : kind === 'col' ? i % c.n : c.g[i];

function newReasonState(ctx) {
  const n = ctx.n;
  return {
    ctx,
    cand: new Uint8Array(n*n).fill(1),
    done: { row: new Uint8Array(n), col: new Uint8Array(n), reg: new Uint8Array(n) },
    placed: 0
  };
}
function cloneRState(S) {
  return {
    ctx: S.ctx,
    cand: S.cand.slice(),
    done: { row: S.done.row.slice(), col: S.done.col.slice(), reg: S.done.reg.slice() },
    placed: S.placed
  };
}
function placeR(S, i) {
  const c = S.ctx, n = c.n, r = (i/n)|0, cc = i%n, k = c.g[i];
  S.done.row[r] = 1; S.done.col[cc] = 1; S.done.reg[k] = 1; S.placed++;
  for (let j = 0; j < n*n; j++) {
    const rj = (j/n)|0, cj = j%n;
    if (rj === r || cj === cc || c.g[j] === k ||
        (c.adj && Math.abs(rj - r) <= 1 && Math.abs(cj - cc) <= 1)) S.cand[j] = 0;
  }
}
const candList = (S, kind, u) => S.ctx.U[kind][u].filter(i => S.cand[i]);
const openUnits = (S, kind) => {
  const o = [];
  for (let u = 0; u < S.ctx.n; u++) if (!S.done[kind][u]) o.push(u);
  return o;
};
function combos(arr, k) {
  const out = [];
  (function rec(s, cur) {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
  })(0, []);
  return out;
}
const rcOf = (n, i) => `hàng ${((i/n)|0)+1}, cột ${i%n+1}`;

function findSingles(S) {
  for (const kind of KINDS) for (const u of openUnits(S, kind)) {
    if (candList(S, kind, u).length === 0) return { contra: true };
  }
  for (const kind of KINDS) for (const u of openUnits(S, kind)) {
    const cs = candList(S, kind, u);
    if (cs.length === 1) {
      const where = kind === 'row' ? `Hàng ${u+1} chỉ còn một ô hợp lệ`
                   : kind === 'col' ? `Cột ${u+1} chỉ còn một ô hợp lệ`
                   : `Mảng màu này chỉ còn một ô hợp lệ`;
      return { level: 1, place: cs[0], target: cs, elim: [],
        msg: `${where}. Vua phải ở ${rcOf(S.ctx.n, cs[0])}.` };
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
      const bs = new Set(union.map(i => lineOf(c, B, i)));
      if (bs.size !== k) continue;
      const elim = [];
      for (const b of bs) for (const i of c.U[B][b])
        if (S.cand[i] && !combo.includes(lineOf(c, A, i))) elim.push(i);
      if (!elim.length) continue;
      const bl = [...bs].sort((x, y) => x - y).map(x => x+1).join(', ');
      const kB = B === 'reg' ? (k === 1 ? 'mảng màu chứa các ô đó' : `${k} mảng màu chứa các ô đó`)
                             : `${NAME[B]} ${bl}`;
      return {
        level: k === 1 ? 2 : k === 2 ? 3 : 4,
        elim, target: union,
        msg: (k === 1
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
    for (let x = 0; x < n*n; x++) {
      if (!S.cand[x] || C.includes(x)) continue;
      const rx = (x/n)|0, cx = x%n;
      if (C.every(y => Math.abs(((y/n)|0) - rx) <= 1 && Math.abs(y%n - cx) <= 1)) elim.push(x);
    }
    if (elim.length) return {
      level: 3, elim, target: C,
      msg: `Mọi vị trí còn lại của ${NAME[kind]} này (ô vàng) đều kề ô gạch đỏ. Vua nào đặt ở đây cũng chạm các ô đỏ nên ô đỏ không thể có vua.`
    };
  }
  return null;
}

function findTrial(S, timeLimit) {
  const n = S.ctx.n;
  const tStart = performance.now();
  const tl = timeLimit || 250;
  const cells = [];
  for (let x = 0; x < n*n; x++) {
    if (!S.cand[x]) continue;
    let priority = 0;
    for (const kind of KINDS) {
      const u = lineOf(S.ctx, kind, x);
      const cnt = candList(S, kind, u).length;
      priority += Math.max(0, 5 - cnt);
    }
    cells.push({ x, priority });
  }
  cells.sort((a, b) => b.priority - a.priority);
  const maxTries = Math.min(cells.length, n <= 7 ? 24 : 14);
  for (let t = 0; t < maxTries; t++) {
    if (performance.now() - tStart > tl) return null;
    const x = cells[t].x;
    const T = cloneRState(S);
    placeR(T, x);
    let bad = false;
    for (let g = 0; g < 200; g++) {
      const s = findSingles(T) || findGroup(T, 1);
      if (!s) break;
      if (s.contra) { bad = true; break; }
      if (s.place !== undefined) placeR(T, s.place);
      else for (const i of s.elim) T.cand[i] = 0;
    }
    if (bad) return {
      level: 5, elim: [x], target: [],
      msg: `Giả định đặt vua vào ô gạch đỏ (${rcOf(n, x)}): lan truyền suy luận dẫn tới mâu thuẫn. Vậy ${rcOf(n, x)} không thể có vua.`
    };
  }
  return null;
}

function findStep(S, allowTrial) {
  return findSingles(S) || findGroup(S, 1) || findGroup(S, 2) || findAdj(S) ||
         findGroup(S, 3) || findGroup(S, 4) || (allowTrial ? findTrial(S) : null);
}

function requiresTrial(n, g, adj, timeLimit) {
  const ctx = makeCtx(n, g, adj);
  const S = newReasonState(ctx);
  const tStart = performance.now();
  const tl = timeLimit || 2500;
  for (let it = 0; it < 400 && S.placed < n; it++) {
    if (performance.now() - tStart > tl) return true;
    const step = findStep(S, false);
    if (!step || step.contra) return true;
    if (step.place !== undefined) placeR(S, step.place);
    else for (const i of step.elim) S.cand[i] = 0;
  }
  return S.placed < n;
}

// ⭐ FIX #4: rate() reject cứng nếu có 1x1
function rate(n, g, adj, level, timeLimit) {
  // Defense-in-depth: reject any 1x1 puzzle
  if (countOneCellRegions(g, n) > 0) return { ok: false };

  const W = [0, 1, 4, 14, 40, 400];
  const tStart = performance.now();
  const tl = timeLimit || 800;
  const ctx = makeCtx(n, g, adj);
  const S = newReasonState(ctx);
  let max = 0, score = 0;
  const cnt = [0, 0, 0, 0, 0, 0];
  for (let it = 0; it < 500 && S.placed < n; it++) {
    if (performance.now() - tStart > tl) return { ok: false };
    const step = findStep(S, true);
    if (!step || step.contra) return { ok: false };
    if (step.place !== undefined) placeR(S, step.place);
    else for (const i of step.elim) S.cand[i] = 0;
    max = Math.max(max, step.level);
    score += W[step.level];
    cnt[step.level]++;
  }
  if (S.placed < n) return { ok: false };
  const cc = Array(n).fill(0);
  g.forEach(k => cc[k]++);
  // Vẫn giữ phạt dù đã reject ở trên (defense-in-depth)
  score -= 40 * cc.filter(x => x === 1).length;
  const meets = (max >= 5 && cnt[5] >= 1 && requiresTrial(n, g, adj));
  return { ok: true, max, score, cnt, meets,
    trialCount: cnt[5],
    key: score + (meets ? 100000 : 0) };
}

/* ================= ASYNC GENERATION ================= */
function startGeneration(cfg) {
  st.state = 'loading';
  st.genProgress = 0;
  const token = ++st.genToken;
  const budget = getBudget(cfg);
  const rateLimit = getRateLimit(cfg);
  const tStart = performance.now();
  let best = null;
  let cur = null;
  let stagn = 0;

  function finish(p) {
    if (st.genToken !== token) return;
    if (!p) {
      const p2 = makePuzzleSimple(cfg.n, cfg.adj);
      if (p2) p = p2;
      else {
        st.n = cfg.n; st.adj = cfg.adj; st.level = cfg.level;
        st.sol = []; st.reg = [];
        st.cells = new Array(cfg.n * cfg.n).fill(0);
        st.state = 'playing';
        computeLayout();
        return;
      }
    }
    st.n = cfg.n; st.adj = cfg.adj; st.level = cfg.level;
    st.sol = p.sol; st.reg = p.reg;
    st.cells = new Array(cfg.n * cfg.n).fill(0);
    st.hist = []; st.hint = null; st.hints = 0;
    st.trialHints = p.r ? p.r.trialCount : 0;
    st.time = 0; st.winTimer = 0;
    st.state = 'playing';
    computeLayout();
    Sound.sfx.catchOk();
  }

  function step() {
    if (st.genToken !== token) return;
    if (st.state !== 'loading') return;
    const end = performance.now() + 26;
    while (performance.now() < end) {
      if (!cur) {
        const b = baseUnique(cfg.n, cfg.adj);
        if (b) {
          const r = rate(cfg.n, b.reg, cfg.adj, cfg.level, rateLimit);
          if (r.ok) {
            cur = { sol: b.sol, reg: b.reg, r };
            stagn = 0;
            if (!best || r.key > best.r.key) best = cur;
          }
        }
        continue;
      }
      const ng = mutateCopy(cur.reg, cfg.n, cur.sol);
      if (!ng) { stagn++; if (stagn > 100) cur = null; continue; }
      if (countOneCellRegions(ng, cfg.n) > 0) { stagn++; if (stagn > 100) cur = null; continue; }
      if (solve(ng, cfg.n, cfg.adj, 2).length !== 1) { stagn++; if (stagn > 100) cur = null; continue; }
      const r = rate(cfg.n, ng, cfg.adj, cfg.level, rateLimit);
      if (r.ok) {
        if (r.key > cur.r.key) {
          cur = { sol: cur.sol, reg: ng, r };
          if (!best || r.key > best.r.key) best = cur;
          stagn = 0;
        } else stagn++;
      } else stagn++;
      if (stagn > 100) cur = null;
    }
    const el = performance.now() - tStart;
    st.genProgress = Math.min(1, el / budget);
    if (best && best.r.meets && el > budget * 0.6) { finish(best); return; }
    if (best && el > budget * 1.5) { finish(best); return; }
    if (!best && el > budget * 1.2) { finish(null); return; }
    setTimeout(step, 0);
  }
  step();
}

/* ================= LAYOUT ================= */
function computeLayout() {
  const G = LR.G;
  if (!st || st.n < 1) { geo = null; return; }
  const top = G.top || 0;
  const bottomH = 66;
  const pad = 14;
  const availW = G.W - pad * 2;
  const availH = G.H - top - bottomH - pad * 2;
  const boardSize = Math.min(availW, availH);
  const cs = boardSize / st.n;
  const bx = (G.W - boardSize) / 2;
  const by = top + pad + (availH - boardSize) / 2;
  geo = { cs, bx, by, boardSize };
  const btnY = G.H - bottomH + 4;
  const btnH = 44;
  const gap = 6;
  const btnW = (availW - gap * 3) / 4;
  st.buttons = [
    { id: 'hint',  x: pad,                y: btnY, w: btnW, h: btnH, label: '💡 Gợi ý', primary: true },
    { id: 'undo',  x: pad + btnW + gap,   y: btnY, w: btnW, h: btnH, label: '↶ Hoàn tác' },
    { id: 'clear', x: pad + (btnW+gap)*2, y: btnY, w: btnW, h: btnH, label: '🗑 Xóa' },
    { id: 'new',   x: pad + (btnW+gap)*3, y: btnY, w: btnW, h: btnH, label: '🔄 Mới' }
  ];
}

/* ================= HINT ================= */
function rc(i) { return `hàng ${((i/st.n)|0)+1}, cột ${i%st.n+1}`; }
function getHintInfo() {
  const N = st.n;
  if (!st.sol.length) return { msg: 'Ván chưa sẵn sàng. Nhấn "Mới" để thử lại.', target: [], elim: [] };
  const kings = [];
  st.cells.forEach((v, i) => { if (v === 2) kings.push(i); });
  const wrong = kings.filter(i => st.sol[(i/N)|0] !== i%N);
  if (wrong.length) {
    return {
      msg: wrong.length === 1 ? `Vua ở ${rc(wrong[0])} đang sai. Hãy bỏ nó đi.`
                              : `Có ${wrong.length} vua đặt sai (viền vàng). Hãy bỏ chúng đi.`,
      target: wrong, elim: []
    };
  }
  const wrongX = [];
  st.cells.forEach((v, i) => { if (v === 1 && st.sol[(i/N)|0] === i%N) wrongX.push(i); });
  if (wrongX.length) return { msg: `Dấu × ở ${rc(wrongX[0])} đang sai.`, target: wrongX, elim: [] };
  if (kings.length === N) return { msg: 'Bàn đã đủ vua.', target: [], elim: [] };
  const ctx = makeCtx(N, st.reg, st.adj);
  const S = newReasonState(ctx);
  kings.forEach(i => placeR(S, i));
  st.cells.forEach((v, i) => { if (v === 1) S.cand[i] = 0; });
  const step = findStep(S, true);
  if (step && !step.contra) {
    const lv = ['', 'cơ bản', 'nâng cao', 'nhóm 2 đường', 'nhóm 3-4 đường', 'giả định (thử sai)'][step.level];
    return { msg: step.msg + ` (Kỹ thuật: ${lv})`, target: step.target || [], elim: step.elim || [] };
  }
  let bestR = -1, bestN = 99;
  for (let r = 0; r < N; r++) {
    if (kings.some(i => ((i/N)|0) === r)) continue;
    let n = 0;
    for (let c = 0; c < N; c++) if (S.cand[r*N+c]) n++;
    if (n < bestN) { bestN = n; bestR = r; }
  }
  if (bestR < 0) return { msg: 'Thế cờ phức tạp. Thử xoá × để gợi ý dễ hơn.', target: [], elim: [] };
  const cell = bestR * N + st.sol[bestR];
  return { msg: `Thế cờ cần suy luận rất sâu. Thử đặt vua tại ${rc(cell)}.`, target: [cell], elim: [] };
}

/* ================= ACTIONS ================= */
function doNewGame() { st.genToken++; Sound.sfx.click(); startGeneration(st.cfg); }
function doHint() { if (st.state !== 'playing') return; st.hint = getHintInfo(); st.hints++; Sound.sfx.win(); }
function doUndo() {
  if (!st.hist.length || st.state !== 'playing') return;
  st.cells = st.hist.pop(); st.hint = null; Sound.sfx.click();
}
function doClear() {
  if (st.state !== 'playing') return;
  st.hist.push(st.cells.slice()); st.cells = new Array(st.n * st.n).fill(0); st.hint = null; Sound.sfx.click();
}
function doCellClick(i) {
  if (st.state !== 'playing') return;
  st.hist.push(st.cells.slice());
  st.cells[i] = (st.cells[i] + 1) % 3;
  st.hint = null;
  if (st.cells[i] === 2) Sound.sfx.catchOk();
  else if (st.cells[i] === 1) Sound.sfx.tick();
  else Sound.sfx.click();
  checkWin();
}

function checkWin() {
  const N = st.n;
  if (!st.sol.length) return;
  const kings = [];
  st.cells.forEach((v, i) => { if (v === 2) kings.push(i); });
  if (kings.length !== N) return;
  for (let a = 0; a < kings.length; a++) for (let b = a+1; b < kings.length; b++) {
    const ra = (kings[a]/N)|0, ca = kings[a]%N;
    const rb = (kings[b]/N)|0, cb = kings[b]%N;
    if (ra === rb || ca === cb || st.reg[kings[a]] === st.reg[kings[b]]) return;
    if (st.adj && Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) return;
  }
  const match = kings.every(i => st.sol[(i/N)|0] === i%N);
  if (!match) return;
  st.state = 'won';
  st.winTimer = 1.2;
  Sound.sfx.win();
  setTimeout(() => Sound.sfx.win(), 300);
}

function finishWin() {
  const stars = st.hints === 0 ? 3 : st.hints <= 3 ? 2 : 1;
  const score = Math.max(100, 5000 - st.hints * 500 - Math.floor(st.time) * 2);
  const secs = Math.floor(st.time);
  const tStr = String(Math.floor(secs/60)).padStart(2,'0') + ':' + String(secs%60).padStart(2,'0');
  LR.G.finish({
    win: true, score, stars,
    title: 'GIẢI XONG!',
    msg: `Bạn đã xếp đủ ${st.n} vua không xung đột${st.adj ? ' (kể cả chéo)' : ''}!`,
    rows: [
      ['Thời gian', tStr],
      ['Gợi ý dùng', st.hints],
      ['Chế độ', (st.adj ? 'Siêu Khó' : 'Rất Khó') + ' · ' + st.n + '×' + st.n],
      ['Bước giả định', st.trialHints + ' lần'],
      ['Điểm', score]
    ]
  });
}

/* ================= UPDATE ================= */
function update(dt) {
  if (!st || LR.G.state !== 'play') return;
  if (st.state === 'loading') return;
  if (st.state === 'playing') st.time += dt;
  if (st.state === 'won') { st.winTimer -= dt; if (st.winTimer <= 0) finishWin(); }
  const kings = st.cells.filter(v => v === 2).length;
  const secs = Math.floor(st.time);
  const tStr = String(Math.floor(secs/60)).padStart(2,'0') + ':' + String(secs%60).padStart(2,'0');
  LR.G.hud.set([
    { l: 'Vua', v: kings + '/' + st.n },
    { l: 'Giờ', v: tStr },
    { l: 'Gợi ý', v: st.hints }
  ]);
}

/* ================= DRAW ================= */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}
function drawKing(ctx, cx, cy, size) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - 12*s, cy - 12*s);
  ctx.scale(s, s);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(3, 19, 18, 2);
  ctx.beginPath();
  ctx.moveTo(3, 7); ctx.lineTo(8, 12); ctx.lineTo(12, 5); ctx.lineTo(16, 12);
  ctx.lineTo(21, 7); ctx.lineTo(19, 17); ctx.lineTo(5, 17);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawX(ctx, cx, cy, size) {
  const half = size * 0.17;
  ctx.strokeStyle = 'rgba(27, 27, 27, 0.55)';
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - half, cy - half); ctx.lineTo(cx + half, cy + half);
  ctx.moveTo(cx + half, cy - half); ctx.lineTo(cx - half, cy + half);
  ctx.stroke();
}

function drawBoard(ctx) {
  if (!geo) return;
  const { cs, bx, by, boardSize } = geo;
  const n = st.n;
  const hasSol = st.reg.length === n*n;

  ctx.fillStyle = INK;
  ctx.fillRect(bx - 3, by - 3, boardSize + 6, boardSize + 6);

  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const i = r * n + c;
    const regIdx = hasSol ? st.reg[i] : 0;
    ctx.fillStyle = COLORS[regIdx % COLORS.length];
    ctx.fillRect(bx + c*cs, by + r*cs, cs, cs);
  }

  if (hasSol) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(2, cs * 0.06);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const i = r * n + c;
      const x = bx + c*cs, y = by + r*cs;
      const reg = st.reg[i];
      if (r === 0 || st.reg[i - n] !== reg) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke(); }
      if (c === 0 || st.reg[i - 1] !== reg) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cs); ctx.stroke(); }
      if (r === n - 1) { ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
      if (c === n - 1) { ctx.beginPath(); ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); ctx.stroke(); }
    }
  }

  if (st.hint) {
    for (const i of (st.hint.elim || [])) {
      const x = bx + (i%n) * cs, y = by + ((i/n)|0) * cs;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, cs, cs); ctx.clip();
      ctx.strokeStyle = 'rgba(210, 59, 59, 0.55)';
      ctx.lineWidth = 3;
      for (let d = -cs; d < cs*2; d += 10) {
        ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + cs, y + cs); ctx.stroke();
      }
      ctx.restore();
    }
    for (const i of (st.hint.target || [])) {
      const x = bx + (i%n) * cs, y = by + ((i/n)|0) * cs;
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
    }
  }

  const conflicts = new Set();
  const kingIdx = [];
  st.cells.forEach((v, i) => { if (v === 2) kingIdx.push(i); });
  if (hasSol) {
    for (let a = 0; a < kingIdx.length; a++) for (let b = a+1; b < kingIdx.length; b++) {
      const ra = (kingIdx[a]/n)|0, ca = kingIdx[a]%n;
      const rb = (kingIdx[b]/n)|0, cb = kingIdx[b]%n;
      const bad = ra === rb || ca === cb || st.reg[kingIdx[a]] === st.reg[kingIdx[b]]
                || (st.adj && Math.abs(ra-rb) <= 1 && Math.abs(ca-cb) <= 1);
      if (bad) { conflicts.add(kingIdx[a]); conflicts.add(kingIdx[b]); }
    }
  }

  for (let i = 0; i < n*n; i++) {
    const cx = bx + (i%n) * cs + cs/2;
    const cy = by + ((i/n)|0) * cs + cs/2;
    const v = st.cells[i];
    if (v === 2) {
      if (conflicts.has(i)) {
        ctx.fillStyle = '#d23b3b';
        ctx.beginPath(); ctx.arc(cx, cy, cs * 0.34, 0, Math.PI*2); ctx.fill();
      }
      drawKing(ctx, cx, cy, cs * 0.6);
    } else if (v === 1) {
      drawX(ctx, cx, cy, cs);
    }
  }
}

function drawButtons(ctx) {
  for (const btn of st.buttons) {
    ctx.fillStyle = btn.primary ? '#b8860b' : '#e3e8ed';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 8);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = btn.primary ? '#ffffff' : INK;
    ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btn.label, btn.x + btn.w/2, btn.y + btn.h/2);
  }
}

function drawLoading(ctx) {
  const G = LR.G;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, G.W, G.H);
  ctx.fillStyle = INK;
  ctx.font = '700 18px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const modeLabel = st.cfg.adj ? 'Siêu Khó' : 'Rất Khó';
  ctx.fillText('Đang tạo ván ' + modeLabel + ' ' + st.cfg.n + '×' + st.cfg.n + '…', G.W/2, G.H/2 - 40);
  ctx.font = '600 12px "Be Vietnam Pro", sans-serif';
  ctx.fillStyle = 'rgba(22,32,42,0.7)';
  ctx.fillText('Đang dò ván BẮT BUỘC dùng giả định thử-sai…', G.W/2, G.H/2 - 14);

  const barW = Math.min(240, G.W - 60), barH = 10;
  const bx = (G.W - barW) / 2, by = G.H/2 + 14;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  roundRect(ctx, bx, by, barW, barH, 5); ctx.stroke();
  const pct = Math.max(0.05, st.genProgress || 0);
  ctx.fillStyle = '#b8860b';
  roundRect(ctx, bx + 1, by + 1, (barW - 2) * pct, barH - 2, 4); ctx.fill();

  ctx.fillStyle = 'rgba(184, 134, 11, 0.85)';
  ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
  ctx.fillText('⚠️ Ván giả định cần nhiều thời gian tạo (7-11 giây)', G.W/2, G.H/2 + 48);
}

function drawWonOverlay(ctx) {
  const G = LR.G;
  ctx.save();
  ctx.fillStyle = 'rgba(184, 134, 11, 0.15)';
  ctx.fillRect(0, 0, G.W, G.H);
  ctx.fillStyle = '#b8860b';
  ctx.font = '900 34px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.strokeText('🎉 GIẢI XONG!', G.W/2, G.H * 0.4);
  ctx.fillText('🎉 GIẢI XONG!', G.W/2, G.H * 0.4);
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxW, lh, color) {
  const words = text.split(' ');
  let line = '', curY = y;
  ctx.fillStyle = color || '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, curY);
      curY += lh;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, curY);
}

function draw() {
  const G = LR.G, ctx = G.ctx;
  if (!ctx || !st) return;
  const dpr = G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, G.W, G.H);
  if (st.state === 'loading') { drawLoading(ctx); return; }
  if (!geo) return;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, G.W, G.H);
  drawBoard(ctx);
  drawButtons(ctx);
  if (st.hint) {
    const msgY = geo.by + geo.boardSize + 8;
    ctx.fillStyle = 'rgba(22,32,42,0.85)';
    ctx.font = '600 11px "Be Vietnam Pro", sans-serif';
    wrapText(ctx, st.hint.msg, G.W/2, msgY, G.W - 24, 14, '#ffffff');
  }
  if (st.state === 'won') drawWonOverlay(ctx);
}

/* ================= INPUT ================= */
function onPointerDown(x, y, e) {
  if (!st) return;
  Sound.init();
  if (st.state === 'loading' || st.state === 'won') return;
  for (const btn of st.buttons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      if (btn.id === 'hint')  doHint();
      else if (btn.id === 'undo') doUndo();
      else if (btn.id === 'clear') doClear();
      else if (btn.id === 'new') doNewGame();
      return;
    }
  }
  if (!geo) return;
  if (x >= geo.bx && x <= geo.bx + geo.boardSize &&
      y >= geo.by && y <= geo.by + geo.boardSize) {
    const c = Math.floor((x - geo.bx) / geo.cs);
    const r = Math.floor((y - geo.by) / geo.cs);
    if (r >= 0 && r < st.n && c >= 0 && c < st.n) doCellClick(r * st.n + c);
  }
}

/* ================= MOD ================= */
const mod = {
  enter(opts) {
    const modeId = (opts && opts.mode && MODES[opts.mode]) ? opts.mode : DEFAULT_MODE;
    st = newState(modeId);
    computeLayout();
    Sound.init();
    startGeneration(st.cfg);
  },
  exit() {
    if (st) { st.genToken++; st = null; }
    geo = null;
  },
  resize() {
    if (!st) return;
    if (st.state !== 'loading') computeLayout();
  },
  update(dt) { update(dt); },
  draw() { draw(); },
  pointerDown(x, y, e) { onPointerDown(x, y, e); },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '♔ Mỗi mảng màu 1 vua. Mỗi hàng/cột 1 vua. Chạm ô: ✕ → ♔ → trống. ' +
      '<b>TẤT CẢ chế độ</b> đều bắt buộc phải dùng <b>suy luận giả định (thử-sai)</b>. ' +
      'Không có vùng 1×1 — mỗi vùng tối thiểu 2 ô.</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '20-xep-vua',
  title: 'Xếp Vua',
  desc: 'Mỗi mảng màu một vua. Mỗi hàng, mỗi cột đúng một vua. Mọi chế độ đều bắt buộc dùng giả định thử-sai và không có vùng 1×1!',
  rules: [
    'Mỗi mảng màu đặt <b>1 vua</b> ♔',
    'Mỗi hàng và mỗi cột có <b>đúng 1 vua</b>',
    'Hai vua không được cùng hàng, cột hoặc mảng màu',
    '<b>Siêu Khó:</b> hai vua còn không được kề nhau (kể cả chéo)',
    '<b>Mọi chế độ:</b> bắt buộc phải dùng <b>giả định thử-sai</b>',
    '<b>Mọi chế độ:</b> mỗi vùng tối thiểu <b>2 ô</b>',
    'Chạm ô để đổi trạng thái: ✕ → ♔ → trống'
  ],
  status: 'ready',
  pad: false,
  actLabel: 'ĐẶT',
  modes: [
    { id: 'hard-7',  name: 'Rất khó 7×7',  sub: '7×7 · bắt buộc giả định' },
    { id: 'hard-8',  name: 'Rất khó 8×8',  sub: '8×8 · bắt buộc giả định' },
    { id: 'hard-9',  name: 'Rất khó 9×9',  sub: '9×9 · bắt buộc giả định' },
    { id: 'ultra-7', name: 'Siêu khó 7×7', sub: '7×7 · không kề + giả định' },
    { id: 'ultra-8', name: 'Siêu khó 8×8', sub: '8×8 · không kề + giả định' },
    { id: 'ultra-9', name: 'Siêu khó 9×9', sub: '9×9 · không kề + giả định' }
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
