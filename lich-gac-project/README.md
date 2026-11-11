# Hệ Thống Quản Lý & Lập Lịch Gác Quân Sự Tiêu Chuẩn

Ứng dụng web chạy trực tiếp trên trình duyệt đáp ứng toàn diện các tiêu chuẩn quản lý quân sự:
1. **Chống trùng lịch 2 ca liên tiếp**: Nếu nhân sự được xếp 2 ca liên tục liền nhau, hệ thống tự động báo đỏ và chặn không cho cắt lịch.
2. **Chống xếp lịch cho người nghỉ**: Nhân sự đang trong ngày nghỉ (phép, công tác, ốm tại nhà, ốm tại viện, học tập...) tuyệt đối không được xếp gác (báo đỏ & khóa nút cắt lịch).
3. **Mã số định danh quân nhân**: Hỗ trợ nhập tên kèm mã số (VD: `Nguyễn Văn A (SQ01)`), nhập thủ công hoặc import từ Excel/Word.
4. **Bổ sung Ốm tại viện**: Thêm danh mục `Ốm tại viện` vào phần ghi chú và chấm công (`OV`).
5. **Tính công bằng & Khoảng nghỉ**: Thuật toán ưu tiên chia đều số lượng ca đêm và ca ngày cuối tuần giữa các quân nhân, đảm bảo thời gian nghỉ ngơi hợp lý.
6. **Phân quyền bảo mật**: Chỉ định quyền `Chỉ huy / Trưởng ban` mới có quyền cắt lịch và chỉnh sửa; quyền `Nhân viên` chỉ được xem lịch.
7. **Chọn ngày xem lịch**: Trang hiển thị lịch có bộ chọn ngày linh hoạt để xem lại bất cứ ngày nào.
8. **Cảnh báo & mượn quân số tạm thời giữa các Tổ**: Khi một Tổ vắng quá số chiến sĩ cho phép (mặc định 3) hoặc một chiến sĩ làm liên tiếp quá số ngày cho phép (mặc định 5), hệ thống hiển thị cảnh báo và tự động mượn chiến sĩ từ Tổ khác (hoặc thay bằng người cùng Tổ đang nghỉ) để bảo đảm đủ 4 vọng gác. Ngưỡng và chế độ bật/tắt được cấu hình trong trang Quản lý lịch; người được mượn hiển thị viền cam kèm ghi chú lý do.
9. **Danh sách chỉ làm ca đêm**: Đồng chí đang học tập buổi sáng chỉ được xếp vào ca đêm **18:00 – 06:00** (gồm các khung 18–20, 20–22, 22–24, 00–02, 02–04, 04–06); các khung ban ngày 06:00 – 18:00 do người khác cùng Tổ đảm nhiệm.
