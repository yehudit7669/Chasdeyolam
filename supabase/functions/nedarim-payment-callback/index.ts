import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Official Nedarim Plus payment/transaction callback fields — exact names
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

// A successful Nedarim Plus payment has a non-empty TransactionId and Confirmation
function isSuccess(p: NedarimPaymentPayload): boolean {
  return !!(p.TransactionId && p.TransactionId.trim() !== "" && p.Confirmation && p.Confirmation.trim() !== "");
}

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function parseBody(req: Request): Promise<NedarimPaymentPayload> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return await req.json();
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const obj: Record<string, string> = {};
    fd.forEach((v, k) => { obj[k] = String(v); });
    return obj;
  }
  const text = await req.text();
  try { return JSON.parse(text); } catch { return {}; }
}

// ─── Test endpoint ──────────────────────────────────────────────────────────
// POST /nedarim-payment-callback/test
// Sends a synthetic successful callback through the full processing pipeline.
async function handleTest(): Promise<Response> {
  const testPayload: NedarimPaymentPayload = {
    TransactionId: `TEST-${Date.now()}`,
    ClientId: "TEST_CLIENT",
    Zeout: "TEST_ZEOUT",
    ClientName: "בדיקה אוטומטית",
    Adresse: "",
    Phone: "050-0000000",
    Mail: "test@chasdeyolam.com",
    Amount: "290",
    Currency: "ILS",
    TransactionTime: new Date().toISOString(),
    Confirmation: "TEST_CONFIRMATION",
    LastNum: "1234",
    Tokef: "12/27",
    TransactionType: "1",
    Groupe: "תשלום דרך אתר נציבים",
    Comments: "",
    Tashloumim: "1",
    FirstTashloum: "0",
    MosadNumber: "7010422",
    CallId: "TEST_CALL",
    MasofId: "TEST_MASOF",
    Shovar: "TEST_SHOVAR",
    CompagnyCard: "ישראכרט",
    Solek: "1",
    Tayar: "1",
    Makor: "2",
    KevaId: "",
    DebitIframe: "0",
  };

  const supabase = makeSupabase();
  const result = await processPayment(supabase, testPayload, testPayload);
  return new Response(
    JSON.stringify({ test: true, payload: testPayload, result }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Core processing logic ───────────────────────────────────────────────────
async function processPayment(
  supabase: ReturnType<typeof makeSupabase>,
  payload: NedarimPaymentPayload,
  rawPayload: unknown
): Promise<{ processed: boolean; subscriptionId: string | null; error: string | null }> {

  const success = isSuccess(payload);
  let subscriptionId: string | null = null;
  let processingError: string | null = null;

  if (success) {
    try {
      // Match donor: Mail first, fallback by Zeout
      let profileId: string | null = null;

      if (payload.Mail) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", payload.Mail.toLowerCase().trim())
          .maybeSingle();
        profileId = profile?.id ?? null;
      }

      if (!profileId && payload.Zeout) {
        // Fallback: find via previous donation callback with same Zeout
        const { data: prev } = await supabase
          .from("nedarim_donation_callbacks")
          .select("mail")
          .eq("zeout", payload.Zeout)
          .not("mail", "is", null)
          .maybeSingle();
        if (prev?.mail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", prev.mail.toLowerCase().trim())
            .maybeSingle();
          profileId = profile?.id ?? null;
        }
      }

      if (profileId) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id, successful_payments_count, plan_id, plans(required_successful_payments)")
          .eq("user_id", profileId)
          .in("status", ["active", "frozen"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subscription) {
          subscriptionId = subscription.id;

          await supabase.from("payments").insert({
            subscription_id: subscription.id,
            amount: payload.Amount ? Math.round(parseFloat(payload.Amount)) : null,
            status: "succeeded",
            attempt_number: 1,
            paid_at: payload.TransactionTime ?? new Date().toISOString(),
          });

          const newCount = (subscription.successful_payments_count ?? 0) + 1;
          const required = (subscription as any).plans?.required_successful_payments ?? 15;
          const isEligible = newCount >= required;

          const subUpdate: Record<string, unknown> = {
            successful_payments_count: newCount,
            is_eligible: isEligible,
            failed_payment_attempts: 0,
            status: "active",
            frozen_at: null,
            updated_at: new Date().toISOString(),
          };
          // If Nedarim sends a next charge date with this payment, persist it
          if (payload.KevaId) {
            const { data: kevaRow } = await supabase
              .from("nedarim_keva_callbacks")
              .select("next_date")
              .eq("keva_id", payload.KevaId)
              .not("next_date", "is", null)
              .order("received_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (kevaRow?.next_date) {
              subUpdate.next_payment_date = new Date(kevaRow.next_date).toISOString();
            }
          }
          await supabase
            .from("subscriptions")
            .update(subUpdate)
            .eq("id", subscription.id);

          console.log("[nedarim-payment-callback] Subscription updated", {
            subscriptionId: subscription.id,
            newCount,
            isEligible,
          });
        } else {
          processingError = `No subscription found for profile ${profileId}`;
          console.warn("[nedarim-payment-callback]", processingError);
        }
      } else {
        processingError = `No profile found for Mail=${payload.Mail} Zeout=${payload.Zeout}`;
        console.warn("[nedarim-payment-callback]", processingError);
      }
    } catch (err: unknown) {
      processingError = err instanceof Error ? err.message : String(err);
      console.error("[nedarim-payment-callback] Processing error:", processingError);
    }
  } else {
    processingError = `Payment not successful — no TransactionId or Confirmation`;
    console.warn("[nedarim-payment-callback]", processingError);
  }

  // Persist raw callback (always)
  const { error: dbErr } = await supabase.from("nedarim_donation_callbacks").insert({
    transaction_id:   payload.TransactionId   ?? null,
    client_id:        payload.ClientId        ?? null,
    zeout:            payload.Zeout           ?? null,
    client_name:      payload.ClientName      ?? null,
    adresse:          payload.Adresse         ?? null,
    phone:            payload.Phone           ?? null,
    mail:             payload.Mail            ?? null,
    amount:           payload.Amount          ?? null,
    currency:         payload.Currency        ?? null,
    transaction_time: payload.TransactionTime ?? null,
    confirmation:     payload.Confirmation    ?? null,
    last_num:         payload.LastNum         ?? null,
    tokef:            payload.Tokef           ?? null,
    transaction_type: payload.TransactionType ?? null,
    groupe:           payload.Groupe          ?? null,
    comments:         payload.Comments        ?? null,
    tashloumim:       payload.Tashloumim      ?? null,
    first_tashloum:   payload.FirstTashloum   ?? null,
    mosad_number:     payload.MosadNumber     ?? null,
    call_id:          payload.CallId          ?? null,
    masof_id:         payload.MasofId         ?? null,
    shovar:           payload.Shovar          ?? null,
    compagny_card:    payload.CompagnyCard    ?? null,
    solek:            payload.Solek           ?? null,
    tayar:            payload.Tayar           ?? null,
    makor:            payload.Makor           ?? null,
    keva_id:          payload.KevaId          ?? null,
    debit_iframe:     payload.DebitIframe     ?? null,
    subscription_id:  subscriptionId,
    raw_payload:      rawPayload,
    processed:        subscriptionId !== null,
    error_message:    processingError,
  });

  if (dbErr) {
    console.error("[nedarim-payment-callback] DB insert error:", dbErr.message);
  }

  return { processed: subscriptionId !== null, subscriptionId, error: processingError };
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Test endpoint
  const url = new URL(req.url);
  if (req.method === "POST" && url.pathname.endsWith("/test")) {
    return handleTest();
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = makeSupabase();
  let rawPayload: unknown = {};

  try {
    const payload = await parseBody(req);
    rawPayload = payload;

    console.log("[nedarim-payment-callback] Received", {
      TransactionId: payload.TransactionId,
      Amount: payload.Amount,
      Mail: payload.Mail,
      MosadNumber: payload.MosadNumber,
    });

    // Validate: MosadNumber must be present
    if (!payload.MosadNumber) {
      console.error("[nedarim-payment-callback] Missing MosadNumber");
      return new Response(
        JSON.stringify({ error: "Invalid callback: missing MosadNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check by TransactionId
    if (payload.TransactionId) {
      const { data: existing } = await supabase
        .from("nedarim_donation_callbacks")
        .select("id")
        .eq("transaction_id", payload.TransactionId)
        .maybeSingle();

      if (existing) {
        console.log("[nedarim-payment-callback] Duplicate TransactionId, skipping", payload.TransactionId);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await processPayment(supabase, payload, rawPayload);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-payment-callback] Unhandled error:", message);

    try {
      await makeSupabase().from("nedarim_donation_callbacks").insert({
        raw_payload: rawPayload ?? {},
        processed: false,
        error_message: `UNHANDLED: ${message}`,
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
