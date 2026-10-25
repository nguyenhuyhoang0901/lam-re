/* js/levels/ch1/15-xep-khoi.js — Ải 15: Xếp khối 8x8 (Block Puzzle) */
(function(){
'use strict';
const LR = window.LR;
const Sound = LR.Sound;

/* ================= SHAPES ================= */
const N = 8;
const WIN_SCORE = 500;
const LINE_SCORE_TABLE = [0, 20, 50, 100, 180, 300, 450, 600, 800];

const SHAPES = {
  '1x1': { color: '#3b82f6', big: false, variants: [ [[0,0]] ] },
  '1x2': { color: '#ec4899', big: false, variants: [ [[0,0],[0,1]], [[0,0],[1,0]] ] },
  '1x3': { color: '#06b6d4', big: false, variants: [ [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]] ] },
  '1x4': { color: '#8b5cf6', big: false, variants: [ [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]] ] },
  '1x5': { color: '#10b981', big: true,  variants: [ [[0,0],[0,1],[0,2],[0,3],[0,4]], [[0,0],[1,0],[2,0],[3,0],[4,0]] ] },
  '2x2': { color: '#f97316', big: false, variants: [ [[0,0],[0,1],[1,0],[1,1]] ] },
  '3x3': { color: '#ef4444', big: true,  variants: [ [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]] ] },
  'L2':  { color: '#eab308', big: false, variants: [
    [[0,0],[1,0],[1,1]], [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]], [[0,1],[1,0],[1,1]]
  ]},
  'L3':  { color: '#f43f5e', big: false, variants: [
    [[0,0],[1,0],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2],[2,2]],
    [[0,2],[1,2],[2,0],[2,1],[2,2]]
  ]}
};
const NORMAL_KEYS = ['1x1', '1x2', '1x3', '1x4', '2x2', 'L2', 'L3'];

/* ================= STATE ================= */
let State = null;
let L = null;

function createPiece(key, vIdx) {
  const S = SHAPES[key] || SHAPES['1x2'];
  const idx = (vIdx !== undefined && vIdx < S.variants.length) ? vIdx : Math.floor(Math.random() * S.variants.length);
  const cells = S.variants[idx];
  let rows = 0, cols = 0;
  for (const [r, c] of cells) {
    if (r + 1 > rows) rows = r + 1;
    if (c + 1 > cols) cols = c + 1;
  }
  return { key, color: S.color, big: S.big, cells, rows, cols };
}

function canPlace(piece, baseR, baseC, customBoard) {
  if (!piece) return false;
  if (baseR < 0 || baseC < 0 || baseR + piece.rows > N || baseC + piece.cols > N) return false;
  const b = customBoard || State.board;
  for (const [dr, dc] of piece.cells) if (b[baseR + dr][baseC + dc] !== null) return false;
  return true;
}

function canFitAnywhere(piece, customBoard) {
  if (!piece) return false;
  const b = customBoard || State.board;
  for (let r = 0; r <= N - piece.rows; r++)
    for (let c = 0; c <= N - piece.cols; c++)
      if (canPlace(piece, r, c, b)) return true;
  return false;
}

function simulateMove(board, piece, baseR, baseC) {
  const next = board.map(row => row.slice());
  for (const [dr, dc] of piece.cells) next[baseR + dr][baseC + dc] = piece.color;
  const fullR = [], fullC = [];
  for (let r = 0; r < N; r++) if (next[r].every(c => c !== null)) fullR.push(r);
  for (let c = 0; c < N; c++) {
    let ok = true;
    for (let r = 0; r < N; r++) if (next[r][c] === null) { ok = false; break; }
    if (ok) fullC.push(c);
  }
  for (const r of fullR) for (let c = 0; c < N; c++) next[r][c] = null;
  for (const c of fullC) for (let r = 0; r < N; r++) next[r][c] = null;
  return next;
}

