/* js/ui.js — Màn hình: chọn chương, album ải, giới thiệu ải, kết quả, cloud, PWA. */
(function(){
'use strict';
const LR = window.LR;
const {$} = LR.util;
const UI = (function(){
  const pages = ['title','chapters','album','intro'];
  let curPage = 'title', albumCh = 'ch1', toastTimer = 0;

  function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
  function page(id){
    curPage = id;
    pages.forEach(p=> $(p).classList.toggle('on', p === id));
    const o = $(id); if(o) o.scrollTop = 0;
  }
  function modal(id, on){ $(id).classList.toggle('on', !!on); }
  function hideAll(){ pages.forEach(p=> $(p).classList.remove('on')); ['cloud','pause','end'].forEach(m=> modal(m, false)); }
  function toast(msg, ms){
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=> t.classList.remove('on'), ms || 2600);
  }

  /* ----- chương ----- */
  function renderChapters(){
    const grid = $('chGrid'); grid.innerHTML = '';
    LR.chapters.forEach(ch=>{
      const soon = ch.status !== 'ready';
      const total = ch.levels.length, done = soon ? 0 : LR.Store.completed(ch.id);
      const b = el('button', 'card tile' + (soon ? ' dis' : ''));
      b.innerHTML =
        '<div class="num">Chương ' + ch.num + '</div><h3></h3><p></p>' +
        '<div class="prog"><i style="width:' + (total ? Math.round(done/total*100) : 0) + '%"></i></div>' +
        '<div class="meta"><span>' + (soon ? 'Chưa có ải' : done + '/' + total + ' ải') + '</span><span class="tag ' + (soon ? 'soon' : (done >= total ? 'done' : '')) + '">' +
        (soon ? 'Đang phát triển' : (done >= total ? 'Đã hoàn thành' : 'Chơi')) + '</span></div>';
      b.querySelector('h3').textContent = ch.title;
      b.querySelector('p').textContent = ch.desc;
      b.addEventListener('click', ()=>{
        LR.Sound.sfx.click();
        if(soon) return toast('Chương ' + ch.num + ' đang được phát triển. Hẹn bạn sớm nhé!');
        openAlbum(ch.id);
      });
      grid.appendChild(b);
    });
  }

  /* ----- album ----- */
  function levelStatus(ch, lv, i){
    if(lv.status !== 'ready') return 'soon';
    if(!LR.Store.isOpen(ch.id, i)) return 'locked';
    return LR.Store.levelState(ch.id, lv.id).done ? 'done' : 'play';
  }
  const STATUS_TXT = {soon:'Đang phát triển', locked:'Chưa mở', play:'Chơi', done:'Đã hoàn thành'};
  function openAlbum(chId){
    albumCh = chId;
    const ch = LR.chapterById(chId);
    $('albumTitle').textContent = 'Chương ' + ch.num + ': ' + ch.title;
    const grid = $('lvGrid'); grid.innerHTML = '';
    ch.levels.forEach((lv, i)=>{
      const st = levelStatus(ch, lv, i), dis = (st === 'soon' || st === 'locked');
      const b = el('button', 'card tile' + (dis ? ' dis' : ''));
      b.innerHTML = '<div class="hd"><span class="badge">' + (i+1) + '</span><h3></h3></div><p></p>';
      b.querySelector('h3').textContent = lv.title;
      b.querySelector('p').textContent = st === 'locked' ? 'Hoàn thành ải trước để mở khoá.' : (st === 'soon' ? 'Sắp ra mắt.' : lv.desc);
      if(lv.modes && st !== 'soon'){
        const ls = LR.Store.levelState(ch.id, lv.id);
        const chips = el('div', 'chips');
        lv.modes.forEach(m=>{ const s = el('span', ls.modes[m.id] ? 'ok' : ''); s.textContent = (ls.modes[m.id] ? '✓ ' : '') + m.name; chips.appendChild(s); });
        b.appendChild(chips);
      }
      const meta = el('div', 'meta'); meta.innerHTML = '<span></span><span class="tag ' + st + '">' + STATUS_TXT[st] + '</span>';
      b.appendChild(meta);
      b.addEventListener('click', ()=>{
        LR.Sound.sfx.click();
        if(st === 'soon') return toast('Ải này đang được phát triển.');
        if(st === 'locked') return toast('Cần hoàn thành ải trước đó để mở ải này.');
        openIntro(ch.id, lv.id);
      });
      grid.appendChild(b);
    });
    page('album');
  }

  /* ----- giới thiệu ải + chọn mức ----- */
  function openIntro(chId, lvId){
    const ch = LR.chapterById(chId), lv = LR.levelById(ch, lvId), ls = LR.Store.levelState(chId, lvId);
    $('inTitle').textContent = lv.title;
    $('inDesc').textContent = lv.desc;
    $('inRules').innerHTML = lv.rules.map(r=> '<li>' + r + '</li>').join('');
    const ex = $('inExtra'); ex.innerHTML = '';
    if(lv.mod && lv.mod.legend) lv.mod.legend(ex);
    const opts = $('inOpts'); opts.innerHTML = '';
    if(lv.modes){
      lv.modes.forEach(m=>{
        const b = el('button', 'btn opt' + (ls.modes[m.id] ? '' : ' red'));
        const best = ls.best[m.id];
        b.innerHTML = '<span><span class="nm"></span><small></small></span><span class="r"></span>';
        b.querySelector('.nm').textContent = m.name;
        b.querySelector('small').textContent = m.sub;
        b.querySelector('.r').textContent = (ls.modes[m.id] ? '✓ Đã xong' : 'Chưa thắng') + (best ? ' · ' + best : '') + ((ls.times || {})[m.id] ? ' · ⏱ ' + LR.util.fmtTime(ls.times[m.id]) : '');
        b.addEventListener('click', ()=>{ LR.Sound.init(); LR.G.start(chId, lvId, m.id); });
        opts.appendChild(b);
      });
    } else {
      const b = el('button', 'btn red'); b.textContent = ls.done ? 'Chơi lại' : 'Bắt đầu';
      b.addEventListener('click', ()=>{ LR.Sound.init(); LR.G.start(chId, lvId, null); });
      opts.appendChild(b);
      const best = ls.best['default'];
      if(best) opts.appendChild(el('p', 'note center', 'Kỷ lục: ' + best));
    }
    page('intro');
  }

  /* ----- kết thúc ải ----- */
  function showEnd(res, info){
    const cur = LR.G.cur, ch = LR.chapterById(cur.chId), lv = LR.levelById(ch, cur.lvId), idx = ch.levels.indexOf(lv);
    $('endStars').textContent = res.stars != null ? '★'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : '';
    $('endStars').hidden = res.stars == null;
    $('endTitle').textContent = res.title;
    let msg = res.msg || '';
    if(info.prog && info.prog.unlocked) msg += ' Đã mở ải mới: ' + info.prog.unlocked.title + '!';
    $('endMsg').textContent = msg;
    const ls = LR.Store.levelState(cur.chId, cur.lvId), k = cur.modeId || 'default';
    const hasT = res.time != null, fmt = LR.util.fmtTime;
    $('endScore').textContent = res.score != null ? res.score : (hasT ? fmt(res.time) : '');
    let bt = '';
    if(res.score != null) bt = info.isNew ? 'Kỷ lục mới!' : 'Kỷ lục: ' + (ls.best[k] || 0);
    else if(hasT) bt = info.isNewTime ? 'Kỷ lục thời gian mới!' : 'Kỷ lục: ' + fmt((ls.times || {})[k] || res.time);
    $('endBest').textContent = bt;
    $('endStats').innerHTML = (res.rows || []).map(r=> '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('');

    const nextBtn = $('endNext'), retry = $('endRetry'), alb = $('endAlbum');
    let nextFn = null, nextLabel = '';
    if(res.win){
      const nm = lv.modes ? lv.modes.find(m=> !ls.modes[m.id]) : null;
      const nl = ch.levels[idx+1];
      if(nm){ nextLabel = 'Chơi mức ' + nm.name; nextFn = ()=>{ modal('end', false); LR.G.start(cur.chId, cur.lvId, nm.id); }; }
      else if(nl && nl.status === 'ready' && LR.Store.isOpen(ch.id, idx+1)){
        nextLabel = 'Ải tiếp theo: ' + nl.title; nextFn = ()=>{ modal('end', false); LR.G.stop(); openIntro(ch.id, nl.id); };
      }
    }
    if(nextFn){
      nextBtn.hidden = false; nextBtn.textContent = nextLabel; nextBtn.onclick = nextFn;
      retry.textContent = 'Chơi lại'; retry.className = 'btn';
    } else {
      nextBtn.hidden = true;
      retry.textContent = 'Chơi lại'; retry.className = 'btn red';
    }
    retry.onclick = ()=> LR.G.restart();
    alb.onclick = ()=> toAlbum();
    modal('end', true);
  }
  function toAlbum(){
    modal('end', false); modal('pause', false);
    LR.G.stop(); openAlbum(albumCh);
  }

  /* ----- cloud ----- */
  function cloudRefresh(){
    const has = !!LR.Cloud.code;
    $('cCodeBox').hidden = !has; $('cNone').hidden = has;
    $('cCode').textContent = LR.Cloud.code || '—';
    const m = $('cMsg');
    if(!LR.Cloud.configured()){ m.className = 'note err'; m.textContent = 'Chưa cấu hình khoá Supabase (SUPABASE_KEY trong mã nguồn). Tiến trình vẫn được lưu trong máy.'; }
    else { m.className = 'note'; m.textContent = LR.Cloud.lastMsg || (has ? 'Tiến trình tự đồng bộ sau mỗi lần hoàn thành ải.' : ''); }
  }
  async function cloudAct(fn, okMsg){
    const m = $('cMsg');
    m.className = 'note'; m.textContent = 'Đang xử lý…';
    ['cGen','cSync','cRestore'].forEach(i=> $(i).disabled = true);
    try{ await fn(); cloudRefresh(); renderChapters(); if(okMsg) toast(okMsg); }
    catch(e){ m.className = 'note err'; m.textContent = e && e.message && !/^(HTTP|NOKEY)/.test(e.message) && e.name !== 'AbortError' ? e.message : LR.Cloud.explain(e); }
    ['cGen','cSync','cRestore'].forEach(i=> $(i).disabled = false);
  }
  function bindCloud(){
    $('btnCloud').addEventListener('click', ()=>{ LR.Sound.sfx.click(); cloudRefresh(); modal('cloud', true); });
    $('cClose').addEventListener('click', ()=> modal('cloud', false));
    $('cGen').addEventListener('click', ()=> cloudAct(()=> LR.Cloud.create(), 'Đã tạo mã lưu'));
    $('cSync').addEventListener('click', ()=> cloudAct(()=> LR.Cloud.sync(), 'Đã đồng bộ'));
    $('cRestore').addEventListener('click', ()=> cloudAct(()=> LR.Cloud.restore($('cIn').value), 'Đã khôi phục tiến trình'));
    $('cCopy').addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(LR.Cloud.code); toast('Đã chép mã ' + LR.Cloud.code); }
      catch(e){ const r = document.createRange(); r.selectNodeContents($('cCode')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Hãy nhấn giữ để chép mã'); }
    });
  }

  /* ----- PWA ----- */
  let deferred = null;
  function bindInstall(){
    window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferred = e; });
    window.addEventListener('appinstalled', ()=>{ deferred = null; toast('Đã thêm game vào màn hình chính!'); });
    $('btnInstall').addEventListener('click', async ()=>{
      LR.Sound.sfx.click();
      const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
      if(standalone) return toast('Game đã được cài trên thiết bị này rồi.');
      if(deferred){ deferred.prompt(); try{ await deferred.userChoice; }catch(e){} deferred = null; return; }
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      toast(ios ? 'Trên iPhone/iPad: bấm nút Chia sẻ, rồi chọn “Thêm vào MH chính”.' : 'Mở menu trình duyệt (⋮) và chọn “Cài đặt ứng dụng” hoặc “Thêm vào màn hình chính”.', 5200);
    });
  }

  function bind(){
    $('btnStart').addEventListener('click', ()=>{ LR.Sound.init(); LR.Sound.sfx.click(); renderChapters(); page('chapters'); });
    $('albumBack').addEventListener('click', ()=>{ LR.Sound.sfx.click(); renderChapters(); page('chapters'); });
    $('introBack').addEventListener('click', ()=>{ LR.Sound.sfx.click(); openAlbum(albumCh); });
    $('btnCommunity').addEventListener('click', ()=>{
      LR.Sound.sfx.click();
      if(LR.CONFIG.COMMUNITY_URL) window.open(LR.CONFIG.COMMUNITY_URL, '_blank', 'noopener');
      else toast('Chưa có liên kết cộng đồng. Hãy điền COMMUNITY_URL trong mã nguồn.');
    });
    document.querySelectorAll('.soundBtn').forEach(b=> b.addEventListener('click', ()=>{
      LR.Sound.setMuted(!LR.Sound.isMuted());
      const S = LR.Store.get(); S.settings.muted = LR.Sound.isMuted(); LR.Store.save();
      if(!LR.Sound.isMuted()) LR.Sound.sfx.click();
    }));
    $('hudPause').addEventListener('click', ()=> LR.G.pause(true));
    $('hudBack').addEventListener('click', ()=> LR.G.pause(true));
    $('pResume').addEventListener('click', ()=> LR.G.pause(false));
    $('pRetry').addEventListener('click', ()=> LR.G.restart());
    $('pAlbum').addEventListener('click', ()=> toAlbum());
    bindCloud(); bindInstall();
    document.addEventListener('pointerdown', ()=> LR.Sound.init(), true);
  }
  return {bind, page, modal, hideAll, toast, showEnd, renderChapters, openAlbum, cloudRefresh};
})();
LR.UI = UI;
})();
