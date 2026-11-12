import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHandler } from "./handler.ts";

// נקודת קבלה ללוגים של "שולחני": https://chasdeyolam.com/api/shulchani/logs (הפניה ב-netlify.toml).
// פריסה בלי בדיקת JWT (התוכנה לא שולחת Authorization), והמפתח נשמר כ-secret בשם SHULCHANI_LOGS_KEY.

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const handler = createHandler({
  key: Deno.env.get("SHULCHANI_LOGS_KEY") ?? "",
  insert: async (rows) => {
    const { error } = await supabase.from("shulchani_logs").insert(rows);
    if (error) throw new Error(error.message);
  },
  countRecent: async (install, sinceIso) => {
    const { count, error } = await supabase
      .from("shulchani_logs")
      .select("id", { count: "exact", head: true })
      .eq("install", install)
      .gte("received_at", sinceIso);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
});

Deno.serve(async (req: Request) => {
  try {
    return await handler(req);
  } catch (err) {
    console.error("shulchani-logs error:", err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: "server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
