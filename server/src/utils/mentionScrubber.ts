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

  if (!perms.can_mention_roles) {
    result = result.replace(ROLE_MENTION_RE, (_match, roleId) => {
      stripped.push(`<@&${roleId}>`);
      return `@\u200b${roleId}`;
    });
  } else {
    let allowedRoleIds: string[] = [];
    try {
      allowedRoleIds = JSON.parse(perms.allowed_role_mention_ids);
    } catch {
      allowedRoleIds = [];
    }

    const allRolesAllowed = allowedRoleIds.length === 0 || allowedRoleIds.includes("*");
    if (!allRolesAllowed) {
      result = result.replace(ROLE_MENTION_RE, (match, roleId) => {
        if (allowedRoleIds.includes(roleId)) return match;
        stripped.push(`<@&${roleId}>`);
        return `@\u200b${roleId}`;
      });
    }
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
  if (perms.can_mention_everyone) parse.push("everyone");
  if (perms.can_mention_here) parse.push("here");

  let roles: string[] | undefined;

  if (perms.can_mention_roles) {
    let allowedRoleIds: string[] = [];
    try {
      allowedRoleIds = JSON.parse(perms.allowed_role_mention_ids);
    } catch {
      allowedRoleIds = [];
    }

    if (allowedRoleIds.length === 0 || allowedRoleIds.includes("*")) {
      parse.push("roles");
    } else {
      roles = allowedRoleIds.filter((id) => id !== "*");
    }
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
