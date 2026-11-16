/* =====================================================================
   BACKEND LAYER — Supabase (PostgreSQL + Auth) cho Lịch Gác Đội 3
   =====================================================================
   Nguyên tắc hoạt động:
   - Nếu chưa cấu hình URL/key (BACKEND_CONFIG rỗng) → ứng dụng chạy
     CHẾ ĐỘ CỤC BỘ như cũ (localStorage), không ảnh hưởng gì.
   - Nếu đã cấu hình: đăng nhập qua Supabase Auth (tài khoản dạng
     `username` → email ảo `username@doi3.vn`), dữ liệu lịch nạp/lưu từ
     bảng `app_state` (1 dòng JSONB + version chống ghi đè).
   - Mỗi lần nạp thành công đều lưu 1 bản CACHE vào localStorage:
     mất mạng vẫn xem được lịch lần cuối tải (chế độ offline-read).
   ===================================================================== */

// ===== 1. CẤU HÌNH (điền sau khi tạo Supabase project — xem docs/BACKEND-SETUP.md) =====
const BACKEND_CONFIG = {
  url: "",      // vd: "https://abcdefghijk.supabase.co"
  anonKey: "",  // anon/public key (Settings → API → anon public)
};

// Email ảo dùng cho Supabase Auth (username của đồng chí vẫn như cũ)
const BACKEND_EMAIL_DOMAIN = "@doi3.vn";

// Key cache offline (khác với KEY của chế độ cũ)
const BACKEND_CACHE_KEY = "lich-gac-cloud-cache";

// Đối tượng client Supabase (được tạo lazy khi config sẵn)
let sb = null;
let _backendVersion = 0; // version của app_state đang giữ trong bộ nhớ

function backendEnabled() {
  return Boolean(BACKEND_CONFIG.url && BACKEND_CONFIG.anonKey && typeof supabase !== "undefined");
}

function backendClient() {
  if (!backendEnabled()) return null;
  if (!sb) {
    try {
      sb = supabase.createClient(BACKEND_CONFIG.url, BACKEND_CONFIG.anonKey);
    } catch (e) {
      console.error("Không tạo được Supabase client:", e);
      return null;
    }
  }
  return sb;
}

function toBackendEmail(username) {
  const u = String(username || "").trim().toLowerCase();
  return u.includes("@") ? u : u + BACKEND_EMAIL_DOMAIN;
}

// ===== 2. ĐĂNG NHẬP =====
// Trả về profile { role: "commander"|"staff", full_name, code, ... } hoặc throw Error.
async function backendSignIn(username, password) {
  const client = backendClient();
  if (!client) throw new Error("Chưa cấu hình backend");

  const email = toBackendEmail(username);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(backendHumanizeError(error.message));

  const { data: profile, error: profErr } = await client
    .from("profiles").select("*").eq("id", data.user.id).single();
  if (profErr || !profile) {
    await client.auth.signOut();
    throw new Error("Tài khoản chưa có hồ sơ trong hệ thống. Liên hệ Chỉ huy.");
  }
  if (!profile.active) {
    await client.auth.signOut();
    throw new Error("Tài khoản đã ngưng hoạt động.");
  }
  return profile;
}

async function backendSignOut() {
  const client = backendClient();
  if (client) {
    try { await client.auth.signOut(); } catch (e) { /* im lặng */ }
  }
}

