import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Official Nedarim Plus recurring-setup callback fields — exact names
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
  Tashloumim?: string;
  MosadNumber?: string;
  MasofId?: string;
  DebitIframe?: string;
  [key: string]: unknown;
}

// A valid keva setup has a non-empty KevaId
function isValid(p: NedarimKevaPayload): boolean {
  return !!(p.KevaId && p.KevaId.trim() !== "");
}

function makeSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function parseBody(req: Request): Promise<NedarimKevaPayload> {
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

// ─── Test endpoint ────────────────────────────────────────────────────────────
async function handleTest(): Promise<Response> {
  const testPayload: NedarimKevaPayload = {
    KevaId: `TEST-KEVA-${Date.now()}`,
    ClientId: "TEST_CLIENT",
    Zeout: "TEST_ZEOUT",
    ClientName: "בדיקה אוטומטית",
    Adresse: "",
    Phone: "050-0000000",
    Mail: "test@chasdeyolam.com",
    Amount: "290",
    Currency: "ILS",
    NextDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    LastNum: "1234",
    Tokef: "12/27",
    Groupe: "תשלום דרך אתר נציבים",
    Comments: "",
    Tashloumim: "15",
    MosadNumber: "7010422",
    MasofId: "TEST_MASOF",
    DebitIframe: "0",
  };

  const supabase = makeSupabase();
  const result = await processKeva(supabase, testPayload, testPayload);
  return new Response(
    JSON.stringify({ test: true, payload: testPayload, result }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ─── Core processing logic ────────────────────────────────────────────────────
async function processKeva(
  supabase: ReturnType<typeof makeSupabase>,
  payload: NedarimKevaPayload,
  rawPayload: unknown
): Promise<{ processed: boolean; subscriptionId: string | null; error: string | null }> {

  let subscriptionId: string | null = null;
  let processingError: string | null = null;

  if (isValid(payload)) {
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
        const { data: prev } = await supabase
          .from("nedarim_keva_callbacks")
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
        // Find the matching plan by amount
        const amountNum = payload.Amount ? Math.round(parseFloat(payload.Amount)) : null;
        let planId: string | null = null;

        if (amountNum) {
          const { data: plan } = await supabase
            .from("plans")
            .select("id")
            .eq("monthly_amount", amountNum)
            .eq("active", true)
            .maybeSingle();
          planId = plan?.id ?? null;
        }

        // Upsert subscription — create if none exists, otherwise link KevaId
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", profileId)
          .in("status", ["active", "frozen"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Parse NextDate from Nedarim Plus (format: YYYY-MM-DD or ISO)
        const nextPaymentDate = payload.NextDate
          ? new Date(payload.NextDate).toISOString()
          : null;

        if (existingSub) {
          subscriptionId = existingSub.id;
          // Update subscription to confirm it's active and record next charge date
          const updateFields: Record<string, unknown> = {
            status: "active",
            updated_at: new Date().toISOString(),
          };
          if (nextPaymentDate) updateFields.next_payment_date = nextPaymentDate;
          await supabase
            .from("subscriptions")
            .update(updateFields)
            .eq("id", existingSub.id);
        } else if (planId) {
          // Create new subscription from keva setup
          const { data: newSub } = await supabase
            .from("subscriptions")
            .insert({
              user_id: profileId,
              plan_id: planId,
              status: "active",
              successful_payments_count: 0,
              failed_payment_attempts: 0,
              is_eligible: false,
              started_at: new Date().toISOString(),
              next_payment_date: nextPaymentDate,
            })
            .select("id")
            .single();
          subscriptionId = newSub?.id ?? null;
        } else {
          processingError = `Could not find plan for amount ${payload.Amount}`;
          console.warn("[nedarim-keva-callback]", processingError);
        }

        if (subscriptionId) {
          console.log("[nedarim-keva-callback] Subscription linked to KevaId", {
            subscriptionId,
            kevaId: payload.KevaId,
          });
        }
      } else {
        processingError = `No profile found for Mail=${payload.Mail} Zeout=${payload.Zeout}`;
        console.warn("[nedarim-keva-callback]", processingError);
      }
    } catch (err: unknown) {
      processingError = err instanceof Error ? err.message : String(err);
      console.error("[nedarim-keva-callback] Processing error:", processingError);
    }
  } else {
    processingError = "Invalid keva callback — missing KevaId";
    console.warn("[nedarim-keva-callback]", processingError);
  }

  // Persist raw callback (always)
  const { error: dbErr } = await supabase.from("nedarim_keva_callbacks").insert({
    keva_id:      payload.KevaId     ?? null,
    client_id:    payload.ClientId   ?? null,
    zeout:        payload.Zeout      ?? null,
    client_name:  payload.ClientName ?? null,
    adresse:      payload.Adresse    ?? null,
    phone:        payload.Phone      ?? null,
    mail:         payload.Mail       ?? null,
    amount:       payload.Amount     ?? null,
    currency:     payload.Currency   ?? null,
    next_date:    payload.NextDate   ?? null,
    last_num:     payload.LastNum    ?? null,
    tokef:        payload.Tokef      ?? null,
    groupe:       payload.Groupe     ?? null,
    comments:     payload.Comments   ?? null,
    tashloumim:   payload.Tashloumim ?? null,
    mosad_number: payload.MosadNumber ?? null,
    masof_id:     payload.MasofId    ?? null,
    debit_iframe: payload.DebitIframe ?? null,
    subscription_id: subscriptionId,
    raw_payload:  rawPayload,
    processed:    subscriptionId !== null,
    error_message: processingError,
  });

  if (dbErr) {
    console.error("[nedarim-keva-callback] DB insert error:", dbErr.message);
  }

  return { processed: subscriptionId !== null, subscriptionId, error: processingError };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
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

    console.log("[nedarim-keva-callback] Received", {
      KevaId: payload.KevaId,
      Amount: payload.Amount,
      Mail: payload.Mail,
      MosadNumber: payload.MosadNumber,
    });

    // Validate: MosadNumber must be present
    if (!payload.MosadNumber) {
      console.error("[nedarim-keva-callback] Missing MosadNumber");
      return new Response(
        JSON.stringify({ error: "Invalid callback: missing MosadNumber" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check by KevaId
    if (payload.KevaId) {
      const { data: existing } = await supabase
        .from("nedarim_keva_callbacks")
        .select("id")
        .eq("keva_id", payload.KevaId)
        .maybeSingle();

      if (existing) {
        console.log("[nedarim-keva-callback] Duplicate KevaId, skipping", payload.KevaId);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await processKeva(supabase, payload, rawPayload);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-keva-callback] Unhandled error:", message);

    try {
      await makeSupabase().from("nedarim_keva_callbacks").insert({
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