function generateSmartTriplet(forcedBigKey) {
  const pieces = [];
  let simBoard = State.board.map(r => r.slice());
  const getFittingPiece = (board, preferKey) => {
    if (preferKey) {
      const p = createPiece(preferKey);
      for (let r = 0; r <= N - p.rows; r++)
        for (let c = 0; c <= N - p.cols; c++)
          if (canPlace(p, r, c, board)) return { piece: p, r, c };
      return { piece: p, r: -1, c: -1 };
    }
    const pool = [];
    for (const k of NORMAL_KEYS) {
      const w = (k === '1x1') ? 1 : (k === '1x4' || k === 'L3') ? 2 : 3;
      for (let i = 0; i < w; i++) pool.push(k);
    }
    pool.sort(() => Math.random() - 0.5);
    for (const k of pool) {
      const S = SHAPES[k];
      const vIdx = S.variants.map((_, i) => i).sort(() => Math.random() - 0.5);
      for (const vi of vIdx) {
        const p = createPiece(k, vi);
        const spots = [];
        for (let r = 0; r <= N - p.rows; r++)
          for (let c = 0; c <= N - p.cols; c++)
            if (canPlace(p, r, c, board)) spots.push([r, c]);
        if (spots.length > 0) {
          const [r, c] = spots[Math.floor(Math.random() * spots.length)];
          return { piece: p, r, c };
        }
      }
    }
    return { piece: createPiece('1x1', 0), r: -1, c: -1 };
  };
  for (let i = 0; i < 3; i++) {
    const res = getFittingPiece(simBoard, (i === 0 && forcedBigKey) ? forcedBigKey : null);
    pieces.push(res.piece);
    if (res.r !== -1) simBoard = simulateMove(simBoard, res.piece, res.r, res.c);
  }
  if (pieces[0].key === pieces[1].key && pieces[1].key === pieces[2].key) {
    pieces[2] = createPiece(pieces[0].key === '2x2' ? '1x3' : '2x2');
  }
  return pieces.sort(() => Math.random() - 0.5);
}

function decideNextBig(justHadBig) {
  const chance = justHadBig ? 0.18 : 0.38;
  if (Math.random() < chance) return Math.random() < 0.5 ? '3x3' : '1x5';
  return null;
}

/* ================= RESET & HUD ================= */
function reset() {
  State = {
    board: Array.from({ length: N }, () => Array(N).fill(null)),
    tray: [null, null, null],
    nextBig: null,
    score: 0, combo: 0, rounds: 0,
    drag: null, dragHover: null, over: false,
    floats: [], particles: [], flashes: []
  };
  L = computeLayout();
  dealNextRound();
}

function dealNextRound() {
  State.rounds++;
  const currentBig = State.nextBig;
  State.nextBig = decideNextBig(!!currentBig);
  State.tray = generateSmartTriplet(currentBig);
  playDeal();
  if (State.nextBig) playWarn();
  updateHUD();
  checkGameOver();
}

function getStoredBest() {
  if (!LR.G.cur) return 0;
  const ls = LR.Store.levelState(LR.G.cur.chId, LR.G.cur.lvId);
  return (ls.best && ls.best[LR.G.cur.modeId || 'default']) || 0;
}

function updateHUD() {
  if (!LR.G.cur || !State) return;
  const best = Math.max(getStoredBest(), State.score);
  LR.G.hud.set([
    { l: 'Điểm', v: State.score },
    { l: 'Combo', v: State.combo > 0 ? 'x' + State.combo : '—' },
    { l: 'Kỷ lục', v: best }
  ]);
}

/* ================= LAYOUT (responsive xoay ngang/dọc) ================= */
function computeLayout() {
  const G = LR.G, W = G.W, H = G.H, top = G.top || 0;
  const availH = H - top - 10;
  const availW = W - 20;
  const isLandscape = W > H * 1.1;

  if (isLandscape) {
    // Board trái, khay 3 slot xếp dọc bên phải
    const boardSize = Math.min(availH, W * 0.55);
    const boardX = 10, boardY = top + 5;
    const trayX = boardX + boardSize + 15;
    const trayW = W - trayX - 10;
    const trayH = boardSize;
    const slotH = (trayH - 20) / 3;
    const slots = [0,1,2].map(i => ({
      x: trayX, y: boardY + i * (slotH + 10), w: trayW, h: slotH
    }));
    return { boardX, boardY, boardSize, slots,
             trayX, trayY: boardY, trayW, trayH, isLandscape: true };
  } else {
    // Board trên, khay 3 slot ngang dưới
    const boardSize = Math.min(availW, availH * 0.62);
    const boardX = (W - boardSize) / 2, boardY = top + 10;
    const trayH = Math.min(130, (availH - boardSize - 30) * 0.6);
    const trayY = boardY + boardSize + 10;
    const trayW = boardSize, trayX = boardX;
    const slotW = (trayW - 15) / 3;
    const slots = [0,1,2].map(i => ({
      x: trayX + i * (slotW + 5), y: trayY, w: slotW, h: trayH
    }));
    return { boardX, boardY, boardSize, slots,
             trayX, trayY, trayW, trayH, isLandscape: false };
  }
}

