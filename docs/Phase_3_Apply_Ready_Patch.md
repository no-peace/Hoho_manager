# HoHo Manager --- Phase 3 Apply-Ready Patch

**Repository:** `no-peace/Hoho_manager`\
**Branch inspected:** `main`\
**Purpose:** Concrete local code changes, not an audit-only plan.

## Before you start

1.  Open your local `Hoho_manager` folder in VS Code.
2.  Make sure your Phase 2 changes are saved and tests/build currently
    pass.
3.  Create a branch or make a local backup before applying these edits.
4.  Do not copy the code to GitHub's web editor. Apply it locally, test,
    then decide whether to commit/push yourself.

The source snapshot inspected on GitHub `main` contains the bugs
addressed below. Your local Phase 2 work may differ. If a section no
longer matches your local file, stop and compare instead of blindly
replacing it.

------------------------------------------------------------------------

# Patch 1 --- Replace the author resolver

**File:** `server/src/services/authorService.ts`

**Action:** Replace the entire file with the code below.

This fixes the cross-embed author-ID leak, validates Discord profile
URLs properly, keeps `{user.ID.FIELD}` syntax, deduplicates requests,
limits each payload to 10 unique user lookups, and preserves original
values when Discord lookup fails.

``` ts
import type { DiscordMessagePayload } from "@dmb/shared";
import {
  getDiscordUser,
  getDiscordUserAvatarUrl,
  type DiscordMemberSummary,
} from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("authorService");

const DISCORD_USER_ID_REGEX = /^\d{17,20}$/;
const USER_PLACEHOLDER_REGEX = /\{user\.(\d{17,20})\.([a-zA-Z0-9_]+)\}/g;
const MAX_USER_LOOKUPS_PER_PAYLOAD = 10;

type AuthorObject = Record<string, unknown>;

export interface AuthorResolutionResult {
  payload: DiscordMessagePayload;
  authorUserId: string | null;
  authorUser: DiscordMemberSummary | null;
}

/** Accept only a real HTTPS Discord profile URL, not a lookalike hostname. */
const getUserIdFromProfileUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "discord.com" && url.hostname !== "www.discord.com") {
      return null;
    }
    if (url.search || url.hash) return null;

    const match = url.pathname.match(/^\/users\/(\d{17,20})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const getAuthorUserId = (author: AuthorObject): string | null => {
  for (const key of ["user_id", "author_id"] as const) {
    const value = author[key];
    if (typeof value === "string" && DISCORD_USER_ID_REGEX.test(value.trim())) {
      return value.trim();
    }
  }

  if (typeof author.url === "string") {
    const id = getUserIdFromProfileUrl(author.url);
    if (id) return id;
  }

  if (typeof author.name === "string" && DISCORD_USER_ID_REGEX.test(author.name.trim())) {
    return author.name.trim();
  }

  return null;
};

const collectAuthorObjects = (node: unknown, output: AuthorObject[] = []): AuthorObject[] => {
  if (Array.isArray(node)) {
    for (const item of node) collectAuthorObjects(item, output);
    return output;
  }

  if (node === null || typeof node !== "object") return output;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "author" && value !== null && typeof value === "object" && !Array.isArray(value)) {
      output.push(value as AuthorObject);
    }
    collectAuthorObjects(value, output);
  }

  return output;
};

const getUserField = (
  user: DiscordMemberSummary,
  field: string,
): string | null => {
  switch (field.toLowerCase()) {
    case "name":
    case "displayname":
    case "globalname":
      return user.global_name || user.username;
    case "username":
    case "tag":
      return user.username;
    case "id":
      return user.id;
    case "avatar":
    case "icon":
    case "pfp":
      return getDiscordUserAvatarUrl(user);
    case "url":
    case "profile":
      return `https://discord.com/users/${user.id}`;
    case "mention":
      return `<@${user.id}>`;
    default:
      return null;
  }
};

/**
 * Resolves author profiles and {user.<userId>.<field>} placeholders.
 * User lookups are performed server-side using the configured bot token.
 */
