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
  url: "https://zhcailtiwjaiomayrmed.supabase.co",      // Project URL / API URL (không kèm /rest/v1/)
  anonKey: "sb_publishable_d_uHUEPWb6KCrgNqS-GWkw_JJOY5w1g", // anon/publishable key (an toàn để public)
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
      return { ok: true, data: cached.data, version: cached.version, fromCache: true, offline: true, savedAt: cached.savedAt };
    }
    return { ok: false, reason: String(e && e.message ? e.message : e) };
  }
}

// ===== 4. LƯU TRẠNG THÁI (chỉ Chỉ huy; có chống ghi đè theo version) =====
// Trả về { ok: true, version } hoặc { ok: false, conflict: true, reason }
// versionOverride (tùy chọn): dùng khi di trú lần đầu (biết chính xác version của dòng trống).
async function backendSaveState(stateObj, versionOverride) {
  const client = backendClient();
  if (!client) return { ok: false, reason: "disabled" };

  try {
    const { data, error } = await client.rpc("update_app_state", {
      p_data: stateObj,
      p_version: versionOverride != null ? versionOverride : _backendVersion,
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

  // Dòng trống có version = 1 (schema default) — truyền tường minh để RPC khớp
  const res = await backendSaveState(localS, row ? row.version : 1);
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
          // Bỏ qua nếu chính mình vừa lưu (hoặc đã có bản mới hơn trong bộ nhớ)
          if (nextVersion != null && nextVersion <= _backendVersion) return;
          if (typeof onChange === "function") onChange(nextVersion);
        })
      .subscribe();
    return ch;
  } catch (e) {
    console.warn("Realtime không khả dụng:", e);
    return null;
  }
}

/* =====================================================================
   10. KHỐI ĐỒNG BỘ — nối chế độ cloud vào vòng đời của app
   =====================================================================
   - loadStorage() → backendBootAndSync(): nạp dữ liệu mới nhất từ cloud,
     đè lên bản local (cloud là nguồn chính thức), rồi vẽ lại giao diện.
   - saveStorage() → backendQueueSave(): gộp (debounce ~1.2s) rồi đẩy lên
     cloud, tránh gọi API mỗi ký tự gõ.
   - Chỉ Chỉ huy được lưu (RLS chặn sẵn ở DB — bên này chỉ tránh call vô ích).
   ===================================================================== */

let _backendBooted = false;
let _backendSaveTimer = null;
let _backendSaving = false;
let _backendDirtyAfterSave = false;
// Cờ chặn lưu phản hồi: khi áp dữ liệu cloud về máy (applyStateFromParsed tự gọi
// saveStorage), KHÔNG được đẩy ngược lên cloud — tránh vòng lặp lưu vô hạn.
let _backendApplyingRemote = false;

// Được loadStorage() gọi (mỗi trang gọi loadStorage đúng 1 lần lúc mở)
function backendBootAndSync() {
  if (_backendBooted) return;
  _backendBooted = true;
  if (!backendEnabled()) return;

  backendLoadState().then(res => {
    if (res.ok) {
      if (res.offline) {
        backendShowBanner(
          "📴 Không kết nối được server — đang xem bản lịch lưu gần nhất (" +
          backendShortTime(res.savedAt) + "). Thay đổi tạm thời chỉ lưu tại máy này.",
          "warn"
        );
        return; // offline: không đè dữ liệu máy
      }
      // Cloud là nguồn chính thức: áp dữ liệu mới nhất rồi vẽ lại
      try {
        _backendApplyingRemote = true;
        applyStateFromParsed(res.data);
        if (typeof reloadFromStorage === "function") reloadFromStorage();
      } catch (e) {
        console.error("Lỗi áp dữ liệu cloud:", e);
      } finally {
        _backendApplyingRemote = false;
      }
    }
    // res.reason === "empty" → cloud trống: vẫn chạy dữ liệu cục bộ,
    // Chỉ huy đăng nhập lần đầu sẽ được hỏi di trú (xem index.html).
  });

  // Máy khác lưu → nạp lại sau 1 nhịp ngắn (gom nhiều sự kiện liên tiếp)
  backendSubscribeRealtime(() => {
    setTimeout(() => { backendApplyRemoteState(); }, 500);
  });
}

