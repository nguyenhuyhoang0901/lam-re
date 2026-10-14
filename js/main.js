/* js/main.js — Bắt lỗi toàn cục và khởi động game (chạy sau cùng). */
(function(){
'use strict';
const LR = window.LR;
const {$} = LR.util;
let errShown = false;
function showErr(msg){
  if(errShown) return; errShown = true;
  $('errMsg').textContent = msg || 'Game gặp trục trặc. Hãy thử tải lại trang.';
  $('err').hidden = false;
}
$('errReload').addEventListener('click', ()=> location.reload());
window.addEventListener('error', e=>{
  if(e && e.target && e.target !== window && (e.target.tagName === 'LINK' || e.target.tagName === 'IMG')) return; // lỗi tải font/ảnh: bỏ qua
  console.error(e.error || e.message); showErr('Game gặp trục trặc. Hãy thử tải lại trang.');
}, true);
window.addEventListener('unhandledrejection', e=>{ console.error(e.reason); showErr('Có lỗi khi xử lý dữ liệu. Hãy thử tải lại trang.'); });

(async function boot(){
  const bar = $('bar'), txt = $('ltxt');
  const prog = (p, t)=>{ bar.style.width = p + '%'; if(t) txt.textContent = t; };
  const wait = ms => new Promise(r=> setTimeout(r, ms));
  try{
    if(window.__LR_ERR && window.__LR_ERR.length) throw new Error('load: ' + window.__LR_ERR.join(', '));
    prog(15, 'Đọc tiến trình…');
    LR.Store.load();
    LR.Sound.setMuted(!!LR.Store.get().settings.muted);
    prog(40, 'Tải phông chữ…');
    await Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), wait(2500)]);
    prog(75, 'Dựng giao diện…');
    LR.UI.bind(); LR.UI.renderChapters();
    if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
    prog(100, 'Sẵn sàng!');
    await wait(700);
    LR.UI.page('title');
    $('loading').classList.add('off');
  }catch(e){
    console.error(e);
    showErr(String(e && e.message).startsWith('load:') ? 'Thiếu hoặc lỗi tệp trò chơi (' + String(e.message).slice(6) + '). Kiểm tra lại thư mục js/.' : 'Không tải được game. Hãy thử tải lại trang.');
    $('loading').classList.add('off');
    LR.UI.page('title');
  }
})();
})();
