import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRoleAccounts, roleAccountName } from "../src/lib/admin-role.ts";

test("role names match profiles by UUID despite different ordering and duplicate roles", async () => {
  const records = [
    { user_id: "b", role: "owner", status: "pending" },
    { user_id: "a", role: "renter", status: "active" },
    { user_id: "b", role: "driver", status: "pending" },
  ];
  const result = await resolveRoleAccounts(records, async (ids) => {
    assert.deepEqual(ids, ["b", "a"]);
    return [
      { id: "a", full_name: "Mikay" },
      { id: "b", full_name: "George P. Pericano Jr." },
    ];
  });
  assert.deepEqual(result.map(roleAccountName), [
    "George P. Pericano Jr.",
    "Mikay",
    "George P. Pericano Jr.",
  ]);
  assert.deepEqual(
    result.map(({ full_name, account_status, ...row }) => row),
    records,
  );
  assert.equal(records[0].full_name, undefined);
});

test("already joined role names do not need another query, including genuinely blank names", async () => {
  const records = [
    { user_id: "a", full_name: "Mikay" },
    { user_id: "b", full_name: null },
  ];
  assert.equal(
    await resolveRoleAccounts(records, async () => {
      throw new Error("Unexpected query");
    }),
    records,
  );
});

test("fallback profile fields cannot overwrite role IDs or moderation status", async () => {
  const [result] = await resolveRoleAccounts(
    [{ user_id: "a", role: "owner", status: "pending" }],
    async () => [
      {
        id: "a",
        full_name: "Name",
        account_status: "active",
        user_id: "other",
        status: "active",
      },
    ],
  );
  assert.equal(result.user_id, "a");
  assert.equal(result.status, "pending");
  assert.equal(result.full_name, "Name");
});

test("a failed lookup surfaces an error instead of incorrectly labeling users unnamed", async () => {
  await assert.rejects(
    resolveRoleAccounts([{ user_id: "a" }], async () => {
      throw new Error("Offline");
    }),
    /Offline/,
  );
});

test("missing or inaccessible profiles surface an error instead of cross-matching another user", async () => {
  await assert.rejects(
    resolveRoleAccounts([{ user_id: "a" }], async () => [
      { id: "b", full_name: "Wrong account" },
    ]),
    /account names could not be loaded/,
  );
});

test("blank and deleted account labels are reserved for actual profile values", async () => {
  const result = await resolveRoleAccounts(
    [{ user_id: "a" }, { user_id: "b" }],
    async () => [
      { id: "a", full_name: "   ", account_status: "active" },
      { id: "b", full_name: null, account_status: "deleted" },
    ],
  );
  assert.deepEqual(result.map(roleAccountName), [
    "Unnamed account",
    "Deleted account",
  ]);
});
