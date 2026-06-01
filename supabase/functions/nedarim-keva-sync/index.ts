import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/*
  nedarim-keva-sync — Daily sync job

  For every active/frozen subscription with a keva_id:
    1. Calls GetKevaId on Nedarim Plus (correct base URL: Manage3.aspx?Action=GetKevaId)
    2. Syncs status (KevaStatus: "1"=active, "0"=frozen)
    3. Syncs next payment date (KevaNextDate: "DD/MM/YY")
    4. Upserts HistoryData into nedarim_payment_history
    5. Recalculates successful_payments_count and is_eligible

  Invoke via Supabase cron (pg_cron) or an external scheduler:
    POST /functions/v1/nedarim-keva-sync
    Authorization: Bearer <SERVICE_ROLE_KEY>
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NEDARIM_BASE = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

function getCredentials() {
  return {
    MosadId: Deno.env.get("NEDARIM_MOSAD_ID") ?? "7010422",
    ApiPassword: Deno.env.get("NEDARIM_API_PASSWORD") ?? "mj227",
    ApiValid: Deno.env.get("NEDARIM_API_VALID") ?? "Rd8QEQCDEY",
  };
}

function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function callNedarim(action: string, extra: Record<string, string> = {}): Promise<unknown> {
  const c = getCredentials();
  const url = new URL(NEDARIM_BASE);
  url.searchParams.set("Action", action);
  url.searchParams.set("MosadId", c.MosadId);
  url.searchParams.set("ApiPassword", c.ApiPassword);
  url.searchParams.set("ApiValid", c.ApiValid);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function parseDdMmYy(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) {
    const year = parseInt(m2[3]) + 2000;
    return `${year}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) return `${m4[3]}-${m4[2].padStart(2, "0")}-${m4[1].padStart(2, "0")}`;
  return null;
}

function classifyCharge(name: string): "success" | "failed" | "canceled" {
  if (!name || name.trim() === "") return "success";
  const n = name.trim();
  if (n.includes("סירוב") || n.includes("נדחה") || n.includes("שגיאה") || n.includes("כשל")) return "failed";
  if (n.includes("ביטול") || n.includes("בוטל") || n.includes("מחיקה")) return "canceled";
  if (n.includes("חיוב") || n.includes("תשלום") || n.includes("הצלחה")) return "success";
  return "failed";
}

async function getRequiredPayments(
  planId: string,
  svc: ReturnType<typeof makeServiceClient>
): Promise<number> {
  const { data } = await svc.from("plans").select("required_successful_payments").eq("id", planId).maybeSingle();
  return data?.required_successful_payments ?? 15;
}

// Normalise a DB timestamptz or JS ISO string to a plain YYYY-MM-DD date string
// so we can compare "same calendar day" without false-positives from timezone
// formatting differences (e.g. "2026-07-01 00:00:00+00" vs "2026-07-01T00:00:00.000Z").
function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

async function syncSubscription(
  sub: { id: string; user_id: string; status: string; keva_id: string; plan_id: string; next_payment_date: string | null },
  svc: ReturnType<typeof makeServiceClient>
): Promise<{ result: "synced" | "unchanged" | "error"; reason: string }> {
  const tag = `[sync] sub ${sub.id} keva ${sub.keva_id}`;
  try {
    const resp = await callNedarim("GetKevaId", { KevaId: sub.keva_id });
    if (typeof resp !== "object" || !resp || !("KevaId" in (resp as object))) {
      const reason = `unexpected GetKevaId response: ${JSON.stringify(resp)}`;
      console.warn(`${tag}: ERROR — ${reason}`);
      return { result: "error", reason };
    }
    const data = resp as Record<string, unknown>;

    // --- Status ---
    const kevaStatus = String(data["KevaStatus"] ?? "1");
    // KevaStatus: "1" = active, "2" or "0" = frozen, "3" = canceled
    const nedarimStatus: "active" | "frozen" | "canceled" =
      kevaStatus === "1" ? "active" : kevaStatus === "3" ? "canceled" : "frozen";
    const statusChanged =
      nedarimStatus !== sub.status && (sub.status === "active" || sub.status === "frozen");

    // --- Next payment date ---
    // Compare only the calendar date (YYYY-MM-DD) to avoid false-positives from
    // timezone formatting differences between DB timestamptz and JS ISO strings.
    const nextDateIso = parseDdMmYy(data["KevaNextDate"]);
    let nextPaymentDate: string | null = sub.next_payment_date;
    if (nextDateIso) {
      const candidate = new Date(nextDateIso + "T00:00:00Z");
      if (!isNaN(candidate.getTime()) && candidate > new Date()) {
        nextPaymentDate = candidate.toISOString();
      }
    }
    const dateChanged = toDateOnly(nextPaymentDate) !== toDateOnly(sub.next_payment_date);

    // --- Payment history ---
    const historyRaw = data["HistoryData"];
    const records = Array.isArray(historyRaw) ? historyRaw as Record<string, unknown>[] : [];
    for (const rec of records) {
      const chargeDate = parseDdMmYy(rec["Date"]);
      if (!chargeDate) continue;
      const name = String(rec["Name"] ?? "");
      const status = classifyCharge(name);
      try {
        await svc.from("nedarim_payment_history").upsert(
          {
            subscription_id: sub.id,
            keva_id: sub.keva_id,
            charge_date: chargeDate,
            amount: rec["Amount"] && String(rec["Amount"]).trim() !== "" ? Number(rec["Amount"]) : null,
            status,
            transaction_id: String(rec["TransactionId"] ?? "").trim() || null,
            raw_data: { id: rec["ID"], description: name, last_num: rec["LastNum"] },
            synced_at: new Date().toISOString(),
          },
          { onConflict: "subscription_id,charge_date,status", ignoreDuplicates: false }
        );
      } catch (e) {
        console.warn(`${tag}: history upsert warning:`, e);
      }
    }

    // --- Recalculate eligibility ---
    const successCount = records.filter((r) => classifyCharge(String(r["Name"] ?? "")) === "success").length;
    const required = await getRequiredPayments(sub.plan_id, svc);
    const nowEligible = successCount >= required;

    // --- Build update payload ---
    const updates: Record<string, unknown> = {
      nedarim_raw_status: kevaStatus,
      successful_payments_count: successCount,
      is_eligible: nowEligible,
      nedarim_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (statusChanged) {
      updates.status = nedarimStatus;
      if (nedarimStatus === "frozen") updates.frozen_at = new Date().toISOString();
      if (nedarimStatus === "active") updates.frozen_at = null;
      if (nedarimStatus === "canceled") updates.canceled_at = new Date().toISOString();
    }
    if (dateChanged) updates.next_payment_date = nextPaymentDate;

    const { error: updateErr } = await svc.from("subscriptions").update(updates).eq("id", sub.id);
    if (updateErr) {
      const reason = `DB update failed: ${updateErr.message}`;
      console.error(`${tag}: ERROR — ${reason}`);
      return { result: "error", reason };
    }

    if (statusChanged) {
      await svc.from("subscription_actions").insert({
        subscription_id: sub.id,
        user_id: sub.user_id,
        performed_by: null,
        action: nedarimStatus === "frozen" ? "admin_disabled" : nedarimStatus === "canceled" ? "admin_canceled" : "admin_enabled",
        old_status: sub.status,
        new_status: nedarimStatus,
        nedarim_keva_id: sub.keva_id,
        nedarim_response: data,
        success: true,
        notes: "auto-sync via daily job",
      }).catch((e: unknown) => console.warn(`${tag}: audit log warning:`, e));
    }

    const changed = statusChanged || dateChanged;
    const reason = changed
      ? [statusChanged && `status ${sub.status}→${nedarimStatus}`, dateChanged && `nextDate ${toDateOnly(sub.next_payment_date)}→${toDateOnly(nextPaymentDate)}`].filter(Boolean).join(", ")
      : `KevaStatus=${kevaStatus}, no field changes`;
    console.log(`${tag}: ${changed ? "SYNCED" : "UNCHANGED"} — ${reason}`);
    return { result: changed ? "synced" : "unchanged", reason };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`${tag}: ERROR — ${reason}`);
    return { result: "error", reason };
  }
}

async function runSync(): Promise<{ synced: number; unchanged: number; errors: number }> {
  const svc = makeServiceClient();

  const { data: subs, error } = await svc
    .from("subscriptions")
    .select("id, user_id, status, keva_id, plan_id, next_payment_date")
    .in("status", ["active", "frozen"])
    .not("keva_id", "is", null);

  if (error) throw new Error("Failed to fetch subscriptions: " + error.message);
  if (!subs || subs.length === 0) return { synced: 0, unchanged: 0, errors: 0 };

  let synced = 0;
  let unchanged = 0;
  let errors = 0;

  for (const sub of subs) {
    const { result } = await syncSubscription(sub as {
      id: string; user_id: string; status: string;
      keva_id: string; plan_id: string; next_payment_date: string | null
    }, svc);
    if (result === "synced") synced++;
    else if (result === "unchanged") unchanged++;
    else errors++;
    // Small delay between requests to avoid overwhelming the API
    await new Promise((r) => setTimeout(r, 300));
  }

  return { synced, unchanged, errors };
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
    console.log("[nedarim-keva-sync] Starting sync...");
    const result = await runSync();
    console.log("[nedarim-keva-sync] Done:", result);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[nedarim-keva-sync] Fatal:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
