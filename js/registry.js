/* js/registry.js — Đăng ký chương & ải.
   - LR.defineChapter({...})        : khai báo chương (xem js/chapters.js)
   - LR.level('ch1', {n, id, ...})  : mỗi file ải gọi 1 lần để tự đăng ký vào chương.
   Thứ tự ải trong album theo `n` (không phụ thuộc thứ tự nạp file). */
(function(){
'use strict';
const LR = window.LR;
LR.chapters = [];
LR.chapterById = id => LR.chapters.find(c => c.id === id);
LR.levelById = (ch, id) => ch.levels.find(l => l.id === id);

LR.defineChapter = function(def){
  if(LR.chapterById(def.id)) throw new Error('Trùng id chương: ' + def.id);
  const ch = Object.assign({status: 'soon', desc: ''}, def, {levels: []});
  LR.chapters.push(ch);
  return ch;
};

LR.level = function(chId, def){
  const ch = LR.chapterById(chId);
  if(!ch) throw new Error('Chương không tồn tại: ' + chId + ' (ải ' + def.id + ')');
  if(ch.levels.some(l => l.id === def.id)) throw new Error('Trùng id ải: ' + def.id);
  if(ch.levels.some(l => l.n === def.n)) throw new Error('Trùng số thứ tự ải n=' + def.n + ' trong ' + chId);
  const lv = Object.assign({status: 'soon', desc: '', rules: []}, def);
  if(lv.status === 'ready'){
    const m = lv.mod;
    if(!m || typeof m.enter !== 'function' || typeof m.update !== 'function' || typeof m.draw !== 'function')
      throw new Error('Ải ' + def.id + ' cần mod có enter/update/draw');
  }
  ch.levels.push(lv);
  ch.levels.sort((a, b) => a.n - b.n);
  return lv;
};
})();
