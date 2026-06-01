import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Nedarim Plus API
// Base: https://matara.pro/nedarimplus/Reports/Manage3.aspx?Action=<action>
//
// Confirmed actions and responses:
//   GetKevaId   → JSON object: { KevaId, KevaStatus("1"=active,"0"=frozen),
//                                KevaSuccess, KevaNextDate("DD/MM/YY"),
//                                HistoryData:[{ID,Amount,Date,Name,LastNum,TransactionId}] }
//   GetKevaJson → JSON array of ALL standing orders (not used for single-record ops)
//   DisableKeva → "OK" (plain string) on success
//   EnableKevaNew → {"NextDate":"DD/MM/YY"} on success
//   DeleteKeva  → "OK" on success | Hebrew error string on failure
// ---------------------------------------------------------------------------

const NEDARIM_BASE = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

function getCredentials() {
  return {
    MosadId: Deno.env.get("NEDARIM_MOSAD_ID") ?? "7010422",
    ApiPassword: Deno.env.get("NEDARIM_API_PASSWORD") ?? "mj227",
    ApiValid: Deno.env.get("NEDARIM_API_VALID") ?? "Rd8QEQCDEY",
  };
}

async function callNedarim(action: string, extra: Record<string, string> = {}): Promise<unknown> {
  const c = getCredentials();
  const url = new URL(NEDARIM_BASE);
  url.searchParams.set("Action", action);
  url.searchParams.set("MosadId", c.MosadId);
  url.searchParams.set("ApiPassword", c.ApiPassword);
  url.searchParams.set("ApiValid", c.ApiValid);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw new Error(`Nedarim Plus API unreachable: ${String(e)}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Nedarim Plus HTTP ${res.status}: ${body}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text; // plain string responses like "OK"
  }
}

// Check if a response indicates success
// DisableKeva → "OK"; EnableKevaNew → {NextDate:"..."}; DeleteKeva → "OK"
function isActionSuccess(resp: unknown): boolean {
  if (typeof resp === "string") return resp.trim() === "OK";
  if (typeof resp === "object" && resp !== null) {
    // EnableKevaNew returns {NextDate:"..."} on success
    const o = resp as Record<string, unknown>;
    if (o["NextDate"]) return true;
    // GetKevaId returns {KevaId:...}
    if (o["KevaId"]) return true;
  }
  return false;
}

function getActionError(resp: unknown): string {
  if (typeof resp === "string" && resp.trim() !== "OK") return resp.trim();
  if (typeof resp === "object" && resp !== null) {
    const o = resp as Record<string, unknown>;
    if (o["Error"]) return String(o["Error"]);
    if (o["Description"]) return String(o["Description"]);
  }
  return "Nedarim Plus returned unexpected response";
}

// ---------------------------------------------------------------------------
// Payment history parsing
// HistoryData[i].Name: empty or normal = success; contains "סירוב" = failed
// ---------------------------------------------------------------------------

interface ChargeRecord {
  id: string;
  charge_date: string | null;
  amount: number | null;
  status: "success" | "failed" | "canceled";
  description: string;
  last_num: string | null;
  transaction_id: string | null;
}

function parseDdMmYy(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // DD/MM/YY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) {
    const year = parseInt(m2[3]) + 2000;
    return `${year}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  }
  // DD/MM/YYYY
  const m4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m4) return `${m4[3]}-${m4[2].padStart(2, "0")}-${m4[1].padStart(2, "0")}`;
  return null;
}

function classifyCharge(name: string): "success" | "failed" | "canceled" {
  if (!name || name.trim() === "") return "success";
  const n = name.trim();
  if (n.includes("סירוב") || n.includes("נדחה") || n.includes("שגיאה") || n.includes("כשל")) return "failed";
  if (n.includes("ביטול") || n.includes("בוטל") || n.includes("מחיקה")) return "canceled";
  // Positive indicators: charge confirmation descriptions
  if (n.includes("חיוב") || n.includes("תשלום") || n.includes("הצלחה")) return "success";
  // Default unknown = failed (conservative)
  return "failed";
}

