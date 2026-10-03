import { create } from "zustand";
import { request, ApiRequestError } from "../api/client";

export interface StaffRecord {
  id: number;
  discord_user_id: string;
  discord_username: string;
  granted_by_discord_id: string;
  is_active: number;
  expires_at: string | null;
  cooldown_seconds: number;
  can_send_messages: number;
  can_edit_messages: number;
  can_delete_messages: number;
  can_manage_templates: number;
  allowed_channel_ids: string[];
  can_mention_everyone: number;
  can_mention_here: number;
  can_mention_roles: number;
  allowed_role_mention_ids: string[];
  max_messages_per_hour: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffAccessState {
  records: StaffRecord[];
  loading: boolean;
  error: string | null;
  fetchRecords: () => Promise<void>;
  createRecord: (data: Partial<StaffRecord>) => Promise<void>;
  updateRecord: (discordId: string, data: Partial<StaffRecord>) => Promise<void>;
  deleteRecord: (discordId: string) => Promise<void>;
}

export const useStaffAccess = create<StaffAccessState>((set, get) => ({
  records: [],
  loading: false,
  error: null,
  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const data = await request<StaffRecord[]>("/api/access");
      set({ records: data, loading: false });
    } catch (err: any) {
      set({ error: err instanceof ApiRequestError ? err.message : String(err), loading: false });
    }
  },
  createRecord: async (data) => {
    try {
      await request("/api/access", { method: "POST", body: data });
      await get().fetchRecords();
    } catch (err: any) {
      throw new Error(err instanceof ApiRequestError ? err.message : String(err));
    }
  },
  updateRecord: async (discordId, data) => {
    try {
      await request(`/api/access/${discordId}`, { method: "PATCH", body: data });
      await get().fetchRecords();
    } catch (err: any) {
      throw new Error(err instanceof ApiRequestError ? err.message : String(err));
    }
  },
  deleteRecord: async (discordId) => {
    try {
      await request(`/api/access/${discordId}`, { method: "DELETE" });
      await get().fetchRecords();
    } catch (err: any) {
      throw new Error(err instanceof ApiRequestError ? err.message : String(err));
    }
  }
}));
