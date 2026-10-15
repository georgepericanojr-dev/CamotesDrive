type RoleAccount = {
  full_name?: unknown;
  account_status?: unknown;
};

export function roleAccountName(row: RoleAccount): string {
  const name = typeof row.full_name === "string" ? row.full_name.trim() : "";
  if (name) return name;
  return row.account_status === "deleted"
    ? "Deleted account"
    : "Unnamed account";
}

type AccountProfile = RoleAccount & { id: string };
type RoleRecord = RoleAccount & { user_id?: unknown };

// Older camotes_read deployments return roles without their profile fields.
// Resolve only this page's missing profiles, never by name or user-list position.
export async function resolveRoleAccounts<T extends RoleRecord>(
  records: T[],
  loadProfiles: (ids: string[]) => Promise<AccountProfile[]>,
): Promise<T[]> {
  const ids = [
    ...new Set(
      records
        .filter(
          (row) =>
            row.full_name === undefined && typeof row.user_id === "string",
        )
        .map((row) => row.user_id as string),
    ),
  ];
  if (!ids.length) return records;
  const profiles = new Map(
    (await loadProfiles(ids)).map((row) => [row.id, row]),
  );
  if (ids.some((id) => !profiles.has(id))) {
    throw new Error(
      "Some account names could not be loaded. Refresh the Roles page to try again.",
    );
  }
  return records.map((row) => {
    const profile = profiles.get(String(row.user_id));
    return profile && row.full_name === undefined
      ? {
          ...row,
          full_name: profile.full_name,
          account_status: profile.account_status,
        }
      : row;
  });
}
