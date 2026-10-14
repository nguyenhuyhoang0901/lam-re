/* Chương 1 · Ải 4: Xôi — "Nhóm Bếp Đồ Xôi" (nguồn: do-xoi.html).
   Người phụ nữ ngồi thổi lửa, người đàn ông quạt, bọn trẻ xem sau hàng rào đỏ; trên bếp là nồi và chõ xôi.
   Dưới có đồng hồ kim quay với các vùng màu mọc ngẫu nhiên rồi thu hẹp dần:
     XANH (thường gặp): bấm khi kim nằm trong vùng -> thêm lửa (+%), kim quay ngược chiều.
     ĐỎ (ít hơn, càng nhiều khi lửa càng to): bấm trúng -> lửa yếu đi (-%).
     Bấm ra ngoài mọi vùng -> bị phạt nhỏ hơn, kim đứng khựng một lúc.
   Lửa càng to thì càng mau nguội, kim càng nhanh, vùng thu hẹp càng nhanh và càng nhiều vùng đỏ.
   Lên 100% trong 2:30 là thắng; thời gian nhanh nhất được lưu làm kỷ lục (lõi game lưu theo từng ải). */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound} = LR;
const INK = '#2a1a12';

/* ===== hàm vẽ nhỏ của bản gốc (đường cong, ống, bộ phận hình vẽ) ===== */
const PL = {
    red: ['#c2412d'],
    green: ['#4f8a4b'],
    dark: ['#3a2a24'],
    white: ['#f4e4c8'],
    yellow: ['#e8b93c'],
    brown: ['#8a5a3c'],
    straw: ['#d9b96a']
};
const R = Math.random;
const C3 = { time: 0 };            // đồng hồ của ải (giây): chỉ chạy khi chưa thắng/thua
const c3Clock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const colr = c => PL[c] ? PL[c][0] : c;

// paths
const smooth = (pts, closed = true) => ({
    b(g) {
        const n = pts.length;
        const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
        g.moveTo(pts[0][0], pts[0][1]);
        const cnt = closed ? n : n - 1;
        for (let i = 0; i < cnt; i++) {
            const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
            g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
                p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
        }
        if (closed) g.closePath();
    }
});
const ell = (cx, cy, rx, ry) => ({ b(g) { g.moveTo(cx + rx, cy); g.ellipse(cx, cy, rx, ry, 0, 0, 6.283); } });
const circ = (cx, cy, r) => ell(cx, cy, r, r);
const tube = (pts, w1, w2) => ({ t: { pts, w1, w2 } });
function tubeDraw(g, t, c, lw) {
    const { pts, w1, w2 } = t, n = pts.length;
    const wAt = i => w1 + (w2 - w1) * (n > 1 ? i / (n - 1) : 0);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (lw > 0) {
        g.strokeStyle = INK;
        for (let i = 0; i < n - 1; i++) {
            g.lineWidth = (wAt(i) + wAt(i + 1)) / 2 + lw * 2;
            g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
        }
    }
    g.strokeStyle = c;
    for (let i = 0; i < n - 1; i++) {
        g.lineWidth = (wAt(i) + wAt(i + 1)) / 2;
        g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke();
    }
}
// art parts: drawn straight onto the canvas, origin = feet / handle
function part(bbox, fn) {
    return {
        draw(g) {
            const a = {
                fk(c, p, lw) {
                    if (p.t) return tubeDraw(g, p.t, colr(c), lw);
                    g.beginPath(); p.b(g);
                    g.fillStyle = colr(c); g.fill();
                    g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
                },
                key(p, lw) {
                    g.beginPath(); p.b(g);
                    g.strokeStyle = INK; g.lineWidth = lw; g.lineCap = 'round'; g.stroke();
                },
                fill(c, p) {
                    if (p.t) return tubeDraw(g, p.t, colr(c), 0);
                    g.beginPath(); p.b(g); g.fillStyle = colr(c); g.fill();
                },
                ink(p) {
                    g.beginPath(); p.b(g); g.fillStyle = INK; g.fill();
                }
            };
            fn(a);
        }
    };
}
function dp(g, art, x, y, rot, sx, sy) {
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.scale(sx, sy);
    art.draw(g);
    g.restore();
}
let HAND = null;
function c3HandArt() {
    if (!HAND)
        HAND = {
            point: part([-20, 0, 24, 64], a => {
                a.fk('white', smooth([[-14, 28], [16, 28], [22, 64], [-18, 64]]), 2);
                a.fk('white', tube([[0, 0], [3, 32]], 11, 12), 2);
            })
        };
    return HAND;
}


/* ===== trò chơi ===== */
const DD = {
    W: 460,
    H: 995,
    t: 0,
    A: 0,
    ph: 0,
    onWin: null,
    onFail: null
};
const DD_TOP = 1.5
  , DD_LIMIT = 120
  , DD_T = 2.7;
let DD_RND = [.7, .6]
  , DD_NARROW = .5;
// band size: random spread; how much a fast needle narrows them
const DD_SPMAX = 6.0
  , DD_SP0 = 2.6
  , DD_CALM = 3.5;
// start speed / top speed; seconds to win back the speed after a penalty
let DD_GAIN = .075
  , DD_BLEED = .034
  , DD_LIFE = [4.0, 1.6]
  , DD_WIDE = [.36, .08];
// harder than before: smaller gain per good tap, more bleed, narrower and shorter-lived bands
let DD_QUICK = .7
  , DD_SLOW = 3
  , DD_KMAX = 1.2
  , DD_KMIN = .4;
let DD_TOPBLEED2 = .02;
// above 95% it bleeds slower still
let DD_TOPBLEED = .15
  , DD_TOPMISS = .04;
