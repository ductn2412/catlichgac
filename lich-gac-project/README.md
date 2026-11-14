# Hệ Thống Quản Lý & Lập Lịch Gác Quân Sự Tiêu Chuẩn

Ứng dụng web chạy trực tiếp trên trình duyệt đáp ứng toàn diện các tiêu chuẩn quản lý quân sự:
1. **Chống trùng lịch 2 ca liên tiếp**: Nếu nhân sự được xếp 2 ca liên tục liền nhau, hệ thống tự động báo đỏ và chặn không cho cắt lịch.
2. **Chống xếp lịch cho người nghỉ**: Nhân sự đang trong ngày nghỉ (phép, công tác, ốm tại nhà, ốm tại viện, học tập...) tuyệt đối không được xếp gác (báo đỏ & khóa nút cắt lịch).
3. **Mã số định danh**: Hỗ trợ nhập tên kèm mã số (VD: `Nguyễn Văn A (SQ01)`), nhập thủ công hoặc import từ Excel/Word.
4. **Bổ sung Ốm tại viện**: Thêm danh mục `Ốm tại viện` vào phần ghi chú và chấm công (`OV`).
5. **Tính công bằng & Khoảng nghỉ**: Thuật toán ưu tiên chia đều số lượng ca đêm và ca ngày cuối tuần giữa các đồng chí, đảm bảo thời gian nghỉ ngơi hợp lý.
6. **Phân quyền bảo mật**: Chỉ định quyền `Chỉ huy / Trưởng ban` mới có quyền cắt lịch và chỉnh sửa; quyền `Nhân viên` chỉ được xem lịch.
7. **Chọn ngày xem lịch**: Trang hiển thị lịch có bộ chọn ngày linh hoạt để xem lại bất cứ ngày nào.
8. **Cảnh báo & mượn quân số tạm thời giữa các Tổ**: Khi một Tổ vắng quá số chiến sĩ cho phép (mặc định 3) hoặc một chiến sĩ làm liên tiếp quá số ngày cho phép (mặc định 5), hệ thống hiển thị cảnh báo và tự động mượn chiến sĩ từ Tổ khác (hoặc thay bằng người cùng Tổ đang nghỉ) để bảo đảm đủ 4 vọng gác. Ngưỡng và chế độ bật/tắt được cấu hình trong trang Quản lý lịch; người được mượn hiển thị viền cam kèm ghi chú lý do.
9. **Danh sách chỉ làm ca đêm**: Đồng chí đang học tập buổi sáng chỉ được xếp vào ca đêm **18:00 – 06:00** (gồm các khung 18–20, 20–22, 22–24, 00–02, 02–04, 04–06); các khung ban ngày 06:00 – 18:00 do người khác cùng Tổ đảm nhiệm.
10. **Xác nhận chỉnh sửa vắng mặt**: Sửa danh sách vắng mặt phải bấm **✅ Xác nhận** rồi mới được cắt lịch; danh sách vắng được giữ nguyên qua các lần cắt lịch và tự đồng bộ sang các ngày sau.
11. **Cấp bậc hàm**: Nhập cấp bậc (T4…H2, B2, H1) trong trang Quản lý tài khoản; hiển thị trong ô lịch, bảng đọc, Excel/PDF. Chiến sĩ **B2** được ưu tiên làm "mũ 2", **H1** được ưu tiên nghỉ trước.
12. **Kỷ luật phạt làm 7 ngày liên tục**: Nhập người bị phạt (có thể nhiều tên cùng lúc) trong Phần 2 — trong 7 ngày họ luôn được xếp gác, không bị đổi ra nghỉ, trừ khi đang vắng mặt.
13. **Cắt lịch ngày / tuần / tháng**: Nút "Cắt lịch cả tháng" cắt toàn bộ các ngày còn lại trong tháng hiện tại.
14. **Sổ trực & bàn giao ca gác**: Ghi nhận tình hình ca, súng/đạn bàn giao, người giao–nhận, sự cố (`ban-giao.html`).

---

## Cách chạy

Yêu cầu: trình duyệt hiện đại (Chrome/Edge). Không cần cài server.

**Khuyến nghị — chạy qua local server** (localStorage hoạt động ổn định, các trang dùng chung dữ liệu):

```bash
# Python
python -m http.server 8080
# hoặc Node
npx serve .
```

Mở `http://localhost:8080/index.html`.

**Lưu ý:** nếu mở trực tiếp file bằng `file://`, một số trình duyệt tách localStorage theo từng file — dữ liệu có thể không dùng chung giữa các trang. Hãy dùng cố định một địa chỉ/cổng để dữ liệu không bị "mất".

## Tài khoản mặc định

| Tài khoản | Mật khẩu | Quyền |
|---|---|---|
| `chihuy` | `doi3` | Chỉ huy (toàn quyền) |
| `truongban` | `doi3` | Trưởng ban (toàn quyền) |

> ⚠️ **Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.** Chiến sĩ đăng nhập bằng `Họ tên (Mã số)` do Chỉ huy cấp trong trang Quản lý tài khoản.

## Dữ liệu & sao lưu

- Dữ liệu lưu trong **localStorage** của trình duyệt (key `lich-gac-v12`), không có server.
- **Sao lưu:** Quản lý lịch → nút "Sao lưu dữ liệu (.json)". File backup chứa **mã băm (hash)** của mật khẩu, không chứa mật khẩu nguyên văn — giữ file này ở nơi an toàn.
- **Khôi phục:** chỉ Chỉ huy được phép; hệ thống tự tạo bản sao lưu trước khi ghi đè.
- Hệ thống tự lưu tối đa 10 snapshot gần nhất trước các thao tác quan trọng (cắt lịch, khôi phục, sửa biên chế).

## Cấu trúc thư mục

```
lich-gac-project/
├── index.html              # Đăng nhập
├── quan-ly-lich.html       # Quản lý lập lịch (trang chính, Phần 1 + Phần 2)
├── lich-gac.html           # Xem lịch (chỉ đọc)
├── cham-cong.html          # Bảng chấm công tháng
├── so-truc.html            # Đăng ký & duyệt đổi ca
├── ban-giao.html           # Sổ bàn giao trực ban
├── tim-kiem.html           # Tra cứu chiến sĩ & ca gác
├── dashboard.html          # Dashboard thống kê
├── quan-ly-tai-khoan.html  # Quản lý hồ sơ / tài khoản
├── js/                     # config, storage, app, export, dashboard
├── css/style.css
├── vendor/                 # Thư viện offline (xlsx, mammoth, html2pdf, chart.js)
└── tests/                  # Bộ test tự động (xem tests/README.md)
```

## Kiểm thử

```bash
cd tests
node test-new-features.js && node test-improvements.js && node test-fair-schedule.js && node test-assign.js && node test-punishment.js
```

Xem checklist kiểm thử thủ công trong `tests/README.md`.