/* ================= SOUND HELPERS ================= */
function playPickup() { Sound.tone('sine', 520, 780, 0.07, 0.14); }
function playPlace(n) { Sound.tone('triangle', Math.max(80, 240 - n * 8), 110, 0.09, 0.25); }
function playInvalid() { Sound.tone('sawtooth', 190, 130, 0.12, 0.1); }
function playDeal() { [420, 520, 640].forEach((f, i) => Sound.tone('sine', f, f * 1.2, 0.08, 0.1, i * 0.06)); }
function playWarn() { Sound.tone('triangle', 880, 660, 0.12, 0.16); }
function playClear(lines, combo) {
  const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];
  const count = Math.min(8, 2 + lines + combo);
  for (let i = 0; i < count; i++) Sound.tone('sine', notes[i], notes[i] * 1.02, 0.32, 0.18, i * 0.055);
}
function playOver() {
  [392, 349.23, 329.63, 261.63].forEach((f, i) => Sound.tone('triangle', f, f * 0.95, 0.28, 0.2, i * 0.2));
}

/* ================= PLACEMENT ================= */
function placePieceOnBoard(slotIdx, baseR, baseC) {
  const piece = State.tray[slotIdx];
  if (!piece || !canPlace(piece, baseR, baseC)) return false;
  for (const [dr, dc] of piece.cells) State.board[baseR + dr][baseC + dc] = piece.color;

  const cellPx = L.boardSize / N;
  const boardLeft = L.boardX, boardTop = L.boardY;
  const placePts = piece.cells.length;
  let totalAdded = placePts;

  const fullRows = [], fullCols = [];
  for (let r = 0; r < N; r++) if (State.board[r].every(c => c !== null)) fullRows.push(r);
  for (let c = 0; c < N; c++) {
    let full = true;
    for (let r = 0; r < N; r++) if (State.board[r][c] === null) { full = false; break; }
    if (full) fullCols.push(c);
  }

  const totalLines = fullRows.length + fullCols.length;
  playPlace(placePts);

  if (totalLines > 0) {
    State.combo++;
    const base = LINE_SCORE_TABLE[Math.min(totalLines, LINE_SCORE_TABLE.length - 1)];
    const comboMult = 1 + (State.combo - 1) * 0.5;
    const clearBonus = Math.round(base * comboMult);
    totalAdded += clearBonus;
    const perLineScore = Math.round(clearBonus / totalLines);

    const cleared = new Set();
    for (const r of fullRows) for (let c = 0; c < N; c++) cleared.add(`${r},${c}`);
    for (const c of fullCols) for (let r = 0; r < N; r++) cleared.add(`${r},${c}`);
    cleared.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      const col = State.board[r][c] || piece.color;
      spawnParticles(boardLeft + (c + 0.5) * cellPx, boardTop + (r + 0.5) * cellPx, col, 6);
      State.board[r][c] = null;
    });

    fullRows.forEach((r, idx) => {
      addFloat(boardLeft + L.boardSize / 2, boardTop + (r + 0.5) * cellPx, `+${perLineScore}`, '#ffe27a', 20, idx * 0.08);
      State.flashes.push({ row: r, col: -1, alpha: 0.75 });
    });
    fullCols.forEach((c, idx) => {
      addFloat(boardLeft + (c + 0.5) * cellPx, boardTop + L.boardSize / 2, `+${perLineScore}`, '#6ee7b7', 20, (fullRows.length + idx) * 0.08);
      State.flashes.push({ row: -1, col: c, alpha: 0.75 });
    });
    if (totalLines >= 2) addFloat(boardLeft + L.boardSize / 2, boardTop + L.boardSize * 0.35, `🔥 ${totalLines} ĐƯỜNG!`, '#ffffff', 22, 0.12);
    if (State.combo >= 2) addFloat(boardLeft + L.boardSize / 2, boardTop + 30, `⚡ COMBO x${State.combo}`, '#fb923c', 22, 0.18);

    if (State.board.every(row => row.every(cell => cell === null))) {
      totalAdded += 300;
      addFloat(boardLeft + L.boardSize / 2, boardTop + L.boardSize / 2, '🌟 SẠCH BẢNG! +300', '#f472b6', 24, 0.25);
    }
    playClear(totalLines, State.combo);
  } else {
    State.combo = 0;
    const px = boardLeft + (baseC + piece.cols / 2) * cellPx;
    const py = boardTop + (baseR + piece.rows / 2) * cellPx;
    addFloat(px, py, `+${placePts}`, '#cbd5e1', 16, 0);
  }

  State.score += totalAdded;
  updateHUD();
  State.tray[slotIdx] = null;

  if (State.tray.every(p => p === null)) dealNextRound();
  else checkGameOver();
  return true;
}

