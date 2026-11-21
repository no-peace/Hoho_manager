import type { StaffMentionPermissions } from "../store/globalStore";

type RoleMentionPolicy = Pick<
  StaffMentionPermissions,
  "can_mention_roles" | "allowed_role_mention_ids"
>;

/**
 * Applies the same role-mention policy used by the API:
 * an explicit role allowlist takes precedence, while an empty allowlist uses
 * the broad permission toggle. A wildcard allows every role.
 */
export const filterMentionableRoles = <TRole extends { id: string }>(
  roles: TRole[],
  permissions: RoleMentionPolicy | null | undefined,
  unrestricted = false,
): TRole[] => {
  if (unrestricted) return roles;
  if (!permissions) return [];

  const allowedIds = permissions.allowed_role_mention_ids ?? [];
  if (allowedIds.includes("*")) return roles;
  if (allowedIds.length > 0) {
    return roles.filter((role) => allowedIds.includes(role.id));
  }

  return permissions.can_mention_roles ? roles : [];
};