export const resolveAuthorPlaceholders = async (
  payload: DiscordMessagePayload,
  fallbackAuthorId?: string | null,
  profileId?: number | null,
): Promise<AuthorResolutionResult> => {
  const authorObjects = collectAuthorObjects(payload);
  const authorIds = authorObjects.map(getAuthorUserId);
  const hasSingleAuthor = authorObjects.length === 1;

  // A legacy fallback ID is safe only when this payload has exactly one author.
  if (
    hasSingleAuthor &&
    !authorIds[0] &&
    typeof fallbackAuthorId === "string" &&
    DISCORD_USER_ID_REGEX.test(fallbackAuthorId.trim())
  ) {
    authorIds[0] = fallbackAuthorId.trim();
  }

  const serialized = JSON.stringify(payload);
  const placeholderMatches = Array.from(serialized.matchAll(USER_PLACEHOLDER_REGEX));
  const requestedIds = new Set<string>();

  for (const id of authorIds) {
    if (id) requestedIds.add(id);
  }
  for (const match of placeholderMatches) {
    if (match[1]) requestedIds.add(match[1]);
  }

  const allowedIds = Array.from(requestedIds).slice(0, MAX_USER_LOOKUPS_PER_PAYLOAD);
  if (requestedIds.size > MAX_USER_LOOKUPS_PER_PAYLOAD) {
    log.warn(
      `Author resolution skipped ${requestedIds.size - MAX_USER_LOOKUPS_PER_PAYLOAD} user lookup(s); payload limit is ${MAX_USER_LOOKUPS_PER_PAYLOAD}`,
    );
  }

  const userMap = new Map<string, DiscordMemberSummary>();

  // Sequential lookup keeps a single payload's outbound API traffic bounded.
  for (const id of allowedIds) {
    try {
      const user = await getDiscordUser(id, profileId ?? null);
      if (user && user.id === id && typeof user.username === "string") {
        userMap.set(id, user);
      }
    } catch (error) {
      const category =
        error && typeof error === "object" && "status" in error
          ? `HTTP ${String((error as { status: unknown }).status)}`
          : error instanceof Error
            ? error.name
            : "unknown error";
      log.warn(`Could not resolve Discord user ${id} (${category}); preserving original value`);
    }
  }

  const interpolateString = (value: string): string =>
    value.replace(USER_PLACEHOLDER_REGEX, (fullMatch, id: string, field: string) => {
      const user = userMap.get(id);
      if (!user) return fullMatch;
      return getUserField(user, field) ?? fullMatch;
    });

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return interpolateString(node);
    if (Array.isArray(node)) return node.map(walk);

    if (node !== null && typeof node === "object") {
      const output: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (
          key === "author" &&
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          const author = { ...(value as AuthorObject) };
          const id = getAuthorUserId(author);
          const user = id ? userMap.get(id) : undefined;

          if (user) {
            // Preserve manually entered values. Auto-fill blank fields and ID-only names.
            if (
              typeof author.name !== "string" ||
              author.name.trim() === "" ||
              author.name.trim() === id
            ) {
              author.name = user.global_name || user.username;
            }
            if (typeof author.url !== "string" || getUserIdFromProfileUrl(author.url) === id) {
              author.url = `https://discord.com/users/${user.id}`;
            }
            if (typeof author.icon_url !== "string" || author.icon_url.trim() === "") {
              author.icon_url = getDiscordUserAvatarUrl(user);
            }
          }

          output[key] = walk(author);
        } else {
          output[key] = walk(value);
        }
      }

      return output;
    }

    return node;
  };

  const resolvedPayload = walk(payload) as DiscordMessagePayload;
  const primaryUserId =
    (hasSingleAuthor ? authorIds[0] : null) ??
    authorIds.find((id) => Boolean(id)) ??
    null;

  return {
    payload: resolvedPayload,
    authorUserId: primaryUserId,
    authorUser: primaryUserId ? userMap.get(primaryUserId) ?? null : null,
  };
};
```

**Important behavior change:** manually entered author names and icon
URLs are now preserved. Automatic values fill blank fields. If you want
the resolver to overwrite manual values too, that should be an explicit
product decision rather than an accidental side effect.

------------------------------------------------------------------------

# Patch 2 --- Coalesce concurrent Discord user lookups

**File:** `server/src/services/discordService.ts`

Find this exact existing block (near `userCache` and `getDiscordUser`):

``` ts
export const userCache = new BoundedTtlCache<DiscordMemberSummary>(1000, 10 * 60_000);
```

Immediately **below** it, add:

``` ts
const inFlightUserLookups = new Map<string, Promise<DiscordMemberSummary>>();
```

Then find the existing complete function:

``` ts
export const getDiscordUser = async (
  userId: string,
  profileId: number | null = null,
): Promise<DiscordMemberSummary> => {
  const cached = userCache.get(userId);
  if (cached) return cached;

  const token = await resolveBotToken(profileId);
  const data = await apiRequest<any>("GET", `/users/${userId}`, { token });
  if (!data) throw ApiError.notFound(`User ${userId} not found on Discord`);

  const summary: DiscordMemberSummary = {
    id: data.id,
    username: data.username,
    global_name: data.global_name ?? null,
    nickname: null,
    avatar: data.avatar ?? null,
  };
  userCache.set(userId, summary);
  return summary;
};
```

Replace that whole function with:

``` ts
export const getDiscordUser = async (
  userId: string,
  profileId: number | null = null,
): Promise<DiscordMemberSummary> => {
  if (!/^\d{17,20}$/.test(userId)) {
    throw ApiError.badRequest("Invalid Discord user ID");
  }

  const cached = userCache.get(userId);
  if (cached) return cached;

  const existing = inFlightUserLookups.get(userId);
  if (existing) return existing;

  let lookupPromise: Promise<DiscordMemberSummary>;

  lookupPromise = (async () => {
    const token = await resolveBotToken(profileId);
    const data = await apiRequest<{
      id?: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
    }>("GET", `/users/${encodeURIComponent(userId)}`, { token });

    if (
      !data ||
      data.id !== userId ||
      typeof data.username !== "string" ||
      data.username.length === 0
    ) {
      throw ApiError.notFound(`User ${userId} was not returned by Discord`);
    }

    const summary: DiscordMemberSummary = {
      id: data.id,
      username: data.username,
      global_name: data.global_name ?? null,
      nickname: null,
      avatar: data.avatar ?? null,
    };

    // Only successful, validated responses enter the TTL cache.
    userCache.set(userId, summary);
    return summary;
  })().finally(() => {
    if (inFlightUserLookups.get(userId) === lookupPromise) {
      inFlightUserLookups.delete(userId);
    }
  });

  inFlightUserLookups.set(userId, lookupPromise);
  return lookupPromise;
};
```

This retains the existing 1,000-entry, 10-minute cache and adds one
shared request per user ID while a lookup is in progress. Failed
requests are not cached.

------------------------------------------------------------------------

# Patch 3 --- Log unexpected resolver failures

**File:** `server/src/routes/send.ts`

The file already defines:

``` ts
const log = logger.child("send");
```

Find this block inside the message-processing function:

``` ts
let authorResolved = weaoInterpolated;
try {
  const { resolveAuthorPlaceholders } = await import("../services/authorService.js");
  const aRes = await resolveAuthorPlaceholders(weaoInterpolated, null, profileId);
  authorResolved = aRes.payload;
} catch {
  // Fallback to weaoInterpolated
}
```

Replace it with:

``` ts
let authorResolved = weaoInterpolated;
try {
  const { resolveAuthorPlaceholders } = await import("../services/authorService.js");
  const aRes = await resolveAuthorPlaceholders(weaoInterpolated, null, profileId);
  authorResolved = aRes.payload;
} catch (error) {
  log.warn(
    `Author profile enrichment failed; sending original interpolated payload: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
```

The resolver handles individual Discord lookup failures itself. This
catch is only for unexpected resolver-level failures.

------------------------------------------------------------------------

# Patch 4 --- Add truthful Author URL helper text

**File:** `client/src/components/editor/EmbedEditor.tsx`

Find the Author URL input. Its current placeholder is:

``` tsx
placeholder="https://..."
```

Immediately **after the closing `</input>` for the Author URL field**,
add this paragraph, before the closing `</div>` of that URL field:

``` tsx
<p className="mt-1 text-[10px] leading-relaxed text-[#949ba4]">
  For automatic author details, use a Discord profile URL
  (https://discord.com/users/USER_ID). Leave Author Name and
  Author Icon URL empty to let the server fill them when sending.
  The editor preview does not fetch live Discord profiles.
</p>
```

Do not place this paragraph after the Author Icon URL input. It belongs
directly under the Author URL input.

------------------------------------------------------------------------

# Patch 5 --- Add regression tests for the resolver

**New file:** `server/tests/authorService.test.ts`

Create this file with:

``` ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/discordService.js", () => ({
  getDiscordUser: vi.fn(),
  getDiscordUserAvatarUrl: vi.fn((user: { id: string; avatar: string | null }) =>
    user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`
      : `https://cdn.discordapp.com/embed/avatars/0.png`,
  ),
}));

