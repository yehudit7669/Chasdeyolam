import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/*
  send-email — Centralised email dispatch via Resend

  Accepts POST with JSON body:
  {
    template: string,          // e.g. "new_support_ticket"
    to: string,                // recipient email
    idempotencyKey?: string,   // optional dedup key
    data: {                    // template-specific variables
      donorName?: string,
      adminName?: string,
      subject?: string,
      threadId?: string,
      subscriptionId?: string,
      appUrl?: string,
    }
  }

  Uses RESEND_API_KEY secret.
  Logs every attempt to email_log table.
  Retries once on transient (5xx / network) failure.
  Never returns a 5xx to the caller — failures are logged silently.
*/

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Config ────────────────────────────────────────────────────────────────────
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Always use the verified domain address. The EMAIL_FROM secret may hold a
// stale placeholder (onboarding@resend.dev); we override it here so Resend
// accepts delivery to any recipient, not just the account owner.
const _FROM_SECRET = Deno.env.get("EMAIL_FROM") ?? "";
const FROM_ADDRESS = (_FROM_SECRET && !_FROM_SECRET.endsWith("@resend.dev"))
  ? _FROM_SECRET
  : "support@chasdeyolam.com";
const FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "חסדי עולם";
const APP_URL = Deno.env.get("APP_URL") ?? "https://chasdeyolam.com";

// Admin email(s) to notify for support tickets
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "support@chasdeyolam.com";