function backendHumanizeError(msg) {
  const m = String(msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Sai tài khoản hoặc mật khẩu!";
  if (m.includes("email not confirmed")) return "Tài khoản chưa được kích hoạt. Liên hệ Chỉ huy.";
  if (m.includes("too many requests")) return "Đăng nhập quá nhiều lần, chờ vài phút rồi thử lại.";
  if (m.includes("failed to fetch") || m.includes("networkerror")) return "Không kết nối được server — kiểm tra mạng.";
  return msg;
}

// ===== 3. NẠP TRẠNG THÁI (S) TỪ CLOUD =====
// Trả về { ok, data (S object), version, fromCache }
async function backendLoadState() {
  const client = backendClient();
  if (!client) return { ok: false, reason: "disabled" };

  try {
    const { data, error } = await client
      .from("app_state").select("version, data").eq("id", 1).single();
    if (error) throw error;

    if (!data || !data.data || !data.data.days) {
      return { ok: false, reason: "empty", version: data ? data.version : 0 };
    }
    _backendVersion = data.version;
    backendWriteCache(data.data);
    return { ok: true, data: data.data, version: data.version, fromCache: false };
  } catch (e) {
    // Mất mạng / lỗi khác → dùng cache gần nhất
    const cached = backendReadCache();
    if (cached) {
      return { ok: true, data: cached.data, version: cached.version, fromCache: true, offline: true };
    }
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

// ===== 4. LƯU TRẠNG THÁI (chỉ Chỉ huy; có chống ghi đè theo version) =====
// Trả về { ok: true, version } hoặc { ok: false, conflict: true, reason }
async function backendSaveState(stateObj) {
  const client = backendClient();
  if (!client) return { ok: false, reason: "disabled" };

  try {
    const { data, error } = await client.rpc("update_app_state", {
      p_data: stateObj,
      p_version: _backendVersion,
    });
    if (error) {
      const conflict = String(error.message || "").indexOf("CONFLICT") >= 0;
      return { ok: false, conflict, reason: error.message };
    }
    _backendVersion = data;
    backendWriteCache(stateObj, data);
    return { ok: true, version: data };
  } catch (e) {
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

// ===== 5. CACHE OFFLINE (localStorage) =====
function backendWriteCache(stateObj, version) {
  try {
    localStorage.setItem(BACKEND_CACHE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      version: version != null ? version : _backendVersion,
      data: stateObj,
    }));
  } catch (e) { /* localStorage đầy — bỏ qua */ }
}

function backendReadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(BACKEND_CACHE_KEY) || "null");
    if (raw && raw.data && raw.data.days) return raw;
  } catch (e) {}
  return null;
}

// ===== 6. DI TRÚ: LẦN ĐẦU XỬ DỤNG CLOUD, UPLOAD DỮ LIỆU CỤC BỘ LÊN =====
// Chỉ Chỉ huy gọi. Nếu app_state đang trống → đẩy S hiện tại (từ localStorage cũ) lên cloud.
async function backendMigrateLocalState() {
  const client = backendClient();
  if (!client) return { ok: false, reason: "disabled" };

  const { data: row } = await client.from("app_state").select("version, data").eq("id", 1).single();
  if (row && row.data && row.data.days) {
    return { ok: false, reason: "cloud-đã-có-dữ-liệu" }; // cloud đã có lịch — không ghi đè
  }

  // Lấy dữ liệu cục bộ hiện có (chế độ cũ)
  let localS = null;
  try { localS = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!localS || !localS.days) {
    return { ok: false, reason: "local-không-có-dữ-liệu" };
  }

  const res = await backendSaveState(localS);
  return res;
}

// ===== 7. GỌI EDGE FUNCTIONS (quản lý tài khoản — chỉ Chỉ huy) =====
async function backendEdgeCall(fnName, body) {
  const client = backendClient();
  if (!client) return { ok: false, error: "Chưa cấu hình backend" };
  const { data: sess } = await client.auth.getSession();
  if (!sess || !sess.session) return { ok: false, error: "Chưa đăng nhập" };

  try {
    const res = await fetch(`${BACKEND_CONFIG.url}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sess.session.access_token}`,
        "apikey": BACKEND_CONFIG.anonKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, ...json } : { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

// ===== 8. XEM NHẬT KÝ THAO TÁC (audit log — chỉ Chỉ huy) =====
async function backendLoadAuditLog(limit = 100) {
  const client = backendClient();
  if (!client) return { ok: false, error: "Chưa cấu hình backend" };
  const { data, error } = await client
    .from("audit_log")
    .select("at, actor_name, action, detail, new_version")
    .order("at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: data || [] };
}

// ===== 9. ĐỒNG BỘ THỜI GIAN THỰC GIỮA CÁC MÁY (optional, qua Realtime) =====
// Khi máy khác lưu, máy này tự nạp lại (giống cơ chế storage event của chế độ cũ).
function backendSubscribeRealtime(onChange) {
  const client = backendClient();
  if (!client || typeof client.channel !== "function") return null;
  try {
    const ch = client
      .channel("app-state-changes")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "app_state" },
        (payload) => {
          const nextVersion = payload && payload.new ? payload.new.version : null;
          if (nextVersion && nextVersion === _backendVersion) return; // chính mình vừa lưu
          if (typeof onChange === "function") onChange(nextVersion);
        })
      .subscribe();
    return ch;
  } catch (e) {
    console.warn("Realtime không khả dụng:", e);
    return null;
  }
}
