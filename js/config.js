/* js/config.js — Cấu hình chung. Sửa tại đây (hoặc khai báo window.GAME_CONFIG trước các script). */
window.LR = window.LR || {};
LR.CONFIG = Object.assign({
  GAME_NAME: 'Chuyện Làm Rể',
  CODE_PREFIX: 'CHUOT',
  SUPABASE_URL: 'https://uxivdpwnzggcmsmqfnqs.supabase.co',
  SUPABASE_KEY: '',          // <- dán "anon / publishable key" của dự án Supabase vào đây
  COMMUNITY_URL: '',         // <- liên kết nhóm cộng đồng (Zalo/Facebook/Discord…)
  SAVE_KEY: 'chuot-save-v1',
  CODE_KEY: 'chuot-code-v1'
}, window.GAME_CONFIG || {});
