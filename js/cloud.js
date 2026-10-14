/* js/cloud.js — Đồng bộ Supabase bằng mã lưu (REST + RPC). Cấu hình ở js/config.js, bảng ở supabase.sql */
(function(){
'use strict';
const LR = window.LR;
const Cloud = (function(){
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';           // 32 ký tự, bỏ I O 0 1
  const RE = new RegExp('^' + LR.CONFIG.CODE_PREFIX + '-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$');
  let code = '', timer = 0, busy = false, lastMsg = '';
  try{ code = localStorage.getItem(LR.CONFIG.CODE_KEY) || ''; }catch(e){}
  function configured(){ return !!(LR.CONFIG.SUPABASE_URL && LR.CONFIG.SUPABASE_KEY); }
  function genCode(){
    const a = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(a);
    let s = ''; for(let i=0;i<8;i++) s += ALPHABET[a[i] % 32];
    return LR.CONFIG.CODE_PREFIX + '-' + s.slice(0,4) + '-' + s.slice(4);
  }
  function normalizeCode(input){
    const t = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const p = LR.CONFIG.CODE_PREFIX;
    if(t.startsWith(p) && t.length === p.length + 8) return p + '-' + t.slice(p.length, p.length+4) + '-' + t.slice(p.length+4);
    return '';
  }
  async function rpc(name, body){
    if(!configured()) throw new Error('NOKEY');
    const ctl = new AbortController(), to = setTimeout(()=> ctl.abort(), 12000);
    try{
      const res = await fetch(LR.CONFIG.SUPABASE_URL + '/rest/v1/rpc/' + name, {
        method:'POST', signal: ctl.signal,
        headers:{'Content-Type':'application/json', apikey: LR.CONFIG.SUPABASE_KEY, Authorization:'Bearer ' + LR.CONFIG.SUPABASE_KEY},
        body: JSON.stringify(body)
      });
      if(!res.ok){ const t = await res.text().catch(()=> ''); const e = new Error('HTTP ' + res.status); e.detail = t; throw e; }
      if(res.status === 204) return null;
      const txt = await res.text();
      return txt ? JSON.parse(txt) : null;
    } finally { clearTimeout(to); }
  }
  function explain(e){
    if(e && e.message === 'NOKEY') return 'Chưa cấu hình khoá Supabase (SUPABASE_KEY) trong mã nguồn.';
    if(e && e.name === 'AbortError') return 'Kết nối quá chậm. Hãy thử lại.';
    if(e && /HTTP 404/.test(e.message)) return 'Chưa tạo hàm trên Supabase. Hãy chạy file supabase.sql.';
    if(e && /HTTP 40[13]/.test(e.message)) return 'Khoá Supabase không hợp lệ hoặc chưa cấp quyền.';
    return 'Không kết nối được cloud. Kiểm tra mạng rồi thử lại.';
  }
  const pushRaw = (c, data) => rpc('put_save', {p_code:c, p_data:data});
  const pullRaw = c => rpc('get_save', {p_code:c});
  function setCode(c){ code = c; try{ if(c) localStorage.setItem(LR.CONFIG.CODE_KEY, c); else localStorage.removeItem(LR.CONFIG.CODE_KEY); }catch(e){} }

  async function create(){
    for(let i=0;i<5;i++){
      const c = genCode();
      const existing = await pullRaw(c);
      if(existing == null){
        await pushRaw(c, LR.Store.get());
        setCode(c); lastMsg = 'Đã tạo mã và lưu lên cloud.';
        return c;
      }
    }
    throw new Error('Không tạo được mã duy nhất, hãy thử lại.');
  }
  async function sync(){
    if(!code) throw new Error('Chưa có mã lưu.');
    const remote = await pullRaw(code);
    const merged = remote ? LR.Store.merge(LR.Store.get(), remote) : LR.Store.get();
    LR.Store.replace(merged);
    await pushRaw(code, LR.Store.get());
    lastMsg = 'Đã đồng bộ lúc ' + new Date().toLocaleTimeString('vi-VN');
  }
  async function restore(input){
    const c = normalizeCode(input);
    if(!c) throw new Error('Mã không đúng dạng ' + LR.CONFIG.CODE_PREFIX + '-XXXX-XXXX.');
    const remote = await pullRaw(c);
    if(remote == null) throw new Error('Không tìm thấy mã này trên cloud.');
    LR.Store.replace(LR.Store.merge(LR.Store.get(), remote));
    setCode(c);
    await pushRaw(c, LR.Store.get()).catch(()=>{});
    lastMsg = 'Đã khôi phục tiến trình từ mã ' + c + '.';
  }
  function schedule(){
    if(!code || !configured()) return;
    clearTimeout(timer);
    timer = setTimeout(async ()=>{
      if(busy) return; busy = true;
      try{ await sync(); LR.UI.cloudRefresh(); }catch(e){ /* im lặng: sẽ thử lại lần lưu sau */ }
      busy = false;
    }, 1800);
  }
  return {configured, create, sync, restore, schedule, explain, normalizeCode, get code(){ return code; }, get lastMsg(){ return lastMsg; }};
})();
LR.Cloud = Cloud;
})();
