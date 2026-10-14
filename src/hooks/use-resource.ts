import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import { api, ApiError } from "@/lib/api";
import { useApp } from "@/state/app";
export function useResource<T>(path: string | null, poll = 0) {
  const { session } = useApp();
  const [revision, setRevision] = useState(0);
  const key = path
    ? `${session?.user.id || "guest"}:${session?.expires_at || 0}:${revision}:${path}`
    : null;
  const [state, setState] = useState<{
    key: string | null;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key, data: null, error: "", loading: !!path });
  const refresh = () => setRevision((n) => n + 1);
  useFocusEffect(
    useCallback(() => {
      if (!path) return;
      let active = true;
      const controller = new AbortController();
      const load = async () => {
        try {
          const data = await api<T>(path, undefined, controller.signal);
          if (active) setState({ key, data, error: "", loading: false });
        } catch (e) {
          if (active)
            setState((old) => ({
              ...old,
              key,
              data:
                old.key === key &&
                !(e instanceof ApiError && [401, 403].includes(e.status))
                  ? old.data
                  : null,
              error: e instanceof Error ? e.message : "Request failed",
              loading: false,
            }));
        }
      };
      void load();
      const timer = poll
        ? setInterval(() => {
            if (AppState.currentState === "active") void load();
          }, poll)
        : null;
      return () => {
        active = false;
        controller.abort();
        if (timer) clearInterval(timer);
      };
    }, [path, poll, key]),
  );
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : "",
    loading: !!path && (state.key !== key || state.loading),
    refresh,
  };
}
