/* Chương 1 · Ải 6: Nộm — "Trộn Nộm Đúng Nhịp" (nguồn: nom-dung-nhip.html).
   Đầu bài cho một số giây ngẫu nhiên. Bấm "Bắt đầu đếm" rồi bấm "DỪNG" đúng số giây đó. Đồng hồ chỉ hiện lúc đầu
   rồi giấu đi, phải tự đếm tiếp (tiếng dao thớt đếm nhịp từng giây khi đồng hồ còn hiện).
     Vòng 1: lệch tối đa 2 giây  -> đạt thì sang vòng 2, chưa đạt thì làm lại vòng 1
     Vòng 2: lệch tối đa 1,5 giây -> đạt thì sang vòng 3, trượt thì quay về vòng 1
     Vòng 3: lệch tối đa 1 giây  -> đạt là qua ải, trượt thì quay về vòng 1
   Điểm ải = 100 trừ 10 cho mỗi lần thử vượt quá 3 lần tối thiểu (ít lần thử hơn = điểm cao hơn). */
(function(){
'use strict';
const LR = window.LR;
const Eng = LR.G, Sound = LR.Sound;       // Eng: lõi game; N (bên dưới): trạng thái của ải này

const INK = '#2a1a12', CREAM = '#f2ecde';
const TOL = [1, 0.7, 0.5];            // độ lệch cho phép mỗi vòng (giây)
const FRAC = [.5, .35, .2];         // phần của số giây đầu bài mà đồng hồ còn hiện
const RANGE = [5, 12];              // số giây đầu bài ngẫu nhiên (nguyên)
const OVER = 6;                     // tự dừng sau số giây này kể từ đích

/* ---------- trạng thái ---------- */
const N = { round: 0, prev: 0, target: 8, attempts: 0, state: 'brief', t0: 0, e: 0, stopped: 0, dev: 0, ok: false, win: false,
            resultAt: 0, resultT: 0, lastSec: -1, hidden: false, T: 0 };
const confetti = [];

/* ---------- âm thanh bếp núc (dùng bộ Sound chung) ---------- */
const SND = {
    burst(o) { Sound.burst(o); },
    tone(o) { Sound.note(o); },
    // knife on the wooden board: a dry knock plus a bright tap
    chop(v = 1) {
        this.burst({ type: 'bandpass', f0: 1000, f1: 520, q: 1.4, dur: .07, g: .5 * v, atk: .002 });
        this.tone({ f: 230, f1: 80, dur: .09, g: .45 * v });
    },
    // tossing the salad: a quick rustle of leaves and strands
    rustle(len = .5) {
        const n = Math.round(len / .045);
        for (let i = 0; i < n; i++)
            this.burst({ type: 'bandpass', f0: 2200 + Math.random() * 2600, q: 2, dur: .04, g: .04 + Math.random() * .06, delay: i * .045 + Math.random() * .02 });
    },
    // china bowl "tinh": a few inharmonic partials with a quick decay
    clink(f, delay = 0, v = 1) {
        this.tone({ f, dur: .75, g: .17 * v, delay });
        this.tone({ f: f * 2.76, dur: .38, g: .07 * v, delay });
        this.tone({ f: f * 5.4, dur: .15, g: .03 * v, delay });
    },
    start() { this.rustle(.3); this.chop(.5); },
    hide() { this.tone({ f: 320, f1: 140, dur: .12, g: .22 }); this.burst({ type: 'lowpass', f0: 600, dur: .1, g: .15 }); },
    stop() { this.chop(1.2); this.burst({ type: 'highpass', f0: 3500, dur: .05, g: .15 }); },
    pass() { this.rustle(.35); this.clink(1568, .08); this.clink(2093, .24); },
    fail() { this.tone({ f: 180, f1: 60, dur: .3, g: .42 }); this.burst({ type: 'lowpass', f0: 420, dur: .25, g: .25 }); this.rustle(.15); },
    win() { this.rustle(.8); [1319, 1568, 1760, 2093, 2637].forEach((f, i) => this.clink(f, .12 + i * .14, 1.1)); }
};

/* ---------- hàm vẽ nhỏ ---------- */
function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function box(g, x, y, w, h, r, fill, lw = 3) {
    rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
    if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
}
function txt(g, s, x, y, size, color, weight = 700, fam = '"Be Vietnam Pro",sans-serif', al = 'center') {
    g.font = `${weight} ${size}px ${fam}`; g.textAlign = al; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}
function ellp(g, x, y, rx, ry, fill, lw = 2, rot = 0) {
    g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 6.283);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); }
}
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// the heap of salad in the bowl (fixed, generated once)
const mound = (() => {
    const r = rng(7), a = [];
    for (let i = 0; i < 130; i++) {
        const x = 335 + (r() * 2 - 1) * 54, h = 26 * Math.sqrt(Math.max(0, 1 - ((x - 335) / 58) ** 2)), y = 290 - r() * h, k = r();
        a.push({ x, y, a: r() * 6.283, len: 10 + r() * 9, k: k < .45 ? 0 : k < .75 ? 1 : k < .87 ? 2 : k < .94 ? 3 : 4 });
    }
    return a.sort((p, q) => p.y - q.y);
})();

