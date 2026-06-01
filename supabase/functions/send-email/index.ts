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
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") ?? "noreply@chasdei-olam.co.il";
const FROM_NAME = Deno.env.get("EMAIL_FROM_NAME") ?? "חסדי עולם";
const APP_URL = Deno.env.get("APP_URL") ?? "https://chasdei-olam.co.il";

// Admin email(s) to notify for support tickets
const ADMIN_NOTIFICATION_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";

// ── Supabase service client ───────────────────────────────────────────────────
function makeSvc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Template renderer ─────────────────────────────────────────────────────────
interface TemplateData {
  donorName?: string;
  subject?: string;
  threadId?: string;
  subscriptionId?: string;
  messagePreview?: string;
}

interface EmailContent {
  subject: string;
  html: string;
}

function renderButton(label: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td bgcolor="#0B3C5D" style="border-radius:8px;padding:14px 28px;">
          <a href="${url}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;font-family:Arial,sans-serif;">${label}</a>
        </td>
      </tr>
    </table>`;
}

function wrapEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9F8F4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- header -->
        <tr><td bgcolor="#0B3C5D" style="padding:28px 36px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">חסדי עולם</span>
        </td></tr>
        <!-- body -->
        <tr><td style="padding:36px;color:#1a1a1a;font-size:15px;line-height:1.7;direction:rtl;text-align:right;">
          ${bodyHtml}
        </td></tr>
        <!-- footer -->
        <tr><td style="padding:20px 36px;background:#F9F8F4;text-align:center;color:#999;font-size:12px;border-top:1px solid #eeece8;">
          הודעה זו נשלחה אוטומטית ממערכת חסדי עולם
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderTemplate(template: string, data: TemplateData, appUrl: string): EmailContent | null {
  const adminSupportUrl = `${appUrl}/admin/support${data.threadId ? `?thread=${data.threadId}` : ""}`;
  const userSupportUrl = `${appUrl}/support`;
  const userDashboardUrl = `${appUrl}/dashboard`;

  switch (template) {
    // ── Support: new ticket ────────────────────────────────────────────────
    case "new_support_ticket":
      return {
        subject: "פנייה חדשה התקבלה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">פנייה חדשה התקבלה</p>
          <p>התקבלה פנייה חדשה במערכת.</p>
          ${data.donorName ? `<p><strong>תורם:</strong> ${escHtml(data.donorName)}</p>` : ""}
          ${data.subject ? `<p><strong>נושא:</strong> ${escHtml(data.subject)}</p>` : ""}
          ${data.messagePreview ? `<p style="background:#f4f4f4;padding:12px 16px;border-radius:8px;margin:16px 0;font-style:italic;">${escHtml(data.messagePreview)}</p>` : ""}
          ${renderButton("פתח פנייה", adminSupportUrl)}
        `),
      };

    // ── Support: user replied ──────────────────────────────────────────────
    case "support_user_reply":
      return {
        subject: "תגובה חדשה התקבלה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">תגובה חדשה התקבלה</p>
          <p>התקבלה תגובה חדשה ממשתמש.</p>
          ${data.donorName ? `<p><strong>תורם:</strong> ${escHtml(data.donorName)}</p>` : ""}
          ${data.subject ? `<p><strong>פנייה:</strong> ${escHtml(data.subject)}</p>` : ""}
          ${data.messagePreview ? `<p style="background:#f4f4f4;padding:12px 16px;border-radius:8px;margin:16px 0;font-style:italic;">${escHtml(data.messagePreview)}</p>` : ""}
          ${renderButton("פתח פנייה", adminSupportUrl)}
        `),
      };

    // ── Support: admin replied → user ─────────────────────────────────────
    case "support_admin_reply":
      return {
        subject: "התקבלה תגובה מהתמיכה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">מחכה לך תגובה חדשה</p>
          <p>מחכה לך תגובה חדשה מצוות התמיכה.</p>
          ${data.subject ? `<p><strong>נושא הפנייה:</strong> ${escHtml(data.subject)}</p>` : ""}
          ${data.messagePreview ? `<p style="background:#f0f7ff;padding:12px 16px;border-radius:8px;margin:16px 0;">${escHtml(data.messagePreview)}</p>` : ""}
          ${renderButton("לצפייה בפנייה", userSupportUrl)}
        `),
      };

    // ── Subscription: created ─────────────────────────────────────────────
    case "subscription_created":
      return {
        subject: "המנוי הופעל בהצלחה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">ברוך הבא!</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>תודה על הצטרפותך לפעילות הגמ"ח. המנוי שלך הופעל בהצלחה.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: paused (frozen) ─────────────────────────────────────
    case "subscription_frozen":
      return {
        subject: "המנוי הושהה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">המנוי הושהה</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>המנוי שלך הושהה. ניתן לחדשו בכל עת דרך האזור האישי.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: resumed ─────────────────────────────────────────────
    case "subscription_resumed":
      return {
        subject: "המנוי חודש",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">המנוי חודש בהצלחה</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>המנוי שלך חודש בהצלחה.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: canceled ────────────────────────────────────────────
    case "subscription_canceled":
      return {
        subject: "המנוי בוטל",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">המנוי בוטל</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>המנוי שלך בוטל. אם מדובר בטעות או ברצונך להצטרף מחדש, אנחנו כאן.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: status changed by sync ──────────────────────────────
    case "subscription_sync_change":
      return {
        subject: "עדכון במצב המנוי",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">עדכון במצב המנוי</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>זוהה שינוי במצב המנוי שלך.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: bank direct debit approved ──────────────────────────
    case "subscription_bank_approved":
      return {
        subject: "הוראת קבע בנקאית אושרה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">הוראת הקבע הבנקאית אושרה</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>הבקשה לחברות בגמ"ח באמצעות הוראת קבע בנקאית אושרה והמנוי הוקם בהצלחה.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    // ── Subscription: bank direct debit canceled ──────────────────────────
    case "subscription_bank_canceled":
      return {
        subject: "הוראת הקבע הבנקאית בוטלה",
        html: wrapEmail(`
          <p style="font-size:18px;font-weight:700;margin:0 0 16px;">הוראת הקבע הבנקאית בוטלה</p>
          ${data.donorName ? `<p>שלום ${escHtml(data.donorName)},</p>` : ""}
          <p>הוראת הקבע הבנקאית שלך בוטלה.</p>
          ${renderButton("לאזור האישי", userDashboardUrl)}
        `),
      };

    default:
      return null;
  }
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Resend API call (single attempt) ─────────────────────────────────────────
async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; providerResponse: unknown }> {
  if (!RESEND_API_KEY) {
    return { ok: false, providerResponse: { error: "RESEND_API_KEY not configured" } };
  }
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
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({ status: res.status }));
  return { ok: res.ok, providerResponse: body };
}

// ── Log to DB ─────────────────────────────────────────────────────────────────
async function logEmail(svc: ReturnType<typeof makeSvc>, opts: {
  recipient: string;
  template: string;
  subject: string;
  relatedId?: string;
  relatedType?: string;
  success: boolean;
  providerResponse: unknown;
  errorMessage?: string;
  retryCount: number;
}) {
  try {
    await svc.from("email_log").insert({
      recipient: opts.recipient,
      template: opts.template,
      subject: opts.subject,
      related_id: opts.relatedId ?? null,
      related_type: opts.relatedType ?? null,
      success: opts.success,
      provider_response: opts.providerResponse,
      error_message: opts.errorMessage ?? null,
      retry_count: opts.retryCount,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[email-log] Failed to write log:", e);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { template, to, data = {}, relatedId, relatedType } = body as {
      template: string;
      to: string;
      data?: TemplateData;
      relatedId?: string;
      relatedType?: string;
    };

    const ADMIN_TEMPLATES = ["new_support_ticket", "support_user_reply"];
    if (!template || (!to && !ADMIN_TEMPLATES.includes(template))) {
      return new Response(JSON.stringify({ error: "template and to are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = makeSvc();
    const appUrl = data.appUrl || APP_URL;

    // For admin-directed templates, always send to ADMIN_NOTIFICATION_EMAIL
    // (the caller may pass to="" and rely on the env-configured address)
    const isAdminTemplate = ["new_support_ticket", "support_user_reply"].includes(template);
    let recipient = to;
    if (isAdminTemplate) {
      recipient = ADMIN_NOTIFICATION_EMAIL || to;
      if (!recipient) {
        console.warn(`[send-email] No admin email for template ${template}`);
        return new Response(JSON.stringify({ ok: false, error: "No admin email configured" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const content = renderTemplate(template, data, appUrl);
    if (!content) {
      console.warn(`[send-email] Unknown template: ${template}`);
      return new Response(JSON.stringify({ ok: false, error: `Unknown template: ${template}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send with one retry on failure
    let result = await sendViaResend(recipient, content.subject, content.html);
    let retryCount = 0;

    if (!result.ok) {
      // Retry once after 1s for transient errors
      await new Promise((r) => setTimeout(r, 1000));
      result = await sendViaResend(recipient, content.subject, content.html);
      retryCount = 1;
    }

    await logEmail(svc, {
      recipient,
      template,
      subject: content.subject,
      relatedId,
      relatedType,
      success: result.ok,
      providerResponse: result.providerResponse,
      errorMessage: result.ok ? undefined : JSON.stringify(result.providerResponse),
      retryCount,
    });

    console.log(`[send-email] template=${template} to=${recipient} ok=${result.ok} retries=${retryCount}`);

    return new Response(JSON.stringify({ ok: result.ok }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error("[send-email] Fatal:", msg);
    // Never return 5xx — log and return ok:false
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
