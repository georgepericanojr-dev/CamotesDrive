import { createClient } from "@supabase/supabase-js";
import { databaseStatus, resolveRoute, routes } from "./routes.ts";

export function createHandler({
  url,
  key,
  origins = [],
}: {
  url?: string;
  key?: string;
  origins?: string[];
}) {
  return async (request: Request) => {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("origin");
    const cors = {
      "Access-Control-Allow-Origin": origins.length
        ? origin && origins.includes(origin)
          ? origin
          : origins[0]
        : "*",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      Vary: "Origin",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    };
    const respond = (data: unknown, status = 200) =>
      Response.json(data, { status, headers: cors });
    if (origin && origins.length && !origins.includes(origin))
      return respond({ error: "Origin not allowed", requestId }, 403);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (!url || !key)
      return respond({ error: "Server configuration missing", requestId }, 503);
    try {
      const parsed = new URL(request.url);
      const path =
        parsed.pathname
          .replace(/^.*\/camotes-api(?=\/|$)/, "")
          .replace(/\/$/, "") || "/";
      if (path === "/health" && request.method === "GET")
        return respond({ status: "ok" });
      const route = resolveRoute(request.method, path);
      if (!route)
        return respond(
          {
            error: routes.some((r) => r.pattern.test(path))
              ? "Method not allowed"
              : "Route not found",
            requestId,
          },
          routes.some((r) => r.pattern.test(path)) ? 405 : 404,
        );
      const token = request.headers.get("authorization");
      const client = createClient(url, key, {
        global: { headers: token ? { Authorization: token } : {} },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      if (!route.public) {
        if (!token?.startsWith("Bearer "))
          return respond({ error: "Sign in required", requestId }, 401);
        const { data, error } = await client.auth.getUser(token.slice(7));
        if (error || !data.user)
          return respond(
            { error: "Session expired; sign in again", requestId },
            401,
          );
      }
      let input: Record<string, unknown> = {};
      if (request.method === "POST") {
        // Check actual bytes, including chunked requests without Content-Length.
        if (Number(request.headers.get("content-length") || 0) > 65536)
          return respond({ error: "Request too large", requestId }, 413);
        const chunks: Uint8Array[] = [];
        let length = 0;
        const reader = request.body?.getReader();
        if (reader)
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            length += next.value.byteLength;
            if (length > 65536) {
              await reader.cancel();
              return respond({ error: "Request too large", requestId }, 413);
            }
            chunks.push(next.value);
          }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        const raw = new TextDecoder().decode(bytes);
        try {
          input = JSON.parse(raw || "{}");
        } catch {
          return respond({ error: "Invalid JSON", requestId }, 400);
        }
        if (!input || Array.isArray(input) || typeof input !== "object")
          return respond({ error: "JSON object required", requestId }, 400);
      } else input = Object.fromEntries(parsed.searchParams);
      // URL identity always wins over an untrusted JSON body/query parameter.
      if (route.captured)
        input[route.idKey || "id"] = decodeURIComponent(route.captured);
      const { data, error } = route.resource
        ? await client.rpc("camotes_read", {
            resource: route.resource,
            params: input,
          })
        : await client.rpc("camotes_mutate", {
            action: route.action,
            payload: input,
          });
      if (error) {
        const status = databaseStatus(error.code);
        const message =
          status === 503
            ? "Database API migration is not installed"
            : status === 409
              ? "This action conflicts with another update; refresh and try again"
              : error.code === "P0001" ||
                  status === 403 ||
                  status === 404 ||
                  status === 429
                ? error.message
                : "Invalid request; check the required fields";
        return respond({ error: message, code: error.code, requestId }, status);
      }
      return respond({ data });
    } catch {
      return respond({ error: "Unable to process request", requestId }, 500);
    }
  };
}
