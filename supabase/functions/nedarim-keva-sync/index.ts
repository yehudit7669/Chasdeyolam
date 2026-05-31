import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/*
  nedarim-keva-sync — Daily status sync job

  For every active/frozen subscription that has a keva_id, call GetKevaJson on Nedarim Plus
  to fetch the current standing order status and reconcile with the local DB.

  Nedarim status codes:
    1 = active
    2 = frozen/disabled
    3 = canceled/deleted

  Invoke via Supabase cron (pg_cron) or an external scheduler:
    POST /functions/v1/nedarim-keva-sync
    Authorization: Bearer <SERVICE_ROLE_KEY>
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getNedarimCredentials() {
  const MosadId = Deno.env.get("NEDARIM_MOSAD_ID");
  const ApiPassword = Deno.env.get("NEDARIM_API_PASSWORD");
  const ApiValid = Deno.env.get("NEDARIM_API_VALID");
  if (!MosadId || !ApiPassword || !ApiValid) {
    throw new Error("Missing Nedarim Plus credentials in environment");
  }
  return { MosadId, ApiPassword, ApiValid };
}

const NEDARIM_BASE = "https://www.matara.pro/nedarimplus/online";

async function getKevaJson(kevaId: string): Promise<Record<string, unknown>> {
  const creds = getNedarimCredentials();
  const url = new URL(`${NEDARIM_BASE}/GetKevaJson.aspx`);
  url.searchParams.set("MosadId", creds.MosadId);
  url.searchParams.set("ApiPassword", creds.ApiPassword);
  url.searchParams.set("ApiValid", creds.ApiValid);
  url.searchParams.set("KevaId", kevaId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// Map Nedarim status codes to local subscription status
function resolveLocalStatus(nedarimStatus: string): "active" | "frozen" | "canceled" | null {
  if (nedarimStatus === "1") return "active";
  if (nedarimStatus === "2") return "frozen";
  if (nedarimStatus === "3") return "canceled";
  return null;
}

async function runSync(): Promise<{ synced: number; errors: number; skipped: number }> {
  const svc = makeServiceClient();

  const { data: subs, error } = await svc
    .from("subscriptions")
    .select("id, user_id, status, keva_id, next_payment_date")
    .in("status", ["active", "frozen"])
    .not("keva_id", "is", null);

  if (error) throw new Error("Failed to fetch subscriptions: " + error.message);
  if (!subs || subs.length === 0) return { synced: 0, errors: 0, skipped: 0 };

  let synced = 0;
  let errors = 0;
  let skipped = 0;

  for (const sub of subs) {
    try {
      const kevaData = await getKevaJson(sub.keva_id as string);

      // Nedarim returns KevaStatus (or Status) in the response
      const nedarimStatusRaw =
        (kevaData["KevaStatus"] ?? kevaData["Status"] ?? "") as string;

      const nedarimNextDate =
        (kevaData["NextDate"] ?? kevaData["next_date"] ?? null) as string | null;

      const targetStatus = resolveLocalStatus(String(nedarimStatusRaw));

      if (!targetStatus) {
        console.log(`[nedarim-keva-sync] Unknown status ${nedarimStatusRaw} for sub ${sub.id} — skipping`);
        skipped++;
        continue;
      }

      const statusChanged = targetStatus !== sub.status;

      // Compute a future next_payment_date from Nedarim if provided
      let nextPaymentDate: string | null = sub.next_payment_date;
      if (nedarimNextDate) {
        const m = String(nedarimNextDate).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
          const candidate = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T00:00:00Z`);
          if (!isNaN(candidate.getTime()) && candidate > new Date()) {
            nextPaymentDate = candidate.toISOString();
          }
        }
      }

      const dateChanged = nextPaymentDate !== sub.next_payment_date;

      if (!statusChanged && !dateChanged) {
        skipped++;
        continue;
      }

      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (statusChanged) {
        updatePayload.status = targetStatus;
        if (targetStatus === "frozen") updatePayload.frozen_at = updatePayload.frozen_at ?? new Date().toISOString();
        if (targetStatus === "active") updatePayload.frozen_at = null;
        if (targetStatus === "canceled") updatePayload.canceled_at = new Date().toISOString();
      }
      if (dateChanged) updatePayload.next_payment_date = nextPaymentDate;

      await svc.from("subscriptions").update(updatePayload).eq("id", sub.id);

      if (statusChanged) {
        await svc.from("subscription_actions").insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          performed_by: null,
          action: targetStatus === "frozen" ? "admin_disabled" : targetStatus === "active" ? "admin_enabled" : "admin_deleted",
          old_status: sub.status,
          new_status: targetStatus,
          nedarim_keva_id: sub.keva_id,
          nedarim_response: kevaData,
          success: true,
          notes: "auto-sync via daily job",
        });
      }

      console.log(`[nedarim-keva-sync] sub ${sub.id}: ${sub.status} → ${targetStatus}`);
      synced++;
    } catch (err: unknown) {
      console.error(`[nedarim-keva-sync] Error processing sub ${sub.id}:`, err);
      errors++;
    }
  }

  return { synced, errors, skipped };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[nedarim-keva-sync] Starting daily sync...");
    const result = await runSync();
    console.log("[nedarim-keva-sync] Done:", result);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-keva-sync] Fatal error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