// penalties (fraction of the reach): tapping a RED band is worse than tapping outside any band
let DD_RED = .14
  , DD_MISS = .10;
// share of red bands: DD_REDP[0] at the start, DD_REDP[0]+DD_REDP[1] at the top (green stays the majority)
const DD_REDP = [.28, .17];
const DD_GREEN = ['#2e9d4a', '#a6ee7a']
  , DD_REDC = ['#d6361f', '#ff8a6a'];

/* ---------- âm thanh: lửa củi nổ lách tách (dùng bộ Sound chung của game nên nút tắt tiếng có tác dụng) ---------- */
const DDAU = {
    loop: null, timer: 0, last: 0, heat: 0, next: 0,
    ctx() {
        const a = Sound.audio();
        if (!a) return null;
        if (a.ctx.state === 'suspended') a.ctx.resume();
        return a;
    },
    // tiếng lửa nền: tiếng ù trầm + tiếng xì nhẹ, càng to càng sáng khi lửa càng nóng
    start() {
        const a = this.ctx();
        if (!a || this.loop) return;
        const c = a.ctx;
        const mk = (type, f, q) => {
            const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
            s.buffer = a.nb; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
            s.connect(fl); fl.connect(g); g.connect(a.out); s.start(c.currentTime, Math.random());
            return {s, fl, g};
        };
        this.loop = {roar: mk('lowpass', 420, .7), hiss: mk('bandpass', 2600, .6)};
        this.last = performance.now();
        // canh chừng: nếu ải ngừng cập nhật (tạm dừng, thoát) thì lửa tự im
        if (!this.timer) this.timer = setInterval(() => { if (performance.now() - this.last > 900) this.stop(); }, 400);
        this.setHeat(this.heat);
    },
    setHeat(h) {
        this.heat = h;
        const a = Sound.audio();
        if (!this.loop || !a) return;
        const t = a.ctx.currentTime;
        this.loop.roar.g.gain.setTargetAtTime(.05 + .16 * h, t, .15);
        this.loop.roar.fl.frequency.setTargetAtTime(260 + 700 * h, t, .2);
        this.loop.hiss.g.gain.setTargetAtTime(.004 + .03 * h, t, .15);
    },
    stop() {
        if (this.timer) { clearInterval(this.timer); this.timer = 0; }
        const L = this.loop, a = Sound.audio();
        this.loop = null;
        if (L && a) {
            const t = a.ctx.currentTime;
            for (const k of [L.roar, L.hiss]) {
                k.g.gain.setTargetAtTime(0, t, .08);
                try { k.s.stop(t + .5); } catch (e) {}
            }
        }
    },
    // tiếng nổ lép bép ngẫu nhiên: dày và to hơn khi lửa nóng
    tick(dt, h) {
        this.last = performance.now();
        if (!this.loop) { this.start(); return; }
        if (Math.abs(h - this.heat) > .015) this.setHeat(h);
        this.next -= dt;
        if (this.next <= 0) {
            this.crackle(.5 + h);
            this.next = (.05 + Math.random() * .35) / (.5 + 1.8 * h);
        }
    },
    burst(o) { Sound.burst(o); },
    thump(f0, f1, dur, gain) { Sound.note({type: 'sine', f: f0, f1, dur, g: gain}); },
    crackle(power) {
        this.burst({type: 'bandpass', f0: 1200 + Math.random() * 3500, q: 2 + Math.random() * 4, dur: .012 + Math.random() * .03, g: (.05 + .12 * Math.random()) * power});
        if (Math.random() < .3)
            setTimeout(() => this.burst({type: 'bandpass', f0: 1800 + Math.random() * 3000, q: 3, dur: .015 + Math.random() * .02, g: .06 * power}), 20 + Math.random() * 40);
    },
    // bấm xanh: khúc củi trượt vào, lửa bùng "phụp" và nổ vài tiếng
    good(h) {
        this.thump(170, 70, .09, .3);
        this.burst({type: 'bandpass', f0: 300, f1: 1400, q: .8, dur: .45, g: .2 + .08 * h, atk: .06});
        for (let i = 0; i < 3; i++) setTimeout(() => this.crackle(1.3), 60 + i * 70 + Math.random() * 40);
    },
    // bấm đỏ: nước hắt vào lửa, xèo rồi tắt "phụt"
    bad() {
        this.burst({type: 'highpass', f0: 3000, dur: .6, g: .2, atk: .01});
        this.thump(110, 45, .25, .35);
    },
    // bấm ra ngoài mọi vùng: hơi thổi không bén
    miss() {
        this.burst({type: 'highpass', f0: 2600, dur: .25, g: .12, atk: .01});
        this.thump(140, 70, .12, .2);
    },
    // xôi chín: nắp bật, hơi nước phụt dài, lửa nổ rộn
    win() {
        this.thump(220, 80, .15, .35);
        this.burst({type: 'bandpass', f0: 400, f1: 2500, q: .7, dur: 1.2, g: .25, atk: .3});
        this.burst({type: 'highpass', f0: 4000, dur: 1.4, g: .16, atk: .1});
        for (let i = 0; i < 6; i++) setTimeout(() => this.crackle(1.6), 80 + i * 110);
        setTimeout(() => this.stop(), 1500);
    }
};

