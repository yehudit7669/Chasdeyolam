import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NedarimKevaPayload {
  KevaId?: string;
  ClientId?: string;
  Zeout?: string;
  ClientName?: string;
  Adresse?: string;
  Phone?: string;
  Mail?: string;
  Amount?: string;
  Currency?: string;
  NextDate?: string;
  LastNum?: string;
  Tokef?: string;
  Groupe?: string;
  Comments?: string;
  Param1?: string;
  Param2?: string;
  Tashloumim?: string;
  MosadNumber?: string;
  MasofId?: string;
  DebitIframe?: string;
  [key: string]: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractUserId(p: NedarimKevaPayload): string | null {
  if (p.Param1 && UUID_RE.test(p.Param1.trim())) return p.Param1.trim();
  return null;
}

// Param2 carries the plan UUID chosen on the frontend
function extractPlanId(p: NedarimKevaPayload): string | null {
  if (p.Param2 && UUID_RE.test(p.Param2.trim())) return p.Param2.trim();
  return null;
}

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function parseBody(req: Request): Promise<NedarimKevaPayload> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return await req.json();
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { obj[k] = String(v); });
    return obj;
  }
  const text = await req.text();
  try { return JSON.parse(text); } catch { return {}; }
}

function parseNextDate(raw?: string): string | null {
  if (!raw) return null;
  try {
    const s = raw.trim();
    let parsed: Date | null = null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      parsed = new Date(`${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}T00:00:00Z`);
    } else {
      const d = new Date(s);
      if (!isNaN(d.getTime())) parsed = d;
    }
    if (!parsed || isNaN(parsed.getTime())) return null;

    // Always return a future date. Nedarim may send a date that has already passed
    // (e.g. billing day 28 sent on the 30th means next charge is next month's 28th).
    // Advance month-by-month until the date is in the future.
    const now = new Date();
    const billingDay = parsed.getUTCDate();
    let candidate = new Date(parsed);
    while (candidate <= now) {
      // Advance by one month, preserving the billing day
      const y = candidate.getUTCFullYear();
      const mo = candidate.getUTCMonth() + 1; // advance one month
      const nextMonth = mo > 11 ? 0 : mo;
      const nextYear = mo > 11 ? y + 1 : y;
      const daysInNext = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
      candidate = new Date(Date.UTC(nextYear, nextMonth, Math.min(billingDay, daysInNext)));
    }
    return candidate.toISOString();
  } catch (_) { /* leave null */ }
  return null;
}

