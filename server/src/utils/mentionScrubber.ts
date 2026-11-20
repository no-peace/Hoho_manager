/**
 * Scrubs @everyone, @here, and role mentions from a message payload
 * based on staff permissions. Returns the scrubbed payload and a list
 * of what was stripped (for audit logging).
 */

export interface MentionPermissions {
  can_mention_everyone: number;
  can_mention_here: number;
  can_mention_roles: number;
  allowed_role_mention_ids: string; // JSON array
}

export interface ScrubResult {
  payload: Record<string, unknown>;
  stripped: string[];
}

export interface UnauthorizedMentionViolation {
  type: "everyone" | "here" | "role";
  mention: string;
  roleId?: string;
}

// Role mention pattern: <@&123456789012345678> or <@123456789012345678>
const ROLE_OR_USER_MENTION_RE = /<@&?(\d{17,20})>/g;

export const findUnauthorizedMentions = (
  obj: unknown,
  perms: MentionPermissions,
): UnauthorizedMentionViolation[] => {
  const violations: UnauthorizedMentionViolation[] = [];
  const scanned = new Set<string>();

  let allowedRoleIds: string[] = [];
  try {
    allowedRoleIds = typeof perms.allowed_role_mention_ids === "string"
      ? JSON.parse(perms.allowed_role_mention_ids)
      : Array.isArray(perms.allowed_role_mention_ids)
      ? perms.allowed_role_mention_ids
      : [];
  } catch {
    allowedRoleIds = [];
  }

  const canEveryone = Boolean(perms.can_mention_everyone);
  const canHere = Boolean(perms.can_mention_here);
  const allRolesAllowed = Boolean(perms.can_mention_roles) || allowedRoleIds.includes("*");

  const scanText = (text: string) => {
    // 1. Check @everyone
    if (!canEveryone && /@everyone/i.test(text)) {
      if (!scanned.has("@everyone")) {
        violations.push({ type: "everyone", mention: "@everyone" });
        scanned.add("@everyone");
      }
    }

    // 2. Check @here
    if (!canHere && /@here/i.test(text)) {
      if (!scanned.has("@here")) {
        violations.push({ type: "here", mention: "@here" });
        scanned.add("@here");
      }
    }

    // 3. Check role mentions: <@&123...> or <@123...> when targeting roles
    const matches = text.matchAll(ROLE_OR_USER_MENTION_RE);
    for (const match of matches) {
      const id = match[1];
      const rawMention = match[0];
      // If it has & (explicit role mention) or if all roles are disallowed and not in allowed list
      const isExplicitRole = rawMention.startsWith("<@&");
      if (isExplicitRole && !allRolesAllowed && !allowedRoleIds.includes(id)) {
        if (!scanned.has(rawMention)) {
          violations.push({ type: "role", mention: rawMention, roleId: id });
          scanned.add(rawMention);
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

  walk(obj);
  return violations;
};

// Role mention pattern: <@&123456789012345678>
const ROLE_MENTION_RE = /<@&(\d+)>/g;

export const scrubString = (text: string, perms: MentionPermissions, stripped: string[]): string => {
  let result = text;

  // Case-insensitive @everyone scrubbing
  if (!perms.can_mention_everyone && /@everyone/i.test(result)) {
    result = result.replace(/@everyone/gi, (match) => {
      stripped.push(match.toLowerCase());
      return `@\u200b${match.slice(1)}`; // zero-width space breaks ping
    });
  }

  // Case-insensitive @here scrubbing
  if (!perms.can_mention_here && /@here/i.test(result)) {
    result = result.replace(/@here/gi, (match) => {
      stripped.push(match.toLowerCase());
      return `@\u200b${match.slice(1)}`;
    });
  }

  let allowedRoleIds: string[] = [];
  try {
    allowedRoleIds =
      typeof perms.allowed_role_mention_ids === "string"
        ? JSON.parse(perms.allowed_role_mention_ids)
        : Array.isArray(perms.allowed_role_mention_ids)
          ? perms.allowed_role_mention_ids
          : [];
  } catch {
    allowedRoleIds = [];
  }

  const allRolesAllowed = Boolean(perms.can_mention_roles) || allowedRoleIds.includes("*");
  if (!allRolesAllowed) {
    result = result.replace(ROLE_MENTION_RE, (match, roleId) => {
      if (allowedRoleIds.includes(roleId)) return match;
      stripped.push(`<@&${roleId}>`);
      return `@\u200b${roleId}`;
    });
  }

  return result;
};

export const scrubObject = (obj: unknown, perms: MentionPermissions, stripped: string[]): unknown => {
  if (typeof obj === "string") return scrubString(obj, perms, stripped);
  if (Array.isArray(obj)) return obj.map((item) => scrubObject(item, perms, stripped));
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = scrubObject(value, perms, stripped);
    }
    return result;
  }
  return obj;
};

export const scrubMentions = (payload: Record<string, unknown>, perms: MentionPermissions): ScrubResult => {
  const stripped: string[] = [];
  const scrubbedPayload = scrubObject(payload, perms, stripped) as Record<string, unknown>;
  return { payload: scrubbedPayload, stripped: [...new Set(stripped)] };
};

/**
 * Scrub Component V2 flows action parameters and configurations before registration.
 */
export const scrubFlows = <T = unknown>(flows: T[], perms: MentionPermissions): { flows: T[]; stripped: string[] } => {
  const stripped: string[] = [];
  const scrubbedFlows = flows.map((flow) => scrubObject(flow, perms, stripped) as T);
  return { flows: scrubbedFlows, stripped: [...new Set(stripped)] };
};

/**
 * Also strip `allowed_mentions` overrides from staff payloads.
 * Staff can't escalate their own permissions by sending `allowed_mentions: { parse: ['everyone'] }`.
 */
export const sanitizeAllowedMentions = (
  payload: Record<string, unknown>,
  perms: MentionPermissions,
): Record<string, unknown> => {
  const existing = payload.allowed_mentions as Record<string, unknown> | undefined;
  const parse: string[] = [];
  // Discord's allowed_mentions parser uses "everyone" for both @everyone and @here.
  if (perms.can_mention_everyone || perms.can_mention_here) parse.push("everyone");

  let roles: string[] | undefined;

  let allowedRoleIds: string[] = [];
  try {
    allowedRoleIds =
      typeof perms.allowed_role_mention_ids === "string"
        ? JSON.parse(perms.allowed_role_mention_ids)
        : Array.isArray(perms.allowed_role_mention_ids)
          ? perms.allowed_role_mention_ids
          : [];
  } catch {
    allowedRoleIds = [];
  }

  if (perms.can_mention_roles || allowedRoleIds.includes("*")) {
    parse.push("roles");
  } else if (allowedRoleIds.length > 0) {
    roles = allowedRoleIds.filter((id) => id !== "*");
  }

  const allowedMentions: Record<string, unknown> = {
    parse,
    ...(roles && roles.length > 0 ? { roles } : {}),
    // Preserve replied_user if it was already set
    ...(existing?.replied_user !== undefined ? { replied_user: existing.replied_user } : {}),
    ...(Array.isArray(existing?.users) ? { users: existing.users } : {}),
  };

  return { ...payload, allowed_mentions: allowedMentions };
};
