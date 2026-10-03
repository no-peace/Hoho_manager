import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { ProfilesPanel } from "./ProfilesPanel";
import { useGlobalStore } from "../../store/globalStore";
import { request } from "../../api/client";

interface SettingsData {
  log_channel_id: string | null;
  head_admin_ids: string[];
}

export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { selectedGuildId } = useGlobalStore();
  const [tab, setTab] = useState<"general" | "bots">("general");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SettingsData>({ log_channel_id: null, head_admin_ids: [] });
  const [saving, setSaving] = useState(false);
  const [isHeadAdmin, setIsHeadAdmin] = useState(false);

  useEffect(() => {
    if (open) {
      checkAuthAndLoad();
    }
  }, [open, selectedGuildId]);

  const checkAuthAndLoad = async () => {
    try {
      const auth = await request<{ isHeadAdmin: boolean }>("/api/settings/auth");
      setIsHeadAdmin(auth.isHeadAdmin);
      if (auth.isHeadAdmin) {
        loadSettings();
      }
    } catch {
      setIsHeadAdmin(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const qs = selectedGuildId ? `?guildId=${selectedGuildId}` : "";
      const res = await request<SettingsData>(`/api/settings${qs}`);
      setData({
        log_channel_id: res.log_channel_id || null,
        head_admin_ids: res.head_admin_ids || [],
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const qs = selectedGuildId ? `?guildId=${selectedGuildId}` : "";
      await request(`/api/settings${qs}`, {
        method: "PATCH",
        body: data,
      });
      alert("Settings saved!");
    } catch (e) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!isHeadAdmin) {
    return (
      <Modal open={open} onClose={onClose} title="Settings" width="max-w-md">
        <p className="text-sm text-[#f28b8b] text-center p-4">You do not have Head Admin access to view settings.</p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Head Admin Settings" width="max-w-2xl">
      <div className="flex gap-4 h-[60vh]">
        {/* Sidebar */}
        <div className="w-48 bg-[#1e1f22] border border-[#111214] rounded p-2 flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setTab("general")}
            className={`text-left px-3 py-2 rounded text-xs font-bold uppercase ${tab === "general" ? "bg-[#5865f2] text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}
          >
            General
          </button>
          <button
            onClick={() => setTab("bots")}
            className={`text-left px-3 py-2 rounded text-xs font-bold uppercase ${tab === "bots" ? "bg-[#5865f2] text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}
          >
            Bot Profiles
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1e1f22] border border-[#111214] rounded p-4">
          {tab === "general" && (
            <div className="space-y-4">
              <h3 className="font-bold text-[#dbdee1] uppercase text-xs tracking-wider border-b border-[#35373c] pb-2 mb-4">
                General Settings {selectedGuildId ? `(Guild: ${selectedGuildId})` : "(Global)"}
              </h3>
              
              {loading ? (
                <p className="text-xs text-[#949ba4]">Loading...</p>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Audit Log Channel</label>
                    <SearchableDiscordSelect
                      type="channel"
                      guildId={selectedGuildId || undefined}
                      value={data.log_channel_id || ""}
                      onChange={(val) => setData({ ...data, log_channel_id: (val as string) || null })}
                      placeholder="Select a channel..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Head Admin IDs (Select Users)</label>
                    <SearchableDiscordSelect
                      type="member"
                      guildId={selectedGuildId || undefined}
                      multiple
                      value={data.head_admin_ids}
                      onChange={(val) => setData({ ...data, head_admin_ids: val as string[] })}
                      placeholder="Search or enter user IDs..."
                    />
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "bots" && (
            <div className="-m-4">
              <ProfilesPanel />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