async function processKeva(
  supabase: ReturnType<typeof makeSupabase>,
  payload: NedarimKevaPayload,
  rawPayload: unknown
): Promise<{ processed: boolean; subscriptionId: string | null; error: string | null }> {

  let subscriptionId: string | null = null;
  let processingError: string | null = null;
  const resolvedUserId = extractUserId(payload);
  const paramPlanId = extractPlanId(payload);

  if (!payload.KevaId?.trim()) {
    processingError = "Invalid keva callback — missing KevaId";
    console.warn("[nedarim-keva-callback]", processingError);
    await insertRow(supabase, payload, rawPayload, null, null, processingError, false);
    return { processed: false, subscriptionId: null, error: processingError };
  }

  try {
    // Identity resolution:
    // 1. Param1 = authenticated user UUID (iframe flow — authoritative)
    // 2. Mail fallback (legacy / outside-website payments only)
    let profileId: string | null = resolvedUserId;
    let identitySource = resolvedUserId ? "param1" : "none";

    if (profileId) {
      const { data: profile } = await supabase
        .from("profiles").select("id").eq("id", profileId).maybeSingle();
      if (!profile) {
        console.warn("[nedarim-keva-callback] Param1 UUID not found in profiles:", profileId);
        profileId = null;
        identitySource = "none";
      }
    }

    if (!profileId && payload.Mail) {
      identitySource = "mail_fallback";
      const { data: profile } = await supabase
        .from("profiles").select("id")
        .eq("email", payload.Mail.toLowerCase().trim()).maybeSingle();
      profileId = profile?.id ?? null;
    }

    console.log("[nedarim-keva-callback] Identity resolved", {
      profileId, identitySource, kevaId: payload.KevaId,
      param1: payload.Param1, param2: payload.Param2,
    });

    if (profileId) {
      const nextPaymentDate = parseNextDate(payload.NextDate);

      // Plan resolution: Param2 UUID first, then amount lookup
      let planId: string | null = paramPlanId;
      if (planId) {
        const { data: plan } = await supabase
          .from("plans").select("id").eq("id", planId).eq("active", true).maybeSingle();
        if (!plan) planId = null;
      }
      if (!planId && payload.Amount) {
        const amountNum = Math.round(parseFloat(payload.Amount));
        const { data: plan } = await supabase
          .from("plans").select("id")
          .eq("monthly_amount", amountNum).eq("active", true).maybeSingle();
        planId = plan?.id ?? null;
      }

      const { data: existingSub } = await supabase
        .from("subscriptions").select("id")
        .eq("user_id", profileId).in("status", ["active", "frozen"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (existingSub) {
        subscriptionId = existingSub.id;
        const upd: Record<string, unknown> = {
          status: "active",
          keva_id: payload.KevaId,
          subscription_source: "nedarim_iframe",
          updated_at: new Date().toISOString(),
        };
        if (nextPaymentDate) upd.next_payment_date = nextPaymentDate;
        await supabase.from("subscriptions").update(upd).eq("id", existingSub.id);
      } else if (planId) {
        const { data: newSub } = await supabase
          .from("subscriptions").insert({
            user_id: profileId, plan_id: planId, status: "active",
            keva_id: payload.KevaId,
            subscription_source: "nedarim_iframe",
            successful_payments_count: 0, failed_payment_attempts: 0,
            is_eligible: false, started_at: new Date().toISOString(),
            next_payment_date: nextPaymentDate,
          }).select("id").single();
        subscriptionId = newSub?.id ?? null;
      } else {
        processingError = `Could not find plan for amount ${payload.Amount}`;
        console.warn("[nedarim-keva-callback]", processingError);
      }

      if (subscriptionId) {
        console.log("[nedarim-keva-callback] Subscription linked", {
          subscriptionId, kevaId: payload.KevaId, identitySource,
        });

        // Fire subscription_created email for new subscriptions only
        if (!existingSub) {
          const base = Deno.env.get("SUPABASE_URL")!;
          const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const { data: profile } = await supabase
            .from("profiles").select("email, full_name").eq("id", profileId!).maybeSingle();
          if (profile?.email) {
            EdgeRuntime.waitUntil(
              fetch(`${base}/functions/v1/send-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
                body: JSON.stringify({
                  template: "subscription_created",
                  to: profile.email,
                  data: { donorName: profile.full_name || profile.email },
                  relatedId: subscriptionId,
                  relatedType: "subscription",
                }),
              }).catch((e: unknown) => console.error("[nedarim-keva-callback] email error:", e))
            );
          }
        }
      }
    } else {
      processingError = `No profile found — Param1=${payload.Param1} Param2=${payload.Param2} Mail=${payload.Mail}`;
      console.warn("[nedarim-keva-callback] UNMATCHED — queued for admin review", {
        kevaId: payload.KevaId, mail: payload.Mail, param1: payload.Param1,
      });
    }
  } catch (err: unknown) {
    processingError = err instanceof Error ? err.message : String(err);
    console.error("[nedarim-keva-callback] Processing error:", processingError);
  }

  const isUnmatched = subscriptionId === null &&
    (processingError?.startsWith("No profile found") ?? false);

  await insertRow(supabase, payload, rawPayload, resolvedUserId, subscriptionId,
    processingError, isUnmatched);

  return { processed: subscriptionId !== null, subscriptionId, error: processingError };
}

async function insertRow(
  supabase: ReturnType<typeof makeSupabase>,
  payload: NedarimKevaPayload,
  rawPayload: unknown,
  userId: string | null,
  subscriptionId: string | null,
  processingError: string | null,
  isUnmatched: boolean
) {
  await supabase.from("nedarim_keva_callbacks").insert({
    keva_id:       payload.KevaId      ?? null,
    client_id:     payload.ClientId    ?? null,
    zeout:         payload.Zeout       ?? null,
    client_name:   payload.ClientName  ?? null,
    adresse:       payload.Adresse     ?? null,
    phone:         payload.Phone       ?? null,
    mail:          payload.Mail        ?? null,
    amount:        payload.Amount      ?? null,
    currency:      payload.Currency    ?? null,
    next_date:     payload.NextDate    ?? null,
    last_num:      payload.LastNum     ?? null,
    tokef:         payload.Tokef       ?? null,
    groupe:        payload.Groupe      ?? null,
    comments:      payload.Comments    ?? null,
    tashloumim:    payload.Tashloumim  ?? null,
    mosad_number:  payload.MosadNumber ?? null,
    masof_id:      payload.MasofId     ?? null,
    debit_iframe:  payload.DebitIframe ?? null,
    user_id:          userId,
    subscription_id:  subscriptionId,
    raw_payload:      rawPayload,
    processed:        subscriptionId !== null,
    error_message:    processingError,
    review_status:    isUnmatched ? "pending_review" : null,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase();
  let rawPayload: unknown = {};

  try {
    const payload = await parseBody(req);
    rawPayload = payload;

    console.log("[nedarim-keva-callback] Received", {
      KevaId: payload.KevaId, Amount: payload.Amount,
      Param1: payload.Param1, Param2: payload.Param2,
      Mail: payload.Mail, MosadNumber: payload.MosadNumber,
    });

    if (!payload.MosadNumber) {
      return new Response(JSON.stringify({ error: "Invalid callback: missing MosadNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (payload.KevaId) {
      const { data: existing } = await supabase
        .from("nedarim_keva_callbacks").select("id")
        .eq("keva_id", payload.KevaId).maybeSingle();
      if (existing) {
        console.log("[nedarim-keva-callback] Duplicate KevaId, skipping", payload.KevaId);
        return new Response(JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    await processKeva(supabase, payload, rawPayload);
    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-keva-callback] Unhandled error:", message);
    try {
      await makeSupabase().from("nedarim_keva_callbacks").insert({
        raw_payload: rawPayload ?? {}, processed: false, error_message: `UNHANDLED: ${message}`,
        review_status: "pending_review",
      });
    } catch (_) { /* best effort */ }
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
