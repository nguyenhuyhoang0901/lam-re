/* js/store.js — Lưu tiến trình trong localStorage, mở khoá ải tuần tự, gộp bản lưu (dùng cho cloud). */
(function(){
'use strict';
const LR = window.LR;
const Store = (function(){
  let S = null, memOnly = false;
  function blank(){ return {v:1, chapters:{}, settings:{muted:false}, updatedAt:0}; }
  function mergeLevel(la, lb){
    la = la || {}; lb = lb || {};
    const o = {done: !!(la.done || lb.done), modes: {}, best: {}, times: {}};
    new Set([...Object.keys(la.modes || {}), ...Object.keys(lb.modes || {})])
      .forEach(k => o.modes[k] = !!((la.modes || {})[k] || (lb.modes || {})[k]));
    new Set([...Object.keys(la.best || {}), ...Object.keys(lb.best || {})])
      .forEach(k => o.best[k] = Math.max((la.best || {})[k] || 0, (lb.best || {})[k] || 0));
    new Set([...Object.keys(la.times || {}), ...Object.keys(lb.times || {})]).forEach(k => {
      const x = (la.times || {})[k], y = (lb.times || {})[k];
      o.times[k] = (x && y) ? Math.min(x, y) : (x || y);
    });
    return o;
  }
  function normalize(s){
    if(!s || typeof s !== 'object') s = blank();
    s.v = 1; s.chapters = s.chapters || {}; s.settings = s.settings || {};
    for(const ch of LR.chapters){
      const c = s.chapters[ch.id] = s.chapters[ch.id] || {levelsCompleted: 0, levels: {}};
      c.levels = c.levels || {};
      let n = 0, broken = false;
      for(const lv of ch.levels){
        if(lv.status !== 'ready'){ broken = true; continue; }
        // Ải từng đổi id (vd. fly -> gio): gộp tiến trình cũ vào id mới
        if(lv.legacy && c.levels[lv.legacy]) c.levels[lv.id] = mergeLevel(c.levels[lv.id], c.levels[lv.legacy]);
        const l = c.levels[lv.id] = c.levels[lv.id] || {done: false, modes: {}, best: {}};
        l.modes = l.modes || {}; l.best = l.best || {}; l.times = l.times || {};
        if(lv.modes){
          lv.modes.forEach(m => l.modes[m.id] = !!l.modes[m.id]);
          l.done = lv.modes.every(m => l.modes[m.id]);
        } else l.done = !!l.done;
        if(!broken && l.done) n++; else broken = true;
      }
      c.levelsCompleted = n;
    }
    return s;
  }
  function load(){
    let raw = null;
    try{ raw = JSON.parse(localStorage.getItem(LR.CONFIG.SAVE_KEY)); }catch(e){ memOnly = true; }
    S = normalize(raw);
    return S;
  }
  function persist(){
    S.updatedAt = Date.now();
    try{ localStorage.setItem(LR.CONFIG.SAVE_KEY, JSON.stringify(S)); }
    catch(e){ if(!memOnly){ memOnly = true; LR.UI.toast('Trình duyệt không cho lưu trong máy. Hãy dùng mã lưu để giữ tiến trình.'); } }
  }
  function save(){ S = normalize(S); persist(); LR.Cloud.schedule(); }
  const get = () => S;
  const levelState = (chId, lvId) => S.chapters[chId].levels[lvId];
  const completed = chId => S.chapters[chId].levelsCompleted;
  /*
  function isOpen(chId, idx){
    const lv = LR.chapterById(chId).levels[idx];
    if(!lv || lv.status !== 'ready') return false;
    if(LR.CONFIG.DEV_UNLOCK_ALL) return true;
    return idx === 0 || completed(chId) >= idx;
  }
  */
  function isOpen(chId, idx){
    return true;
  }

  function setBest(chId, lvId, modeId, score){
    const l = levelState(chId, lvId), k = modeId || 'default';
    if(score > (l.best[k] || 0)){ l.best[k] = score; save(); return true; }
    return false;
  }
  // Thời gian qua ải (ms) theo từng mức: chỉ giữ kỷ lục nhanh nhất
  function setBestTime(chId, lvId, modeId, ms){
    const l = levelState(chId, lvId), k = modeId || 'default', cur = l.times[k];
    if(!(ms > 0)) return false;
    if(!cur || ms < cur){ l.times[k] = Math.round(ms); save(); return true; }
    return false;
  }
  function markWin(chId, lvId, modeId){
    const ch = LR.chapterById(chId), lv = LR.levelById(ch, lvId), l = levelState(chId, lvId);
    const before = completed(chId);
    if(lv.modes && modeId) l.modes[modeId] = true; else l.done = true;
    save();
    const after = completed(chId), nxt = ch.levels[ch.levels.indexOf(lv) + 1];
    return {levelDone: levelState(chId, lvId).done, unlocked: (after > before && nxt && nxt.status === 'ready') ? nxt : null};
  }
  // Gộp 2 bản lưu: giữ phần tiến triển nhiều hơn; giữ cả dữ liệu của ải/chương mà bản này chưa có
  function merge(a, b){
    a = JSON.parse(JSON.stringify(a || blank())); b = JSON.parse(JSON.stringify(b || blank()));
    const out = blank();
    out.settings = Object.assign({}, b.settings, a.settings);
    out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
    new Set([...Object.keys(a.chapters || {}), ...Object.keys(b.chapters || {})]).forEach(cid => {
      const ca = (a.chapters || {})[cid] || {}, cb = (b.chapters || {})[cid] || {};
      const oc = out.chapters[cid] = {levelsCompleted: 0, levels: {}};
      new Set([...Object.keys(ca.levels || {}), ...Object.keys(cb.levels || {})])
        .forEach(id => oc.levels[id] = mergeLevel((ca.levels || {})[id], (cb.levels || {})[id]));
    });
    return normalize(out);
  }
  function replace(next){ S = normalize(next); persist(); }
  return {load, save, get, levelState, completed, isOpen, setBest, setBestTime, markWin, merge, replace};
})();
LR.Store = Store;
})();