/* ---------- art ---------- */
let DDART = null;
function ddArt() {
    if (DDART)
        return DDART;
    const skin = 'white';
    // woman crouching to feed the fire: feet at (0,0), face to +x; the log in her hands points at the stove mouth
    const nhom = part([-30, -96, 70, 4], a => {
        a.fk('dark', smooth([[-20, -4], [-24, -30], [6, -38], [18, -26], [14, -4]]), 2);
        // skirt
        a.fk('dark', ell(-4, -2, 9, 4), 1.4);
        a.fk('dark', ell(14, -2, 9, 4), 1.4);
        // feet
        a.fk('green', smooth([[-16, -34], [-14, -64], [8, -68], [12, -36]]), 2.2);
        // tunic
        a.fk(skin, tube([[-4, -58], [12, -44], [30, -32]], 6, 5), 1.6);
        a.fk(skin, tube([[4, -58], [22, -46], [34, -36]], 6, 5), 1.6);
        // both arms to the log
        a.fk('dark', tube([[26, -30], [46, -24], [64, -18]], 5, 5), 1.4);
        // the log
        a.fill('red', ell(64, -18, 3, 2.6));
        // its glowing tip
        a.fk(skin, circ(0, -80, 12), 2.2);
        // head
        a.key(smooth([[4, -82], [7, -80], [10, -82]], false), 1.2);
        a.fill('red', ell(7, -75, 2.6, 1.8));
        a.fk('dark', smooth([[-12, -78], [-6, -92], [8, -93], [14, -84], [10, -78], [-8, -74]]), 1.6);
        // headscarf
        a.ink(smooth([[-12, -76], [-17, -64], [-10, -60], [-8, -72]]));
    }
    );
    // man standing and fanning the fire: feet at (0,0), face to +x; hand with the fan at about (36,-52)
    const fanner = part([-30, -132, 44, 4], a => {
        a.fk('dark', smooth([[-12, -56], [10, -56], [12, -4], [2, -4], [0, -40], [-4, -4], [-14, -4]]), 2);
        // trousers
        a.fk('dark', ell(-6, -2, 9, 4), 1.4);
        a.fk('dark', ell(8, -2, 9, 4), 1.4);
        a.fk('red', smooth([[-15, -100], [13, -102], [18, -60], [16, -40], [-18, -40], [-18, -64]]), 2.2);
        // tunic
        a.fk(skin, tube([[6, -92], [20, -72], [36, -52]], 7, 5), 1.6);
        // the fanning arm
        a.fk(skin, tube([[-8, -92], [-4, -70], [4, -52]], 7, 5), 1.6);
        a.fk(skin, circ(4, -114, 13), 2.2);
        a.key(smooth([[8, -116], [11, -114], [14, -116]], false), 1.2);
        a.key(smooth([[9, -108], [12, -106], [15, -108]], false), 1);
        a.fill('red', ell(10, -110, 2.6, 1.8));
        a.fk('dark', smooth([[-10, -120], [-4, -128], [8, -129], [17, -122], [15, -117], [-9, -114]]), 1.6);
        // his turban
    }
    );
    // palm-leaf fan: the handle is at the origin, the blade points up
    const quat = part([-20, -40, 20, 8], a => {
        a.fk('yellow', smooth([[0, 0], [-17, -28], [-7, -38], [7, -38], [17, -28]]), 1.6);
        for (const x of [-8, 0, 8])
            a.key(smooth([[0, -2], [x * 1.6, -30]], false), 1);
        a.fk('dark', tube([[0, 6], [0, -2]], 2.5, 2.5), 1);
    }
    );
    const kid = col => part([-20, -70, 20, 4], a => {
        a.fk(col, smooth([[-14, -6], [-16, -34], [14, -36], [16, -6]]), 2);
        a.fk(skin, circ(0, -48, 13), 2);
        a.ink(smooth([[-4, -62], [0, -66], [4, -62]]));
        a.key(smooth([[2, -48], [6, -45], [10, -48]], false), 1.2);
        a.fill('red', ell(8, -42, 3, 2));
    }
    );
    DDART = {
        woman: nhom,
        man: fanner,
        fan: quat,
        kids: [kid('green'), kid('red'), kid('green')]
    };
    return DDART;
}

