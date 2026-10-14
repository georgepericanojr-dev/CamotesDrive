import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
type Manifest = { version: string; chunks: number; encoding?: "uri" };
async function manifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(`${key}.manifest`);
  return raw ? JSON.parse(raw) : null;
}
async function removeChunks(key: string, m: Manifest | null) {
  if (m)
    await Promise.all(
      Array.from({ length: m.chunks }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}.${m.version}.${i}`),
      ),
    );
}
// Session JSON can exceed the historic 2 KB iOS keychain item limit. Small
// chunks + an atomic manifest keep the previous session intact on write failure.
export const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web")
      return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(key);
    const m = await manifest(key);
    if (!m) return null;
    const parts = await Promise.all(
      Array.from({ length: m.chunks }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${m.version}.${i}`),
      ),
    );
    if (parts.some((p) => p === null)) return null;
    return m.encoding === "uri"
      ? decodeURIComponent(parts.join(""))
      : parts.join("");
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined")
        window.localStorage.setItem(key, value);
      return;
    }
    const old = await manifest(key);
    const encoded = encodeURIComponent(value);
    const next: Manifest = {
      version: randomUUID(),
      chunks: Math.ceil(encoded.length / 1900),
      encoding: "uri",
    };
    try {
      for (let i = 0; i < next.chunks; i++)
        await SecureStore.setItemAsync(
          `${key}.${next.version}.${i}`,
          encoded.slice(i * 1900, (i + 1) * 1900),
        );
      await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify(next));
    } catch (e) {
      await removeChunks(key, next);
      throw e;
    }
    await removeChunks(key, old);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
      return;
    }
    const m = await manifest(key);
    await SecureStore.deleteItemAsync(`${key}.manifest`);
    await removeChunks(key, m);
  },
};