/* ---------- bố cục: hai vùng (đầu bài/đồng hồ và gian bếp), xếp dọc trên điện thoại, cạnh nhau trên màn rộng ---------- */
const S = { W: 460, H: 980, u: 1 };
function regions() {
    const W = S.W, H = S.H;
    if (H > W) {
        const th = Math.max(300, Math.min(430, H * .46)), sy = 56 + th + 6;
        return { t: { x: 20, y: 56, w: W - 40, h: th }, s: { x: 0, y: sy, w: W, h: Math.max(160, H - sy - 112) }, clipS: [0, sy - 10, W, H] };
    }
    return { t: { x: W * .5 + 10, y: 60, w: W * .5 - 40, h: H - 170 }, s: { x: 10, y: 50, w: W * .5 - 30, h: H - 160 }, clipS: [0, 0, W * .5, H] };
}

/* ---------- the kitchen scene (local space 420 x 380) ---------- */
function drawScene(g) {
    const R = regions(), s = R.s, u = Math.min(1.7, s.w / 420, s.h / 380);
    const ox = s.x + s.w / 2 - 210 * u, oy = s.y + (s.h - 380 * u) / 2;
    const run = N.state === 'run', vis = run && N.e <= N.target * FRAC[N.round];
    // the table, spanning the whole width of this region
    g.save();
    g.beginPath(); g.rect(...R.clipS.slice(0, 2), R.clipS[2] - R.clipS[0], R.clipS[3] - R.clipS[1]); g.clip();
    g.translate(ox, oy); g.scale(u, u);
    const L = -(ox / u) - 20, Rr = (S.W - ox) / u + 20 + 1200;
    g.fillStyle = '#a8754a'; g.fillRect(L, 215, Rr - L, 2000);
    g.fillStyle = '#c99660'; g.fillRect(L, 215, Rr - L, 12);
    g.strokeStyle = INK; g.lineWidth = 2.4; g.beginPath(); g.moveTo(L, 227); g.lineTo(Rr, 227); g.moveTo(L, 215); g.lineTo(Rr, 215); g.stroke();
    g.strokeStyle = 'rgba(42,26,18,.25)'; g.lineWidth = 1.4;
    for (const y of [268, 322, 372]) { g.beginPath(); g.moveTo(L, y); g.lineTo(Rr, y); g.stroke(); }
    // wall: a conical hat and a string of chillies
    g.fillStyle = '#e8d29a'; g.strokeStyle = INK; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(66, 36); g.lineTo(18, 100); g.quadraticCurveTo(66, 120, 114, 100); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 1.2;
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(66, 36); g.lineTo(18 + k * 19.2, 106 + Math.sin(k / 5 * Math.PI) * 3); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 1.8; g.beginPath(); g.moveTo(250, 30); g.quadraticCurveTo(330, 56, 410, 28); g.stroke();
    for (let i = 0; i < 7; i++) {
        const k = (i + .5) / 7, x = 250 + 160 * k, y = 30 + Math.sin(k * Math.PI) * 18 + 8 + (k > .5 ? 0 : 0);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke();
        ellp(g, x, y + 20, 4.4, 11, '#c2412d', 1.6, Math.sin(N.T * 1.3 + i) * .12);
    }
    // the chopping board with a green papaya being sliced
    box(g, 36, 252, 226, 84, 10, '#e0bd78', 2.6);
    g.strokeStyle = 'rgba(122,74,43,.45)'; g.lineWidth = 1.2;
    for (const y of [266, 282, 298, 314]) { g.beginPath(); g.moveTo(46, y); g.quadraticCurveTo(150, y + 3, 252, y - 1); g.stroke(); }
    ellp(g, 52, 294, 5, 5, '#a8754a', 1.6);
    box(g, 62, 268, 72, 34, 15, '#8fb552', 2.4);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(74, 275); g.lineTo(120, 275); g.stroke();
    ellp(g, 134, 285, 6, 17, '#efe3b0', 2);
    for (const x of [190, 206, 222]) { ellp(g, x, 286, 7, 17, '#8fb552', 2); ellp(g, x + 1, 286, 4.2, 12, '#efe3b0', 0); }
    // the knife: it chops once per second while the clock is visible (up during the last 30% of each second, drops on the tick)
    let lift = 0;
    if (vis) { const p = N.e % 1; lift = p > .7 ? Math.sin((p - .7) / .3 * Math.PI / 2) : 0; }
    g.save(); g.translate(158, 304 - lift * 34);
    box(g, -30, -44, 60, 44, 3, '#d7dde0', 2.4);
    g.fillStyle = '#aab4b9'; g.fillRect(-27, -8, 54, 4);
    box(g, 30, -40, 48, 12, 5, '#7a4a2b', 2.2);
    g.restore();
    // the bowl of salad
    g.fillStyle = '#f6f1e4'; g.strokeStyle = INK; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(269, 288); g.bezierCurveTo(272, 335, 300, 342, 335, 342); g.bezierCurveTo(370, 342, 398, 335, 401, 288); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#c2412d'; g.lineWidth = 4; g.beginPath(); g.moveTo(272, 314); g.quadraticCurveTo(335, 334, 398, 314); g.stroke();
    ellp(g, 335, 288, 66, 14, '#f6f1e4', 2.6);
    ellp(g, 335, 288, 60, 10, '#e6dcc4', 0);
    g.lineCap = 'round';
    for (const m of mound) {
        if (m.k === 0 || m.k === 1) {
            g.strokeStyle = m.k ? '#ee8a2a' : '#efe3b0'; g.lineWidth = 2.6;
            g.beginPath(); g.moveTo(m.x, m.y);
            g.quadraticCurveTo(m.x + Math.cos(m.a) * m.len * .5, m.y + Math.sin(m.a) * m.len * .9 - 4, m.x + Math.cos(m.a) * m.len, m.y + Math.sin(m.a) * m.len * .4); g.stroke();
        } else if (m.k === 2) ellp(g, m.x, m.y, 6, 2.8, '#5a9a3c', 0, m.a);
        else if (m.k === 3) ellp(g, m.x, m.y, 2.8, 2.8, '#b5753a', 1);
        else { g.strokeStyle = '#c2412d'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, 3, 0, 6.283); g.stroke(); }
    }
    g.strokeStyle = INK; g.lineWidth = 2.6; g.beginPath(); g.ellipse(335, 288, 66, 14, 0, 0, Math.PI); g.stroke();
    // little dishes on the table: fish sauce, peanuts, limes, chillies
    const dish = (x, y, inner) => {
        g.fillStyle = '#f6f1e4'; g.strokeStyle = INK; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 24, y); g.quadraticCurveTo(x - 22, y + 20, x, y + 20); g.quadraticCurveTo(x + 22, y + 20, x + 24, y); g.closePath(); g.fill(); g.stroke();
        ellp(g, x, y, 24, 6, inner, 2);
    };
    dish(66, 352, '#7a3d1c');
    dish(130, 354, '#e0bd78');
    for (let i = 0; i < 9; i++) ellp(g, 118 + (i % 5) * 6, 352 + Math.floor(i / 5) * 3, 2.4, 2.4, '#b5753a', 1);
    for (const [x, y] of [[196, 358], [226, 362]]) {
        ellp(g, x, y, 13, 11, '#b9d94a', 2);
        g.strokeStyle = '#f2ecde'; g.lineWidth = 1.4;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(k * 1.57 + .4) * 10, y + Math.sin(k * 1.57 + .4) * 8); g.stroke(); }
    }
    for (const [x, y, r] of [[286, 362, .3], [304, 368, -.4], [322, 360, .8]]) ellp(g, x, y, 4.4, 11, '#c2412d', 1.8, r);
    // sparkles over the bowl after a pass
    if (N.state === 'result' && N.ok && N.resultT < 1.6) {
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * 6.283 + N.resultT * 2, d = 20 + N.resultT * 60 + (i % 2) * 14, x = 335 + Math.cos(a) * d, y = 270 + Math.sin(a) * d * .6, sz = 6 * (1 - N.resultT / 1.6);
            g.fillStyle = '#ffd75a'; g.strokeStyle = INK; g.lineWidth = 1.2;
            g.beginPath(); for (let k = 0; k < 8; k++) { const rr_ = k % 2 ? sz * .4 : sz; g.lineTo(x + Math.cos(k * .785) * rr_, y + Math.sin(k * .785) * rr_); } g.closePath(); g.fill(); g.stroke();
        }
    }
    g.restore();
}