/* ---------- layout ---------- */
function ddLayout() {
    const p = DD.H > DD.W;
    if (p) {
        DD.L = Math.min(DD.W * .44, DD.H * .27);
        DD.piv = {
            x: DD.W / 2,
            y: DD.H * .12 + 40
        };
        DD.ground = DD.piv.y + DD.L + 64;
        DD.dial = {
            x: DD.W / 2,
            y: Math.max(DD.ground + 100 + DD.W * .36, DD.H * .72),
            r: Math.min(DD.W * .36, DD.H * .17)
        };
    } else {
        DD.L = Math.min(DD.H * .4, DD.W * .2);
        DD.piv = {
            x: DD.W * .33,
            y: DD.H * .12 + 30
        };
        DD.ground = DD.piv.y + DD.L + 64;
        DD.dial = {
            r: Math.min(DD.H * .3, DD.W * .16)
        };
        DD.dial.x = DD.W - DD.dial.r - 50;
        DD.dial.y = DD.H * .52;
    }
    DD.right = p ? DD.W : DD.dial.x - DD.dial.r - 24;
    // the scene stops short of the dial on a wide screen
}
function ddStart() {
    ddLayout();
    Object.assign(DD, {
        t: 0,
        A: 0,
        ph: 0,
        done: false,
        failed: false,
        doneT: 0,
        who: 0,
        pump: [0, 0],
        n: 0,
        hits: 0,
        miss: 0,
        bad: 0,
        ang: -Math.PI / 2,
        dir: 1,
        sp: DD_SP0,
        bands: [],
        flash: 0,
        stall: -1,
        shake: 0,
        calm: 0,
        lastHit: null,
        combo: 1,
        flashOk: false,
        taps: 0
    });
    DDAU.heat = 0;
    DDAU.next = 0;
    DDAU.start();
    ddBands();
}
const ddH = () => Math.min(1, DD.A / DD_TOP);
// how hot, 0..1
// keep as many bands as the heat asks for; each starts wide and shrinks away (faster when hotter).
// Green is the common colour; red shows up more often the hotter the fire is. There is always at least one green band.
function ddBands() {
    const want = Math.min(5, 2 + Math.floor(Math.min(3, ddH() * 3.4) * (1 - DD.calm)));
    // after a penalty: fewer bands, coming back as it recovers
    while (DD.bands.length < want) {
        let a = 0;
        for (let k = 0; k < 20; k++) {
            a = R() * 6.283;
            const far = d => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d)));
            if (far(DD.ang) > .9 && DD.bands.every(b => far(b.a) > 1))
                break;
        }
        const needG = !DD.bands.some(b => b.k === 'g')
          , redP = DD_REDP[0] + DD_REDP[1] * ddFast()
          , kind = (needG && DD.bands.length >= want - 1) || R() >= redP ? 'g' : 'r'
          , life = DD_LIFE[0] - DD_LIFE[1] * ddH() * (1 - DD.calm) + R() * .8;
        DD.bands.push({
            a,
            k: kind,
            w0: (DD_WIDE[0] - DD_WIDE[1] * ddH() * (1 - DD.calm)) * (DD_RND[0] + R() * DD_RND[1]) * (1 - DD_NARROW * ddFast()),
            life,
            t: 0,
            born: 0
        });
    }
}
const ddFast = () => ddH() * (1 - DD.calm);
// band size, needle speed and red share follow the fire's heat (%), eased after a penalty
const ddW = b => Math.max(0, b.w0 * (1 - b.t / b.life));
// half-width now
function ddUpdate(dt) {
    DD.t += dt;
    // the fire: its heat A is raised by good taps and dies down, faster the hotter it is
    if (!DD.done)
        DD.A = Math.max(0, DD.A - (.004 + DD_BLEED * DD.A * DD.A) * (ddH() >= .95 ? DD_TOPBLEED2 : ddH() >= .9 ? DD_TOPBLEED : 1) * dt);
    DD.ph += dt * 6.283 / DD_T;
    DD.pump = DD.pump.map(v => Math.max(0, v - dt));
    DD.flash = Math.max(0, DD.flash - dt);
    if (DD.done) {
        DD.doneT += dt;
        if (DD.doneT > 1.6 && DD.onWin) {
            const cb = DD.onWin;
            DD.onWin = null;
            cb();
        }
        return;
    }
    if (DD.failed)
        return;
    if (typeof C3 !== 'undefined' && C3.time >= DD_LIMIT) {
        DD.failed = true;
        DDAU.stop();
        return;
    }
    // the shell ends the round (timeLimit)
    DDAU.tick(dt, ddH());
    // the needle and the bands
    DD.shake = Math.max(0, (DD.shake || 0) - dt);
    DD.stall = Math.max(-1, DD.stall - dt);
    if (DD.stall <= 0)
        DD.calm = Math.max(0, DD.calm - dt / DD_CALM);
    const spNow = DD_SP0 + (DD_SPMAX - DD_SP0) * ddFast();
    // the hotter the fire, the faster; after a penalty it starts slow again and works back up
    if (DD.stall <= 0)
        DD.ang = (DD.ang + DD.dir * spNow * Math.min(1, -DD.stall * 3.3) * dt) % 6.283;
    for (const b of DD.bands)
        b.t += dt * (1 + ddH() * .6 * (1 - DD.calm));
    DD.bands = DD.bands.filter(b => ddW(b) > .035);
    ddBands();
}
// a penalty: the bands go, the needle stops dead, the dial shakes, then it goes on
function ddPenalty(stall) {
    DD.calm = 1;
    DD.bands = [];
    ddBands();
    DD.stall = stall;
    DD.shake = .4;
    DD.flash = .25;
    DD.flashOk = false;
}
function ddTap() {
    if (DD.done || DD.failed || DD.stall > 0)
        return;
    // while the needle is stuck, taps do nothing
    DDAU.ctx();
    DDAU.start();
    DD.taps++;
    const hit = DD.bands.find(b => {
        const d = Math.abs(Math.atan2(Math.sin(DD.ang - b.a), Math.cos(DD.ang - b.a)));
        return d <= ddW(b) + .03;
    }
    );
    if (hit && hit.k === 'g') {
        // green: more fire
        DD.bands.splice(DD.bands.indexOf(hit), 1);
        DD.dir = -DD.dir;
        // hits in quick succession lift more, a long wait since the last one lifts less (xKMAX within QUICK s ... xKMIN after SLOW s)
        const gap = DD.lastHit == null ? DD_SLOW / 2 : DD.t - DD.lastHit
          , k = DD_KMAX - (DD_KMAX - DD_KMIN) * Math.max(0, Math.min(1, (gap - DD_QUICK) / (DD_SLOW - DD_QUICK)));
        DD.lastHit = DD.t;
        DD.combo = k;
        DD.A = Math.min(DD_TOP, DD.A + (ddH() >= .95 ? Math.min(1, k) * DD_TOP * .01 : k * (ddH() >= .9 ? DD_TOP * .02 : DD_GAIN)));
        // from 90% a good tap adds 2% (at an even pace); from 95% 1% at the very most
        DD.pump[DD.who] = .35;
        DD.who = 1 - DD.who;
        DD.hits++;
        DD.flash = .25;
        DD.flashOk = true;
        if (DD.A >= DD_TOP - 1e-9) {
            DD.done = true;
            DDAU.win();
        } else
            DDAU.good(ddH());
        ddBands();
    } else if (hit) {
        // red: the fire dies down
        const h = ddH();
        DD.A = Math.max(0, DD.A - (h >= .95 ? DD_TOP * .03 : h >= .9 ? DD_TOP * .05 : DD_RED));
        DD.bad++;
        ddPenalty(.7);
        DDAU.bad();
    } else {
        // outside every band: a smaller penalty (near the top it costs less)
        const h = ddH();
        DD.A = Math.max(0, DD.A - (h >= .95 ? DD_TOP * .02 : h >= .9 ? DD_TOP * DD_TOPMISS : DD_MISS));
        DD.miss++;
        ddPenalty(.55);
        DDAU.miss();
    }
}

