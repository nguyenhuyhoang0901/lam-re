/* =====================================================================
   MẪU ẢI MỚI (file này KHÔNG được nạp — chỉ để copy)

   Cách thêm một ải:
   1. Copy file này đè lên file ải giữ chỗ, vd. js/levels/ch1/03-thit-xien.js
   2. Sửa n / id / title bên dưới cho khớp ải đó (id là khoá lưu tiến trình, đừng đổi sau khi phát hành).
   3. Viết trò chơi trong `mod`. Xong là chạy: ải tự hiện trong album và tự mở khoá sau ải trước.
   (Với ải mới, file đã được nạp sẵn trong index.html. Ải ở chương mới thì thêm <script> tương ứng.)

   Giao diện `mod` (chỉ enter, update, draw là bắt buộc):
     enter({mode})          bắt đầu/chơi lại ải. mode = id mức độ nếu ải có `modes`.
     update(dt)             dt tính bằng giây.
     draw()                 vẽ bằng G.ctx; kích thước G.W x G.H; hệ số co giãn G.u; G.dpr; vùng dưới HUD bắt đầu từ G.top.
     resize()               (tuỳ chọn) gọi khi đổi kích thước màn hình.
     pointerDown(x,y,e)     (tuỳ chọn) chạm / bấm chuột trên canvas.
     pointerMove / pointerUp / pointerLeave / exit / legend(box)   (tuỳ chọn; pointerUp dùng cho kéo thả, con trỏ được giữ khi kéo ra ngoài canvas)
     keyDown(code, repeat)  (tuỳ chọn) trả true nếu ải đã xử lý phím đó
   Khai báo ải thêm được: actLabel (nhãn nút hành động trên điện thoại), modes, pad.
   Tiện ích từ lõi:
     G.hud.set([{l:'Điểm', v:12, w:false}, ...])   cập nhật thanh trạng thái (w:true = nổi cảnh báo)
     G.finish({win, score, stars, title, msg, rows:[['Nhãn', giá trị], ...]})   kết thúc ải
        - win:true ghi nhận hoàn thành (nếu ải có modes thì ghi nhận mức đó) và mở khoá ải sau
        - score (tuỳ chọn) được lưu làm kỷ lục; stars 1-3 (tuỳ chọn)
     Input.vec() -> {x,y,m} hướng đi (bàn phím + pad ảo); Input.consumeAct() -> true khi bấm nút hành động. Cần `pad: true`.
     Sound.sfx.* (click, splat, catchOk, win, lose…), Sound.tone(...) nếu muốn thêm tiếng riêng.
       Sound.burst({type,f0,f1,q,dur,g,atk,delay}) tiếng ồn có lọc (dao thớt, lửa…), Sound.note({type,f,f1,dur,g,delay}) một nốt,
       Sound.audio() -> {ctx,out,nb} để dựng âm thanh liên tục (đi qua cổng master nên tắt tiếng vẫn có tác dụng).
   Ải có nhiều mức độ: thêm  modes: [{id:'easy', name:'Dễ', sub:'mô tả'}, ...]  — phải thắng đủ mọi mức để tính hoàn thành.
   ===================================================================== */
(function(){
'use strict';
const LR = window.LR;
const {G, Sound} = LR;
const {rnd, clamp, TAU, INK} = LR.util;

const mod = (function(){
  const TIME = 20, NEED = 8;
  let ctx, W, H, dpr, u;
  let clock, left, hits, done, targets, pops;

  function resize(){ ctx = G.ctx; W = G.W; H = G.H; dpr = G.dpr; u = G.u; }
  function hud(){
    G.hud.set([{l: 'Trúng', v: hits + '/' + NEED}, {l: 'Giờ', v: Math.ceil(left), w: left <= 5}]);
  }
  function enter(opts){
    resize();
    clock = 0; left = TIME; hits = 0; done = false; targets = []; pops = [];
    hud();
  }
  function update(dt){
    clock += dt; left -= dt;
    if(Math.random() < dt * 1.6) targets.push({x: rnd(40*u, W - 40*u), y: rnd(G.top + 50*u, H - 50*u), r: 30*u, t: 0});
    targets.forEach(t => t.t += dt);
    targets = targets.filter(t => t.t < 1.6);
    pops.forEach(p => p.t += dt);
    pops = pops.filter(p => p.t < .8);
    hud();
    if(!done && hits >= NEED){ done = true; G.finish({win: true, score: Math.round(left * 10), stars: left > 10 ? 3 : left > 5 ? 2 : 1,
      title: 'Xong rồi!', msg: 'Mẫu ải hoàn thành.', rows: [['Thời gian còn lại', Math.round(left) + ' giây']]}); }
    else if(!done && left <= 0){ done = true; G.finish({win: false, title: 'Hết giờ!', msg: 'Thử lại nhé.', rows: [['Trúng', hits + '/' + NEED]]}); }
  }
  function pointerDown(x, y){
    for(const t of targets){
      if(Math.hypot(x - t.x, y - t.y) < t.r){
        t.t = 99; hits++; pops.push({x: t.x, y: t.y, t: 0}); Sound.sfx.catchOk(); return;
      }
    }
    Sound.sfx.miss();
  }
  function draw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ecdcb8'; ctx.fillRect(0, 0, W, H);
    for(const t of targets){
      ctx.fillStyle = '#c8352b'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * (1 - t.t / 3.2), 0, TAU); ctx.fill(); ctx.stroke();
    }
    for(const p of pops){
      ctx.globalAlpha = 1 - p.t / .8; ctx.fillStyle = '#0f7a43'; ctx.font = '700 ' + Math.round(22 * u) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('+1', p.x, p.y - 30 * p.t * u); ctx.globalAlpha = 1;
    }
  }
  return {enter, update, draw, resize, pointerDown};
})();

LR.level('ch1', {
  n: 3, id: 'thit-xien', title: 'Thịt xiên',     // <- sửa cho đúng ải
  status: 'ready', pad: false,                    // pad: true nếu cần phím điều hướng ảo
  desc: 'Mô tả ngắn hiện trong album và màn giới thiệu.',
  rules: ['<b>Chạm</b> vào mục tiêu đỏ trước khi nó biến mất.', 'Trúng đủ 8 mục tiêu trong 20 giây.'],
  mod
});
})();
