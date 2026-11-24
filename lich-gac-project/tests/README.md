# Bộ kiểm thử tự động (Node.js)

Chạy toàn bộ bằng cách mở terminal tại thư mục gốc dự án:

```bash
cd tests
node test-new-features.js     # 50 test  — tính năng mới (vắng mặt, hạn phép dài ngày, đăng nhập, bảo mật...)
node test-improvements.js     # 52 test  — cải tiến nghiệp vụ (mượn quân, đổi ca, chấm công, sĩ quan thay chiến sĩ...)
node test-fair-schedule.js    # 17 test  — luật công bằng khi cắt lịch (mũ 1/mũ 2, xoay vọng, ưu tiên H1/B2)
node test-assign.js           # 33 test  — validate đổi ca / xung đột ca / giao nhiệm vụ
node test-punishment.js       # 11 test  — kỷ luật phạt làm 7 ngày liên tục
node test-streak.js           # 27 test  — quy tắc "số mũ" theo từng ngày (3 khung = 1, 1 đêm = 0,5, 2 ngày: CS 0,25 / SQ +0,5)
```

Test chạy trực tiếp bằng `node`, không cần cài thêm thư viện (dùng `vm` để nạp
`js/config.js`, `js/storage.js`, `js/app.js` vào sandbox).

> Tổng hiện tại: **190 test / 0 fail**. Sau mỗi lần sửa code, chạy lại cả 6 file.

## Checklist kiểm thử thủ công trước khi phát hành

- [ ] Đăng nhập đúng/sai cả 2 vai trò (Chỉ huy / Chiến sĩ).
- [ ] Mở thẳng từng URL khi chưa đăng nhập → bị chuyển về `index.html`.
- [ ] Cắt lịch ngày, cắt 7 ngày, cắt cả tháng; kiểm tra không trùng ca, không xếp người vắng.
- [ ] Thêm người vắng dài ngày → lịch các ngày sau tự cập nhật; bấm Xác nhận mới được cắt lịch.
- [ ] Nhập người bị phạt 7 ngày → có mặt đủ 7 ngày, không bị đổi ra nghỉ; bỏ phạt → lịch tương lai tự cắt lại.
- [ ] Nhập X / 0.5 / P / CT / O / OV / H / NB ở bảng chấm công → không mất người khác.
- [ ] Sửa biên chế 4 Tổ → không trùng mã; thêm người mới có mã đúng thứ tự.
- [ ] Xóa/ngưng tài khoản → lịch sử không báo đỏ "sai chức danh".
- [ ] Sửa tay/giao nhiệm vụ cho Sĩ quan vào vị trí Vọng gác của Chiến sĩ → chỉ cảnh báo vàng "Sĩ quan đi làm thay", không báo đỏ; Chiến sĩ vào cột Đốc gác vẫn báo đỏ.
- [ ] Gửi / duyệt / từ chối đổi ca → không tạo 2 ca liền giờ, không lẫn Tổ.
- [ ] Backup → xóa dữ liệu → khôi phục → dữ liệu khớp.
- [ ] In và xuất Excel/PDF ở trang Lịch gác và Chấm công (có Quốc hiệu, chữ ký).
- [ ] Số mũ trên lịch: đủ 3 khung = 1 → hôm sau 2 → 3; 1 ca đêm = 0,5 → hôm sau 1,5; 2 ca ngày của chiến sĩ hiển thị 0,25 và hôm sau về 1; 2 ca ngày của sĩ quan cộng dồn (1 → 1,5 → 2 → 3); 1 khung ngày không hiện mũ; sửa tay được số lẻ và PDF hiển thị đúng.
- [ ] Cắt lịch: khi các chiến sĩ cùng "số mũ", H1 nghỉ trước B2; người chưa cập nhật cấp bậc xếp giữa B2 và H1.
- [ ] Mở 2 tab cùng sửa → tab kia tự nạp lại dữ liệu (storage event).
- [ ] Ngắt mạng → xuất Excel/PDF/Chart vẫn chạy (thư viện nằm trong `vendor/`).
