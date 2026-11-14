# Bộ kiểm thử tự động (Node.js)

Chạy toàn bộ bằng cách mở terminal tại thư mục gốc dự án:

```bash
cd tests
node test-new-features.js     # 40 test  — tính năng mới (vắng mặt, đăng nhập, bảo mật...)
node test-improvements.js     # 49 test  — cải tiến nghiệp vụ (mượn quân, đổi ca, chấm công...)
node test-fair-schedule.js    # 13 test  — luật công bằng khi cắt lịch (mũ 1/mũ 2, xoay vọng)
node test-assign.js           # 30 test  — validate đổi ca / xung đột ca
node test-punishment.js       # 11 test  — kỷ luật phạt làm 7 ngày liên tục
```

Test chạy trực tiếp bằng `node`, không cần cài thêm thư viện (dùng `vm` để nạp
`js/config.js`, `js/storage.js`, `js/app.js` vào sandbox).

> Tổng hiện tại: **143 test / 0 fail**. Sau mỗi lần sửa code, chạy lại cả 5 file.

## Checklist kiểm thử thủ công trước khi phát hành

- [ ] Đăng nhập đúng/sai cả 2 vai trò (Chỉ huy / Chiến sĩ).
- [ ] Mở thẳng từng URL khi chưa đăng nhập → bị chuyển về `index.html`.
- [ ] Cắt lịch ngày, cắt 7 ngày, cắt cả tháng; kiểm tra không trùng ca, không xếp người vắng.
- [ ] Thêm người vắng dài ngày → lịch các ngày sau tự cập nhật; bấm Xác nhận mới được cắt lịch.
- [ ] Nhập người bị phạt 7 ngày → có mặt đủ 7 ngày, không bị đổi ra nghỉ; bỏ phạt → lịch tương lai tự cắt lại.
- [ ] Nhập X / 0.5 / P / CT / O / OV / H / NB ở bảng chấm công → không mất người khác.
- [ ] Sửa biên chế 4 Tổ → không trùng mã; thêm người mới có mã đúng thứ tự.
- [ ] Xóa/ngưng tài khoản → lịch sử không báo đỏ "sai chức danh".
- [ ] Gửi / duyệt / từ chối đổi ca → không tạo 2 ca liền giờ, không lẫn Tổ.
- [ ] Backup → xóa dữ liệu → khôi phục → dữ liệu khớp.
- [ ] In và xuất Excel/PDF ở trang Lịch gác và Chấm công (có Quốc hiệu, chữ ký).
- [ ] Mở 2 tab cùng sửa → tab kia tự nạp lại dữ liệu (storage event).
- [ ] Ngắt mạng → xuất Excel/PDF/Chart vẫn chạy (thư viện nằm trong `vendor/`).
