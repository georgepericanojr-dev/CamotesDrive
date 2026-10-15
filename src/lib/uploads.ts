import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { supabase } from "./supabase";
export async function pickUpload(
  bucket:
    | "vehicle-photos"
    | "verification-documents"
    | "payment-proofs"
    | "handover-photos",
  vehicleId?: string,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in to upload a file");
  const imagesOnly =
    bucket === "vehicle-photos" || bucket === "handover-photos";
  const result = await DocumentPicker.getDocumentAsync({
    type: imagesOnly
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    // Expo Go can scope FileSystem access differently from DocumentPicker's
    // Android cache. Read the selected content:// URI while its picker grant
    // is active; iOS still needs its cache copy for immediate file access.
    copyToCacheDirectory: Platform.OS !== "android",
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const limit =
    bucket === "verification-documents" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (asset.size && asset.size > limit)
    throw new Error(`Choose a file smaller than ${limit / 1024 / 1024} MB`);
  let bytes: ArrayBuffer;
  try {
    bytes =
      Platform.OS === "web" && asset.file
        ? await asset.file.arrayBuffer()
        : await new File(asset.uri).arrayBuffer();
  } catch {
    throw new Error(
      "Cannot read the selected file. Choose it again from Files or Downloads. If it is stored online, download it to your device first, then retry.",
    );
  }
  if (bytes.byteLength > limit)
    throw new Error(`Choose a file smaller than ${limit / 1024 / 1024} MB`);
  if (!bytes.byteLength)
    throw new Error("The selected file is empty. Choose another file.");
  const extension = (asset.name.split(".").pop() || "jpg")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const path = `${session.user.id}/${vehicleId ? `${vehicleId}/` : ""}${randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: asset.mimeType || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
export async function signedFile(bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}
