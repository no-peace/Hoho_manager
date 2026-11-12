# HoHo Manager — Phase 3 Complete Patch
## Live Discord user preview and ID-aware autocomplete

Based on the latest `main` source of `no-peace/Hoho_manager`.

Your live preview endpoint, server-side Discord lookup, caching, `avatarurl` resolver, preview provider, and preview tests are already present in the pushed code. **Do not replace those working files with older versions.** This patch adds the missing autocomplete behaviour in both editor input systems and regression tests.

## Expected behaviour

Typing `{user.133342345` must keep autocomplete open and show suggestions such as:

- `{user.133342345.name}`
- `{user.133342345.username}`
- `{user.133342345.url}`
- `{user.133342345.avatarurl}`

Typing `{user.133342345.ava` filters the suggestions to avatar-related fields. Selecting an item replaces the incomplete token with the complete ID-based placeholder.

The suggestions include only profile fields supported by the existing ID resolver. Arbitrary user's server roles and join dates are not suggested because the current user-profile endpoint does not fetch those values.

---

## 1. Create the shared autocomplete helper

Create `client/src/utils/userPlaceholderAutocomplete.ts`:

```ts
export interface UserIdPlaceholderSuggestion {
  tag: string;
  label: string;
  desc: string;
}

type UserProfileField = {
  key: string;
  label: string;
  desc: string;
};

const USER_PROFILE_FIELDS: readonly UserProfileField[] = [
  { key: "name", label: "Display name", desc: "Global display name, falling back to username" },
  { key: "displayname", label: "Display name alias", desc: "Alias for the user's display name" },
  { key: "globalname", label: "Global name", desc: "Discord global display name" },
  { key: "username", label: "Username", desc: "Discord username" },
  { key: "tag", label: "Username alias", desc: "Alias for the Discord username" },
  { key: "id", label: "User ID", desc: "The Discord user's ID" },
  { key: "url", label: "Profile URL", desc: "Link to the Discord profile" },
  { key: "profile", label: "Profile URL alias", desc: "Alias for the Discord profile URL" },
  { key: "avatarurl", label: "Avatar URL", desc: "Direct link to the user's profile picture" },
  { key: "avatar", label: "Avatar", desc: "Alias for the user's profile picture URL" },
  { key: "icon", label: "Icon", desc: "Alias for the user's profile picture URL" },
  { key: "pfp", label: "Profile picture", desc: "Alias for the user's profile picture URL" },
  { key: "mention", label: "Mention", desc: "Discord mention for this user" },
];

/**
 * Returns ID-specific suggestions for an incomplete token such as:
 *   user.123456789012345678
 *   user.123456789012345678.ava
 *
 * Returns null when the query is an ordinary (non-ID) variable query.
 */
export const getUserIdPlaceholderSuggestions = (
  query: string,
): UserIdPlaceholderSuggestion[] | null => {
  const normalized = query.toLowerCase().replace(/^\\{+/, "");
  const match = normalized.match(/^user\\.(\\d{1,20})(?:\\.(.*))?$/);

  if (!match) return null;

  const userIdPrefix = match[1];
  const fieldQuery = (match[2] ?? "").trim();

  return USER_PROFILE_FIELDS
    .filter((field) => {
      if (!fieldQuery) return true;

      return (
        field.key.includes(fieldQuery) ||
        field.label.toLowerCase().includes(fieldQuery) ||
        field.desc.toLowerCase().includes(fieldQuery)
      );
    })
    .map((field) => ({
      tag: `{user.${userIdPrefix}.${field.key}}`,
      label: field.label,
      desc: field.desc,
    }));
};
```

---

## 2. Update `client/src/components/ui/Field.tsx`

This covers normal text inputs, including embed property fields.

### 2.1 Add the import

Add alongside the other imports:

```ts
import { getUserIdPlaceholderSuggestions } from "../../utils/userPlaceholderAutocomplete";
```

### 2.2 Add one filtering function

