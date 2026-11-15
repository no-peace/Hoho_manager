
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
  { key: "name", label: "Server nickname", desc: "Selected server nickname, falling back to username" },
  { key: "displayname", label: "Global display name", desc: "Discord global display name, falling back to username" },
  { key: "globalname", label: "Global name", desc: "Discord global display name" },
  { key: "username", label: "Username", desc: "Discord username" },
  { key: "tag", label: "Username alias", desc: "Alias for username" },
  { key: "id", label: "User ID", desc: "Discord user ID" },
  { key: "url", label: "Profile URL", desc: "Discord profile URL" },
  { key: "profile", label: "Profile URL alias", desc: "Alias for profile URL" },
  { key: "avatar", label: "Avatar URL", desc: "Direct profile picture URL" },
  { key: "avatarurl", label: "Avatar URL alias", desc: "Alias for the avatar URL" },
  { key: "mention", label: "Mention", desc: "Discord mention for this user" },
  { key: "roles", label: "Server roles", desc: "Space-separated mentions for this user's server roles" },
  { key: "clantag", label: "Clan tag", desc: "Official Discord clan tag or a tag parsed from the member name" },
  { key: "created", label: "Account created", desc: "Discord account creation date" },
  { key: "created.relative", label: "Account age", desc: "Relative Discord account creation timestamp" },
  { key: "joined", label: "Server joined", desc: "Relative timestamp for when the user joined this server" },
  { key: "joined.date", label: "Server join date", desc: "Discord timestamp for the server join date" },
] as const;

export function getUserIdPlaceholderSuggestions(
  query: string,
): UserIdPlaceholderSuggestion[] | null {
  const normalized = query.trim().replace(/^\{+/, "").toLowerCase();

  const match = normalized.match(/^user\.(\d{1,20})(?:\.([a-z0-9_.]*))?$/);

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
