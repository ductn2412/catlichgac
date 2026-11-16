# 🚀 HƯỚNG DẪN LÊN BACKEND (Supabase) + DEPLOY (Vercel) — Bản miễn phí 100%

Mục tiêu: hệ thống lịch gác dùng được **nhiều máy / ngoài khuôn viên** qua internet,
dữ liệu thật nằm trên PostgreSQL, đăng nhập thật (bcrypt trong Supabase Auth),
mọi thao tác lưu đều ghi **nhật ký (audit log)** tự động.

Kiến trúc:

```
Trình duyệt (9 trang HTML giữ nguyên giao diện)
   │  gọi thẳng qua HTTPS
   ▼
Supabase  ── Auth (đăng nhập) · PostgreSQL (app_state 1 dòng JSONB)
          ── RLS (quyền tại DB) · Edge Functions (quản lý tài khoản)
   ▲
Vercel — host file HTML/JS/CSS (static), không cần server tự quản
```

---

## BƯỚC 1 — Tạo Supabase project (~5 phút)

1. Mở **https://supabase.com** → `Start your free project` → đăng ký bằng email.
2. `New project`:
   - **Name:** `lich-gac-doi3`
   - **Database Password:** tự đặt (lưu lại, ít dùng)
   - **Region:** `Singapore (ap-southeast-1)` — gần Việt Nam nhất
3. Chờ ~2 phút project khởi tạo xong.

## BƯỚC 2 — Chạy schema SQL (~1 phút)

1. Trong Supabase Dashboard → menu **SQL Editor** → `New query`.
2. Mở file `supabase/schema.sql` trong repo này, **copy toàn bộ** dán vào → `Run`.
3. Kết quả phải báo `Success. No rows returned` (chạy lại lần nữa cũng an toàn).

## BƯỚC 3 — Lấy 2 chuỗi key (đưa cho dev hoặc tự điền)

Dashboard → **Settings → API**:
- `Project URL` → dạng `https://xxxx.supabase.co`
- `anon public` key → chuỗi dài bắt đầu `eyJ...`

⚠️ **Chỉ lấy key `anon`** — tuyệt đối không dùng `service_role` key trong frontend.

## BƯỚC 4 — Tạo tài khoản Chỉ huy đầu tiên (~2 phút)

Dashboard → **Authentication → Users → Add user → Create new user**:
- **Email:** `chihuy@doi3.vn`
- **Password:** mật khẩu Chỉ huy thật (≥ 6 ký tự)
- ✅ Auto Confirm User

Sau đó **SQL Editor**, chạy:

```sql
insert into public.profiles (id, username, full_name, role)
select id, 'chihuy', 'Chỉ huy Đội 3', 'commander'
from auth.users where email = 'chihuy@doi3.vn';
```

Tạo thêm `truongban@doi3.vn` tương tự (role `commander`).

## BƯỚC 5 — Điền key vào code

Mở `js/backend.js`, điền vào `BACKEND_CONFIG`:

```js
const BACKEND_CONFIG = {
  url: "https://xxxx.supabase.co",
  anonKey: "eyJ...",
};
```

**Lần đầu đăng nhập Chỉ huy sau khi điền key:** hệ thống tự hỏi di trú toàn bộ
dữ liệu lịch cục bộ (localStorage cũ) lên cloud — bấm OK là xong.

## BƯỚC 6 — Deploy Edge Functions (quản lý tài khoản) (~10 phút)

Cần tạo/quản lý tài khoản chiến sĩ từ trang web → chạy 1 lần:

```bash
# cài Supabase CLI (Windows)
npm install -g supabase
# hoặc: winget install Supabase.CLI

# trong thư mục lich-gac-project/
supabase login                      # mở trình duyệt đăng nhập
supabase link --project-ref XXXX    # XXXX = phần giữa của Project URL
supabase functions deploy create-user
supabase functions deploy reset-password
supabase functions deploy set-user-active
```

## BƯỚC 7 — Deploy lên Vercel (~5 phút)

1. Code đã ở GitHub (`github.com/ductn2412/catlichgac`).
2. Vào **https://vercel.com** → đăng nhập bằng GitHub.
3. `Add New → Project` → chọn repo `catlichgac` → Deploy.
   - Framework Preset: **Other** (site tĩnh)
   - Root Directory: `lich-gac-project`
4. Vercel cung cấp địa chỉ dạng `https://catlichgac.vercel.app` — chia sẻ cho cả đội.

Mỗi lần `git push` lên `main` là Vercel **tự động deploy** bản mới.

---

## Chế độ hoạt động

| Tình huống | Hành vi |
|---|---|
| Đã điền key + có mạng | Dùng cloud: dữ liệu chung mọi máy, phiên hết hạn tự đăng nhập lại |
| Chưa điền key | Chạy cục bộ như cũ (localStorage) — code cũ giữ nguyên |
| Mất mạng | Vẫn **xem** được lịch (bản cache gần nhất), không lưu được |
| 2 máy cùng sửa | Máy lưu sau bị chặn (version conflict) → nạp lại rồi lưu tiếp |

## Bảo mật — chạy nhờ Supabase RLS

- Chiến sĩ đăng nhập chỉ **đọc** được lịch (RLS chặn update từ DB).
- Lưu dữ liệu phải qua hàm `update_app_state`: chỉ role `commander`, và chỉ khi
  version khớp → không máy nào ghi đè mất dữ liệu của máy khác.
- **Audit log**: mỗi lần lưu ghi tự động ai/lúc nào/version bao nhiêu (bảng
  `audit_log`, Chỉ huy xem được, có thể hiện lên Dashboard sau).
- Mật khẩu do Supabase Auth hash (bcrypt nội bộ) — không ai nhìn thấy.

## Những việc còn lại trong lộ trình backend

- [ ] Nối `saveStorage()` (js/storage.js) → gọi `backendSaveState()` khi đang ở chế độ cloud.
- [ ] Trang Quản lý tài khoản → tạo/đặt lại mật khẩu/ngưng hoạt động qua Edge Functions.
- [ ] Xem audit log trên Dashboard (nút "Nhật ký hệ thống").
- [ ] Hướng dẫn từng đồng chí tạo mật khẩu riêng lần đầu đăng nhập.
