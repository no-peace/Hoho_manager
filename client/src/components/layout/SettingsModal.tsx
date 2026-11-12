import React, { useEffect, useState, useMemo } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { useGlobalStore } from "../../store/globalStore";
import { request } from "../../api/client";
import { ALL_LOG_EVENTS, DEFAULT_LOG_EVENTS } from "@dmb/shared";
import { CheckSquare, Square, Shield, Bell } from "lucide-react";

interface SettingsData {
  log_channel_id: string | null;
  head_admin_ids: string[];
  extra_settings?: {
    logging_config?: {
      enabled_channel_events?: string[];
    };
    [key: string]: any;
  };
}

export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { selectedGuildId } = useGlobalStore();
  const tab = "general" as const;
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
      const res = await request<any>(`/api/settings${qs}`);
      const extra = res.extra_settings || {};
      const loggingCfg = extra.logging_config || {
        enabled_channel_events: [...DEFAULT_LOG_EVENTS],
      };
      setData({
        log_channel_id: res.log_channel_id || null,
        head_admin_ids: res.head_admin_ids || [],
        extra_settings: {
          ...extra,
          logging_config: {
            enabled_channel_events: Array.isArray(loggingCfg.enabled_channel_events)
              ? loggingCfg.enabled_channel_events
              : [...DEFAULT_LOG_EVENTS],
          },
        },
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
      useGlobalStore.getState().showToast("Settings saved!", "success");
    } catch (e) {
      useGlobalStore.getState().showToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const enabledEvents: string[] = useMemo(() => {
    return data.extra_settings?.logging_config?.enabled_channel_events ?? [...DEFAULT_LOG_EVENTS];
  }, [data.extra_settings]);

  const setEnabledEvents = (events: string[]) => {
    setData((prev) => ({
      ...prev,
      extra_settings: {
        ...(prev.extra_settings || {}),
        logging_config: {
          enabled_channel_events: events,
        },
      },
    }));
  };

  const toggleEvent = (eventKey: string) => {
    if (enabledEvents.includes(eventKey)) {
      setEnabledEvents(enabledEvents.filter((e) => e !== eventKey));
    } else {
      setEnabledEvents([...enabledEvents, eventKey]);
    }
  };

  const toggleCategory = (categoryEvents: string[]) => {
    const allSelected = categoryEvents.every((e) => enabledEvents.includes(e));
    if (allSelected) {
      setEnabledEvents(enabledEvents.filter((e) => !categoryEvents.includes(e)));
    } else {
      const merged = Array.from(new Set([...enabledEvents, ...categoryEvents]));
      setEnabledEvents(merged);
    }
  };

  const categories = useMemo(() => {
    const map = new Map<string, Array<{ event: string; label: string }>>();
    for (const item of ALL_LOG_EVENTS) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push({ event: item.event, label: item.label });
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, []);

  if (!isHeadAdmin) {
    return (
      <Modal open={open} onClose={onClose} title="Settings" width="max-w-md">
        <p className="text-sm text-[#f28b8b] text-center p-4">You do not have Head Admin access to view settings.</p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Head Admin Settings" width="max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-4 h-[75vh] min-w-0">
        {/* Sidebar */}
        <div className="w-full sm:w-44 bg-[#1e1f22] border border-[#111214] rounded p-1.5 sm:p-2 flex flex-row sm:flex-col gap-1 shrink-0 min-w-0">
          <button
            onClick={() => tab}
            className={`text-left px-3 py-2 rounded text-xs font-bold uppercase ${tab === "general" ? "bg-[#5865f2] text-white" : "text-[#b5bac1] hover:bg-[#35373c]"}`}
          >
            General
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-[#1e1f22] border border-[#111214] rounded p-4">
          {tab === "general" && (
            <div className="space-y-5">
              <div className="border-b border-[#35373c] pb-2">
                <h3 className="font-bold text-[#dbdee1] uppercase text-xs tracking-wider">
                  General Settings {selectedGuildId ? `(Guild: ${selectedGuildId})` : "(Global)"}
                </h3>
                <p className="text-[11px] text-[#949ba4] mt-0.5">
                  Configure Discord log streaming, audit event dispatch, and authorized Head Admins.
                </p>
              </div>

              {loading ? (
                <p className="text-xs text-[#949ba4]">Loading...</p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                      Audit Log Channel
                    </label>
                    <SearchableDiscordSelect
                      type="channel"
                      guildId={selectedGuildId || undefined}
                      value={data.log_channel_id || ""}
                      onChange={(val) => setData({ ...data, log_channel_id: (val as string) || null })}
                      placeholder="Select a channel for audit alerts..."
                    />
                  </div>

                  {/* Configurable Discord Logging Events */}
                  <div className="space-y-3 pt-2 border-t border-[#2b2d31]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Bell size={13} className="text-[#5865f2]" />
                          <h4 className="text-xs font-bold text-[#dbdee1] uppercase tracking-wider">
                            Discord Log Channel Events
                          </h4>
                        </div>
                        <p className="text-[11px] text-[#949ba4]">
                          Choose which events dispatch embeds to your Discord log channel ({enabledEvents.length}/{ALL_LOG_EVENTS.length} enabled)
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEnabledEvents([...DEFAULT_LOG_EVENTS])}
                          className="px-2 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[10px] font-semibold text-[#dbdee1] transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEnabledEvents([
                              "SEND_MESSAGE",
                              "SEND_BLOCKED",
                              "MENTION_BLOCKED",
                              "ROLE_MENTION_BLOCKED",
                              "PERMISSION_DENIED",
                              "STAFF_GRANTED",
                              "STAFF_REVOKED",
                              "STAFF_UPDATED",
                              "RATE_LIMIT_HIT",
                            ])
                          }
                          className="px-2 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[10px] font-semibold text-[#5865f2] transition-colors"
                        >
                          Recommended
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnabledEvents([])}
                          className="px-2 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[10px] font-semibold text-[#f28b8b] transition-colors"
                        >
                          Disable All
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {categories.map(({ category, items }) => {
                        const catEvents = items.map((i) => i.event);
                        const allSelected = catEvents.every((e) => enabledEvents.includes(e));

                        return (
                          <div
                            key={category}
                            className="bg-[#111214]/60 border border-[#2b2d31] rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between border-b border-[#2b2d31] pb-1.5">
                              <span className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1.5">
                                <Shield size={12} className="text-[#949ba4]" />
                                {category}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleCategory(catEvents)}
                                className="text-[10px] text-[#949ba4] hover:text-white transition-colors"
                              >
                                {allSelected ? "Deselect category" : "Select category"}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                              {items.map(({ event, label }) => {
                                const checked = enabledEvents.includes(event);
                                return (
                                  <label
                                    key={event}
                                    onClick={() => toggleEvent(event)}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer transition-colors text-xs select-none ${
                                      checked
                                        ? "bg-[#5865f2]/15 text-white border border-[#5865f2]/30"
                                        : "bg-[#1e1f22] text-[#949ba4] hover:text-[#dbdee1] border border-transparent"
                                    }`}
                                  >
                                    {checked ? (
                                      <CheckSquare size={14} className="text-[#5865f2] shrink-0" />
                                    ) : (
                                      <Square size={14} className="text-[#4e5058] shrink-0" />
                                    )}
                                    <span className="truncate font-medium">{label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-[#2b2d31]">
                    <label className="block text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                      Head Admin IDs (Select Users)
                    </label>
                    <SearchableDiscordSelect
                      type="member"
                      guildId={selectedGuildId || undefined}
                      multiple
                      value={data.head_admin_ids}
                      onChange={(val) => setData({ ...data, head_admin_ids: val as string[] })}
                      placeholder="Search or enter user IDs..."
                    />
                    <p className="text-[11px] text-[#949ba4]">
                      Head Admins have full configuration permissions across all bots, logging, and staff management.
                    </p>
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
        </div>
      </div>
    </Modal>
  );
};
