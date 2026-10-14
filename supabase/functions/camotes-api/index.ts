import { createHandler } from "./handler.ts";
let publishable: string | undefined;
try {
  publishable = JSON.parse(
    Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}",
  ).default;
} catch {}
Deno.serve(
  createHandler({
    url: Deno.env.get("SUPABASE_URL"),
    key: publishable || Deno.env.get("SUPABASE_ANON_KEY"),
    origins: (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  }),
);
