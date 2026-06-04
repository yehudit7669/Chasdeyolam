import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NEDARIM_BASE = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

function getNedarimCredentials() {
  return {
    MosadId: Deno.env.get("NEDARIM_MOSAD_ID") ?? "7010422",
    ApiPassword: Deno.env.get("NEDARIM_API_PASSWORD") ?? "mj227",
    ApiValid: Deno.env.get("NEDARIM_API_VALID") ?? "Rd8QEQCDEY",
  };
}

async function callNedarimDeleteKeva(kevaId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const c = getNedarimCredentials();
    const url = new URL(NEDARIM_BASE);
    url.searchParams.set("Action", "DeleteKeva");
    url.searchParams.set("MosadId", c.MosadId);
    url.searchParams.set("ApiPassword", c.ApiPassword);
    url.searchParams.set("ApiValid", c.ApiValid);
    url.searchParams.set("KevaId", kevaId);

    const res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed === "OK") return { success: true };
    return { success: false, error: trimmed || `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function makeUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handle(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = makeUserClient(authHeader);
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  const svc = makeServiceClient();

  // Verify caller is admin
  const { data: callerProfile } = await svc
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (callerProfile?.role !== "admin") return err("Forbidden – admins only", 403);

  const body: { userId: string } = await req.json();
  if (!body.userId) return err("userId is required", 400);
  const targetId = body.userId;

  // Prevent self-deletion
  if (targetId === user.id) return err("Cannot delete your own account", 400);

  // Find active/frozen subscriptions that have a keva_id (need Nedarim cancellation)
  const { data: activeSubs, error: subErr } = await svc
    .from("subscriptions")
    .select("id, status, keva_id, subscription_source")
    .eq("user_id", targetId)
    .in("status", ["active", "frozen"]);

  if (subErr) return err("Failed to query subscriptions: " + subErr.message, 500);

  // Cancel each active Nedarim subscription before deletion
  for (const sub of activeSubs ?? []) {
    if (sub.keva_id) {
      const result = await callNedarimDeleteKeva(sub.keva_id);
      if (!result.success) {
        return err(
          `ביטול מנוי בנדרים נכשל (KevaId: ${sub.keva_id}): ${result.error}. המשתמש לא נמחק.`,
          502
        );
      }
      // Mark subscription as canceled in DB
      await svc.from("subscriptions").update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        canceled_by: user.id,
        cancellation_reason: "user_deleted_by_admin",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);

      // Log the action
      await svc.from("subscription_actions").insert({
        subscription_id: sub.id,
        user_id: targetId,
        performed_by: user.id,
        action: "admin_deleted",
        old_status: sub.status,
        new_status: "canceled",
        nedarim_keva_id: sub.keva_id,
        success: true,
        notes: "Canceled as part of user deletion",
      }).catch(() => {/* non-critical */});
    } else {
      // No keva_id — just mark canceled in DB
      await svc.from("subscriptions").update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        canceled_by: user.id,
        cancellation_reason: "user_deleted_by_admin",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
    }
  }

  // Now run the full cascade delete via the DB function (runs as the authenticated caller)
  // We use the service client with rpc so it has full permissions
  const { error: deleteErr } = await svc.rpc("delete_user_cascade", {
    target_user_id: targetId,
  });

  if (deleteErr) {
    return err("מחיקת המשתמש נכשלה: " + deleteErr.message, 500);
  }

  return ok({ success: true, message: "המשתמש נמחק בהצלחה." });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") return err("Method not allowed", 405);
  try {
    return await handle(req);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[delete-user]", msg);
    return err(msg, 500);
  }
});