function parseHistoryData(raw: unknown): ChargeRecord[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((rec) => {
    const name = String(rec["Name"] ?? "");
    return {
      id: String(rec["ID"] ?? ""),
      charge_date: parseDdMmYy(rec["Date"]),
      amount: rec["Amount"] && String(rec["Amount"]).trim() !== "" ? Number(rec["Amount"]) : null,
      status: classifyCharge(name),
      description: name,
      last_num: String(rec["LastNum"] ?? "").trim() || null,
      transaction_id: String(rec["TransactionId"] ?? "").trim() || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function makeServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
function makeUserClient(auth: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
}
async function getCallerRole(uid: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data } = await svc.from("profiles").select("role").eq("id", uid).maybeSingle();
  return (data?.role as string) ?? "donor";
}
async function getSub(id: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data, error } = await svc
    .from("subscriptions")
    .select("id, user_id, status, keva_id, plan_id, successful_payments_count, is_eligible")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("DB: " + error.message);
  return data;
}
async function getDonorProfile(uid: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data } = await svc.from("profiles").select("email, full_name").eq("id", uid).maybeSingle();
  return data;
}
async function getRequiredPayments(planId: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data } = await svc.from("plans").select("required_successful_payments").eq("id", planId).maybeSingle();
  return data?.required_successful_payments ?? 15;
}

async function auditLog(svc: ReturnType<typeof makeServiceClient>, opts: {
  subscription_id: string; user_id: string | null; performed_by: string | null;
  action: string; old_status: string | null; new_status: string | null;
  nedarim_keva_id: string | null; nedarim_response: unknown; success: boolean; notes?: string;
}) {
  try { await svc.from("subscription_actions").insert(opts); }
  catch (e) { console.error("[audit]", e); }
}

function fireEmail(payload: Record<string, unknown>, svc_key: string, base: string) {
  EdgeRuntime.waitUntil(
    fetch(`${base}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${svc_key}` },
      body: JSON.stringify(payload),
    }).catch((e) => console.error("[email]", e))
  );
}

