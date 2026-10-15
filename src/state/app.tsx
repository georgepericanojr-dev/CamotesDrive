import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { api, ApiError, photoUrl } from "@/lib/api";
import { configured, supabase } from "@/lib/supabase";
import { signOutCurrentDevice } from "@/lib/auth-session";
import {
  asRow,
  mapTrip,
  rows,
  text,
  type Mode,
  type Row,
  type Trip,
} from "@/data/models";
type Me = {
  profile: Row;
  roles: Row[];
  favorites: string[];
  driver_profile: Row | null;
};
type App = {
  session: Session | null;
  signedIn: boolean;
  initializing: boolean;
  identityLoading: boolean;
  identityError: string;
  mode: Mode;
  modes: Mode[];
  setMode: (m: Mode) => Promise<void>;
  profile: Row;
  roles: Row[];
  name: string;
  favorites: string[];
  trips: Trip[];
  ownedVehicles: Row[];
  driverProfile: Row;
  settings: Row;
  chauffeur: boolean;
  notice: string;
  toast: (s: string) => void;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  mutate: <T = Row>(path: string, body: unknown) => Promise<T>;
  signOut: () => Promise<void>;
};
const Context = createContext<App | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [mode, setModeState] = useState<Mode>("Renter");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [ownedVehicles, setOwned] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Row>({});
  const [notice, toast] = useState("");
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState(
    configured
      ? ""
      : "Configure your Supabase public URL and anon key, then restart Expo.",
  );
  const generation = useRef(0);
  const refreshSequence = useRef(0);
  const userId = useRef<string | null>(null);
  const clearPrivate = useCallback(() => {
    setMe(null);
    setTrips([]);
    setOwned([]);
    setIdentityError("");
    setIdentityLoading(false);
    setModeState("Renter");
  }, []);
  useEffect(() => {
    let mounted = true;
    let eventReceived = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true;
      if (userId.current !== next?.user.id) {
        generation.current++;
        clearPrivate();
        userId.current = next?.user.id || null;
      }
      setSession(next);
      setInitializing(false);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (mounted && !eventReceived) {
          if (error) toast(error.message);
          userId.current = data.session?.user.id || null;
          setSession(data.session);
          setInitializing(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          toast(e.message);
          setInitializing(false);
        }
      });
    const appState = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") {
        if (state === "active") supabase.auth.startAutoRefresh();
        else supabase.auth.stopAutoRefresh();
      }
    });
    if (Platform.OS !== "web" && AppState.currentState === "active")
      supabase.auth.startAutoRefresh();
    return () => {
      mounted = false;
      subscription.unsubscribe();
      appState.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [clearPrivate]);
  const refresh = useCallback(async () => {
    if (!configured) {
      return;
    }
    const epoch = generation.current;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    setIdentityLoading(!!session);
    try {
      // A catalog/provider failure must not hide a successfully loaded identity.
      const [config, identity, bookings, owned] = await Promise.allSettled([
        api<Row>("/settings"),
        session ? api<Me>("/me") : Promise.resolve(null),
        session ? api<Row[]>("/bookings?limit=50") : Promise.resolve([]),
        session ? api<Row[]>("/owned-vehicles") : Promise.resolve([]),
      ]);
      if (epoch !== generation.current || sequence !== refreshSequence.current)
        return;
      if (config.status === "fulfilled") setSettings(asRow(config.value));
      if (identity.status === "fulfilled" && identity.value) {
        const current = identity.value;
        setMe(current);
        setIdentityError("");
        const preferred = text(current.profile.preferred_mode);
        const active = current.roles.some(
          (r) => r.role === preferred && r.status === "active",
        );
        setModeState(
          active
            ? ((preferred[0].toUpperCase() + preferred.slice(1)) as Mode)
            : "Renter",
        );
      } else if (identity.status === "rejected") {
        setIdentityError(
          identity.reason instanceof Error
            ? identity.reason.message
            : "Could not load your account",
        );
        if (
          identity.reason instanceof ApiError &&
          [401, 403].includes(identity.reason.status)
        )
          setMe(null);
      }
      if (bookings.status === "fulfilled")
        setTrips(rows(bookings.value).map((b) => mapTrip(b, photoUrl)));
      if (owned.status === "fulfilled") setOwned(rows(owned.value));
      const failure = [identity, config, bookings, owned].find(
        (result) => result.status === "rejected",
      );
      setError(
        failure?.status === "rejected"
          ? failure.reason instanceof Error
            ? failure.reason.message
            : "Could not load data"
          : "",
      );
    } catch (e) {
      if (epoch === generation.current && sequence === refreshSequence.current)
        setError(e instanceof Error ? e.message : "Could not load data");
    } finally {
      if (
        epoch === generation.current &&
        sequence === refreshSequence.current
      ) {
        setLoading(false);
        setIdentityLoading(false);
      }
    }
  }, [session]);
  useEffect(() => {
    let active = true;
    // Leave Supabase's auth notification/refresh lock before reading the session.
    queueMicrotask(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);
  const mutate = useCallback(
    async <T = Row,>(path: string, body: unknown): Promise<T> => {
      const result = await api<T>(path, body);
      if (
        !/^\/(messages|notifications\/read|blocks|reports|reviews)$/.test(path)
      )
        void refresh();
      return result;
    },
    [refresh],
  );
  const modes: Mode[] = ["Renter"];
  if (me?.roles.some((r) => r.role === "owner" && r.status === "active"))
    modes.push("Owner");
  if (me?.roles.some((r) => r.role === "driver" && r.status === "active"))
    modes.push("Driver");
  const setMode = async (m: Mode) => {
    if (!modes.includes(m))
      throw new Error("This provider role is not verified");
    await mutate("/me/mode", { mode: m.toLowerCase() });
    setModeState(m);
  };
  const toggleFavorite = async (id: string) => {
    if (!session) {
      toast("Sign in to save a vehicle.");
      return;
    }
    try {
      const saved = !me?.favorites.includes(id);
      await mutate("/favorites", { vehicle_id: id, saved });
      setMe((old) =>
        old
          ? {
              ...old,
              favorites: saved
                ? [...old.favorites, id]
                : old.favorites.filter((x) => x !== id),
            }
          : old,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save favorite");
    }
  };
  const signOut = async () => {
    const { remoteConfirmed } = await signOutCurrentDevice(supabase.auth);
    generation.current++;
    clearPrivate();
    setSession(null);
    toast(
      remoteConfirmed
        ? "Signed out successfully."
        : "Signed out on this device. Server sign-out could not be confirmed.",
    );
  };
  return (
    <Context.Provider
      value={{
        identityLoading,
        identityError,
        session,
        signedIn: !!session,
        initializing,
        mode,
        modes,
        setMode,
        profile: me?.profile || {},
        roles: me?.roles || [],
        name: text(me?.profile.full_name) || "Explorer",
        favorites: me?.favorites || [],
        trips,
        ownedVehicles,
        driverProfile: me?.driver_profile || {},
        settings,
        chauffeur: settings.chauffeur_enabled === true,
        notice,
        toast,
        loading,
        error,
        refresh,
        toggleFavorite,
        mutate,
        signOut,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider required");
  return value;
}
