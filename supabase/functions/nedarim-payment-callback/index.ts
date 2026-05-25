import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NedarimPaymentPayload {
  Mosad?: string;
  Zeout?: string;
  Amount?: string | number;
  Currency?: string;
  PayerID?: string;
  PayerName?: string;
  PayerEmail?: string;
  PayerPhone?: string;
  PaymentType?: string;
  PaymentDate?: string;
  ApprovalNumber?: string;
  CardSuffix?: string;
  StatusCode?: string;
  StatusDesc?: string;
  ApiValid?: string;
  [key: string]: unknown;
}

function parseAmount(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : Math.round(n);
}

function isSuccess(payload: NedarimPaymentPayload): boolean {
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

  let payload: NedarimPaymentPayload = {};
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
      const text = await req.text();
      try {
        payload = JSON.parse(text);
        rawPayload = payload;
      } catch {
        rawPayload = { raw_text: text };
        console.warn("[nedarim-payment-callback] Unparseable body received");
      }
    }

    console.log("[nedarim-payment-callback] Received callback", {
      Zeout: payload.Zeout,
      Amount: payload.Amount,
      PayerEmail: payload.PayerEmail,
      StatusCode: payload.StatusCode,
    });

    if (!payload.Mosad) {
      console.error("[nedarim-payment-callback] Missing Mosad field — rejecting");
      return new Response(
        JSON.stringify({ error: "Invalid callback: missing Mosad" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const success = isSuccess(payload);
    const amountVal = parseAmount(payload.Amount);

    // Idempotency: skip duplicate Zeout
    if (payload.Zeout) {
      const { data: existing } = await supabase
        .from("nedarim_donation_callbacks")
        .select("id")
        .eq("zeout", payload.Zeout)
        .maybeSingle();

      if (existing) {
        console.log("[nedarim-payment-callback] Duplicate Zeout, skipping", payload.Zeout);
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let processingError: string | null = null;

    if (success) {
      console.log("[nedarim-payment-callback] One-time donation received", {
        amount: amountVal,
        payer: payload.PayerEmail,
        zeout: payload.Zeout,
      });
    } else {
      processingError = `Payment failed — StatusCode: ${payload.StatusCode}, Desc: ${payload.StatusDesc}`;
      console.warn("[nedarim-payment-callback]", processingError);
    }

    const { error: insertError } = await supabase.from("nedarim_donation_callbacks").insert({
      mosad: payload.Mosad ?? null,
      zeout: payload.Zeout ?? null,
      amount: amountVal,
      currency: payload.Currency ?? "ILS",
      payer_id: payload.PayerID ?? null,
      payer_name: payload.PayerName ?? null,
      payer_email: payload.PayerEmail ?? null,
      payer_phone: payload.PayerPhone ?? null,
      payment_type: payload.PaymentType ?? null,
      payment_date: payload.PaymentDate ?? null,
      approval_number: payload.ApprovalNumber ?? null,
      card_last4: payload.CardSuffix ?? null,
      status: success ? "success" : "failure",
      status_code: payload.StatusCode ?? null,
      raw_payload: rawPayload,
      processed: success,
      error_message: processingError,
    });

    if (insertError) {
      console.error("[nedarim-payment-callback] Failed to persist callback:", insertError);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[nedarim-payment-callback] Unhandled error:", message);

    try {
      const supabaseFallback = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseFallback.from("nedarim_donation_callbacks").insert({
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
