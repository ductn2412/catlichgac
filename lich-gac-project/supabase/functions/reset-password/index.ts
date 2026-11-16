// Edge Function: reset-password
// Chỉ huy đặt lại mật khẩu cho một tài khoản (theo username).
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
    const { data: me } = await caller.from("profiles").select("role, active").single();
    if (!me || me.role !== "commander" || !me.active) {
      return json({ error: "Chỉ Chỉ huy mới được đặt lại mật khẩu" }, 403, cors);
    }

    const { username, newPassword } = await req.json();
    if (!username || !newPassword || String(newPassword).length < 6) {
      return json({ error: "Thiếu username hoặc mật khẩu mới (tối thiểu 6 ký tự)" }, 400, cors);
    }

    const email = `${String(username).toLowerCase()}@doi3.vn`;
    const { data: found, error: findErr } = await admin.auth.admin.listUsers();
    if (findErr) return json({ error: findErr.message }, 500, cors);
    const user = found.users.find((u) => (u.email || "").toLowerCase() === email);
    if (!user) return json({ error: "Không tìm thấy tài khoản: " + username }, 404, cors);

    const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
    if (error) return json({ error: error.message }, 400, cors);

    await admin.from("audit_log").insert({
      actor: null,
      actor_name: me.username,
      action: "user.reset_password",
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
