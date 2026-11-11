import { useGlobalStore } from "../store/globalStore";
import { useProfileStore } from "../store/profileStore";

export interface MentionViolationCheck {
  valid: boolean;
  violations: string[];
}

export const checkUnauthorizedMentions = (payloads: unknown[]): MentionViolationCheck => {
  const currentUser = useGlobalStore.getState().currentUser;
  const botProfileId = useProfileStore.getState().botProfileId;

  // Unrestricted if Head Admin or using own Custom Bot profile
  if (currentUser?.isAdmin || botProfileId !== null) {
    return { valid: true, violations: [] };
  }

  const staffPerms = currentUser?.staffPermissions;
  if (!staffPerms) {
    return { valid: true, violations: [] };
  }

  const allowedRoleIds: string[] = staffPerms.allowed_role_mention_ids ?? [];
  const allRolesAllowed = Boolean(staffPerms.can_mention_roles || allowedRoleIds.includes("*"));

  const violations: string[] = [];
  const scanned = new Set<string>();

  const scanText = (text: string) => {
    if (!staffPerms.can_mention_everyone && /@everyone/i.test(text)) {
      if (!scanned.has("@everyone")) {
        violations.push("@everyone");
        scanned.add("@everyone");
      }
    }
    if (!staffPerms.can_mention_here && /@here/i.test(text)) {
      if (!scanned.has("@here")) {
        violations.push("@here");
        scanned.add("@here");
      }
    }
    const matches = text.matchAll(/<@&?(\d{17,20})>/g);
    for (const match of matches) {
      const raw = match[0];
      const id = match[1];
      if (raw.startsWith("<@&") && !allRolesAllowed && !allowedRoleIds.includes(id)) {
        if (!scanned.has(raw)) {
          violations.push(raw);
          scanned.add(raw);
        }
      }
    }
  };

  const walk = (val: unknown) => {
    if (typeof val === "string") scanText(val);
    else if (Array.isArray(val)) val.forEach(walk);
    else if (val !== null && typeof val === "object") {
      for (const v of Object.values(val as Record<string, unknown>)) walk(v);
    }
  };

  payloads.forEach(walk);
  return { valid: violations.length === 0, violations };
};
