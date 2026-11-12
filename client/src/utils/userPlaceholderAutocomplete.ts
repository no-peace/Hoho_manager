
export interface UserIdPlaceholderSuggestion {
   /** Full token inserted into the editor. */
  tag: string;
  /** Short tag shown in the autocomplete menu. */
  displayTag: string;
  /** Discord user ID extracted from the query. */
  userId: string;
  label: string;
  desc: string;
}

const USER_PROFILE_FIELDS = [
  { key: "name", label: "Display name", desc: "Display name, falling back to username" },
  { key: "displayname", label: "Display name alias", desc: "Alias for display name" },
  { key: "globalname", label: "Global name", desc: "Discord global display name" },
  { key: "username", label: "Username", desc: "Discord username" },
  { key: "tag", label: "Username alias", desc: "Alias for username" },
  { key: "id", label: "User ID", desc: "Discord user ID" },
  { key: "url", label: "Profile URL", desc: "Discord profile URL" },
  { key: "profile", label: "Profile URL alias", desc: "Alias for profile URL" },
  { key: "avatarurl", label: "Avatar URL", desc: "Direct profile picture URL" },
  { key: "avatar", label: "Avatar", desc: "Alias for avatar URL" },
  { key: "icon", label: "Icon", desc: "Alias for avatar URL" },
  { key: "pfp", label: "Profile picture", desc: "Alias for avatar URL" },
  { key: "mention", label: "Mention", desc: "Discord mention for this user" },
] as const;

export function getUserIdPlaceholderSuggestions(
  query: string,
): UserIdPlaceholderSuggestion[] | null {
  const normalized = query.trim().replace(/^\{+/, "").toLowerCase();

  const match = normalized.match(/^user\.(\d{1,20})(?:\.([a-z0-9_]*))?$/);

  if (!match) return null;

  const userId = match[1];
  const fieldQuery = (match[2] ?? "").trim();

  return USER_PROFILE_FIELDS
    .filter((field) => {
      if (!fieldQuery) return true;

      return (
        field.key.includes(fieldQuery)
      );
    })
    .map((field) => ({
      tag: `{user.${userId}.${field.key}}`,
      displayTag: `{user.${field.key}}`,
      userId,
      label: field.label,
      desc: field.desc,
    }));
}
