-- =====================================================================
-- SCHEMA HỆ THỐNG LỊCH GÁC ĐỘI 3 — Supabase (PostgreSQL)
-- Chạy toàn bộ file này trong: Supabase Dashboard → SQL Editor → New query
-- An toàn chạy lại nhiều lần (idempotent: có IF NOT EXISTS / CREATE OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------
-- 1. BẢNG HỒ SƠ NGƯỜI DÙNG (liên kết với Supabase Auth)
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text,
  code        text,                       -- SQ01, CS01...
  role        text not null default 'soldier'
              check (role in ('commander', 'staff')),
  team_id     int,                        -- Tổ 1..4 (null với Chỉ huy)
  rank        text,                       -- cấp bậc hàm: T4..H1, B2
  position    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 2. BẢNG TRẠNG THÁI APP (document JSON — toàn bộ dữ liệu S hiện tại)
--    Chỉ có đúng 1 dòng id = 1. Mỗi lần lưu version + 1.
-- ---------------------------------------------------------------
create table if not exists public.app_state (
  id          int primary key default 1 check (id = 1),
  version     bigint not null default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

-- Dòng trạng thái duy nhất (nếu chưa có)
insert into public.app_state (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------
-- 3. NHẬT KÝ THAO TÁC (audit log — tự ghi bằng trigger)
-- ---------------------------------------------------------------
create table if not exists public.audit_log (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  actor         uuid references public.profiles(id),
  actor_name    text,
  action        text not null,            -- vd: app_state.update
  detail        jsonb,                    -- thông tin đi kèm (số ngày đổi, ai mượn...)
  prev_version  bigint,
  new_version   bigint
);

-- ---------------------------------------------------------------
-- 4. HÀM HỖ TRỢ & RLS (Row Level Security)
-- ---------------------------------------------------------------
create or replace function public.is_commander()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'commander' and p.active
  );
$$;

alter table public.profiles  enable row level security;
alter table public.app_state enable row level security;
alter table public.audit_log enable row level security;

-- profiles: ai đăng nhập cũng đọc được (để hiện tên, tổ, cấp bậc)
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

-- profiles: chỉ Chỉ huy được sửa hồ sơ
drop policy if exists "profiles_update_commander" on public.profiles;
create policy "profiles_update_commander" on public.profiles
  for update to authenticated using (public.is_commander());

-- app_state: ai đăng nhập cũng đọc lịch
drop policy if exists "app_state_select_all" on public.app_state;
create policy "app_state_select_all" on public.app_state
  for select to authenticated using (true);

-- app_state: KHÔNG cho update trực tiếp qua bảng (phải qua hàm update_app_state
-- để kiểm tra version chống ghi đè). Không tạo policy update → mọi update
-- trực tiếp từ client đều bị chặn.

-- audit_log: Chỉ huy đọc toàn bộ; người khác không đọc
drop policy if exists "audit_select_commander" on public.audit_log;
create policy "audit_select_commander" on public.audit_log
  for select to authenticated using (public.is_commander());

-- ---------------------------------------------------------------
-- 5. HÀM LƯU TRẠNG THÁI (optimistic locking)
--    Client gọi: select update_app_state(p_data := '{...}', p_version := 42)
--    Nếu version không khớp → lỗi CONFLICT (đã có máy khác lưu trước).
-- ---------------------------------------------------------------
create or replace function public.update_app_state(p_data jsonb, p_version bigint)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_new bigint;
begin
  if not public.is_commander() then
    raise exception 'FORBIDDEN: Chỉ Chỉ huy mới được lưu dữ liệu';
  end if;

  update public.app_state
     set data       = p_data,
         version    = version + 1,
         updated_at = now(),
         updated_by = auth.uid()
   where id = 1
     and version = p_version
  returning version into v_new;

  if not found then
    raise exception 'CONFLICT: Dữ liệu đã được máy khác lưu (version không khớp). Hãy nạp lại!';
  end if;

  return v_new;
end $$;

-- ---------------------------------------------------------------
-- 6. TRIGGER GHI AUDIT LOG TỰ ĐỘNG
-- ---------------------------------------------------------------
create or replace function public.audit_app_state_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name  text;
begin
  select p.username into v_name from public.profiles p where p.id = v_actor;
  insert into public.audit_log (actor, actor_name, action, detail, prev_version, new_version)
  values (
    v_actor,
    v_name,
    'app_state.update',
    jsonb_build_object(
      'days',            jsonb_array_length(coalesce(NEW.data -> 'days' -> 'keys', '[]'::jsonb)),
      'absenceEditCount', coalesce(jsonb_array_length(coalesce(NEW.data -> 'absenceEdits', '[]'::jsonb)), 0),
      'punishCount',      coalesce(jsonb_array_length(coalesce(NEW.data -> 'punishments', '[]'::jsonb)), 0),
      'swapCount',        coalesce(jsonb_array_length(coalesce(NEW.data -> 'swapRequests', '[]'::jsonb)), 0)
    ),
    OLD.version,
    NEW.version
  );
  return NEW;
end $$;

drop trigger if exists trg_audit_app_state on public.app_state;
create trigger trg_audit_app_state
  after update on public.app_state
  for each row execute function public.audit_app_state_change();

-- ---------------------------------------------------------------
-- 7. KÍCH HOẠT REALTIME (tab/máy khác tự nạp lại khi có người lưu)
--    (phần client đã có sẵn cơ chế storage event — Supabase Realtime
--     thêm vào sau nếu cần; hiện tại không bắt buộc)
-- ---------------------------------------------------------------
alter publication supabase_realtime add table public.app_state;

-- =====================================================================
-- XONG. Bước tiếp theo xem docs/BACKEND-SETUP.md
-- =====================================================================