function checkGameOver() {
  if (State.over) return;
  const remaining = State.tray.filter(p => p !== null);
  if (remaining.length === 0) return;
  const anyFit = remaining.some(p => canFitAnywhere(p));
  if (!anyFit) {
    State.over = true;
    playOver();
    setTimeout(finishGame, 300);
  }
}

function finishGame() {
  if (LR.G.state !== 'play' || !State.over) return;
  const won = State.score >= WIN_SCORE;
  const stars = !won ? 0 : State.score >= 2000 ? 3 : State.score >= 1000 ? 2 : 1;
  LR.G.finish({
    win: won,
    score: State.score,
    stars,
    title: won ? 'XẾP KHỐI GIỎI!' : 'HẾT CHỖ ĐẶT',
    msg: won ? 'Bạn đã đạt đủ điểm để qua ải.' : 'Bàn cờ đã kín. Thử lại nhé!',
    delay: 200,
    rows: [
      ['Điểm', State.score],
      ['Số vòng', State.rounds],
      ['Mục tiêu', WIN_SCORE]
    ]
  });
}

/* ================= EFFECTS ================= */
function addFloat(x, y, text, color, size, delay) {
  State.floats.push({ x, y, text, color, size, age: -(delay || 0), life: 1.15 });
}
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 160;
    State.particles.push({
      x, y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 50,
      color, size: 4 + Math.random() * 4,
      age: 0, life: 0.45 + Math.random() * 0.3
    });
  }
}