// Sync HistoryData records to nedarim_payment_history and recalculate eligibility
async function syncHistory(
  svc: ReturnType<typeof makeServiceClient>,
  subId: string, planId: string, kevaId: string, historyRaw: unknown
): Promise<{ successCount: number; becameEligible: boolean }> {
  const records = parseHistoryData(historyRaw);
  const successCount = records.filter((r) => r.status === "success").length;
  const required = await getRequiredPayments(planId, svc);

  for (const rec of records) {
    if (!rec.charge_date) continue;
    try {
      await svc.from("nedarim_payment_history").upsert(
        {
          subscription_id: subId, keva_id: kevaId,
          charge_date: rec.charge_date, amount: rec.amount,
          status: rec.status, transaction_id: rec.transaction_id,
          raw_data: { id: rec.id, description: rec.description, last_num: rec.last_num },
          synced_at: new Date().toISOString(),
        },
        { onConflict: "subscription_id,charge_date,status", ignoreDuplicates: false }
      );
    } catch (e) { console.warn("[history upsert]", e); }
  }

  const { data: current } = await svc.from("subscriptions").select("is_eligible").eq("id", subId).maybeSingle();
  const wasEligible = current?.is_eligible ?? false;
  const nowEligible = successCount >= required;

  await svc.from("subscriptions").update({
    successful_payments_count: successCount,
    is_eligible: nowEligible,
    nedarim_last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", subId);

  return { successCount, becameEligible: !wasEligible && nowEligible };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

interface Body {
  operation: "GetKevaId" | "GetKevaJson" | "DisableKeva" | "EnableKevaNew" | "DeleteKeva";
  subscriptionId?: string;
  clientId?: string;
  kevaId?: string;
  notes?: string;
  syncPayments?: boolean;
}

async function handle(req: Request): Promise<Response> {
  const auth = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await makeUserClient(auth).auth.getUser();
  if (authErr || !user) return err("Unauthorized", 401);

  const svc = makeServiceClient();
  const role = await getCallerRole(user.id, svc);
  const body: Body = await req.json();
  const { operation: op } = body;
  const base = Deno.env.get("SUPABASE_URL")!;
  const svc_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ── GetKevaId ─────────────────────────────────────────────────────────────
  if (op === "GetKevaId") {
    if (role !== "admin") return err("Forbidden", 403);
    if (!body.kevaId && !body.subscriptionId && !body.clientId) return err("kevaId, subscriptionId, or clientId required", 400);

    let kevaId = body.kevaId;
    if (!kevaId && body.subscriptionId) {
      const sub = await getSub(body.subscriptionId, svc);
      kevaId = sub?.keva_id ?? undefined;
    }
    if (!kevaId && body.clientId) kevaId = body.clientId;
    if (!kevaId) return err("No KevaId found", 404);

    try {
      const resp = await callNedarim("GetKevaId", { KevaId: kevaId });
      const data = resp as Record<string, unknown>;

      // Always sync status when subscriptionId is provided
      let syncResult = null;
      if (body.subscriptionId) {
        const sub = await getSub(body.subscriptionId, svc);
        if (sub) {
          // Nedarim: "1" = active, "0" or "2" = frozen, "3" = canceled
          const kevaStatus = String(data["KevaStatus"] ?? "1");
          const nedarimStatus: "active" | "frozen" | "canceled" =
            kevaStatus === "1" ? "active" : kevaStatus === "3" ? "canceled" : "frozen";
          const prevStatus = sub.status;
          const statusChanged = nedarimStatus !== sub.status &&
            (sub.status === "active" || sub.status === "frozen");

          const updates: Record<string, unknown> = {
            nedarim_raw_status: kevaStatus,
            nedarim_last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          const nextDate = parseDdMmYy(data["KevaNextDate"]);
          if (nextDate) {
            const candidate = new Date(nextDate + "T00:00:00Z");
            if (!isNaN(candidate.getTime()) && candidate > new Date()) {
              updates.next_payment_date = candidate.toISOString();
            }
          }

          if (statusChanged) {
            updates.status = nedarimStatus;
            if (nedarimStatus === "frozen") updates.frozen_at = new Date().toISOString();
            if (nedarimStatus === "active") updates.frozen_at = null;
            if (nedarimStatus === "canceled") { updates.canceled_at = new Date().toISOString(); }
          }

          await svc.from("subscriptions").update(updates).eq("id", sub.id);

          if (statusChanged) {
            await auditLog(svc, {
              subscription_id: sub.id, user_id: sub.user_id, performed_by: user.id,
              action: "admin_sync", old_status: prevStatus, new_status: nedarimStatus,
              nedarim_keva_id: kevaId, nedarim_response: data, success: true,
              notes: "manual admin sync via GetKevaId",
            });
          }

          if (body.syncPayments && sub.plan_id) {
            syncResult = await syncHistory(svc, sub.id, sub.plan_id, kevaId, data["HistoryData"]);
          }

          return ok({
            ...data,
            _prevStatus: prevStatus,
            _newStatus: statusChanged ? nedarimStatus : sub.status,
            _statusChanged: statusChanged,
            _syncedAt: new Date().toISOString(),
            _syncResult: syncResult,
          });
        }
      }
      return ok({ ...data, _syncResult: syncResult });
    } catch (e) {
      return err(String(e), 502);
    }
  }

  // ── GetKevaJson (all standing orders) ────────────────────────────────────
  if (op === "GetKevaJson") {
    if (role !== "admin") return err("Forbidden", 403);
    try {
      const resp = await callNedarim("GetKevaJson");
      return ok(resp);
    } catch (e) {
      return err(String(e), 502);
    }
  }

  // ── DisableKeva ──────────────────────────────────────────────────────────
  if (op === "DisableKeva") {
    if (!body.subscriptionId) return err("subscriptionId required", 400);
    const sub = await getSub(body.subscriptionId, svc);
    if (!sub) return err("Subscription not found", 404);
    if (role !== "admin" && sub.user_id !== user.id) return err("Forbidden", 403);
    if (sub.status !== "active") return err(`Cannot pause: subscription is '${sub.status}'`, 400);
    const kevaId = sub.keva_id;
    if (!kevaId) return err("No KevaId on this subscription", 400);

    let resp: unknown;
    let success = false;
    let errMsg = "";
    try {
      resp = await callNedarim("DisableKeva", { KevaId: kevaId });
      success = isActionSuccess(resp);
      if (!success) errMsg = getActionError(resp);
    } catch (e) {
      resp = String(e);
      errMsg = String(e);
    }

    if (success) {
      await svc.from("subscriptions").update({ status: "frozen", frozen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", sub.id);
      const donor = await getDonorProfile(sub.user_id!, svc);
      if (donor?.email) fireEmail({ template: "subscription_frozen", to: donor.email, idempotencyKey: `sub_frozen_${sub.id}_${Date.now()}`, data: { donorName: donor.full_name || donor.email } }, svc_key, base);
    }
    await auditLog(svc, { subscription_id: sub.id, user_id: sub.user_id, performed_by: user.id, action: role === "admin" ? "admin_disabled" : "user_disabled", old_status: sub.status, new_status: success ? "frozen" : sub.status, nedarim_keva_id: kevaId, nedarim_response: resp, success, notes: body.notes });
    if (!success) return err(`Nedarim error: ${errMsg}`, 502);
    return ok({ success: true, newStatus: "frozen" });
  }

  // ── EnableKevaNew ────────────────────────────────────────────────────────
  if (op === "EnableKevaNew") {
    if (!body.subscriptionId) return err("subscriptionId required", 400);
    const sub = await getSub(body.subscriptionId, svc);
    if (!sub) return err("Subscription not found", 404);
    if (role !== "admin" && sub.user_id !== user.id) return err("Forbidden", 403);
    if (sub.status !== "frozen") return err(`Cannot resume: subscription is '${sub.status}'`, 400);
    const kevaId = sub.keva_id;
    if (!kevaId) return err("No KevaId on this subscription", 400);

    let resp: unknown;
    let success = false;
    let errMsg = "";
    let nextDate: string | null = null;
    try {
      resp = await callNedarim("EnableKevaNew", { KevaId: kevaId });
      success = isActionSuccess(resp);
      if (!success) errMsg = getActionError(resp);
      if (success && typeof resp === "object" && resp !== null) {
        nextDate = parseDdMmYy((resp as Record<string, unknown>)["NextDate"]);
      }
    } catch (e) {
      resp = String(e);
      errMsg = String(e);
    }

    if (success) {
      const updates: Record<string, unknown> = { status: "active", frozen_at: null, updated_at: new Date().toISOString() };
      if (nextDate) {
        const candidate = new Date(nextDate + "T00:00:00Z");
        if (!isNaN(candidate.getTime()) && candidate > new Date()) updates.next_payment_date = candidate.toISOString();
      }
      await svc.from("subscriptions").update(updates).eq("id", sub.id);
      const donor = await getDonorProfile(sub.user_id!, svc);
      if (donor?.email) fireEmail({ template: "subscription_resumed", to: donor.email, idempotencyKey: `sub_resumed_${sub.id}_${Date.now()}`, data: { donorName: donor.full_name || donor.email } }, svc_key, base);
    }
    await auditLog(svc, { subscription_id: sub.id, user_id: sub.user_id, performed_by: user.id, action: role === "admin" ? "admin_enabled" : "user_enabled", old_status: sub.status, new_status: success ? "active" : sub.status, nedarim_keva_id: kevaId, nedarim_response: resp, success, notes: body.notes });
    if (!success) return err(`Nedarim error: ${errMsg}`, 502);
    return ok({ success: true, newStatus: "active", nextPaymentDate: nextDate });
  }

  // ── DeleteKeva ───────────────────────────────────────────────────────────
  if (op === "DeleteKeva") {
    if (!body.subscriptionId) return err("subscriptionId required", 400);
    const sub = await getSub(body.subscriptionId, svc);
    if (!sub) return err("Subscription not found", 404);
    if (role !== "admin" && sub.user_id !== user.id) return err("Forbidden", 403);
    if (sub.status === "canceled") return err("Subscription already canceled", 400);
    const kevaId = sub.keva_id;
    if (!kevaId) return err("No KevaId on this subscription", 400);

    let resp: unknown;
    let success = false;
    let errMsg = "";
    try {
      resp = await callNedarim("DeleteKeva", { KevaId: kevaId });
      success = isActionSuccess(resp);
      if (!success) errMsg = getActionError(resp);
    } catch (e) {
      resp = String(e);
      errMsg = String(e);
    }

    if (success) {
      await svc.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString(), canceled_by: user.id, cancellation_reason: body.notes ?? null, updated_at: new Date().toISOString() }).eq("id", sub.id);
      const donor = await getDonorProfile(sub.user_id!, svc);
      if (donor?.email) fireEmail({ template: "subscription_canceled", to: donor.email, idempotencyKey: `sub_canceled_${sub.id}_${Date.now()}`, data: { donorName: donor.full_name || donor.email } }, svc_key, base);
    }
    await auditLog(svc, { subscription_id: sub.id, user_id: sub.user_id, performed_by: user.id, action: role === "admin" ? "admin_deleted" : "user_deleted", old_status: sub.status, new_status: success ? "canceled" : sub.status, nedarim_keva_id: kevaId, nedarim_response: resp, success, notes: body.notes });
    if (!success) return err(`Nedarim error: ${errMsg}`, 502);
    return ok({ success: true, newStatus: "canceled" });
  }

  return err(`Unknown operation: ${op}`, 400);
}

function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return err("Method not allowed", 405);
  try { return await handle(req); }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[nedarim-keva-service]", msg);
    return err(msg, 500);
  }
});
