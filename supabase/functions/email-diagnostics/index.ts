import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "(not set)";
    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "(not set)";
    const APP_URL = Deno.env.get("APP_URL") ?? "(not set)";

    // 1. Report env vars (mask key, show domain only)
    const keyMasked = RESEND_API_KEY ? RESEND_API_KEY.slice(0, 8) + "..." : "(not set)";
    const fromDomain = EMAIL_FROM.includes("@") ? EMAIL_FROM.split("@")[1] : EMAIL_FROM;

    // 2. Call Resend directly to check domain list
    const domainsRes = await fetch("https://api.resend.com/domains", {
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}` },
    });
    const domainsBody = await domainsRes.json().catch(() => null);

    // 3. Send a test email directly to ADMIN_EMAIL with exact from
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `חסדי עולם <${EMAIL_FROM}>`,
        to: [ADMIN_EMAIL],
        subject: "Diagnostic test — chasdeyolam.com delivery",
        html: "<p>This is a diagnostic delivery test. If you receive this, Resend is working correctly with the verified domain.</p>",
      }),
    });
    const sendBody = await sendRes.json().catch(() => null);

    return new Response(JSON.stringify({
      env: {
        RESEND_API_KEY: keyMasked,
        EMAIL_FROM,
        EMAIL_FROM_domain: fromDomain,
        ADMIN_EMAIL,
        APP_URL,
      },
      resend_domains_status: domainsRes.status,
      resend_domains: domainsBody,
      test_send_status: sendRes.status,
      test_send_response: sendBody,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
