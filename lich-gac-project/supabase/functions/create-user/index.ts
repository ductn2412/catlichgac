// Edge Function: create-user
// Chỉ huy tạo tài khoản mới (Chỉ huy hoặc Chiến sĩ) trong Supabase Auth + hồ sơ.
// Deploy: supabase functions deploy create-user --no-verify-jwt=false
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Xác thực người gọi là Chỉ huy
    const authHeader = req.headers.get("Authorization")!;
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: me } = await caller.from("profiles").select("username, role, active").single();
    if (!me || me.role !== "commander" || !me.active) {
      return json({ error: "Chỉ Chỉ huy mới được tạo tài khoản" }, 403, cors);
    }

    const body = await req.json();
    const { username, password, fullName, code, role, teamId, rank, position } = body;
    if (!username || !password || password.length < 6) {
      return json({ error: "Thiếu username hoặc mật khẩu (tối thiểu 6 ký tự)" }, 400, cors);
    }

    // Email ảo theo quy ước: username@doi3.vn (Supabase Auth cần email)
    const email = `${String(username).toLowerCase()}@doi3.vn`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, fullName, code },
    });
    if (createErr) {
      return json({ error: humanizeAuthError(createErr.message) }, 400, cors);
    }

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: created.user.id,
      username: String(username).toLowerCase(),
      full_name: fullName || null,
      code: code || null,
      role: role === "commander" ? "commander" : "staff",
      team_id: teamId || null,
      rank: rank || null,
      position: position || null,
      active: true,
    });
    if (profileErr) {
      return json({ error: "Tạo tài khoản Auth xong nhưng lỗi ghi hồ sơ: " + profileErr.message }, 500, cors);
    }

    await admin.from("audit_log").insert({
      actor: (await admin.auth.getUser(authHeader.replace("Bearer ", ""))).data?.user?.id ?? null,
      actor_name: me.username,
      action: "user.create",
      detail: { username, role, code },
    });

    return json({ ok: true, userId: created.user.id }, 200, cors);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500, cors);
  }
});

function json(obj: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function humanizeAuthError(msg: string): string {
  if ((msg || "").toLowerCase().includes("already been registered")) {
    return "Tài khoản này đã tồn tại (username bị trùng)";
  }
  return msg;
}