/* ================= UPDATE ================= */
function update(dt) {
  if (LR.G.state !== 'play') return;
  State.dragHover = State.drag ? getHoveredBoardCell() : null;

  for (let i = State.particles.length - 1; i >= 0; i--) {
    const p = State.particles[i];
    p.age += dt;
    if (p.age >= p.life) { State.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 480 * dt;
  }
  for (let i = State.floats.length - 1; i >= 0; i--) {
    const f = State.floats[i];
    f.age += dt;
    if (f.age >= f.life) State.floats.splice(i, 1);
  }
  for (let i = State.flashes.length - 1; i >= 0; i--) {
    State.flashes[i].alpha -= dt * 1.8;
    if (State.flashes[i].alpha <= 0) State.flashes.splice(i, 1);
  }
}

/* ================= INPUT ================= */
function getHoveredBoardCell() {
  if (!State.drag) return null;
  const p = State.drag.piece;
  const cellPx = L.boardSize / N;
  const cx = State.drag.x;
  const cy = State.drag.y - State.drag.offsetY;
  const topLeftX = cx - (p.cols * cellPx) / 2;
  const topLeftY = cy - (p.rows * cellPx) / 2;
  const col = Math.round((topLeftX - L.boardX) / cellPx);
  const row = Math.round((topLeftY - L.boardY) / cellPx);
  if (canPlace(p, row, col)) return { row, col };
  return null;
}
function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

function onPointerDown(x, y, e) {
  if (LR.G.state !== 'play' || State.over) return;
  Sound.init();
  for (let i = 0; i < 3; i++) {
    if (pointInRect(x, y, L.slots[i]) && State.tray[i]) {
      playPickup();
      State.drag = {
        slotIndex: i, piece: State.tray[i], x, y,
        offsetY: e && e.pointerType === 'mouse' ? 20 : 55
      };
      return;
    }
  }
}
function onPointerMove(x, y) {
  if (!State.drag) return;
  State.drag.x = x;
  State.drag.y = y;
}
function onPointerUp() {
  if (!State.drag) return;
  const target = getHoveredBoardCell();
  if (target) placePieceOnBoard(State.drag.slotIndex, target.row, target.col);
  else playInvalid();
  State.drag = null;
  State.dragHover = null;
}

/* ================= DRAW ================= */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBlock(ctx, x, y, size, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  const pad = Math.max(1, size * 0.04);
  const bx = x + pad, by = y + pad, bs = size - pad * 2;
  const bev = Math.max(2, bs * 0.15);
  ctx.fillStyle = color;
  roundRect(ctx, bx, by, bs, bs, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(bx + 2, by + 2, bs - 4, bev);
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ctx.fillRect(bx + 2, by + bs - bev - 2, bs - 4, bev);
  ctx.restore();
}

function drawBackground(ctx) {
  const G = LR.G;
  const g = ctx.createRadialGradient(G.W / 2, G.H * 0.3, 0, G.W / 2, G.H * 0.3, G.W * 0.8);
  g.addColorStop(0, '#2b3266'); g.addColorStop(1, '#151936');
  ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
}

function drawBoard(ctx) {
  const { boardX, boardY, boardSize } = L;
  const cellPx = boardSize / N;

  ctx.fillStyle = '#262c59';
  ctx.strokeStyle = '#4f5cb0';
  ctx.lineWidth = 4;
  roundRect(ctx, boardX - 4, boardY - 4, boardSize + 8, boardSize + 8, 14);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#141834';
  roundRect(ctx, boardX, boardY, boardSize, boardSize, 10);
  ctx.fill();

  let previewRows = null, previewCols = null;
  if (State.drag && State.dragHover) {
    const ghostSet = new Set();
    const { row, col } = State.dragHover;
    for (const [dr, dc] of State.drag.piece.cells) ghostSet.add(`${row + dr},${col + dc}`);
    previewRows = new Set(); previewCols = new Set();
    for (let r = 0; r < N; r++) {
      let full = true;
      for (let c = 0; c < N; c++) if (!State.board[r][c] && !ghostSet.has(`${r},${c}`)) { full = false; break; }
      if (full) previewRows.add(r);
    }
    for (let c = 0; c < N; c++) {
      let full = true;
      for (let r = 0; r < N; r++) if (!State.board[r][c] && !ghostSet.has(`${r},${c}`)) { full = false; break; }
      if (full) previewCols.add(c);
    }
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const x = boardX + c * cellPx, y = boardY + r * cellPx;
      const alt = ((r >> 1) + (c >> 1)) % 2 === 0;
      ctx.fillStyle = alt ? '#1b2044' : '#202650';
      ctx.fillRect(x + 1.5, y + 1.5, cellPx - 3, cellPx - 3);
      if (State.board[r][c]) drawBlock(ctx, x, y, cellPx, State.board[r][c], 1);
      if (previewRows && (previewRows.has(r) || previewCols.has(c))) {
        ctx.fillStyle = 'rgba(255, 226, 122, 0.35)';
        ctx.fillRect(x + 1, y + 1, cellPx - 2, cellPx - 2);
      }
    }
  }

  if (State.drag && State.dragHover) {
    const { row, col } = State.dragHover;
    for (const [dr, dc] of State.drag.piece.cells) {
      drawBlock(ctx, boardX + (col + dc) * cellPx, boardY + (row + dr) * cellPx, cellPx, State.drag.piece.color, 0.55);
    }
  }

  State.flashes.forEach(fl => {
    ctx.fillStyle = `rgba(255, 235, 140, ${fl.alpha})`;
    if (fl.row >= 0) ctx.fillRect(boardX, boardY + fl.row * cellPx, boardSize, cellPx);
    else ctx.fillRect(boardX + fl.col * cellPx, boardY, cellPx, boardSize);
  });
}

function drawTray(ctx) {
  ctx.fillStyle = '#262c59';
  ctx.strokeStyle = '#4f5cb0';
  ctx.lineWidth = 3;
  roundRect(ctx, L.trayX - 4, L.trayY - 4, L.trayW + 8, L.trayH + 8, 14);
  ctx.fill(); ctx.stroke();

  L.slots.forEach((slot, i) => {
    ctx.fillStyle = '#161a38';
    ctx.strokeStyle = '#2e366e';
    ctx.lineWidth = 1.5;
    roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 10);
    ctx.fill(); ctx.stroke();

    const p = State.tray[i];
    if (!p || (State.drag && State.drag.slotIndex === i)) return;
    const fits = canFitAnywhere(p);
    const alpha = fits ? 1 : 0.35;
    const cellSz = Math.min(25, (slot.w - 16) / p.cols, (slot.h - 16) / p.rows);
    const startX = slot.x + (slot.w - p.cols * cellSz) / 2;
    const startY = slot.y + (slot.h - p.rows * cellSz) / 2;
    for (const [r, c] of p.cells) drawBlock(ctx, startX + c * cellSz, startY + r * cellSz, cellSz, p.color, alpha);
  });

  if (State.nextBig) {
    const wx = L.trayX + L.trayW - 12;
    const wy = L.trayY - 12;
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
    ctx.save();
    ctx.translate(wx, wy); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 16px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }
}

