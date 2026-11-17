import type { AppLayoutDocuments } from "./puckAppLayout";
import { validateAppLayoutDocuments } from "./puckAppLayout";

export interface PublishedAppLayout {
  schemaVersion: 1;
  desktop: AppLayoutDocuments["desktop"];
  mobile: AppLayoutDocuments["mobile"];
  publisher?: { discordId: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface PublishedAppLayoutResponse {
  layout: PublishedAppLayout | null;
  fallback: boolean;
}

export interface PublishAppLayoutResponse {
  ok: true;
  layout: PublishedAppLayout;
}

const APP_LAYOUT_ENDPOINT = "/api/design/app-layout";

const request = async <T,>(method: "GET" | "PUT", body?: AppLayoutDocuments): Promise<T> => {
  const response = await fetch(APP_LAYOUT_ENDPOINT, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? {
      body: JSON.stringify({
        schemaVersion: 1,
        desktop: body.desktop,
        mobile: body.mobile,
      }),
    } : {}),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    const error = new Error(
      typeof payload.error === "string" ? payload.error : "Application layout request failed.",
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
};

export const appLayoutApi = {
  getPublished: () => request<PublishedAppLayoutResponse>("GET"),
  publish: (documents: AppLayoutDocuments) => {
    const checked = validateAppLayoutDocuments(documents);
    return request<PublishAppLayoutResponse>("PUT", checked);
  },
};