import {
  getDiscordUser,
  getDiscordUserAvatarUrl,
} from "../src/services/discordService.js";
import { resolveAuthorPlaceholders } from "../src/services/authorService.js";

const USER_A = "123456789012345678";
const USER_B = "223456789012345678";

const makeUser = (id: string, username: string, globalName: string | null = null) => ({
  id,
  username,
  global_name: globalName,
  nickname: null,
  avatar: "avatar_hash",
});

describe("authorService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDiscordUser).mockImplementation(async (id) => {
      if (id === USER_A) return makeUser(USER_A, "peace", "Peace") as any;
      if (id === USER_B) return makeUser(USER_B, "other", "Other") as any;
      throw new Error("Unknown test user");
    });
    vi.mocked(getDiscordUserAvatarUrl).mockImplementation(
      (user) => `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`,
    );
  });

  it("fills blank author fields from a valid Discord profile URL", async () => {
    const result = await resolveAuthorPlaceholders({
      embeds: [{ author: { url: `https://discord.com/users/${USER_A}` } }],
    } as any);

    expect((result.payload as any).embeds[0].author).toMatchObject({
      name: "Peace",
      url: `https://discord.com/users/${USER_A}`,
      icon_url: `https://cdn.discordapp.com/avatars/${USER_A}/avatar_hash.png?size=1024`,
    });
    expect(getDiscordUser).toHaveBeenCalledTimes(1);
    expect(getDiscordUser).toHaveBeenCalledWith(USER_A, null);
  });

  it("preserves manually entered author name and icon URL", async () => {
    const result = await resolveAuthorPlaceholders({
      embeds: [{
        author: {
          name: "My custom label",
          url: `https://discord.com/users/${USER_A}`,
          icon_url: "https://example.com/custom.png",
        },
      }],
    } as any);

    expect((result.payload as any).embeds[0].author.name).toBe("My custom label");
    expect((result.payload as any).embeds[0].author.icon_url).toBe("https://example.com/custom.png");
  });

  it("does not apply one embed's author ID to another embed", async () => {
    const result = await resolveAuthorPlaceholders({
      embeds: [
        { author: { url: `https://discord.com/users/${USER_A}` } },
        { author: { name: "A different author" } },
      ],
    } as any);

    expect((result.payload as any).embeds[0].author.name).toBe("Peace");
    expect((result.payload as any).embeds[1].author.name).toBe("A different author");
    expect(getDiscordUser).toHaveBeenCalledTimes(1);
  });

  it("rejects lookalike profile URL hosts", async () => {
    await resolveAuthorPlaceholders({
      embeds: [{ author: { url: `https://discord.com.evil.example/users/${USER_A}` } }],
    } as any);

    expect(getDiscordUser).not.toHaveBeenCalled();
  });

  it("rejects non-HTTPS Discord profile URLs", async () => {
    await resolveAuthorPlaceholders({
      embeds: [{ author: { url: `http://discord.com/users/${USER_A}` } }],
    } as any);

    expect(getDiscordUser).not.toHaveBeenCalled();
  });

  it("resolves supported user variables", async () => {
    const result = await resolveAuthorPlaceholders({
      content: [
        `{user.${USER_A}.name}`,
        `{user.${USER_A}.username}`,
        `{user.${USER_A}.id}`,
        `{user.${USER_A}.url}`,
        `{user.${USER_A}.mention}`,
        `{user.${USER_A}.unknown}`,
      ].join("|"),
    } as any);

    expect((result.payload as any).content).toBe(
      `Peace|peace|${USER_A}|https://discord.com/users/${USER_A}|<@${USER_A}>|{user.${USER_A}.unknown}`,
    );
  });

  it("leaves placeholders unchanged when Discord lookup fails", async () => {
    vi.mocked(getDiscordUser).mockRejectedValueOnce(new Error("Discord unavailable"));

    const result = await resolveAuthorPlaceholders({
      content: `{user.${USER_A}.username}`,
    } as any);

    expect((result.payload as any).content).toBe(`{user.${USER_A}.username}`);
  });

  it("deduplicates repeated user placeholders", async () => {
    await resolveAuthorPlaceholders({
      content: `{user.${USER_A}.name} {user.${USER_A}.username}`,
    } as any);

    expect(getDiscordUser).toHaveBeenCalledTimes(1);
  });

  it("does not use the legacy fallback ID across multiple authors", async () => {
    const result = await resolveAuthorPlaceholders(
      {
        embeds: [
          { author: { name: "First" } },
          { author: { name: "Second" } },
        ],
      } as any,
      USER_A,
    );

    expect(getDiscordUser).not.toHaveBeenCalled();
    expect((result.payload as any).embeds[0].author.name).toBe("First");
    expect((result.payload as any).embeds[1].author.name).toBe("Second");
  });
});
```

These are focused regression tests. They do not yet test real Discord
HTTP rate-limit responses; the in-flight request test for
`getDiscordUser()` should be added after this first patch is stable.

------------------------------------------------------------------------

# Patch 6 --- Correct the documentation claims

**File:** `client/src/pages/DocsPage.tsx`

Search for the exact sentence:

``` text
the server will automatically resolve and populate the user's live Discord display name and profile picture!
```

Replace it with:

``` text
When the message is sent, the server attempts to fetch the Discord user and fills blank author name and icon fields. The live editor preview does not fetch Discord profiles. If Discord lookup fails, the original author values are kept.
```

Also search for:

``` text
real-time
```

Review each matching sentence in the dynamic author section. Remove
claims that the profile updates in real time. Resolution occurs when the
payload is processed for sending; the backend cache can serve a recent
result for up to 10 minutes.

Keep the canonical syntax:

``` text
{user.123456789012345678.name}
{user.123456789012345678.username}
{user.123456789012345678.avatar}
{user.123456789012345678.url}
{user.123456789012345678.mention}
```

Do not document `{user<id>.name}`.

------------------------------------------------------------------------

# Test the changes

From the repository root in PowerShell:

``` powershell
cd server
npx vitest run tests/authorService.test.ts
npm test
npm run typecheck
npm run build
```

Then return to the repository root:

``` powershell
cd ..
npm test
npm run build
```

Use the root commands only if those scripts exist in the root
`package.json`. If root `npm test` already runs all workspaces, that is
the full-suite command.

## If a test fails

Do not change several files at once to silence the failure. Copy the
first complete failing test name, error message, and stack trace. The
most likely compatibility issue is a test mock or TypeScript shape, not
the intended behavior.

## Phase 3 acceptance checklist

-   [ ] A valid HTTPS Discord profile URL resolves at send time.
-   [ ] Lookalike hosts and HTTP URLs do not trigger a lookup.
-   [ ] One embed's ID cannot leak into another embed's author.
-   [ ] Manually entered author values are preserved.
-   [ ] `{user.ID.FIELD}` uses the documented field names.
-   [ ] Unknown fields and failed lookups remain unchanged.
-   [ ] Repeated IDs in one payload trigger one lookup.
-   [ ] Concurrent sends share an in-flight lookup.
-   [ ] Tests, typecheck and build pass.

**Execution status:** This is a proposed local patch based on a
read-only GitHub source review. I have not applied it to your computer,
run its tests, or changed GitHub.
