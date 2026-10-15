const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real upload helper with native boundary adapters. Node cannot
// run Android's document picker or Expo Go; these tests make no network calls.
const filename = join(__dirname, "../src/lib/uploads.ts");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
  fileName: filename,
}).outputText;
const USER_ID = "00000000-0000-4000-8000-000000000001";
const FILE_ID = "00000000-0000-4000-8000-000000000002";
const VEHICLE_ID = "00000000-0000-4000-8000-000000000003";
const CONTENT_URI =
  "content://com.android.providers.downloads.documents/document/42";
const CACHE_URI =
  "file:///data/user/0/host.exp.exponent/cache/DocumentPicker/picked.pdf";

function fixture({
  platform = "android",
  canceled = false,
  signedIn = true,
  bytes = Uint8Array.from([37, 80, 68, 70]).buffer,
  size = 4,
  name = "Identity.PDF",
  mimeType = "application/pdf",
  localError,
  storageError = null,
  webFile,
} = {}) {
  const calls = { picker: [], nativeReads: [], uploads: [], buckets: [] };
  class NativeFile {
    constructor(uri) {
      this.uri = uri;
    }
    async arrayBuffer() {
      calls.nativeReads.push(this.uri);
      if (localError) throw localError;
      if (platform === "android" && this.uri === CACHE_URI)
        throw new Error("Missing 'READ' permission for accessing the file.");
      return bytes;
    }
  }
  const adapters = {
    "expo-document-picker": {
      async getDocumentAsync(options) {
        calls.picker.push(options);
        return canceled
          ? { canceled: true, assets: null }
          : {
              canceled: false,
              assets: [
                {
                  name,
                  size,
                  mimeType,
                  uri: options.copyToCacheDirectory ? CACHE_URI : CONTENT_URI,
                  ...(webFile ? { file: webFile } : {}),
                },
              ],
            };
      },
    },
    "expo-file-system": { File: NativeFile },
    "expo-crypto": { randomUUID: () => FILE_ID },
    "react-native": { Platform: { OS: platform } },
    "./supabase": {
      supabase: {
        auth: {
          async getSession() {
            return {
              data: {
                session: signedIn ? { user: { id: USER_ID } } : null,
              },
            };
          },
        },
        storage: {
          from(bucket) {
            calls.buckets.push(bucket);
            return {
              async upload(path, body, options) {
                calls.uploads.push({ bucket, path, body, options });
                return { error: storageError };
              },
            };
          },
        },
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module,
      exports: module.exports,
      require(specifier) {
        assert.ok(
          Object.hasOwn(adapters, specifier),
          `Unexpected import: ${specifier}`,
        );
        return adapters[specifier];
      },
    },
    { filename },
  );
  return { ...module.exports, calls, bytes };
}

test("Android uploads the granted content URI instead of Expo Go's unreadable cache copy", async () => {
  const f = fixture();
  const path = await f.pickUpload("verification-documents");

  assert.equal(f.calls.picker[0].copyToCacheDirectory, false);
  assert.equal(f.calls.picker[0].multiple, false);
  assert.deepEqual(Array.from(f.calls.picker[0].type), [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]);
  assert.deepEqual(f.calls.nativeReads, [CONTENT_URI]);
  assert.equal(path, `${USER_ID}/${FILE_ID}.pdf`);
  assert.equal(f.calls.uploads.length, 1);
  const upload = f.calls.uploads[0];
  assert.equal(upload.bucket, "verification-documents");
  assert.equal(upload.path, path);
  assert.strictEqual(upload.body, f.bytes);
  assert.equal(upload.options.contentType, "application/pdf");
  assert.equal(upload.options.upsert, false);
});

test("canceling the document picker does not read a file or call Storage", async () => {
  const f = fixture({ canceled: true });
  assert.equal(await f.pickUpload("verification-documents"), null);
  assert.deepEqual(f.calls.nativeReads, []);
  assert.deepEqual(f.calls.buckets, []);
  assert.deepEqual(f.calls.uploads, []);
});

test("a local read failure gives actionable guidance and never calls Storage", async () => {
  const f = fixture({
    localError: new Error("Missing 'READ' permission for accessing the file."),
  });
  await assert.rejects(f.pickUpload("verification-documents"), (error) => {
    assert.match(error.message, /Cannot read the selected file/);
    assert.match(error.message, /Files or Downloads/);
    assert.match(error.message, /download it to your device first/);
    return true;
  });
  assert.deepEqual(f.calls.buckets, []);
  assert.deepEqual(f.calls.uploads, []);
});

test("web uploads the browser File bytes and restricts vehicle photos to image types", async () => {
  const browserBytes = Uint8Array.from([137, 80, 78, 71]).buffer;
  let browserReads = 0;
  const f = fixture({
    platform: "web",
    name: "Vehicle.PNG",
    mimeType: "image/png",
    webFile: {
      async arrayBuffer() {
        browserReads += 1;
        return browserBytes;
      },
    },
  });
  const path = await f.pickUpload("vehicle-photos", VEHICLE_ID);
  assert.equal(browserReads, 1);
  assert.deepEqual(f.calls.nativeReads, []);
  assert.deepEqual(Array.from(f.calls.picker[0].type), [
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  assert.equal(path, `${USER_ID}/${VEHICLE_ID}/${FILE_ID}.png`);
  assert.equal(f.calls.uploads[0].bucket, "vehicle-photos");
  assert.strictEqual(f.calls.uploads[0].body, browserBytes);
  assert.equal(f.calls.uploads[0].options.contentType, "image/png");
});

test("iOS retains its cache copy for immediate file access", async () => {
  const f = fixture({ platform: "ios" });
  await f.pickUpload("payment-proofs");
  assert.equal(f.calls.picker[0].copyToCacheDirectory, true);
  assert.deepEqual(f.calls.nativeReads, [CACHE_URI]);
  assert.equal(f.calls.uploads.length, 1);
  assert.equal(f.calls.uploads[0].bucket, "payment-proofs");
});

test("actual bytes reject oversized and empty files even when reported size is inaccurate", async () => {
  for (const [bytes, message] of [
    [new ArrayBuffer(10 * 1024 * 1024 + 1), /smaller than 10 MB/],
    [new ArrayBuffer(0), /selected file is empty/],
  ]) {
    const f = fixture({ bytes, size: 1 });
    await assert.rejects(f.pickUpload("verification-documents"), message);
    assert.equal(f.calls.nativeReads.length, 1);
    assert.deepEqual(f.calls.buckets, []);
    assert.deepEqual(f.calls.uploads, []);
  }
});

test("Storage failures keep their original error after a successful local read", async () => {
  const storageError = new Error("Storage policy rejected upload");
  const f = fixture({ storageError });
  await assert.rejects(
    f.pickUpload("verification-documents"),
    (error) => error === storageError,
  );
  assert.deepEqual(f.calls.nativeReads, [CONTENT_URI]);
  assert.equal(f.calls.uploads.length, 1);
});

test("signed-out users cannot open the picker or upload files", async () => {
  const f = fixture({ signedIn: false });
  await assert.rejects(
    f.pickUpload("verification-documents"),
    /Sign in to upload a file/,
  );
  assert.deepEqual(f.calls.picker, []);
  assert.deepEqual(f.calls.nativeReads, []);
  assert.deepEqual(f.calls.buckets, []);
  assert.deepEqual(f.calls.uploads, []);
});
