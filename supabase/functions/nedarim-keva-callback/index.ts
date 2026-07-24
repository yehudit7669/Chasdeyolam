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

// ---------------------------------------------------------------------------
// ביטול הוראת קבע ישנה בעת החלפת תוכנית (plan_change_requests, status='approved')
// ---------------------------------------------------------------------------
const NEDARIM_BASE = "https://matara.pro/nedarimplus/Reports/Manage3.aspx";

async function deleteOldKeva(kevaId: string): Promise<{ success: boolean; error?: string }> {
  const c = {
    MosadId: Deno.env.get("NEDARIM_MOSAD_ID") ?? "7010422",
    ApiPassword: Deno.env.get("NEDARIM_API_PASSWORD") ?? "mj227",
    ApiValid: Deno.env.get("NEDARIM_API_VALID") ?? "Rd8QEQCDEY",
  };
  const url = new URL(NEDARIM_BASE);
  url.searchParams.set("Action", "DeleteKeva");
  url.searchParams.set("MosadId", c.MosadId);
  url.searchParams.set("ApiPassword", c.ApiPassword);
  url.searchParams.set("ApiValid", c.ApiValid);
  url.searchParams.set("KevaId", kevaId);
  try {
    const res = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    if (text.trim() === "OK") return { success: true };
    return { success: false, error: text.trim() };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// מטפל בתשלום שמשלים בקשת "החלפת תוכנית" (plan_change_requests, status='approved'):
// יוצר מנוי חדש עם חודשי הזיכוי, ומבטל את המנוי/הוראת הקבע הישנים.
async function handlePlanChangeIfApplicable(
  supabase: ReturnType<typeof makeSupabase>,
  profileId: string,
  newPlanId: string,
  kevaId: string,
  nextPaymentDate: string | null
): Promise<string | null> {
  const { data: reqRow } = await supabase
    .from("plan_change_requests")
    .select("id, old_subscription_id, credited_months")
    .eq("user_id", profileId).eq("new_plan_id", newPlanId).eq("status", "approved")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!reqRow) return null;

  const { data: plan } = await supabase
    .from("plans").select("required_successful_payments").eq("id", newPlanId).maybeSingle();
  const required = plan?.required_successful_payments ?? 15;
  const creditedMonths = reqRow.credited_months ?? 0;

  const { data: newSub } = await supabase
    .from("subscriptions").insert({
      user_id: profileId, plan_id: newPlanId, status: "active",
      keva_id: kevaId, subscription_source: "nedarim_iframe",
      successful_payments_count: 0, failed_payment_attempts: 0,
      credited_payments: creditedMonths,
      is_eligible: creditedMonths >= required,
      started_at: new Date().toISOString(),
      next_payment_date: nextPaymentDate,
    }).select("id").single();
  const newSubscriptionId = newSub?.id ?? null;

  const { data: oldSub } = await supabase
    .from("subscriptions").select("id, keva_id").eq("id", reqRow.old_subscription_id).maybeSingle();

  let cancelResult: { success: boolean; error?: string } = { success: false, error: "no keva_id on old subscription" };
  if (oldSub?.keva_id) cancelResult = await deleteOldKeva(oldSub.keva_id);

  if (cancelResult.success) {
    await supabase.from("subscriptions").update({
      status: "canceled", canceled_at: new Date().toISOString(),
      cancellation_reason: "plan_change", updated_at: new Date().toISOString(),
    }).eq("id", reqRow.old_subscription_id);
  } else {
    console.error("[nedarim-keva-callback] Failed to cancel old keva on plan change:", cancelResult.error);
  }

  await supabase.from("plan_change_requests").update({
    status: "completed", new_subscription_id: newSubscriptionId,
    admin_note: cancelResult.success ? null : `⚠️ ביטול הוראת הקבע הישנה נכשל אוטומטית: ${cancelResult.error}. נדרש טיפול ידני!`,
    updated_at: new Date().toISOString(),
  }).eq("id", reqRow.id);

  const base = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", profileId).maybeSingle();
  if (profile?.email) {
    EdgeRuntime.waitUntil(
      fetch(`${base}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
        body: JSON.stringify({
          template: "plan_change_completed", to: profile.email,
          data: { donorName: profile.full_name || profile.email },
          relatedId: newSubscriptionId, relatedType: "subscription",
        }),
      }).catch((e: unknown) => console.error("[nedarim-keva-callback] plan change email error:", e))
    );
  }
  if (!cancelResult.success) {
    EdgeRuntime.waitUntil(
      fetch(`${base}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
        body: JSON.stringify({
          template: "plan_change_manual_action_needed", to: "sh0533130728@gmail.com",
          data: { donorName: profile?.full_name || profile?.email || "תורם", error: cancelResult.error ?? "" },
          relatedId: reqRow.old_subscription_id, relatedType: "subscription",
        }),
      }).catch((e: unknown) => console.error("[nedarim-keva-callback] admin alert email error:", e))
    );
  }

  return newSubscriptionId;
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

      // בדיקה ראשונה: האם זה תשלום שמשלים בקשת "החלפת תוכנית" מאושרת?
      // אם כן — יוצר מנוי חדש עם חודשי הזיכוי ומבטל את הישן. לא עובר דרך existingSub הרגיל,
      // כדי שלא יחליף בטעות רק את ה-keva_id של המנוי הישן ותוך כדי ישמור על plan_id הישן.
      const planChangeSubId = planId
        ? await handlePlanChangeIfApplicable(supabase, profileId, planId, payload.KevaId, nextPaymentDate)
        : null;

      let existingSub: { id: string } | null = null;

      if (planChangeSubId) {
        subscriptionId = planChangeSubId;
      } else {
        const { data: existingSubRow } = await supabase
          .from("subscriptions").select("id")
          .eq("user_id", profileId).in("status", ["active", "frozen"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        existingSub = existingSubRow;

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
      }

      if (subscriptionId) {
        console.log("[nedarim-keva-callback] Subscription linked", {
          subscriptionId, kevaId: payload.KevaId, identitySource,
        });

        // Fire subscription_created email for brand-new subscriptions only
        // (plan-change subscriptions already got their own "plan_change_completed" email above)
        if (!existingSub && !planChangeSubId) {
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

          // Notify admin — new subscription actually created (not just started)
          const { data: planRow } = await supabase
            .from("plans").select("name_he").eq("id", planId!).maybeSingle();
          EdgeRuntime.waitUntil(
            fetch(`${base}/functions/v1/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${svcKey}` },
              body: JSON.stringify({
                template: "new_subscription_admin",
                to: "sh0533130728@gmail.com",
                data: {
                  donorName: profile?.full_name || profile?.email || "תורם",
                  planName: planRow?.name_he || "תוכנית לא ידועה",
                },
                relatedId: subscriptionId,
                relatedType: "subscription",
              }),
            }).catch((e: unknown) => console.error("[nedarim-keva-callback] admin email error:", e))
          );
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

    // חיזוק נוסף (warn-only, לא חוסם עדיין) — MosadNumber חשוף בקוד הלקוח כך שזה לא סוד
    // אמיתי, אבל מסנן payloads רשלניים/גנריים במקום לקבל כל דבר עם שדה לא-ריק.
    const EXPECTED_MOSAD = "7010422";
    if (payload.MosadNumber !== EXPECTED_MOSAD) {
      console.warn("[nedarim-keva-callback] MosadNumber לא תואם לצפוי", { received: payload.MosadNumber });
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
