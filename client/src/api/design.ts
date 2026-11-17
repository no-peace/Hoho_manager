import type { UiThemeTokens } from "../utils/puckTheme";

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null as T;
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof payload.error === "string" ? payload.error : "Design Lab request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
};

export interface DesignTheme {
  id: string;
  ownerDiscordId: string;
  name: string;
  description: string | null;
  data: { puck?: unknown; theme?: UiThemeTokens };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface DesignAccessResponse {
  allowed: true;
  isOwner: boolean;
  allowedUsers: Array<{ discord_user_id: string; created_at: string }>;
}
export const designApi = {
  access: () => request<DesignAccessResponse>("/api/design/access"),
  themes: () => request<{ themes: DesignTheme[] }>("/api/design/themes"),
  createTheme: (body: { name: string; description?: string; data: DesignTheme["data"] }) =>
    request<{ theme: DesignTheme }>("/api/design/themes", { method: "POST", body: JSON.stringify(body) }),
  updateTheme: (id: string, body: { name: string; description?: string; data: DesignTheme["data"] }) =>
    request<{ theme: DesignTheme }>("/api/design/themes/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(body) }),
  deleteTheme: (id: string) =>
    request<null>("/api/design/themes/" + encodeURIComponent(id), { method: "DELETE" }),
  setDefault: (id: string) =>
    request<{ theme: DesignTheme }>("/api/design/themes/" + encodeURIComponent(id) + "/default", { method: "POST" }),
  grantAccess: (discordId: string) =>
    request<{ ok: true; discordId: string }>("/api/design/access", { method: "POST", body: JSON.stringify({ discordId }) }),
  revokeAccess: (discordId: string) =>
    request<null>("/api/design/access/" + encodeURIComponent(discordId), { method: "DELETE" }),
  defaultTheme: () => request<{ theme: DesignTheme | null }>("/api/design/default"),
};
