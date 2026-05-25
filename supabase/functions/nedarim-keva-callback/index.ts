import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Nedarim Plus sends callbacks as POST with JSON or form-encoded body.
// Standard fields documented by Nedarim Plus / matara.pro:
//   Mosad, Zeout, Amount, Currency, PayerID, PayerName, PayerEmail, PayerPhone,
//   PaymentType, PaymentNum, TotalPayments, PaymentDate, ApprovalNumber,
//   CardSuffix, StatusCode, StatusDesc, ApiValid
interface NedarimKevaPayload {
  Mosad?: string;
  Zeout?: string;          // Transaction / auth reference number
  Amount?: string | number;
  Currency?: string;
  PayerID?: string;
  PayerName?: string;
  PayerEmail?: string;
  PayerPhone?: string;
  PaymentType?: string;
  PaymentNum?: string | number;   // Which payment in the series (1, 2, ...)
  TotalPayments?: string | number;
  PaymentDate?: string;
  ApprovalNumber?: string;
  CardSuffix?: string;
  StatusCode?: string;
  StatusDesc?: string;
  ApiValid?: string;
  // Allow any extra fields Nedarim Plus may add
  [key: string]: unknown;
}

function parseAmount(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.round(n);
}

function isSuccess(payload: NedarimKevaPayload): boolean {
  // Nedarim Plus uses StatusCode "000" or "0" for success; ApiValid "1" also signals valid
  const code = String(payload.StatusCode ?? "");
  const valid = String(payload.ApiValid ?? "");
  return code === "000" || code === "0" || valid === "1";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let payload: NedarimKevaPayload = {};
  let rawPayload: unknown = {};

  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
      rawPayload = payload;
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      const obj: Record<string, string> = {};
      formData.forEach((value, key) => { obj[key] = String(value); });
      payload = obj;
      rawPayload = obj;
    } else {
      // Attempt JSON fallback
      const text = await req.text();
      try {
        payload = JSON.parse(text);
        rawPayload = payload;
      } catch {
        rawPayload = { raw_text: text };
        console.warn("[nedarim-keva-callback] Unparseable body received");
      }
    }

    console.log("[nedarim-keva-callback] Received callback", {
      Zeout: payload.Zeout,
      Amount: payload.Amount,
      PayerEmail: payload.PayerEmail,
      StatusCode: payload.StatusCode,
    });

    // Basic validation — Nedarim Plus always sends Mosad
    if (!payload.Mosad) {
      console.error("[nedarim-keva-callback] Missing Mosad field — rejecting");
      return new Response(
        JSON.stringify({ error: "Invalid callback: missing Mosad" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const success = isSuccess(payload);
    const amountVal = parseAmount(payload.Amount);
    const paymentNum = payload.PaymentNum !== undefined ? Number(payload.PaymentNum) : null;
    const totalPayments = payload.TotalPayments !== undefined ? Number(payload.TotalPayments) : null;

    // Idempotency: skip if we already have this Zeout stored
    if (payload.Zeout) {
      const { data: existing } = await supabase
        .from("nedarim_keva_callbacks")
        .select("id")
        .eq("zeout", payload.Zeout)
        .maybeSingle();

      if (existing) {
        console.log("[nedarim-keva-callback] Duplicate Zeout, skipping", payload.Zeout);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Try to find matching subscription by email
    let subscriptionId: string | null = null;
    let processingError: string | null = null;

    if (success && payload.PayerEmail) {
      try {
        // Find profile by email
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", payload.PayerEmail.toLowerCase().trim())
          .maybeSingle();

        if (profile) {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("id, successful_payments_count, plan_id, plans(required_successful_payments)")
            .eq("user_id", profile.id)
            .eq("status", "active")
            .maybeSingle();

          if (subscription) {
            subscriptionId = subscription.id;

            // Insert payment record
            await supabase.from("payments").insert({
              subscription_id: subscription.id,
              amount: amountVal,
              status: "succeeded",
              attempt_number: paymentNum ?? 1,
              paid_at: new Date().toISOString(),
            });

            // Update subscription counts
            const newCount = (subscription.successful_payments_count ?? 0) + 1;
            const requiredPayments =
              (subscription as any).plans?.required_successful_payments ?? 15;
            const isEligible = newCount >= requiredPayments;

            await supabase
              .from("subscriptions")
              .update({
                successful_payments_count: newCount,
                is_eligible: isEligible,
                failed_payment_attempts: 0,
                status: "active",
                frozen_at: null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);

            console.log("[nedarim-keva-callback] Payment processed", {
              subscriptionId: subscription.id,
              newCount,
              isEligible,
            });
          } else {
            processingError = `No active subscription found for email: ${payload.PayerEmail}`;
            console.warn("[nedarim-keva-callback]", processingError);
          }
        } else {
          processingError = `No profile found for email: ${payload.PayerEmail}`;
          console.warn("[nedarim-keva-callback]", processingError);
        }
      } catch (err: unknown) {
        processingError = err instanceof Error ? err.message : String(err);
        console.error("[nedarim-keva-callback] Processing error:", processingError);
      }
    } else if (!success) {
      // Failed payment — try to freeze subscription
      try {
        if (payload.PayerEmail) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", payload.PayerEmail.toLowerCase().trim())
            .maybeSingle();

          if (profile) {
            const { data: subscription } = await supabase
              .from("subscriptions")
              .select("id, failed_payment_attempts")
              .eq("user_id", profile.id)
              .in("status", ["active", "frozen"])
              .maybeSingle();

            if (subscription) {
              subscriptionId = subscription.id;
              const newFailed = (subscription.failed_payment_attempts ?? 0) + 1;

              // Insert failed payment record
              await supabase.from("payments").insert({
                subscription_id: subscription.id,
                amount: amountVal,
                status: "failed",
                attempt_number: paymentNum ?? 1,
                failure_reason: payload.StatusDesc ?? `StatusCode: ${payload.StatusCode}`,
              });

              await supabase
                .from("subscriptions")
                .update({
                  failed_payment_attempts: newFailed,
                  status: newFailed >= 3 ? "frozen" : "active",
                  frozen_at: newFailed >= 3 ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", subscription.id);
            }
          }
        }
      } catch (err: unknown) {
        processingError = err instanceof Error ? err.message : String(err);
        console.error("[nedarim-keva-callback] Failed-payment handling error:", processingError);
      }
    }

    // Always persist the raw callback for audit
    const { error: insertError } = await supabase.from("nedarim_keva_callbacks").insert({
      mosad: payload.Mosad ?? null,
      zeout: payload.Zeout ?? null,
      amount: amountVal,
      currency: payload.Currency ?? "ILS",
      payer_id: payload.PayerID ?? null,
      payer_name: payload.PayerName ?? null,
      payer_email: payload.PayerEmail ?? null,
      payer_phone: payload.PayerPhone ?? null,
      payment_type: payload.PaymentType ?? null,
      payment_num: isNaN(paymentNum as number) ? null : paymentNum,
      total_payments: isNaN(totalPayments as number) ? null : totalPayments,
      payment_date: payload.PaymentDate ?? null,
      approval_number: payload.ApprovalNumber ?? null,
      card_last4: payload.CardSuffix ?? null,
      status: success ? "success" : "failure",
      status_code: payload.StatusCode ?? null,
      subscription_id: subscriptionId,
      raw_payload: rawPayload,
      processed: subscriptionId !== null,
      error_message: processingError,
    });

    if (insertError) {
      console.error("[nedarim-keva-callback] Failed to persist callback:", insertError);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-keva-callback] Unhandled error:", message);

    // Attempt to save even broken payloads
    try {
      const supabaseFallback = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseFallback.from("nedarim_keva_callbacks").insert({
        raw_payload: rawPayload ?? {},
        processed: false,
        error_message: message,
      });
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