/* ---------- drawing ---------- */
// one flame tongue, base at (x,y), height h, tip leaning by sway
function ddTongue(g, x, y, w, h, col, sway) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x - w * 1.1, y - h * .55, x + sway, y - h);
    g.quadraticCurveTo(x + w * 1.1, y - h * .55, x + w, y);
    g.closePath();
    g.fill();
}
// the clay stove with its fire, the pot, the wooden steamer, the lid and the steam
function ddStove(g, u, cx, gy, h) {
    const t = DD.t
      , bw = 72 * u
      , bh = 66 * u
      , mw = 30 * u
      , mh = 46 * u;
    // the glow of the fire on the ground
    const gr = g.createRadialGradient(cx, gy, 4 * u, cx, gy, 130 * u);
    gr.addColorStop(0, `rgba(255,150,40,${(.18 + .34 * h).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr;
    g.fillRect(cx - 130 * u, gy - 130 * u, 260 * u, 190 * u);
    // clay block
    g.lineJoin = 'round';
    g.fillStyle = '#b4784a';
    g.strokeStyle = INK;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(cx - bw, gy + 4);
    g.lineTo(cx - bw + 8 * u, gy - bh);
    g.lineTo(cx + bw - 8 * u, gy - bh);
    g.lineTo(cx + bw, gy + 4);
    g.closePath();
    g.fill();
    g.stroke();
    g.lineWidth = 1.2;
    for (let r = 1; r < 3; r++) {
        const y = gy + 4 - (bh + 4) * r / 3
          , ins = 8 * u * r / 3 + 4;
        g.beginPath();
        g.moveTo(cx - bw + ins, y);
        g.lineTo(cx + bw - ins, y);
        g.stroke();
        for (const s of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + s * (50 - r * 10) * u, y);
            g.lineTo(cx + s * (50 - r * 10) * u, y + (bh / 3) * .95);
            g.stroke();
        }
    }
    // the mouth, with logs, embers and the flames inside
    const my = gy - mh + mw;
    g.beginPath();
    g.moveTo(cx - mw, gy + 4);
    g.lineTo(cx - mw, my);
    g.arc(cx, my, mw, Math.PI, 0);
    g.lineTo(cx + mw, gy + 4);
    g.closePath();
    g.fillStyle = '#1d1612';
    g.fill();
    g.lineWidth = 2.4;
    g.stroke();
    g.save();
    g.clip();
    g.lineCap = 'round';
    const logs = () => {
        g.beginPath();
        g.moveTo(cx - mw * .9, gy - 2 * u);
        g.lineTo(cx + mw * .2, gy - 10 * u);
        g.moveTo(cx - mw * .5, gy - 10 * u);
        g.lineTo(cx + mw * .9, gy - 3 * u);
        g.stroke();
    }
    ;
    g.strokeStyle = '#4a2a1a';
    g.lineWidth = 8 * u;
    logs();
    g.strokeStyle = `rgba(255,120,40,${(.35 + .6 * h).toFixed(3)})`;
    g.lineWidth = 3 * u;
    logs();
    const H = mh * (.3 + .85 * h);
    for (let i = 0; i < 5; i++) {
        const fx = cx + (i - 2) * mw * .42
          , f = .72 + .28 * Math.sin(t * 8 + i * 2.1) + .12 * Math.sin(t * 13 + i * 5.3)
          , mid = i === 2 ? 1.15 : 1 - .12 * Math.abs(i - 2)
          , hh = H * f * mid
          , w = mw * .2 * (.8 + .4 * h)
          , sway = Math.sin(t * 5 + i * 1.7) * mw * .12;
        ddTongue(g, fx, gy + 4, w * 1.5, hh, '#d8431f', sway);
        ddTongue(g, fx, gy + 4, w * 1.1, hh * .78, '#f08a24', sway * .8);
        ddTongue(g, fx, gy + 4, w * .7, hh * .55, '#ffd75a', sway * .6);
    }
    g.restore();
    // sparks flying up
    const n = 3 + Math.round(9 * h);
    for (let i = 0; i < n; i++) {
        const ph = (t * (.5 + .3 * ((i * 7) % 3) / 3) + i * .37) % 1
          , x = cx + Math.sin(i * 12.9 + ph * 4) * mw * (.5 + ph)
          , y = gy - 20 * u - ph * (60 + 60 * h) * u;
        g.fillStyle = `rgba(255,${180 + (i % 3) * 20},70,${(1 - ph).toFixed(2)})`;
        g.beginPath();
        g.arc(x, y, (1.6 + (i % 2)) * u * (1 - ph * .5), 0, 6.283);
        g.fill();
    }
    // the pot (nồi)
    const y0 = gy - bh;
    g.fillStyle = '#6b3f2c';
    g.strokeStyle = INK;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(cx - 50 * u, y0);
    g.bezierCurveTo(cx - 66 * u, y0 - 10 * u, cx - 62 * u, y0 - 38 * u, cx - 46 * u, y0 - 44 * u);
    g.lineTo(cx + 46 * u, y0 - 44 * u);
    g.bezierCurveTo(cx + 62 * u, y0 - 38 * u, cx + 66 * u, y0 - 10 * u, cx + 50 * u, y0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#8a5a40';
    g.fillRect(cx - 50 * u, y0 - 50 * u, 100 * u, 8 * u);
    g.strokeRect(cx - 50 * u, y0 - 50 * u, 100 * u, 8 * u);
    // the wooden steamer (chõ) with a cloth wrapped round the joint
    const y1 = y0 - 46 * u
      , y2 = y1 - 80 * u;
    g.fillStyle = PL.straw[0];
    g.beginPath();
    g.moveTo(cx - 44 * u, y1);
    g.lineTo(cx - 40 * u, y2);
    g.lineTo(cx + 40 * u, y2);
    g.lineTo(cx + 44 * u, y1);
    g.closePath();
    g.fill();
    g.stroke();
    g.lineWidth = 1.2;
    for (const k of [.25, .5, .75]) {
        const y = y1 + (y2 - y1) * k
          , d = 44 * u - 4 * u * k;
        g.beginPath();
        g.moveTo(cx - d, y);
        g.lineTo(cx + d, y);
        g.stroke();
    }
    for (let x = -30; x <= 30; x += 15) {
        g.beginPath();
        g.moveTo(cx + x * u, y1);
        g.lineTo(cx + x * .93 * u, y2);
        g.stroke();
    }
    g.fillStyle = '#f2ecde';
    g.lineWidth = 2;
    g.fillRect(cx - 48 * u, y1 - 5 * u, 96 * u, 9 * u);
    g.strokeRect(cx - 48 * u, y1 - 5 * u, 96 * u, 9 * u);
    // the lid: it rattles when the fire is hot and pops off when the rice is done
    const lift = DD.done ? Math.min(1, DD.doneT * 2.2) * 30 * u : 0
      , rat = DD.done ? 0 : h > .6 ? Math.sin(t * 46) * 2.4 * u * (h - .6) / .4 : 0;
    g.save();
    g.translate(0, -lift + rat);
    g.fillStyle = '#c9a25a';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(cx - 54 * u, y2);
    g.lineTo(cx, y2 - 26 * u);
    g.lineTo(cx + 54 * u, y2);
    g.closePath();
    g.fill();
    g.stroke();
    g.lineWidth = 1.2;
    for (const k of [-.5, 0, .5]) {
        g.beginPath();
        g.moveTo(cx, y2 - 26 * u);
        g.lineTo(cx + k * 54 * u * 1.6, y2);
        g.stroke();
    }
    g.fillStyle = PL.red[0];
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, y2 - 29 * u, 5 * u, 0, 6.283);
    g.fill();
    g.stroke();
    g.restore();
    // the steam: more and thicker the hotter the fire is, a big burst when done
    const k = DD.done ? 12 : 3 + Math.round(7 * h)
      , amp = DD.done ? 1.5 : .35 + .65 * h;
    for (let i = 0; i < k; i++) {
        const ph = (t * (.32 + .25 * h) + i / k) % 1
          , x = cx + Math.sin(ph * 7 + i * 2.3) * 16 * u * (.4 + ph) + (i % 3 - 1) * 14 * u
          , y = y2 - 26 * u - lift - ph * (90 + 60 * h) * u
          , r = (9 + 26 * ph) * u * (.7 + .5 * amp)
          , al = Math.max(0, 1 - ph) * .6 * Math.min(1, amp);
        g.fillStyle = `rgba(255,255,255,${al.toFixed(3)})`;
        g.strokeStyle = `rgba(91,47,31,${(al * .35).toFixed(3)})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(x, y, r, 0, 6.283);
        g.fill();
        g.stroke();
    }
}
function ddRender(g) {
    const A = ddArt()
      , P = DD.piv
      , L = DD.L
      , gy = DD.ground
      , u = L / 175
      , cx = P.x
      , h = ddH();
    // the line of hanging things: chilli strings, corn, garlic and leaf bundles
    const ly = P.y - 34
      , lx0 = 20
      , lx1 = DD.right - 20;
    g.strokeStyle = INK;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(lx0, ly + 10);
    g.quadraticCurveTo(DD.W / 2, ly + 30, lx1, ly + 10);
    g.stroke();
    for (let i = 0; i < 9; i++) {
        const k = (i + .5) / 9
          , x = lx0 + (lx1 - lx0) * k
          , y = ly + 10 + Math.sin(k * Math.PI) * 18;
        if (Math.abs(x - cx) < 70 * u)
            continue;
        const sw = Math.sin(DD.t * 1.3 + i) * 2;
        g.lineWidth = 1.6;
        g.strokeStyle = INK;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + sw, y + 10);
        g.stroke();
        const ty = i % 3;
        if (ty === 0) {
            // chilli string
            g.fillStyle = PL.red[0];
            for (let j = 0; j < 3; j++) {
                g.beginPath();
                g.ellipse(x + sw + (j % 2 ? 4 : -4), y + 16 + j * 9, 3.6, 7, 0, 0, 6.283);
                g.fill();
                g.stroke();
            }
        } else if (ty === 1) {
            // corn cob
            g.fillStyle = '#f2c640';
            g.beginPath();
            g.ellipse(x + sw, y + 24, 6, 15, 0, 0, 6.283);
            g.fill();
            g.stroke();
        } else {
            // bundle of leaves
            g.fillStyle = PL.green[0];
            g.beginPath();
            g.moveTo(x + sw - 3, y + 10);
            g.lineTo(x + sw + 3, y + 10);
            g.lineTo(x + sw + 8, y + 40);
            g.lineTo(x + sw - 8, y + 40);
            g.closePath();
            g.fill();
            g.stroke();
        }
    }
    // the ground
    g.fillStyle = 'rgba(91,47,31,.16)';
    g.fillRect(0, gy, DD.right, 26);
    // the stove, the pot and the steamer
    ddStove(g, u, cx, gy, h);
    // the woman feeding the fire: she pushes the log in on every other good tap
    const pk = DD.pump[0] / .35
      , push = pk > 0 ? Math.sin(pk * Math.PI) * 18 * u : 0;
    dp(g, A.woman, cx - 108 * u + push, gy + 6, Math.sin(DD.t * 1.5) * .02, u, u);
    // the man fanning it: slow when idle, quick flaps on his turn
    g.save();
    g.translate(cx + 108 * u, gy + 6);
    g.scale(-u, u);
    dp(g, A.man, 0, 0, 0, 1, 1);
    g.restore();
    const fk = DD.pump[1] > 0
      , rot = fk ? Math.sin(DD.t * 30) * .6 : Math.sin(DD.t * 2.5) * .18;
    dp(g, A.fan, cx + 108 * u - 36 * u, gy + 6 - 52 * u, rot - .5, u, u);
    // the children peeking over the railing
    const kx = [cx - 175 * u, cx + 50 * u, cx + 175 * u];
    A.kids.forEach( (k, i) => dp(g, k, Math.max(40, Math.min(DD.right - 40, kx[i])), gy + 46, Math.sin(DD.t * 2 + i) * .03, .85, .85));
    // the red railing in front, like the print
    const ry = gy + 30;
    g.fillStyle = PL.red[0];
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.fillRect(0, ry, DD.right, 9);
    g.strokeRect(-2, ry, DD.right + 4, 9);
    for (let x = 14; x < DD.right - 6; x += 22) {
        g.fillStyle = (x / 22) % 2 < 1 ? PL.green[0] : '#f2ecde';
        g.fillRect(x - 5, ry + 9, 10, 26);
        g.strokeRect(x - 5, ry + 9, 10, 26);
    }
    g.fillStyle = PL.red[0];
    g.fillRect(0, ry + 35, DD.right, 8);
    g.strokeRect(-2, ry + 35, DD.right + 4, 8);
    ddDrawDial(g);
}
function ddDrawDial(g) {
    const {x, y, r} = DD.dial
      , r0 = r * .56
      , r1 = r * .9
      , sh = (DD.shake || 0) / .4;
    g.save();
    g.translate(x + Math.sin(DD.t * 70) * 7 * sh, y + Math.cos(DD.t * 53) * 4 * sh);
    g.rotate(Math.sin(DD.t * 61) * .04 * sh);
    // the wooden rim and the dark track
    g.fillStyle = PL.brown[0];
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, r, 0, 6.283);
    g.fill();
    g.stroke();
    g.fillStyle = '#2a221d';
    g.beginPath();
    g.arc(0, 0, r1, 0, 6.283);
    g.fill();
    g.lineWidth = 1.6;
    g.stroke();
    for (let k = 0; k < 24; k++) {
        const a = k / 24 * 6.283;
        g.strokeStyle = 'rgba(242,236,222,.25)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(Math.cos(a) * r1 * .96, Math.sin(a) * r1 * .96);
        g.lineTo(Math.cos(a) * r1 * .9, Math.sin(a) * r1 * .9);
        g.stroke();
    }
    // the bands: GREEN (+ more fire) and RED (- the fire dies down), each with a light heart and a + / - mark
    for (const b of DD.bands) {
        const w = ddW(b)
          , born = Math.min(1, b.t * 5)
          , col = b.k === 'g' ? DD_GREEN : DD_REDC;
        g.globalAlpha = born;
        g.fillStyle = col[0];
        g.beginPath();
        g.arc(0, 0, r1 - 3, b.a - w, b.a + w);
        g.arc(0, 0, r0 + 3, b.a + w, b.a - w, true);
        g.closePath();
        g.fill();
        g.fillStyle = col[1];
        g.beginPath();
        g.arc(0, 0, r1 - 10, b.a - w * .55, b.a + w * .55);
        g.arc(0, 0, r0 + 10, b.a + w * .55, b.a - w * .55, true);
        g.closePath();
        g.fill();
        if (w > .1 && born > .8) {
            const rm = (r0 + r1) / 2
              , bx = Math.cos(b.a) * rm
              , by = Math.sin(b.a) * rm
              , sz = Math.min(r * .06, (r1 - r0) * .2);
            g.strokeStyle = '#1d1612';
            g.lineWidth = Math.max(2, r * .02);
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(bx - sz, by);
            g.lineTo(bx + sz, by);
            if (b.k === 'g') {
                g.moveTo(bx, by - sz);
                g.lineTo(bx, by + sz);
            }
            g.stroke();
        }
        g.globalAlpha = 1;
    }
    // the needle
    const nc = DD.flash > 0 ? (DD.flashOk ? '#a6ee7a' : '#ff5a3a') : '#f2ecde';
    g.strokeStyle = nc;
    g.lineWidth = DD.flash > 0 ? 6 : 4.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(Math.cos(DD.ang) * (r0 + 2), Math.sin(DD.ang) * (r0 + 2));
    g.lineTo(Math.cos(DD.ang) * (r1 - 2), Math.sin(DD.ang) * (r1 - 2));
    g.stroke();
    // the hub: time left, and how hot the fire is as an orange arc round it
    g.fillStyle = '#f2ecde';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, r0, 0, 6.283);
    g.fill();
    g.stroke();
    g.strokeStyle = '#f08a24';
    g.lineWidth = 6;
    g.lineCap = 'butt';
    g.beginPath();
    g.arc(0, 0, r0 - 8, -Math.PI / 2, -Math.PI / 2 + ddH() * 6.283);
    g.stroke();
    const left = Math.max(0, DD_LIMIT - (typeof C3 !== 'undefined' ? C3.time : 0))
      , sec = Math.ceil(left);
    g.fillStyle = left <= 20 ? '#c73a1e' : INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `900 ${Math.round(r0 * .44)}px "Playfair Display", serif`;
    g.fillText(c3Clock(sec), 0, -r0 * .06);
    g.fillStyle = '#d8671a';
    g.font = `700 ${Math.round(r0 * .17)}px "Be Vietnam Pro", sans-serif`;
    g.fillText(Math.round(ddH() * 100) + '%', 0, r0 * .38);
    g.restore();
}
// Cho tới lần bấm trúng đầu tiên: chú thích ngắn và bàn tay chạm lên mặt đồng hồ (vẽ cùng hệ toạ độ với cảnh)
function ddOverlay(g) {
    if (DD.hits || DD.done) return;
    const x = DD.dial.x + DD.dial.r * .3, y = DD.dial.y + DD.dial.r * .35, k = (DD.t * 1.4) % 1, press = k < .2;
    g.save();
    const msg = 'Xanh: thêm lửa · Đỏ: lửa yếu đi', fs = 15;
    g.font = `700 ${fs}px "Be Vietnam Pro", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = g.measureText(msg).width + 24, lx = DD.dial.x, ly = DD.dial.y - DD.dial.r - 22;
    g.fillStyle = 'rgba(242,236,222,.92)';
    g.fillRect(lx - tw / 2, ly - fs * .9, tw, fs * 1.8);
    g.fillStyle = INK;
    g.fillText(msg, lx, ly);
    g.globalAlpha = .9;
    dp(g, c3HandArt().point, x, y + (press ? 6 : 0), -.28, 1.1, 1.1);
    if (press) {
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y - 4, 14 * (1 + k * 3), 0, 6.283);
        g.stroke();
    }
    g.restore();
}

/* =====================================================================
   NỐI VÀO KHUNG GAME
   ===================================================================== */
const mod = (function(){
  let ctx = null, scale = 1, finished = false;

  // Không gian ảo của bản gốc: dọc W=460, ngang H=700. Ở đây tính trên vùng canvas nằm DƯỚI thanh HUD.
  function fit(){
    ctx = G.ctx;
    const cw = G.W, ch = Math.max(200, G.H - G.top);
    let W, H;
    if(ch > cw){ W = 460; H = 460 * ch / cw; } else { H = 700; W = 700 * cw / ch; }
    DD.W = W; DD.H = H; scale = cw / W;
    ddLayout();
  }
  function hud(){
    const left = Math.max(0, DD_LIMIT - C3.time);
    G.hud.set([
      {l:'Lửa', v:Math.round(ddH() * 100) + '%'},
      {l:'Còn', v:c3Clock(Math.ceil(left)), w:left <= 20},
      {l:'Đúng', v:DD.hits}
    ]);
  }
  function enter(){
    finished = false; C3.time = 0;
    fit(); ddStart();
    DD.onWin = finishWin;
    hud();
  }
  function exit(){ DDAU.stop(); }
  function update(dt){
    if(!DD.done && !DD.failed) C3.time += dt;
    ddUpdate(dt);
    if(DD.failed) finishFail();
    hud();
  }
  function stats(){ return [['Thời gian', c3Clock(Math.round(C3.time))], ['Bấm đúng vùng xanh', DD.hits], ['Bấm ra ngoài', DD.miss], ['Bấm phải vùng đỏ', DD.bad]]; }
  function finishWin(){
    if(finished) return; finished = true; DDAU.stop();
    const perfect = DD.miss === 0 && DD.bad === 0;
    G.finish({win:true, time:Math.round(C3.time * 1000), stars: perfect ? 3 : (C3.time <= 90 ? 2 : 1),
      title:'Xôi chín rồi!', msg: perfect ? 'Lửa đượm quá! Không sai nhịp nào!' : 'Xôi chín rồi, dẻo thơm! Giỏi quá!', rows:stats()});
  }
  function finishFail(){
    if(finished) return; finished = true; DDAU.stop();
    G.finish({win:false, title:'Hết giờ', msg:'Hết giờ! Lửa chưa đượm, xôi chưa chín.', rows:stats()});
  }
  function draw(){
    const g = ctx, d = G.dpr, w = G.W, h = G.H;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = '#f2d5c8'; g.fillRect(0, 0, w, h);
    const v = g.createRadialGradient(w/2, h/2, Math.min(w, h)*.3, w/2, h/2, Math.max(w, h)*.75);
    v.addColorStop(0, 'rgba(255,255,255,.25)'); v.addColorStop(1, 'rgba(120,60,40,.18)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.setTransform(scale * d, 0, 0, scale * d, 0, G.top * d);
    ddRender(g); ddOverlay(g);
  }
  function pointerDown(){ ddTap(); }
  function keyDown(code, rep){
    if(code === 'Space' || code === 'Enter' || code === 'KeyZ' || code === 'KeyJ'){ if(!rep) ddTap(); return true; }
    return false;
  }
  return {enter, exit, update, draw, resize:fit, pointerDown, keyDown};
})();

LR.level('ch1', {
  n: 4, id: 'xoi',
  title: 'Xôi', status: 'ready', pad: false,
  desc: 'Giữ lửa thật đượm để đồ xôi chín!',
  rules: [
    '<b>Bấm</b> (chạm, chuột hoặc phím Cách) khi kim chạy qua vùng <b style="color:#2e9d4a">XANH</b> để thêm lửa. Bấm đều nhịp, liên tiếp thì được nhiều lửa hơn.',
    'Tránh vùng <b style="color:#d6361f">ĐỎ</b>: bấm trúng là lửa yếu đi. Bấm ra ngoài mọi vùng cũng bị phạt, kim đứng khựng một lúc.',
    'Lửa càng to thì càng mau nguội, kim chạy nhanh hơn, vùng thu hẹp nhanh hơn và có nhiều vùng đỏ hơn.',
    'Đạt 100% trong 2:30 là xôi chín. Thời gian nhanh nhất được lưu làm kỷ lục.'
  ],
  mod
});
})();
