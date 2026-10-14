import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { authStorage } from "./auth-storage";

export const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
export const configured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  !supabaseAnonKey.startsWith("sb_secret_");

export const supabase = createClient(
  configured ? supabaseUrl : "https://unconfigured.invalid",
  configured ? supabaseAnonKey : "unconfigured",
  {
    auth: {
      storage: authStorage,
      lock: processLock,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
