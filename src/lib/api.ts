import { configured, supabase, supabaseAnonKey, supabaseUrl } from "./supabase";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
const apiUrl =
  process.env.EXPO_PUBLIC_API_URL || `${supabaseUrl}/functions/v1/camotes-api`;
export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  if (!configured)
    throw new ApiError(
      "Add your Supabase public URL and anon key to .env, then restart Expo.",
      503,
    );
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  let response: Response;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 20000);
  const abort = () => timeout.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        apikey: supabaseAnonKey,
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout.signal,
    });
  } catch {
    throw new ApiError(
      signal?.aborted
        ? "Request cancelled"
        : "Cannot reach CamotesDrive. Check your connection and API deployment.",
      0,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
  const result = await response
    .json()
    .catch(() => ({ error: "The API returned an unreadable response" }));
  if (!response.ok)
    throw new ApiError(
      response.status === 404 && !result.code
        ? "API route unavailable. Deploy the camotes-api Edge Function."
        : result.error || "Request failed",
      response.status,
      result.code,
    );
  return result.data as T;
}
export const photoUrl = (path: string) =>
  supabase.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl;