/* ---------- the task card and the clock (local space 420 x 410) ---------- */
const fmt2 = e => Math.min(99.99, Math.max(0, e)).toFixed(2).padStart(5, '0');
function drawTask(g) {
    const R = regions().t, tu = Math.min(R.w / 420, R.h / 410);
    g.save(); g.translate(R.x + (R.w - 420 * tu) / 2, R.y); g.scale(tu, tu);
    const st = N.state, shown = st === 'result' ? N.prev : N.round, tol = TOL[shown];
    const show = st !== 'ready' && st !== 'win';
    // round + pips
    txt(g, 'Vòng ' + (shown + 1) + ' / 3', 0, 16, 26, INK, 900, '"Playfair Display",serif', 'left');
    txt(g, 'Lần thử: ' + (N.attempts + (st === 'result' ? 0 : 1)), 0, 42, 12, '#6b4a3a', 500, '"Be Vietnam Pro",sans-serif', 'left');
    for (let i = 0; i < 3; i++) {
        const x = 330 + i * 32;
        ellp(g, x, 18, 12, 12, i < N.round || (st === 'win' || (st === 'result' && N.win)) ? '#a6ee7a' : '#f2ecde', 2.6);
        g.strokeStyle = INK; g.lineWidth = 1.2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x + Math.cos(k * 2.09 + 1) * 10, 18 + Math.sin(k * 2.09 + 1) * 10); g.stroke(); }
        if (i === N.round && st !== 'result') { g.strokeStyle = '#c2412d'; g.lineWidth = 3; g.beginPath(); g.arc(x, 18, 16, 0, 6.283); g.stroke(); }
    }
    // the task card
    box(g, 0, 56, 420, 136, 8, CREAM, 3);
    txt(g, 'Trộn nộm đúng', 210, 82, 16, '#6b4a3a', 500);
    txt(g, show ? N.target + ' giây' : '? ' + 'giây', 210, 128, 58, INK, 900, '"Playfair Display",serif');
    txt(g, 'Cho phép lệch ± ' + tol.toFixed(1) + ' giây', 210, 170, 16, '#c2412d', 700);
    // the clock sign
    box(g, 30, 206, 360, 112, 10, '#b98a5a', 3);
    ellp(g, 44, 220, 3.6, 3.6, '#5b3a22', 1.4); ellp(g, 376, 220, 3.6, 3.6, '#5b3a22', 1.4);
    ellp(g, 44, 304, 3.6, 3.6, '#5b3a22', 1.4); ellp(g, 376, 304, 3.6, 3.6, '#5b3a22', 1.4);
    box(g, 50, 220, 320, 84, 6, '#241b17', 2.4);
    const vis = st === 'run' && N.e <= N.target * FRAC[N.round];
    let digits = '--.--', col = '#6f5f55', cap = '';
    if (st === 'brief') { digits = '00.00'; col = '#a99a8c'; cap = 'sẵn sàng'; }
    else if (st === 'run') { digits = vis ? fmt2(N.e) : '??.??'; col = vis ? '#ffd75a' : '#7a6a60'; cap = vis ? 'đang đếm…' : 'đã giấu — tự đếm nhé!'; }
    else if (st === 'result') { digits = fmt2(N.stopped); col = N.ok ? '#a6ee7a' : '#ff7a5a'; cap = 'đã dừng'; }
    txt(g, digits, 210, 255, 60, col, 700, 'ui-monospace,Menlo,Consolas,"Courier New",monospace');
    txt(g, cap, 210, 291, 12, '#a99a8c', 500);
    // status area
    if (st === 'brief') {
        txt(g, 'Bấm “Bắt đầu đếm”, rồi DỪNG đúng ', 210, 352, 15, INK, 500);
        txt(g, N.target + ' giây — đồng hồ sẽ giấu đi giữa chừng.', 210, 374, 15, INK, 500);
    } else if (st === 'run') {
        txt(g, vis ? 'Nghe nhịp dao và đếm theo…' : 'Đang giấu đồng hồ — đếm thầm!', 210, 360, 16, '#6b4a3a', 700);
    } else if (st === 'result') {
        const d = N.dev, sgn = d >= 0 ? '+' : '−';
        txt(g, 'Dừng lúc ' + N.stopped.toFixed(2) + ' s · ' + 'lệch ' + sgn + Math.abs(d).toFixed(2) + ' s', 210, 338, 16, INK, 700);
        let m;
        if (N.win) m = 'Qua ải rồi! Nộm đã trộn xong 🥗';
        else if (N.ok) m = ('Đạt! Sang vòng ' + (N.round + 1));
        else m = N.prev === 0 ? 'Chưa đạt — ở lại vòng 1' : 'Trượt — quay về vòng 1';
        txt(g, m, 210, 360, 16, N.ok ? '#2e9d4a' : '#c2412d', 700);
        // tolerance bar: the green window is the allowed range, the marker is where you stopped
        const lo = N.target - 3.5, hi = N.target + 3.5, mp = t => 20 + (Math.max(lo, Math.min(hi, t)) - lo) / (hi - lo) * 380;
        box(g, 20, 384, 380, 10, 5, '#d8c6a8', 2);
        g.fillStyle = '#4ea45a'; g.fillRect(mp(N.target - tol), 385.5, mp(N.target + tol) - mp(N.target - tol), 7);
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(mp(N.target), 380); g.lineTo(mp(N.target), 398); g.stroke();
        const mx = mp(N.stopped);
        g.fillStyle = N.ok ? '#2e9d4a' : '#c2412d'; g.beginPath(); g.moveTo(mx, 400); g.lineTo(mx - 7, 408); g.lineTo(mx + 7, 408); g.closePath(); g.fill(); g.stroke();
        // red seal, like a print stamp
        g.save(); g.translate(352, 112); g.rotate(.22);
        const k = Math.min(1, N.resultT * 6), sc = 1.6 - .6 * k; g.scale(sc, sc); g.globalAlpha = k;
        g.strokeStyle = N.ok ? '#2e9d4a' : '#c2412d'; g.lineWidth = 4; rr(g, -50, -22, 100, 44, 6); g.stroke();
        txt(g, N.win ? 'QUA ẢI!' : N.ok ? 'ĐẠT' : 'TRƯỢT', 0, 1, 24, N.ok ? '#2e9d4a' : '#c2412d', 900, '"Playfair Display",serif');
        g.restore();
    }
    g.restore();
}