Find the existing `ACTUAL_VARIABLES` declaration:

```ts
const ACTUAL_VARIABLES = VARIABLES.filter(
  (v): v is { tag: string; label: string; desc: string } => typeof (v as any).tag === "string",
);
```

Immediately after it, add:

```ts
const getAutocompleteVariables = (query: string) => {
  const idSuggestions = getUserIdPlaceholderSuggestions(query);

  // null means this is an ordinary variable query.
  // An empty array means it is an ID query with no matching field.
  if (idSuggestions !== null) return idSuggestions;

  const q = query.toLowerCase().replace(/^\\{+/, "");

  return ACTUAL_VARIABLES.filter(
    (v) =>
      !q ||
      v.tag.toLowerCase().includes(q) ||
      v.desc.toLowerCase().includes(q) ||
      v.label.toLowerCase().includes(q),
  ).slice(0, 8);
};
```

### 2.3 Update `VariableAutocompletePopover`

Inside `VariableAutocompletePopover`, replace the existing `const q` and `const filtered = useMemo(...)` declarations with:

```ts
  const filtered = useMemo(
    () => getAutocompleteVariables(query),
    [query],
  );
```

Keep the rest of the component unchanged.

### 2.4 Update Enter/Tab keyboard selection

Inside `TextField`'s `onKeyDown`, find the block that starts:

```ts
const q = acState.query.toLowerCase().replace(/^\\{+/, "");
const filtered = ACTUAL_VARIABLES.filter(
```

Replace that whole query/filter block with:

```ts
const filtered = getAutocompleteVariables(acState.query);
```

Do not change the ArrowUp, ArrowDown, Enter, Tab, or Escape handling around it. Both the visible dropdown and keyboard selection must use the same helper.

---

## 3. Update `client/src/components/editor/DiscordMentionInput.tsx`

This covers the main message editor.

### 3.1 Add the import

Add:

```ts
import { getUserIdPlaceholderSuggestions } from "../../utils/userPlaceholderAutocomplete";
```

Keep the existing import of `VARIABLES` from `../ui/Field`.

### 3.2 Update the variable autocomplete branch

Inside the `acItems` `useMemo`, find:

```ts
if (acType === "variable") {
  const items: AutocompleteItem[] = [];
```

Immediately after those lines, insert:

```ts
      const idSuggestions = getUserIdPlaceholderSuggestions(q);

      if (idSuggestions !== null) {
        return idSuggestions.slice(0, 20).map((suggestion) => ({
          id: `var_${suggestion.tag}`,
          title: suggestion.tag,
          subtitle: `${suggestion.label}  ${suggestion.desc}`,
          icon: <Code size={13} className="text-[#5865f2] shrink-0" />,
          replacement: suggestion.tag,
          keepOpen: false,
        }));
      }
```

Leave the existing WEAO suggestion and ordinary `VARIABLES.forEach(...)` code below this insertion unchanged.

---

## 4. Add regression tests

Create `client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getUserIdPlaceholderSuggestions } from "../userPlaceholderAutocomplete";

describe("getUserIdPlaceholderSuggestions", () => {
  it("suggests fields while a Discord ID is being typed", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.133342345");

    expect(suggestions).not.toBeNull();
    expect(suggestions?.some(
      (item) => item.tag === "{user.133342345.name}",
    )).toBe(true);
    expect(suggestions?.some(
      (item) => item.tag === "{user.133342345.avatarurl}",
    )).toBe(true);
  });

  it("filters fields after the ID", () => {
    const suggestions = getUserIdPlaceholderSuggestions(
      "user.123456789012345678.ava",
    );

    expect(suggestions).not.toBeNull();
    expect(suggestions?.length).toBeGreaterThan(0);
    expect(suggestions?.every(
      (item) => item.tag.toLowerCase().includes(".ava"),
    )).toBe(true);
    expect(suggestions?.some(
      (item) => item.tag === "{user.123456789012345678.avatarurl}",
    )).toBe(true);
  });

  it("suggests fields after a complete ID and trailing dot", () => {
    const suggestions = getUserIdPlaceholderSuggestions(
      "user.123456789012345678.",
    );

    expect(suggestions?.some(
      (item) => item.tag === "{user.123456789012345678.username}",
    )).toBe(true);
  });

  it("does not treat ordinary user variables as ID-based variables", () => {
    expect(getUserIdPlaceholderSuggestions("user.")).toBeNull();
    expect(getUserIdPlaceholderSuggestions("user.name")).toBeNull();
  });

  it("does not accept more than 20 ID digits", () => {
    expect(
      getUserIdPlaceholderSuggestions("user.123456789012345678901"),
    ).toBeNull();
  });

  it("keeps the entered ID prefix in every replacement", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.133342345");

    expect(suggestions?.every(
      (item) => item.tag.startsWith("{user.133342345."),
    )).toBe(true);
  });
});
```

