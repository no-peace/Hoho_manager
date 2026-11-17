import type { UiThemeTokens } from "../utils/puckTheme";
const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options, credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  if (response.status === 204) return null as T;
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof payload.error === "string" ? payload.error : "Theme request failed") as Error & { status?: number };
    error.status = response.status; throw error;
  }
  return payload as T;
};
export interface DesignTheme {
  id: string; ownerDiscordId: string; name: string; description: string | null;
  theme: UiThemeTokens; data?: { theme?: UiThemeTokens; puck?: unknown }; isDefault: boolean; isPublic: boolean; createdAt: string; updatedAt: string;
}
export interface ThemeListResponse { themes: DesignTheme[]; isOwner: boolean; canPublishServerTheme: boolean; }
export const designApi = {
  themes: () => request<ThemeListResponse>("/api/design/themes"),
  createTheme: (body: { name: string; description?: string; theme?: UiThemeTokens; data?: { theme?: UiThemeTokens; puck?: unknown } }) =>
    request<{ theme: DesignTheme }>("/api/design/themes", { method: "POST", body: JSON.stringify(body) }),
  updateTheme: (id: string, body: { name: string; description?: string; theme?: UiThemeTokens; data?: { theme?: UiThemeTokens; puck?: unknown } }) =>
    request<{ theme: DesignTheme }>("/api/design/themes/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) }),
  deleteTheme: (id: string) => request<null>("/api/design/themes/" + encodeURIComponent(id), { method: "DELETE" }),
  access: () => request<{ allowed: true; isOwner: boolean; allowedUsers: Array<{ discord_user_id: string; created_at: string; can_publish_server_theme: number }> }>("/api/design/access"),
  setServerThemePublishAccess: (discordId: string, canPublishServerTheme: boolean) =>
    request<{ ok: true; discordId: string; canPublishServerTheme: boolean }>(
      "/api/design/access/" + encodeURIComponent(discordId),
      { method: "PATCH", body: JSON.stringify({ canPublishServerTheme }) },
    ),
  setDefault: (id: string) => request<{ theme: DesignTheme }>("/api/design/themes/" + encodeURIComponent(id) + "/default", { method: "POST" }),
  grantAccess: (discordId: string) => request<{ ok: true; discordId: string }>("/api/design/access", { method: "POST", body: JSON.stringify({ discordId }) }),
  revokeAccess: (discordId: string) => request<null>("/api/design/access/" + encodeURIComponent(discordId), { method: "DELETE" }),
  publishServerTheme: (theme: UiThemeTokens) =>
    request<{ theme: { theme: UiThemeTokens; updatedAt: string } }>("/api/design/server-theme", { method: "PUT", body: JSON.stringify({ theme }) }),
  publishCommunityTheme: (id: string) =>
    request<{ theme: { theme: UiThemeTokens; sourceThemeId: string; updatedAt: string } }>("/api/design/themes/" + encodeURIComponent(id) + "/publish", { method: "POST" }),
  defaultTheme: () => request<{ theme: { theme: UiThemeTokens; updatedAt: string | null } }>("/api/design/default"),
};