/* =====================================================================
   NỐI VÀO KHUNG GAME
   ===================================================================== */
const mod = (function(){
  let ctx = null, scale = 1, finished = false, lastTick = 0;

  // Không gian ảo như bản gốc (dọc W=460, ngang H=700), tính trên vùng canvas nằm DƯỚI thanh HUD
  function fit(){
    ctx = Eng.ctx;
    const cw = Eng.W, ch = Math.max(200, Eng.H - Eng.top);
    if(ch > cw){ S.W = 460; S.H = 460 * ch / cw; } else { S.H = 700; S.W = 700 * cw / ch; }
    scale = cw / S.W;
  }
  function newTarget(){
    let t;
    do t = RANGE[0] + Math.floor(Math.random() * (RANGE[1] - RANGE[0] + 1)); while(t === N.target && RANGE[1] > RANGE[0]);
    return t;
  }
  function hud(){
    const shown = N.state === 'result' ? N.prev : N.round;
    Eng.hud.set([
      {l:'Vòng', v:(shown + 1) + '/3'},
      {l:'Lần thử', v:N.attempts + (N.state === 'result' ? 0 : 1)},
      {l:'Đích', v:N.target + ' giây'}
    ]);
  }
  function enter(){
    finished = false; lastTick = 0;
    fit();
    N.round = 0; N.prev = 0; N.attempts = 0; N.win = false; N.ok = false; N.T = 0; confetti.length = 0;
    N.target = newTarget(); N.state = 'brief';
    hud();
  }

  /* ----- luồng chơi ----- */
  function act(){
    const now = performance.now();
    if(N.state === 'brief'){
      N.state = 'run'; N.t0 = now; N.e = 0; N.lastSec = 0; N.hidden = false; SND.start();
    } else if(N.state === 'run'){
      stopRun(now);
    } else if(N.state === 'result' && now - N.resultAt > 450){
      if(N.win) finishWin(); else { N.target = newTarget(); N.state = 'brief'; }
    }
    hud();
  }
  function stopRun(now){
    const e = (now - N.t0) / 1000;
    N.stopped = e; N.dev = e - N.target; N.prev = N.round;
    N.ok = Math.abs(N.dev) <= TOL[N.round] + 1e-9;
    N.attempts++;
    N.win = false;
    if(N.ok){ if(N.round === 2) N.win = true; else N.round++; } else N.round = 0;
    N.state = 'result'; N.resultAt = now; N.resultT = 0;
    SND.stop();
    setTimeout(() => N.win ? SND.win() : N.ok ? SND.pass() : SND.fail(), 140);
    if(N.win){
      for(let i = 0; i < 46; i++) confetti.push({ x: Math.random() * S.W, y: -Math.random() * S.H * .5, vy: 90 + Math.random() * 130, a: Math.random() * 6.28, va: (Math.random() - .5) * 8, c: ['#5a9a3c', '#ee8a2a', '#efe3b0', '#c2412d'][i % 4], s: 4 + Math.random() * 5 });
    }
  }
  function finishWin(){
    if(finished) return; finished = true;
    const extra = Math.max(0, N.attempts - 3), score = Math.max(10, 100 - extra * 10);
    Eng.finish({win:true, score, stars: N.attempts <= 4 ? 3 : N.attempts <= 8 ? 2 : 1,
      title:'Qua ải! Nộm đã sẵn sàng', msg:'Bạn trộn nộm đúng nhịp sau ' + N.attempts + ' lần thử.',
      rows:[['Số lần thử', N.attempts], ['Số lần trượt', extra], ['Tối thiểu có thể', 3]]});
  }
  function update(dt){
    const now = performance.now();
    // sau khi tạm dừng (hoặc khựng hình lâu) dịch mốc bắt đầu để không tính thời gian dừng vào đồng hồ
    if(lastTick && now - lastTick > 250 && N.state === 'run') N.t0 += (now - lastTick) - dt * 1000;
    lastTick = now;
    N.T += dt;
    if(N.state === 'run'){
      N.e = (now - N.t0) / 1000;
      const vis = N.e <= N.target * FRAC[N.round], sec = Math.floor(N.e);
      if(sec > N.lastSec){ if(vis) SND.chop(.8); N.lastSec = sec; }
      if(!vis && !N.hidden){ N.hidden = true; SND.hide(); }
      if(N.e > N.target + OVER) stopRun(N.t0 + (N.target + OVER) * 1000);
    }
    if(N.state === 'result'){
      N.resultT += dt;
      if(N.win && N.resultT > 6) finishWin();          // tự kết thúc nếu người chơi không bấm tiếp
    }
    for(const p of confetti){
      p.y += p.vy * dt; p.a += p.va * dt; p.x += Math.sin(p.a) * 20 * dt;
      if(p.y > S.H + 20) p.y = -20;
    }
    hud();
  }

  /* ----- vẽ ----- */
  function drawGo(g){
    const w = Math.min(300, Eng.W - 40), h = 52, x = Eng.W / 2 - w / 2, y = Eng.H - 22 - h;
    const label = N.state === 'brief' ? 'Bắt đầu đếm' : N.state === 'run' ? 'DỪNG!' : N.win ? 'Hoàn thành' : 'Tiếp tục';
    g.fillStyle = INK; rr(g, x + 3, y + 3, w, h, 6); g.fill();
    box(g, x, y, w, h, 6, N.state === 'run' ? '#2e9d4a' : '#c2412d', 3);
    txt(g, label, x + w / 2, y + h / 2 + 1, 22, CREAM, 700);
  }
  function draw(){
    const g = ctx, d = Eng.dpr, w = Eng.W, h = Eng.H;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = '#f2d5c8'; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w/2, h/2, Math.min(w, h)*.3, w/2, h/2, Math.max(w, h)*.75);
    v.addColorStop(0, 'rgba(255,255,255,.25)'); v.addColorStop(1, 'rgba(120,60,40,.18)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.setTransform(scale * d, 0, 0, scale * d, 0, Eng.top * d);
    drawScene(g); drawTask(g);
    for(const p of confetti){
      g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.strokeStyle = INK; g.lineWidth = 1;
      g.beginPath(); g.ellipse(0, 0, p.s, p.s * .45, 0, 0, 6.283); g.fill(); g.stroke(); g.restore();
    }
    g.setTransform(d, 0, 0, d, 0, 0);
    drawGo(g);
  }
  function pointerDown(){ act(); }
  function keyDown(code, rep){
    if(code === 'Space' || code === 'Enter' || code === 'KeyZ' || code === 'KeyJ'){ if(!rep) act(); return true; }
    return false;
  }
  return {enter, update, draw, resize:fit, pointerDown, keyDown};
})();

LR.level('ch1', {
  n: 6, id: 'nom',
  title: 'Nộm', status: 'ready', pad: false,
  desc: 'Trộn nộm đúng nhịp: bấm Bắt đầu đếm rồi bấm DỪNG đúng số giây của đầu bài. Đồng hồ chỉ hiện lúc đầu rồi giấu đi, hãy tự đếm tiếp.',
  rules: [
    '<b>Bắt đầu đếm</b> rồi <b>DỪNG</b> đúng số giây đầu bài (chạm màn hình, bấm chuột hoặc phím Cách). Nghe tiếng dao thớt để đếm nhịp.',
    '<b>Vòng 1:</b> lệch tối đa 2 giây. Đạt thì sang vòng 2, chưa đạt thì làm lại vòng 1.',
    '<b>Vòng 2:</b> lệch tối đa 1,5 giây. Đạt thì sang vòng 3, trượt thì quay về vòng 1.',
    '<b>Vòng 3:</b> lệch tối đa 1 giây. Đạt là qua ải, trượt thì quay về vòng 1.',
    'Càng ít lần thử điểm càng cao (tối thiểu 3 lần).'
  ],
  mod
});
})();
