# Chuyện Làm Rể — cấu trúc dự án

```
index.html                 vỏ trang + danh sách script
manifest.webmanifest, sw.js, icon-*.png   cài về màn hình chính (PWA)
supabase.sql               tạo bảng + hàm lưu cloud
css/style.css
js/
  config.js                cấu hình (khoá Supabase, link cộng đồng…)
  util.js                  hàm tiện ích (rnd, lerp, clamp…)
  registry.js              LR.defineChapter / LR.level
  store.js                 lưu local, mở khoá ải, gộp bản lưu
  cloud.js                 đồng bộ Supabase bằng mã lưu CHUOT-XXXX-XXXX
  sound.js                 âm thanh tổng hợp
  input.js                 bàn phím + pad ảo
  engine.js                canvas, vòng lặp, tạm dừng, kết thúc ải
  ui.js                    các màn hình menu
  chapters.js              danh sách chương
  levels/
    _template.js           mẫu ải mới (không nạp)
    ch1/01-gio.js … 13-don-dep.js   mỗi ải một file
  main.js                  khởi động + bắt lỗi (nạp sau cùng)
```

## Chương 1 — Làm rể
| Ải | File | Trạng thái |
|---|---|---|
| 1 Giò (đập ruồi, 3 mức độ) | 01-gio.js | chơi được |
| 2 Gà | 02-ga.js | chơi được |
| 3 Thịt xiên · 4 Xôi · 5 Canh măng · 6 Nộm · 7 Tôm · 8 Hoa quả · 9 Chuối nấu | 03–09 | đang phát triển |
| 10 Kiểm kê thực đơn · 11 Dọn mâm · 12 Chúc rượu · 13 Dọn dẹp | 10–13 | đang phát triển |

Ải mở khoá lần lượt: phải hoàn thành ải trước. Ải 1 phải thắng đủ 3 mức Dễ/Vừa/Khó.

## Thêm / làm một ải
1. Mở file ải giữ chỗ (vd. `js/levels/ch1/03-thit-xien.js`).
2. Copy nội dung `js/levels/_template.js` đè lên, sửa `n`, `id`, `title`, viết phần `mod`.
   `id` là khoá lưu tiến trình — đừng đổi sau khi phát hành (nếu buộc phải đổi, thêm `legacy: 'id-cũ'`).
3. Mở `index.html` là chơi được. API chi tiết ở đầu `_template.js`.

## Thêm chương mới
1. Thêm `LR.defineChapter({...})` trong `js/chapters.js` (đặt `status: 'ready'`).
2. Tạo `js/levels/ch4/…` (mỗi ải một file, gọi `LR.level('ch4', {...})`) và thêm các `<script>` vào `index.html`.
3. Thêm file mới vào `SHELL` trong `sw.js` và tăng số phiên bản `CACHE`.

## Chạy
Mở bằng một máy chủ tĩnh (ví dụ `npx serve` hoặc `python3 -m http.server`). Cloud và cài PWA cần địa chỉ https.
# lam-re
