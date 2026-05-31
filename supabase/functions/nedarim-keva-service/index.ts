import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// Nedarim Plus API helpers
// ---------------------------------------------------------------------------

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

interface NedarimApiResponse {
  Status: string; // "1" = success
  Description: string;
  [key: string]: unknown;
}

async function callNedarimApi(
  endpoint: string,
  params: Record<string, string>
): Promise<NedarimApiResponse> {
  const url = new URL(`${NEDARIM_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Nedarim API HTTP ${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Some endpoints return pipe-separated values instead of JSON
    return { Status: "1", Description: text, raw: text };
  }
}

// GetKevaId — look up the KevaId for a given MosadId + ClientId
async function getKevaId(clientId: string): Promise<NedarimApiResponse> {
  const creds = getNedarimCredentials();
  return callNedarimApi("GetKevaId.aspx", {
    MosadId: creds.MosadId,
    ApiPassword: creds.ApiPassword,
    ApiValid: creds.ApiValid,
    ClientId: clientId,
  });
}

// GetKevaJson — fetch full standing order details by KevaId
async function getKevaJson(kevaId: string): Promise<NedarimApiResponse> {
  const creds = getNedarimCredentials();
  return callNedarimApi("GetKevaJson.aspx", {
    MosadId: creds.MosadId,
    ApiPassword: creds.ApiPassword,
    ApiValid: creds.ApiValid,
    KevaId: kevaId,
  });
}

// DisableKeva — pause (freeze) a standing order
async function disableKeva(kevaId: string): Promise<NedarimApiResponse> {
  const creds = getNedarimCredentials();
  return callNedarimApi("DisableKeva.aspx", {
    MosadId: creds.MosadId,
    ApiPassword: creds.ApiPassword,
    ApiValid: creds.ApiValid,
    KevaId: kevaId,
  });
}

// EnableKevaNew — resume a frozen standing order
async function enableKevaNew(kevaId: string): Promise<NedarimApiResponse> {
  const creds = getNedarimCredentials();
  return callNedarimApi("EnableKevaNew.aspx", {
    MosadId: creds.MosadId,
    ApiPassword: creds.ApiPassword,
    ApiValid: creds.ApiValid,
    KevaId: kevaId,
  });
}

// DeleteKeva — permanently cancel a standing order
async function deleteKeva(kevaId: string): Promise<NedarimApiResponse> {
  const creds = getNedarimCredentials();
  return callNedarimApi("DeleteKeva.aspx", {
    MosadId: creds.MosadId,
    ApiPassword: creds.ApiPassword,
    ApiValid: creds.ApiValid,
    KevaId: kevaId,
  });
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function makeServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function makeUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// Resolve the caller's role from profiles
async function resolveCallerRole(userId: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data } = await svc
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as string) ?? "donor";
}

// Fetch subscription with keva_id
async function fetchSubscription(subscriptionId: string, svc: ReturnType<typeof makeServiceClient>) {
  const { data, error } = await svc
    .from("subscriptions")
    .select("id, user_id, status, keva_id, plan_id")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (error) throw new Error("DB error: " + error.message);
  return data;
}

// Write to subscription_actions audit log (best effort — never throws)
async function logAction(
  svc: ReturnType<typeof makeServiceClient>,
  opts: {
    subscription_id: string;
    user_id: string | null;
    performed_by: string | null;
    action: string;
    old_status: string | null;
    new_status: string | null;
    nedarim_keva_id: string | null;
    nedarim_response: unknown;
    success: boolean;
    notes?: string;
  }
) {
  try {
    await svc.from("subscription_actions").insert(opts);
  } catch (e) {
    console.error("[nedarim-keva-service] Failed to write audit log:", e);
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

interface RequestBody {
  operation: "GetKevaId" | "GetKevaJson" | "DisableKeva" | "EnableKevaNew" | "DeleteKeva";
  subscriptionId?: string;
  clientId?: string;
  kevaId?: string;
  notes?: string;
}

async function handleRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";

  // Identify caller
  const userClient = makeUserClient(authHeader);
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonError("Unauthorized", 401);
  }

  const svc = makeServiceClient();
  const callerRole = await resolveCallerRole(user.id, svc);

  const body: RequestBody = await req.json();
  const { operation } = body;

  // ── GetKevaId ────────────────────────────────────────────────────────────
  if (operation === "GetKevaId") {
    if (callerRole !== "admin") return jsonError("Forbidden", 403);
    if (!body.clientId) return jsonError("clientId required", 400);
    const result = await getKevaId(body.clientId);
    return jsonOk(result);
  }

  // ── GetKevaJson ──────────────────────────────────────────────────────────
  if (operation === "GetKevaJson") {
    if (callerRole !== "admin") return jsonError("Forbidden", 403);
    if (!body.kevaId && !body.subscriptionId) return jsonError("kevaId or subscriptionId required", 400);

    let kevaId = body.kevaId ?? null;
    if (!kevaId && body.subscriptionId) {
      const sub = await fetchSubscription(body.subscriptionId, svc);
      kevaId = sub?.keva_id ?? null;
    }
    if (!kevaId) return jsonError("No KevaId found for this subscription", 404);

    const result = await getKevaJson(kevaId);
    return jsonOk(result);
  }

  // ── DisableKeva (pause) ──────────────────────────────────────────────────
  if (operation === "DisableKeva") {
    if (!body.subscriptionId) return jsonError("subscriptionId required", 400);

    const sub = await fetchSubscription(body.subscriptionId, svc);
    if (!sub) return jsonError("Subscription not found", 404);

    // Donors can only pause their own subscription; admins can pause any
    if (callerRole !== "admin" && sub.user_id !== user.id) return jsonError("Forbidden", 403);
    if (sub.status !== "active") return jsonError("Subscription is not active", 400);

    const kevaId = sub.keva_id;
    if (!kevaId) return jsonError("No KevaId on this subscription — cannot call Nedarim API", 400);

    const actionType = callerRole === "admin" ? "admin_disabled" : "user_disabled";
    let nedarimResult: NedarimApiResponse;
    let success = false;

    try {
      nedarimResult = await disableKeva(kevaId);
      success = nedarimResult.Status === "1";
    } catch (e) {
      nedarimResult = { Status: "0", Description: String(e) };
    }

    if (success) {
      await svc
        .from("subscriptions")
        .update({ status: "frozen", frozen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sub.id);
    }

    await logAction(svc, {
      subscription_id: sub.id,
      user_id: sub.user_id,
      performed_by: user.id,
      action: actionType,
      old_status: sub.status,
      new_status: success ? "frozen" : sub.status,
      nedarim_keva_id: kevaId,
      nedarim_response: nedarimResult,
      success,
      notes: body.notes,
    });

    if (!success) return jsonError(`Nedarim API error: ${nedarimResult.Description}`, 502);
    return jsonOk({ success: true, newStatus: "frozen" });
  }

  // ── EnableKevaNew (resume) ───────────────────────────────────────────────
  if (operation === "EnableKevaNew") {
    if (!body.subscriptionId) return jsonError("subscriptionId required", 400);

    const sub = await fetchSubscription(body.subscriptionId, svc);
    if (!sub) return jsonError("Subscription not found", 404);

    if (callerRole !== "admin" && sub.user_id !== user.id) return jsonError("Forbidden", 403);
    if (sub.status !== "frozen") return jsonError("Subscription is not frozen", 400);

    const kevaId = sub.keva_id;
    if (!kevaId) return jsonError("No KevaId on this subscription — cannot call Nedarim API", 400);

    const actionType = callerRole === "admin" ? "admin_enabled" : "user_enabled";
    let nedarimResult: NedarimApiResponse;
    let success = false;

    try {
      nedarimResult = await enableKevaNew(kevaId);
      success = nedarimResult.Status === "1";
    } catch (e) {
      nedarimResult = { Status: "0", Description: String(e) };
    }

    if (success) {
      await svc
        .from("subscriptions")
        .update({ status: "active", frozen_at: null, updated_at: new Date().toISOString() })
        .eq("id", sub.id);
    }

    await logAction(svc, {
      subscription_id: sub.id,
      user_id: sub.user_id,
      performed_by: user.id,
      action: actionType,
      old_status: sub.status,
      new_status: success ? "active" : sub.status,
      nedarim_keva_id: kevaId,
      nedarim_response: nedarimResult,
      success,
      notes: body.notes,
    });

    if (!success) return jsonError(`Nedarim API error: ${nedarimResult.Description}`, 502);
    return jsonOk({ success: true, newStatus: "active" });
  }

  // ── DeleteKeva (permanent cancel) ────────────────────────────────────────
  if (operation === "DeleteKeva") {
    if (!body.subscriptionId) return jsonError("subscriptionId required", 400);

    const sub = await fetchSubscription(body.subscriptionId, svc);
    if (!sub) return jsonError("Subscription not found", 404);

    if (callerRole !== "admin" && sub.user_id !== user.id) return jsonError("Forbidden", 403);
    if (sub.status === "canceled") return jsonError("Subscription is already canceled", 400);

    const kevaId = sub.keva_id;
    if (!kevaId) return jsonError("No KevaId on this subscription — cannot call Nedarim API", 400);

    const actionType = callerRole === "admin" ? "admin_deleted" : "user_deleted";
    let nedarimResult: NedarimApiResponse;
    let success = false;

    try {
      nedarimResult = await deleteKeva(kevaId);
      success = nedarimResult.Status === "1";
    } catch (e) {
      nedarimResult = { Status: "0", Description: String(e) };
    }

    if (success) {
      await svc
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
          canceled_by: user.id,
          cancellation_reason: body.notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }

    await logAction(svc, {
      subscription_id: sub.id,
      user_id: sub.user_id,
      performed_by: user.id,
      action: actionType,
      old_status: sub.status,
      new_status: success ? "canceled" : sub.status,
      nedarim_keva_id: kevaId,
      nedarim_response: nedarimResult,
      success,
      notes: body.notes,
    });

    if (!success) return jsonError(`Nedarim API error: ${nedarimResult.Description}`, 502);
    return jsonOk({ success: true, newStatus: "canceled" });
  }

  return jsonError(`Unknown operation: ${operation}`, 400);
}

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    return await handleRequest(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-keva-service] Unhandled error:", message);
    return jsonError(message, 500);
  }
});
