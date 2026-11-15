import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../../api/client";
import { useGlobalStore } from "../../store/globalStore";

const USER_PLACEHOLDER_REGEX = /\{user\.(\d{17,20})\.([a-zA-Z0-9_]+)\}/g;
const MAX_IDS_PER_REQUEST = 10;
const PREVIEW_DEBOUNCE_MS = 250;

export interface PreviewDiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  nickname: string | null;
  avatarUrl: string;
  profileUrl: string;
}

interface UserPlaceholderPreviewContextValue {
  resolveUserPlaceholders: (value: string) => string;
  isResolvingUsers: boolean;
}

const UserPlaceholderPreviewContext =
  createContext<UserPlaceholderPreviewContextValue | null>(null);

const collectUserIds = (value: unknown, ids: Set<string>): void => {
  if (typeof value === "string") {
    for (const match of value.matchAll(USER_PLACEHOLDER_REGEX)) {
      const field = match[2]?.toLowerCase();
      // Removed legacy aliases do not trigger a Discord lookup by themselves.
      if (field === "avatarurl" || field === "icon" || field === "pfp") continue;
      if (match[1]) ids.add(match[1]);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectUserIds(item, ids);
    return;
  }

  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      collectUserIds(child, ids);
    }
  }
};

const getFieldValue = (
  user: PreviewDiscordUser,
  field: string,
): string | null => {
  switch (field.toLowerCase()) {
    case "name":
      return user.nickname || user.username;
    case "displayname":
    case "globalname":
      return user.globalName || user.username;

    case "username":
    case "tag":
      return user.username;

    case "id":
      return user.id;

    case "url":
    case "profile":
      return user.profileUrl;

    case "avatar":
    case "avatarurl":
      return user.avatarUrl;

    case "mention":
      return `<@${user.id}>`;

    default:
      return null;
  }
};

export const UserPlaceholderPreviewProvider = ({
  source,
  children,
}: {
  source: unknown;
  children: React.ReactNode;
}) => {
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const currentUser = useGlobalStore((state) => state.currentUser);
  const [users, setUsers] = useState<Record<string, PreviewDiscordUser>>({});
  const [isResolvingUsers, setIsResolvingUsers] = useState(false);
  const attemptedIdsRef = useRef(new Set<string>());

  // JSON serialization gives the effect a stable dependency for nested editor data.
  const sourceSnapshot = useMemo(() => {
    try {
      return JSON.stringify(source ?? null);
    } catch {
      return "";
    }
  }, [source]);

  const requestedIds = useMemo(() => {
    const ids = new Set<string>();
    if (sourceSnapshot) {
      try {
        collectUserIds(JSON.parse(sourceSnapshot), ids);
      } catch {
        // Invalid/transient editor state: leave placeholders unresolved.
      }
    }
    if (currentUser?.id && /\{user\.(?:name|displayname)\}/i.test(sourceSnapshot)) {
      ids.add(currentUser.id);
    }
    return [...ids];
  }, [sourceSnapshot, currentUser?.id]);

  useEffect(() => {
    const pendingIds = requestedIds.filter(
      (id) => !users[id] && !attemptedIdsRef.current.has(id),
    );

    if (pendingIds.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      if (cancelled) return;

      setIsResolvingUsers(true);

      // Mark before the request to prevent duplicate calls during React rerenders.
      for (const id of pendingIds) attemptedIdsRef.current.add(id);

      try {
        const resolved: Record<string, PreviewDiscordUser> = {};

        for (let index = 0; index < pendingIds.length; index += MAX_IDS_PER_REQUEST) {
          if (cancelled) return;

          const batch = pendingIds.slice(index, index + MAX_IDS_PER_REQUEST);
          const response = await api.discord.resolveUsers(batch, controller.signal, selectedGuildId || undefined);

          for (const [id, user] of Object.entries(response.users ?? {})) {
            if (
              batch.includes(id) &&
              user &&
              user.id === id &&
              typeof user.username === "string" &&
              typeof user.avatarUrl === "string" &&
              typeof user.profileUrl === "string"
            ) {
              resolved[id] = user;
            }
          }
        }

        if (!cancelled && Object.keys(resolved).length > 0) {
          setUsers((current) => ({ ...current, ...resolved }));
        }
      } catch (error) {
        // Abort is expected when the user edits/deletes a placeholder quickly.
        if (!(error instanceof Error && error.name === "AbortError")) {
          // Keep failed placeholders intact. Do not repeatedly hammer Discord on rerender.
        }
      } finally {
        if (!cancelled) setIsResolvingUsers(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();

      // An aborted batch may be retried if its ID is still present next time.
      for (const id of pendingIds) attemptedIdsRef.current.delete(id);
    };
  }, [requestedIds, users, selectedGuildId]);

  const resolveUserPlaceholders = useCallback(
    (value: string): string =>
      value
        .replace(
          USER_PLACEHOLDER_REGEX,
          (original, id: string, field: string) => {
            const user = users[id];
            if (!user) return original;
            return getFieldValue(user, field) ?? original;
          },
        )
        .replace(/\{user\.(name|displayname)\}/gi, (original, field: string) => {
          const user = currentUser?.id ? users[currentUser.id] : undefined;
          if (!user) return original;
          return field.toLowerCase() === "name"
            ? user.nickname || user.username
            : user.globalName || user.username;
        }),
    [users, currentUser?.id],
  );

  const contextValue = useMemo(
    () => ({ resolveUserPlaceholders, isResolvingUsers }),
    [resolveUserPlaceholders, isResolvingUsers],
  );

  return (
    <UserPlaceholderPreviewContext.Provider value={contextValue}>
      {children}
    </UserPlaceholderPreviewContext.Provider>
  );
};

export const useUserPlaceholderPreview = () => {
  const context = useContext(UserPlaceholderPreviewContext);

  // Keep child preview components usable in isolation (unit tests/story previews).
  return (
    context ?? {
      resolveUserPlaceholders: (value: string) => value,
      isResolvingUsers: false,
    }
  );
};