---

## 5. Existing live-preview files — keep them

The latest `main` already has these pieces. Do not duplicate or overwrite them:

- `server/src/routes/discord.ts`: authenticated `GET /api/discord/users/resolve`, validates IDs, deduplicates requests, limits batches to 10, and returns safe profile fields only.
- `server/src/services/discordService.ts`: successful-result cache and in-flight lookup deduplication.
- `server/src/services/authorService.ts`: final-send resolution for `avatarurl`, `avatar`, `icon`, `pfp`, `url`, `profile`, `mention`, names, and IDs.
- `client/src/components/preview/UserPlaceholderPreviewContent.tsx`: debounced and batched preview lookups.
- `client/src/components/preview/MessagePreview.tsx`: provider wraps the message preview.
- `client/src/components/preview/EmbedPreview.tsx`: user placeholders are resolved for embed text and applicable URL/image properties.
- `client/src/components/preview/ComponentPreview.tsx`: component media URLs are resolved.
- `client/src/components/preview/Markdown.tsx`: user placeholders are resolved before Markdown rendering.
- `client/src/components/preview/__tests__/UserPlaceholderPreviewContext.test.tsx`: the API mock path has already been corrected.

The browser must continue to call your own backend endpoint. Never expose the Discord bot token in frontend code.

---

## 6. Run verification

From the project root:

```powershell
cd client

npx vitest run .\\src\\utils\\__tests__\\userPlaceholderAutocomplete.test.ts
npx vitest run .\\src\\components\\preview\\__tests__\\UserPlaceholderPreviewContext.test.tsx

npm test
npm run typecheck
npm run build
```

Then run backend checks:

```powershell
cd ..\\server

npm test
npm run typecheck
npm run build
```

### Manual checks

Test in both a normal text field and the main message editor:

1. Type `{user.` — normal user variable suggestions should appear.
2. Type `{user.133342345` — ID-based suggestions should appear, not disappear.
3. Type `{user.133342345.ava` — avatar-related fields should be filtered.
4. Select `avatarurl` — it should insert `{user.133342345.avatarurl}`.
5. Type a complete ID followed by `.`, then choose `name` or `username`.
6. Press Enter and Tab to select the highlighted item.
7. Type `{user.name}` — ordinary non-ID suggestions should still work.

For live preview, use a real valid Discord user ID:

```text
{user.115238234778370049.username}
{user.115238234778370049.name}
{user.115238234778370049.url}
{user.115238234778370049.avatarurl}
```

Use `avatarurl` in an image URL property to confirm that the actual profile picture renders.

---

## 7. Review and push

Review the patch before committing:

```powershell
git status
git diff --check
git diff
```

After all checks pass:

```powershell
git add client/src/utils/userPlaceholderAutocomplete.ts client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts client/src/components/ui/Field.tsx client/src/components/editor/DiscordMentionInput.tsx
git commit -m "fix: support user ID placeholder autocomplete"
git push origin main
```

This guide does not modify GitHub. Apply the changes locally and push only after reviewing and verifying them.
