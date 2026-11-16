// Edge Function: set-user-active
// Chỉ huy ngưng hoạt động / kích hoạt lại một tài khoản.
// Ngưng hoạt động: đổi password sang chuỗi ngẫu nhiên vô nghĩa (chặn đăng nhập)
// và đánh dấu profiles.active = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: me } = await caller.from("profiles").select("username, role, active").single();
    if (!me || me.role !== "commander" || !me.active) {
      return json({ error: "Chỉ Chỉ huy mới được thay đổi trạng thái tài khoản" }, 403, cors);
    }

    const { username, active } = await req.json();
    if (!username || typeof active !== "boolean") {
      return json({ error: "Thiếu username hoặc giá trị active (true/false)" }, 400, cors);
    }

    const email = `${String(username).toLowerCase()}@doi3.vn`;
    const { data: found } = await admin.auth.admin.listUsers();
    const user = found.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!user) return json({ error: "Không tìm thấy tài khoản: " + username }, 404, cors);

    // Đánh dấu hồ sơ + (khi ngưng) chặn đăng nhập bằng mật khẩu ngẫu nhiên
    const { error: profErr } = await admin.from("profiles").update({ active }).eq("id", user.id);
    if (profErr) return json({ error: profErr.message }, 500, cors);

    if (!active) {
      const random = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password: random });
      if (pwErr) return json({ error: pwErr.message }, 500, cors);
    }

    await admin.from("audit_log").insert({
      actor: null,
      actor_name: me.username,
      action: active ? "user.activate" : "user.deactivate",
      detail: { username },
    });

    return json({ ok: true }, 200, cors);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500, cors);
  }
});

function json(obj: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
