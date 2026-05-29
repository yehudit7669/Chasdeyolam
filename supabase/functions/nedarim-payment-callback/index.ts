import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NedarimPaymentPayload {
  TransactionId?: string;
  ClientId?: string;
  Zeout?: string;
  ClientName?: string;
  Adresse?: string;
  Phone?: string;
  Mail?: string;
  Amount?: string;
  Currency?: string;
  TransactionTime?: string;
  Confirmation?: string;
  LastNum?: string;
  Tokef?: string;
  TransactionType?: string;
  Groupe?: string;
  Comments?: string;
  Param1?: string;
  Param2?: string;
  Tashloumim?: string;
  FirstTashloum?: string;
  MosadNumber?: string;
  CallId?: string;
  MasofId?: string;
  Shovar?: string;
  CompagnyCard?: string;
  Solek?: string;
  Tayar?: string;
  Makor?: string;
  KevaId?: string;
  DebitIframe?: string;
  [key: string]: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isSuccess(p: NedarimPaymentPayload): boolean {
  return !!(p.TransactionId?.trim() && p.Confirmation?.trim());
}

// Param1 = authenticated user UUID (set by iframe PostNedarim — authoritative)
function extractUserId(p: NedarimPaymentPayload): string | null {
  if (p.Param1 && UUID_RE.test(p.Param1.trim())) return p.Param1.trim();
  return null;
}

// Param2 = plan UUID chosen on the frontend (set by iframe PostNedarim)
// "additional_donation" is a sentinel value for one-time donations — not a UUID
function extractPlanId(p: NedarimPaymentPayload): string | null {
  if (p.Param2 && UUID_RE.test(p.Param2.trim())) return p.Param2.trim();
  return null;
}

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function parseBody(req: Request): Promise<NedarimPaymentPayload> {
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

async function processPayment(
  supabase: ReturnType<typeof makeSupabase>,
  payload: NedarimPaymentPayload,
  rawPayload: unknown
): Promise<{ processed: boolean; subscriptionId: string | null; error: string | null }> {

  const success = isSuccess(payload);
  let subscriptionId: string | null = null;
  let processingError: string | null = null;
  const resolvedUserId = extractUserId(payload);
  const paramPlanId = extractPlanId(payload);

  if (!success) {
    processingError = "Payment not successful — no TransactionId or Confirmation";
    console.warn("[nedarim-payment-callback]", processingError);
    await supabase.from("nedarim_donation_callbacks").insert(
      buildRow(payload, null, rawPayload, resolvedUserId, processingError)
    );
    return { processed: false, subscriptionId: null, error: processingError };
  }

  try {
    // Identity resolution priority:
    // 1. Param1 = authenticated user UUID (iframe PostNedarim — authoritative)
    // 2. KevaId → look up original keva row (recurring monthly charge back-reference)
    // 3. Mail fallback (legacy only — never used for new iframe payments)
    let profileId: string | null = resolvedUserId;
    let identitySource = resolvedUserId ? "param1" : "none";

    if (profileId) {
      const { data: profile } = await supabase
        .from("profiles").select("id").eq("id", profileId).maybeSingle();
      if (!profile) {
        console.warn("[nedarim-payment-callback] Param1 UUID not found in profiles:", profileId);
        profileId = null;
        identitySource = "none";
      }
    }

    // KevaId path: recurring monthly charges reference the original HK setup
    if (!profileId && payload.KevaId?.trim()) {
      identitySource = "keva_id";
      const { data: kevaRow } = await supabase
        .from("nedarim_keva_callbacks")
        .select("user_id, subscription_id")
        .eq("keva_id", payload.KevaId.trim())
        .not("subscription_id", "is", null)
        .order("received_at", { ascending: false })
        .limit(1).maybeSingle();

      if (kevaRow?.subscription_id) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, user_id, successful_payments_count, plans(required_successful_payments)")
          .eq("id", kevaRow.subscription_id)
          .in("status", ["active", "frozen"]).maybeSingle();

        if (sub) {
          subscriptionId = sub.id;
          await recordPayment(supabase, sub, payload);
          await supabase.from("nedarim_donation_callbacks").insert(
            buildRow(payload, subscriptionId, rawPayload, kevaRow.user_id ?? null, null)
          );
          console.log("[nedarim-payment-callback] Payment recorded via KevaId", {
            subscriptionId, kevaId: payload.KevaId,
          });
          return { processed: true, subscriptionId, error: null };
        }
      }

      if (kevaRow?.user_id) profileId = kevaRow.user_id;
    }

    if (!profileId && payload.Mail) {
      identitySource = "mail_fallback";
      const { data: profile } = await supabase
        .from("profiles").select("id")
        .eq("email", payload.Mail.toLowerCase().trim()).maybeSingle();
      profileId = profile?.id ?? null;
    }

    console.log("[nedarim-payment-callback] Identity resolved", {
      profileId, identitySource,
      transactionId: payload.TransactionId,
      param1: payload.Param1, param2: payload.Param2,
    });

    if (profileId) {
      // One-time additional donation — no subscription to link
      if (payload.Param2?.trim() === "additional_donation") {
        // Record as a standalone payment without subscription
        await supabase.from("payments").insert({
          subscription_id: null,
          amount: payload.Amount ? Math.round(parseFloat(payload.Amount)) : null,
          status: "succeeded",
          attempt_number: 1,
          paid_at: payload.TransactionTime ?? new Date().toISOString(),
        });
        await supabase.from("nedarim_donation_callbacks").insert(
          buildRow(payload, null, rawPayload, profileId, null)
        );
        console.log("[nedarim-payment-callback] One-time donation recorded", {
          userId: profileId, amount: payload.Amount,
        });
        return { processed: true, subscriptionId: null, error: null };
      }

      // Recurring subscription payment
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("id, user_id, successful_payments_count, plans(required_successful_payments)")
        .eq("user_id", profileId).in("status", ["active", "frozen"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (subscription) {
        subscriptionId = subscription.id;
        await recordPayment(supabase, subscription, payload);
      } else {
        // No subscription yet — this is the first payment on a new HK setup.
        // The keva callback should have created the subscription already,
        // but create it here as a safety net using Param2 plan ID.
        let planId = paramPlanId;
        if (!planId && payload.Amount) {
          const amountNum = Math.round(parseFloat(payload.Amount));
          const { data: plan } = await supabase
            .from("plans").select("id")
            .eq("monthly_amount", amountNum).eq("active", true).maybeSingle();
          planId = plan?.id ?? null;
        }
        if (planId) {
          const { data: newSub } = await supabase
            .from("subscriptions").insert({
              user_id: profileId, plan_id: planId, status: "active",
              successful_payments_count: 0, failed_payment_attempts: 0,
              is_eligible: false, started_at: new Date().toISOString(),
            }).select("id").single();
          if (newSub) {
            subscriptionId = newSub.id;
            const freshSub = { id: newSub.id, user_id: profileId, successful_payments_count: 0,
              plans: { required_successful_payments: 15 } };
            await recordPayment(supabase, freshSub, payload);
          }
        } else {
          processingError = `No subscription or plan found for profile ${profileId}`;
          console.warn("[nedarim-payment-callback]", processingError);
        }
      }
    } else {
      processingError = `No profile found — Param1=${payload.Param1} Param2=${payload.Param2} Mail=${payload.Mail}`;
      console.warn("[nedarim-payment-callback]", processingError);
    }
  } catch (err: unknown) {
    processingError = err instanceof Error ? err.message : String(err);
    console.error("[nedarim-payment-callback] Processing error:", processingError);
  }

  await supabase.from("nedarim_donation_callbacks").insert(
    buildRow(payload, subscriptionId, rawPayload, resolvedUserId, processingError)
  );

  return { processed: subscriptionId !== null, subscriptionId, error: processingError };
}

async function recordPayment(
  supabase: ReturnType<typeof makeSupabase>,
  sub: { id: string; successful_payments_count: number; plans: unknown },
  payload: NedarimPaymentPayload
) {
  await supabase.from("payments").insert({
    subscription_id: sub.id,
    amount: payload.Amount ? Math.round(parseFloat(payload.Amount)) : null,
    status: "succeeded",
    attempt_number: 1,
    paid_at: payload.TransactionTime ?? new Date().toISOString(),
  });

  const newCount = (sub.successful_payments_count ?? 0) + 1;
  const required = (sub.plans as any)?.required_successful_payments ?? 15;
  const isEligible = newCount >= required;

  await supabase.from("subscriptions").update({
    successful_payments_count: newCount,
    is_eligible: isEligible,
    failed_payment_attempts: 0,
    status: "active",
    frozen_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", sub.id);

  console.log("[nedarim-payment-callback] Subscription updated", {
    subscriptionId: sub.id, newCount, isEligible,
  });
}

function buildRow(
  p: NedarimPaymentPayload,
  subscriptionId: string | null,
  rawPayload: unknown,
  userId: string | null,
  processingError: string | null
) {
  return {
    transaction_id:   p.TransactionId   ?? null,
    client_id:        p.ClientId        ?? null,
    zeout:            p.Zeout           ?? null,
    client_name:      p.ClientName      ?? null,
    adresse:          p.Adresse         ?? null,
    phone:            p.Phone           ?? null,
    mail:             p.Mail            ?? null,
    amount:           p.Amount          ?? null,
    currency:         p.Currency        ?? null,
    transaction_time: p.TransactionTime ?? null,
    confirmation:     p.Confirmation    ?? null,
    last_num:         p.LastNum         ?? null,
    tokef:            p.Tokef           ?? null,
    transaction_type: p.TransactionType ?? null,
    groupe:           p.Groupe          ?? null,
    comments:         p.Comments        ?? null,
    tashloumim:       p.Tashloumim      ?? null,
    first_tashloum:   p.FirstTashloum   ?? null,
    mosad_number:     p.MosadNumber     ?? null,
    call_id:          p.CallId          ?? null,
    masof_id:         p.MasofId         ?? null,
    shovar:           p.Shovar          ?? null,
    compagny_card:    p.CompagnyCard    ?? null,
    solek:            p.Solek           ?? null,
    tayar:            p.Tayar           ?? null,
    makor:            p.Makor           ?? null,
    keva_id:          p.KevaId          ?? null,
    debit_iframe:     p.DebitIframe     ?? null,
    user_id:          userId,
    subscription_id:  subscriptionId,
    raw_payload:      rawPayload,
    processed:        subscriptionId !== null,
    error_message:    processingError,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/test")) {
    const testPayload: NedarimPaymentPayload = {
      TransactionId: `TEST-${Date.now()}`,
      Confirmation: "TEST_CONF",
      Amount: "290", Currency: "1",
      Param1: "", Param2: "",
      Groupe: "תשלום דרך אתר נציבים",
      MosadNumber: "7010422",
      TransactionTime: new Date().toISOString(),
    };
    const supabase = makeSupabase();
    const result = await processPayment(supabase, testPayload, testPayload);
    return new Response(JSON.stringify({ test: true, payload: testPayload, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = makeSupabase();
  let rawPayload: unknown = {};

  try {
    const payload = await parseBody(req);
    rawPayload = payload;

    console.log("[nedarim-payment-callback] Received", {
      TransactionId: payload.TransactionId, Amount: payload.Amount,
      Param1: payload.Param1, Param2: payload.Param2,
      KevaId: payload.KevaId, MosadNumber: payload.MosadNumber,
    });

    if (!payload.MosadNumber) {
      return new Response(JSON.stringify({ error: "Invalid callback: missing MosadNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (payload.TransactionId) {
      const { data: existing } = await supabase
        .from("nedarim_donation_callbacks").select("id")
        .eq("transaction_id", payload.TransactionId).maybeSingle();
      if (existing) {
        console.log("[nedarim-payment-callback] Duplicate TransactionId, skipping", payload.TransactionId);
        return new Response(JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    await processPayment(supabase, payload, rawPayload);
    return new Response(JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-payment-callback] Unhandled error:", message);
    try {
      await makeSupabase().from("nedarim_donation_callbacks").insert({
        raw_payload: rawPayload ?? {}, processed: false, error_message: `UNHANDLED: ${message}`,
      });
    } catch (_) { /* best effort */ }
    return new Response(JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