// Được saveStorage() gọi sau mỗi lần ghi localStorage
function backendQueueSave() {
  if (!backendEnabled()) return;
  if (_backendApplyingRemote) return; // đang áp dữ liệu cloud về máy — không đẩy ngược
  if (typeof getCurrentRole === "function" && getCurrentRole() !== "commander") return; // soldier không lưu cloud
  if (_backendSaveTimer) clearTimeout(_backendSaveTimer);
  _backendSaveTimer = setTimeout(backendFlushSave, 1200);
}

async function backendFlushSave() {
  _backendSaveTimer = null;
  if (_backendSaving) { _backendDirtyAfterSave = true; return; }
  _backendSaving = true;
  try {
    const res = await backendSaveState(S);
    if (!res.ok) {
      if (res.conflict) {
        backendShowBanner(
          "⚠️ Máy khác vừa lưu dữ liệu mới hơn. Đang nạp bản mới nhất — thay đổi vừa rồi của máy này chưa lên cloud, hãy kiểm tra lại rồi lưu thêm lần nữa.",
          "warn"
        );
        await backendApplyRemoteState();
      } else if (String(res.reason || "").indexOf("FORBIDDEN") >= 0) {
        backendShowBanner("⚠️ Tài khoản hiện tại không có quyền lưu dữ liệu lên cloud (chỉ Chỉ huy).", "warn");
      } else {
        backendShowBanner("⚠️ Không lưu được lên cloud: " + (res.reason || "lỗi mạng") + " — dữ liệu vẫn an toàn tại máy này.", "bad");
      }
    }
  } catch (e) {
    backendShowBanner("⚠️ Lỗi lưu cloud: " + e, "bad");
  } finally {
    _backendSaving = false;
    if (_backendDirtyAfterSave) {
      _backendDirtyAfterSave = false;
      backendQueueSave();
    }
  }
}

// Nạp bản mới nhất từ cloud → áp vào S → vẽ lại giao diện của trang hiện tại
async function backendApplyRemoteState() {
  const res = await backendLoadState();
  if (!res.ok) return;
  try {
    _backendApplyingRemote = true;
    applyStateFromParsed(res.data);
    if (typeof reloadFromStorage === "function") reloadFromStorage();
    else if (typeof refresh === "function") refresh();
  } catch (e) {
    console.error("Lỗi nạp dữ liệu từ cloud:", e);
  } finally {
    _backendApplyingRemote = false;
  }
}

// ===== 11. BANNER THÔNG BÁO (nổi ở đáy màn hình mọi trang) =====
function backendShowBanner(message, kind) {
  if (typeof document === "undefined") return;
  try {
    let el = document.getElementById("backendBanner");
    if (!el) {
      el = document.createElement("div");
      el.id = "backendBanner";
      el.style.cssText =
        "position:fixed;left:0;right:0;bottom:0;z-index:99998;padding:10px 16px;font-size:13.5px;" +
        "font-weight:600;color:#fff;box-shadow:0 -2px 8px rgba(0,0,0,.25);white-space:pre-line;";
      document.body.appendChild(el);
    }
    el.style.background = kind === "bad" ? "#b71c1c" : "#e65100";
    el.textContent = message;
    // Tự ẩn sau 12 giây với banner cảnh báo nhẹ
    if (kind !== "bad") {
      clearTimeout(el._hideTimer);
      el._hideTimer = setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 12000);
    }
  } catch (e) { /* trang chưa sẵn sàng DOM */ }
}

function backendShortTime(iso) {
  try { return new Date(iso).toLocaleTimeString("vi-VN"); } catch (e) { return "?"; }
}