function drawDraggedPiece(ctx) {
  if (!State.drag) return;
  const p = State.drag.piece;
  const cellPx = L.boardSize / N;
  const cx = State.drag.x;
  const cy = State.drag.y - State.drag.offsetY;
  const startX = cx - (p.cols * cellPx) / 2;
  const startY = cy - (p.rows * cellPx) / 2;
  for (const [r, c] of p.cells) drawBlock(ctx, startX + c * cellPx, startY + r * cellPx, cellPx, p.color, 0.9);
}

function drawParticles(ctx) {
  State.particles.forEach(pt => {
    ctx.globalAlpha = 1 - pt.age / pt.life;
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  });
  ctx.globalAlpha = 1;
}

function drawFloats(ctx) {
  State.floats.forEach(fl => {
    if (fl.age < 0) return;
    const prog = fl.age / fl.life;
    if (prog >= 1) return;
    const y = fl.y - prog * 48;
    const a = prog < 0.7 ? 1 : (1 - prog) / 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `800 ${fl.size}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = '#11152e';
    ctx.strokeText(fl.text, fl.x, y);
    ctx.fillStyle = fl.color; ctx.fillText(fl.text, fl.x, y);
    ctx.restore();
  });
}

function draw() {
  if (!State || !L) return;
  const ctx = LR.G.ctx, dpr = LR.G.dpr || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, LR.G.W, LR.G.H);

  drawBackground(ctx);
  drawBoard(ctx);
  drawTray(ctx);
  drawDraggedPiece(ctx);
  drawParticles(ctx);
  drawFloats(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ================= MOD ================= */
const mod = {
  enter() {
    reset();
    L = computeLayout();
  },
  exit() {
    if (State) { State.drag = null; State.dragHover = null; }
  },
  resize() {
    if (!State) return;
    L = computeLayout();
  },
  update(dt) { update(dt); },
  draw() { draw(); },
  pointerDown(x, y, e) { onPointerDown(x, y, e); },
  pointerMove(x, y, e) { onPointerMove(x, y, e); },
  pointerUp(x, y, e) { onPointerUp(); },
  legend(el) {
    el.innerHTML = '<p class="note" style="margin:8px 0 0">' +
      '💡 Kéo khối từ khay đặt vào bàn cờ 8×8. Ăn hàng/cột để ghi điểm. ' +
      'Khi có biểu tượng <b>!</b> đỏ, vòng sau sẽ có khối lớn. Đạt <b>' + WIN_SCORE +
      ' điểm</b> để qua ải.</p>';
  }
};

/* ================= REGISTER ================= */
const LEVEL = {
  id: '15-xep-khoi',
  title: 'Xếp khối 8×8',
  desc: 'Kéo 3 khối trong khay đặt vào bàn cờ 8×8. Ăn hàng/cột để ghi điểm và combo!',
  rules: [
    'Kéo khối từ khay dưới (hoặc bên phải) đặt vào bàn cờ 8×8',
    'Đặt hết 3 khối sẽ tự sinh 3 khối mới',
    'Ăn hàng/cột: +20/+50/+100… điểm, ăn nhiều đường một lúc càng được nhiều',
    'Combo (ăn liên tiếp): nhân điểm x1.5, x2.0, x2.5…',
    'Xoá sạch bàn cờ: thưởng +300 điểm',
    'Hết chỗ đặt = kết thúc lượt chơi. Đạt ' + WIN_SCORE + ' điểm để qua ải'
  ],
  status: 'ready',
  pad: false,
  actLabel: 'ĐẶT',
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