// ── Supabase client (service role for logging) ────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// ── Template registry ─────────────────────────────────────────────────────────
interface TemplateData {
  donorName?: string;
  adminName?: string;
  subject?: string;
  threadId?: string;
  messagePreview?: string;
  subscriptionId?: string;
  appUrl?: string;
  body?: string;
  link?: string;
  planName?: string;
  error?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// ניקוי קלט לפני שתילה ב-HTML של המייל — מנטרל תגיות/שבירת מרכאות (הגנת HTML injection)
function sanitize(s: string | undefined): string | undefined {
  if (s === undefined || s === null) return s ?? undefined;
  return String(s).replace(/[<>"]/g, "");
}

function buildEmail(template: string, data: TemplateData, appUrl: string): EmailPayload | null {
  data = {
    ...data,
    donorName: sanitize(data.donorName),
    adminName: sanitize(data.adminName),
    subject: sanitize(data.subject),
    messagePreview: sanitize(data.messagePreview),
    body: sanitize(data.body),
    error: sanitize(data.error),
    // קישור פנימי בלבד — חייב להתחיל ב-/ (מנטרל הזרקת כתובת זרה ל-href)
    link: data.link && data.link.startsWith("/") ? sanitize(data.link) : undefined,
  };
  const url = data.appUrl ?? appUrl;

  switch (template) {
    case "new_support_ticket":
      return {
        to: ADMIN_EMAIL,
        subject: `פנייה חדשה: ${data.subject ?? "ללא נושא"}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">פנייה חדשה התקבלה</h2>
            <p><strong>שם התורם:</strong> ${data.donorName ?? "לא ידוע"}</p>
            <p><strong>נושא:</strong> ${data.subject ?? "ללא נושא"}</p>
            ${data.messagePreview ? `<p><strong>תוכן:</strong> ${data.messagePreview}</p>` : ""}
            <a href="${url}/admin/support${data.threadId ? `?thread=${data.threadId}` : ""}"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              צפה בפנייה
            </a>
          </div>`,
      };

    case "support_user_reply":
      return {
        to: ADMIN_EMAIL,
        subject: `תגובה חדשה: ${data.subject ?? "ללא נושא"}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">תגובה חדשה מהתורם</h2>
            <p><strong>שם התורם:</strong> ${data.donorName ?? "לא ידוע"}</p>
            <p><strong>נושא:</strong> ${data.subject ?? "ללא נושא"}</p>
            ${data.messagePreview ? `<p><strong>תוכן:</strong> ${data.messagePreview}</p>` : ""}
            <a href="${url}/admin/support${data.threadId ? `?thread=${data.threadId}` : ""}"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              צפה וענה
            </a>
          </div>`,
      };

    case "support_admin_reply":
      return {
        to: data.donorName ? "" : "", // caller must supply `to`
        subject: `תשובה לפנייתך: ${data.subject ?? "ללא נושא"}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">קיבלת תשובה לפנייתך</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            ${data.messagePreview ? `<p>${data.messagePreview}</p>` : ""}
            <a href="${url}/support${data.threadId ? `?thread=${data.threadId}` : ""}"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              צפה בשיחה
            </a>
          </div>`,
      };

    case "subscription_created":
      return {
        to: "",
        subject: "ברוכים הבאים לחסדי עולם!",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">תרומתך נרשמה בהצלחה</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>תודה שהצטרפת לחסדי עולם. תרומתך נרשמה בהצלחה.</p>
            <a href="${url}/dashboard"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לאזור האישי
            </a>
          </div>`,
      };

    case "new_subscription_admin":
      return {
        to: ADMIN_EMAIL,
        subject: `מנוי חדש: ${data.donorName ?? "תורם"} — ${data.planName ?? "תוכנית לא ידועה"}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">מנוי חדש נוצר</h2>
            <p><strong>תורם:</strong> ${data.donorName ?? "לא ידוע"}</p>
            <p><strong>תוכנית:</strong> ${data.planName ?? "לא ידוע"}</p>
            <a href="${url}/admin/donors"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              צפה בתורמים
            </a>
          </div>`,
      };

    case "plan_change_completed":
      return {
        to: "",
        subject: "התוכנית שלך הוחלפה בהצלחה!",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">התוכנית שלך הוחלפה בהצלחה</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>התשלום לתוכנית החדשה התקבל, והתוכנית הקודמת בוטלה. חודשי הזיכוי שהצטברו כבר נכנסו לתוקף.</p>
            <a href="${url}/donor/manage-subscription"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לניהול המנוי
            </a>
          </div>`,
      };

    case "plan_change_manual_action_needed":
      return {
        to: ADMIN_EMAIL,
        subject: `⚠️ נדרש טיפול ידני — ביטול הוראת קבע ישנה נכשל (${data.donorName ?? "תורם"})`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #b91c1c;">נדרש טיפול ידני בהחלפת תוכנית</h2>
            <p><strong>תורם:</strong> ${data.donorName ?? "לא ידוע"}</p>
            <p>המנוי החדש נוצר בהצלחה, אך ביטול הוראת הקבע הישנה בנדרים פלוס נכשל אוטומטית.</p>
            ${data.error ? `<p><strong>פרטי השגיאה:</strong> ${data.error}</p>` : ""}
            <p>יש לבטל את הוראת הקבע הישנה ידנית דרך עמוד "מנויים" באדמין, כדי למנוע חיוב כפול.</p>
            <a href="${url}/admin/subscriptions"
               style="display:inline-block;padding:10px 20px;background:#b91c1c;color:#fff;border-radius:6px;text-decoration:none;">
              לניהול מנויים
            </a>
          </div>`,
      };

    case "subscription_frozen":
      return {
        to: "",
        subject: "תרומתך הושהתה זמנית",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">תרומתך הושהתה</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>תרומתך הושהתה זמנית לפי בקשתך.</p>
            <a href="${url}/donor/manage-subscription"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              נהל תרומה
            </a>
          </div>`,
      };

    case "subscription_resumed":
      return {
        to: "",
        subject: "תרומתך חודשה",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">תרומתך חודשה בהצלחה</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>תרומתך חודשה ותהיה פעילה מחדש.</p>
            <a href="${url}/dashboard"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לאזור האישי
            </a>
          </div>`,
      };

    case "subscription_canceled":
      return {
        to: "",
        subject: "תרומתך בוטלה",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">תרומתך בוטלה</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>תרומתך בוטלה. נשמח לראותך שוב בעתיד.</p>
            <a href="${url}/plans"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              הצטרף מחדש
            </a>
          </div>`,
      };

    case "subscription_sync_change":
      return {
        to: "",
        subject: "עדכון בסטטוס תרומתך",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">עדכון בתרומתך</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>חל שינוי בסטטוס תרומתך. לפרטים נוספים היכנס לאזור האישי.</p>
            <a href="${url}/dashboard"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לאזור האישי
            </a>
          </div>`,
      };

    case "immediate_admin":
      return {
        to: ADMIN_EMAIL,
        subject: data.subject ?? "מימוש מיידי — עדכון",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">${data.subject ?? "מימוש מיידי — עדכון"}</h2>
            <p>${data.body ?? ""}</p>
            <a href="${url}${data.link ?? "/admin/immediate-requests"}"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לניהול הבקשות
            </a>
          </div>`,
      };

    case "immediate_user":
      return {
        to: "", // הנמען מגיע מהקורא (מייל המשתמש)
        subject: data.subject ?? "עדכון בהזמנה שלך",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0B3C5D;">${data.subject ?? "עדכון בהזמנה שלך"}</h2>
            <p>שלום ${data.donorName ?? ""},</p>
            <p>${data.body ?? ""}</p>
            <a href="${url}${data.link ?? "/donor/my-orders"}"
               style="display:inline-block;padding:10px 20px;background:#0B3C5D;color:#fff;border-radius:6px;text-decoration:none;">
              לאזור האישי
            </a>
          </div>`,
      };

    default:
      return null;
  }
}

// ── Send via Resend ───────────────────────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }

  return res.json();
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      template,
      to: recipientOverride,
      data = {},
      relatedId,
      relatedType,
    } = body;

    if (!template) {
      return new Response(JSON.stringify({ ok: false, error: "missing template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = buildEmail(template, data, APP_URL);

    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: `unknown template: ${template}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller-supplied `to` overrides template default
    const finalTo = recipientOverride || email.to;

    if (!finalTo) {
      return new Response(JSON.stringify({ ok: false, error: "missing recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let providerResponse: Record<string, unknown> = {};
    let success = false;
    let errorMessage = "";

    // Attempt with one retry on transient failure
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        providerResponse = await sendViaResend(finalTo, email.subject, email.html);
        success = true;
        break;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        if (attempt === 0 && errorMessage.includes("5")) continue; // retry on 5xx
        break;
      }
    }

    // Log to email_log (best effort)
    try {
      await supabase.from("email_log").insert({
        template,
        recipient: finalTo,
        success,
        error_message: success ? null : errorMessage,
        provider_response: providerResponse,
        retry_count: success ? 0 : 1,
        related_id: relatedId ?? null,
        related_type: relatedType ?? null,
      });
    } catch (_) {
      // logging failure must not affect response
    }

    return new Response(JSON.stringify({ ok: true, success, id: providerResponse.id ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
