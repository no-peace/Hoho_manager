import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Edit2, ShieldAlert, Loader2 } from "lucide-react";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, TextField } from "../ui/Field";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { useGlobalStore } from "../../store/globalStore";
import { useStaffAccess, type StaffRecord } from "../../hooks/useStaffAccess";

export const AccessPanel = () => {
  const { records, loading, error, fetchRecords, createRecord, updateRecord, deleteRecord } = useStaffAccess();
  const { selectedGuildId, currentUser, showToast, openConfirm } = useGlobalStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<StaffRecord>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [allChannelsAllowed, setAllChannelsAllowed] = useState(false);
  const [allGuildsAllowed, setAllGuildsAllowed] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleEdit = (record: StaffRecord) => {
    setEditingId(record.discord_user_id);
    setFormData(record);
    setIsCreating(false);
    setAllChannelsAllowed(record.allowed_channel_ids.includes("*"));
    setAllGuildsAllowed((record.allowed_guild_ids ?? []).includes("*"));
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({
      discord_user_id: "",
      discord_username: "",
      discord_global_name: "",
      discord_avatar: null,
      is_active: 1,
      can_send_messages: 1,
      can_edit_messages: 0,
      can_delete_messages: 0,
      can_manage_templates: 0,
      can_manage_automation: 0,
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      can_attach_files: 0,
      can_use_components_v2: 0,
      can_use_weao_exploits: 0,
      allowed_guild_ids: selectedGuildId ? [selectedGuildId] : [],
      cooldown_seconds: 30,
      max_messages_per_hour: 10,
      allowed_channel_ids: [],
      allowed_role_mention_ids: [],
      notes: ""
    });
    setIsCreating(true);
    setAllChannelsAllowed(false);
    setAllGuildsAllowed(false);
  };

  const handleSave = async () => {
    try {
      const dataToSave = { ...formData };
      dataToSave.allowed_channel_ids = allChannelsAllowed
        ? ["*"]
        : (formData.allowed_channel_ids ?? []).filter((id) => id !== "*");
      dataToSave.allowed_guild_ids = allGuildsAllowed
        ? ["*"]
        : (formData.allowed_guild_ids ?? []).filter((id) => id !== "*");
      
      if (isCreating) {
        if (!dataToSave.discord_user_id) {
          return showToast("User ID is required.","warning");
        }
        await createRecord(dataToSave);
      } else if (editingId && editingId !== "new") {
        await updateRecord(editingId, dataToSave);
      }
      setEditingId(null);
    } catch (err: any) {
      showToast(err.message,"error");
    }
  };

  const handleDelete = (id: string) => {
    openConfirm({
      title: "Revoke Staff Access",
      message: "Are you sure you want to revoke access for this user?",
      confirmLabel: "Revoke Access",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteRecord(id);
          showToast("Staff access revoked.", "success");
        } catch (err: any) {
          showToast(err.message, "error");
        }
      },
    });
  };

  const updateForm = (updates: Partial<StaffRecord>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-md border border-[#1D2230] bg-[#161A23]">
      <div className="flex flex-col gap-3 border-b border-[#1D2230] bg-[#1D2230] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 shrink-0">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-[#F1F3F9] sm:text-lg">
            <ShieldAlert size={20} className="text-[#FBBF24]" />
            Staff Access Management
          </h2>
          <p className="text-xs text-[#A1A8B8] sm:text-sm">Control who can use this tool and what they can do.</p>
        </div>
        {!editingId && (
          <Button icon={Plus} onClick={handleCreate} variant="primary" className="w-full sm:w-auto">
            Grant Access
          </Button>
        )}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 text-[#F1F3F9] custom-scrollbar sm:p-5">
        {error && <div className="mb-4 p-3 bg-[#F87171]/10 border border-[#F87171]/30 text-[#F87171] rounded">{error}</div>}

        {currentUser && !editingId && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[#252B3A]/50 bg-[#1D2230] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatarUrl || `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`}
                  alt={currentUser.username}
                  className="w-8 h-8 rounded-full object-cover border border-[#252B3A]"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#818CF8] flex items-center justify-center text-white text-xs font-bold">
                  {currentUser.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {currentUser.global_name || currentUser.username}
                  </span>
                  <span className="text-[10px] font-mono text-[#A1A8B8] bg-[#161A23] px-1.5 py-0.5 rounded border border-[#10131A]">
                    {currentUser.id}
                  </span>
                  {currentUser.isAdmin && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FBBF24] bg-[#FBBF24]/10 px-1.5 py-0.2 rounded">
                      Head Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#A1A8B8]">Authenticated Operator</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-[#34D399] flex items-center gap-1.5 bg-[#34D399]/10 px-2 py-1 rounded">
              <span className="w-2 h-2 rounded-full bg-[#34D399]" /> Active Session
            </span>
          </div>
        )}

        {editingId ? (
          <div className="w-full min-w-0 max-w-3xl space-y-6 rounded-lg border border-[#10131A] bg-[#1D2230] p-3 sm:p-5">
            <h3 className="text-md font-semibold text-[#F1F3F9] border-b border-[#252B3A] pb-2 mb-4">
              {isCreating ? "Grant New Access" : `Edit Access: ${formData.discord_username || formData.discord_user_id}`}
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isCreating ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-[#A1A8B8]">Select User or enter ID</label>
                    {currentUser && (
                      <button
                        type="button"
                        onClick={() =>
                          updateForm({
                            discord_user_id: currentUser.id,
                            discord_username: currentUser.username,
                            discord_global_name: currentUser.global_name || currentUser.username,
                            discord_avatar: currentUser.avatar,
                          })
                        }
                        className="text-[11px] text-[#818CF8] hover:underline font-semibold"
                        title="Fill with my authenticated Discord ID"
                      >
                        Grant to Myself
                      </button>
                    )}
                  </div>
                  <SearchableDiscordSelect
                    type="member"
                    guildId={selectedGuildId || undefined}
                    value={formData.discord_user_id || ""}
                    onChange={(val) => updateForm({ discord_user_id: val as string })}
                    onSelectOption={(opt) => {
                      updateForm({
                        discord_user_id: opt.id,
                        discord_username: opt.username || opt.name,
                        discord_global_name: opt.global_name || null,
                        discord_avatar: opt.avatar || null,
                      });
                    }}
                    placeholder="Search member..."
                  />
                  {formData.discord_user_id && (
                    <div className="mt-2 flex items-center gap-3 p-2.5 rounded bg-[#161A23] border border-[#252B3A]/50">
                      {formData.discord_avatar ? (
                        <img
                          src={`https://cdn.discordapp.com/avatars/${formData.discord_user_id}/${formData.discord_avatar}.png`}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover border border-[#252B3A]"
                          onError={(e) => {
                            const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(BigInt(formData.discord_user_id || "0") >> 22n) % 6n}.png`;
                            (e.target as HTMLImageElement).src = defaultAvatar;
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#818CF8] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(formData.discord_global_name || formData.discord_username || "U").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">
                            {formData.discord_global_name || formData.discord_username || "Selected User"}
                          </span>
                          <span className="text-[10px] font-mono text-[#A1A8B8] bg-[#1D2230] px-1.5 py-0.2 rounded border border-[#10131A]">
                            {formData.discord_user_id}
                          </span>
                        </div>
                        {formData.discord_username && (
                          <p className="text-[11px] text-[#A1A8B8] truncate">@{formData.discord_username}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <TextField
                  label="Discord User ID (Snowflake)"
                  value={formData.discord_user_id || ""}
                  onChange={(e) => updateForm({ discord_user_id: e.target.value })}
                  disabled
                />
              )}
              <TextField
                label="Staff Username (Optional)"
                value={formData.discord_username || ""}
                onChange={(e) => updateForm({ discord_username: e.target.value })}
                placeholder="Name to identify them"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#F1F3F9]">Action Permissions</h4>
              <div className="grid grid-cols-1 gap-3 rounded border border-[#10131A] bg-[#161A23] p-3 sm:grid-cols-2">
                <Checkbox
                  label="Can Send Messages"
                  checked={formData.can_send_messages === 1}
                  onChange={(c) => updateForm({ can_send_messages: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Edit Bot Messages"
                  checked={formData.can_edit_messages === 1}
                  onChange={(c) => updateForm({ can_edit_messages: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Delete Bot Messages"
                  checked={formData.can_delete_messages === 1}
                  onChange={(c) => updateForm({ can_delete_messages: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Manage Templates"
                  checked={formData.can_manage_templates === 1}
                  onChange={(c) => updateForm({ can_manage_templates: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Manage Automations (Schedules / Sticky Messages)"
                  checked={formData.can_manage_automation === 1}
                  onChange={(c) => updateForm({ can_manage_automation: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Attach / Upload Files"
                  checked={formData.can_attach_files !== 0}
                  onChange={(c) => updateForm({ can_attach_files: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Use Components V2"
                  checked={formData.can_use_components_v2 !== 0}
                  onChange={(c) => updateForm({ can_use_components_v2: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can Bind WEAO Exploits"
                  checked={formData.can_use_weao_exploits !== 0}
                  onChange={(c) => updateForm({ can_use_weao_exploits: c ? 1 : 0 })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#F1F3F9]">Mention Permissions</h4>
              <div className="grid grid-cols-1 gap-3 rounded border border-[#10131A] bg-[#161A23] p-3 sm:grid-cols-3">
                <Checkbox
                  label="Can @everyone"
                  checked={formData.can_mention_everyone === 1}
                  onChange={(c) => updateForm({ can_mention_everyone: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can @here"
                  checked={formData.can_mention_here === 1}
                  onChange={(c) => updateForm({ can_mention_here: c ? 1 : 0 })}
                />
                <Checkbox
                  label="Can @roles (Any)"
                  checked={formData.can_mention_roles === 1}
                  onChange={(c) => updateForm({ can_mention_roles: c ? 1 : 0 })}
                />
              </div>
              
              {!formData.can_mention_roles && (
                <div>
                  <label className="block text-[11px] font-bold text-[#A1A8B8] mb-1">Allowed Role Mentions (Specific)</label>
                  <SearchableDiscordSelect
                    type="role"
                    multiple
                    guildId={selectedGuildId || undefined}
                    value={formData.allowed_role_mention_ids || []}
                    onChange={(val) => updateForm({ allowed_role_mention_ids: val as string[] })}
                    placeholder="Select allowed roles..."
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#F1F3F9]">Server Allowlist</h4>
              <div className="bg-[#161A23] p-3 rounded border border-[#10131A] space-y-3">
                <Checkbox
                  label="Allow ALL servers (*)"
                  checked={allGuildsAllowed}
                  onChange={setAllGuildsAllowed}
                />
                {!allGuildsAllowed && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#A1A8B8] mb-1">Allowed Servers</label>
                    <SearchableDiscordSelect
                      type="guild"
                      multiple
                      value={(formData.allowed_guild_ids || []).filter((id) => id !== "*")}
                      onChange={(val) => updateForm({ allowed_guild_ids: val as string[] })}
                      placeholder="Select allowed servers..."
                    />
                  </div>
                )}
                <p className="text-[10px] text-[#6F788A]">New staff accounts are restricted to the selected server by default. Server and channel allowlists are checked by the API.</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#F1F3F9]">Channel Allowlist</h4>
              <div className="bg-[#161A23] p-3 rounded border border-[#10131A] space-y-3">
                <Checkbox
                  label="Allow ALL channels (*)"
                  checked={allChannelsAllowed}
                  onChange={(c) => setAllChannelsAllowed(c)}
                />
                
                {!allChannelsAllowed && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#A1A8B8] mb-1">Allowed Channel IDs</label>
                    <SearchableDiscordSelect
                      type="channel"
                      multiple
                      guildId={selectedGuildId || undefined}
                      value={(formData.allowed_channel_ids || []).filter(c => c !== "*")}
                      onChange={(val) => updateForm({ allowed_channel_ids: val as string[] })}
                      placeholder="Select allowed channels..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Access Expires At (Optional)"
                type="datetime-local"
                value={formData.expires_at ? (() => {
                  const date = new Date(formData.expires_at);
                  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                })() : ""}
                onChange={(e) => updateForm({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
              <TextField
                label="Admin Notes (Optional)"
                value={formData.notes || ""}
                onChange={(e) => updateForm({ notes: e.target.value })}
                placeholder="Reason for granting access..."
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#F1F3F9]">Per-Action Limits</h4>
              <p className="text-[11px] text-[#A1A8B8]">Leave a field blank to use the global cooldown or hourly limit. Set 0 cooldown to disable the cooldown for that action.</p>
              <div className="grid grid-cols-1 gap-3 rounded border border-[#10131A] bg-[#161A23] p-3 sm:grid-cols-2">
                {(["send", "edit", "delete", "templates", "automation", "weao"] as const).map((action) => (
                  <div key={action} className="grid grid-cols-2 gap-2">
                    <TextField
                      label={action + " cooldown (s)"}
                      type="number"
                      value={formData.granular_cooldowns?.[action] === undefined ? "" : String(formData.granular_cooldowns?.[action])}
                      onChange={(e) => {
                        const next = { ...(formData.granular_cooldowns || {}) };
                        if (e.target.value.trim() === "") delete next[action];
                        else if (Number.isFinite(Number(e.target.value)) && Number(e.target.value) >= 0) next[action] = Number(e.target.value);
                        updateForm({ granular_cooldowns: next });
                      }}
                      placeholder="Default"
                    />
                    <TextField
                      label={action + " max/hr"}
                      type="number"
                      value={formData.granular_rate_limits?.[action] === undefined ? "" : String(formData.granular_rate_limits?.[action])}
                      onChange={(e) => {
                        const next = { ...(formData.granular_rate_limits || {}) };
                        if (e.target.value.trim() === "") delete next[action];
                        else if (Number.isFinite(Number(e.target.value)) && Number(e.target.value) >= 0) next[action] = Number(e.target.value);
                        updateForm({ granular_rate_limits: next });
                      }}
                      placeholder="Default"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="Cooldown (Seconds)"
                type="number"
                value={String(formData.cooldown_seconds || 30)}
                onChange={(e) => updateForm({ cooldown_seconds: parseInt(e.target.value) || 0 })}
              />
              <TextField
                label="Max Actions Per Hour"
                type="number"
                value={String(formData.max_messages_per_hour || 10)}
                onChange={(e) => updateForm({ max_messages_per_hour: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-[#252B3A]">
              <Checkbox
                label="Account Active"
                checked={formData.is_active === 1}
                onChange={(c) => updateForm({ is_active: c ? 1 : 0 })}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button icon={Save} onClick={handleSave} variant="primary">Save Access</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#272D3A] bg-[#161A23] px-3 py-3 text-xs text-[#A1A8B8]"><Loader2 size={15} className="animate-spin text-[#818CF8]" /><span>Loading staff access…</span></div>
            ) : records.length === 0 ? (
              <div className="text-[#A1A8B8] p-8 text-center bg-[#1D2230] rounded border border-dashed border-[#252B3A]">
                No staff members configured. Click &quot;Grant Access&quot; to add one.
              </div>
            ) : (
              records.map(record => {
                const isCurrentUser = currentUser && record.discord_user_id === currentUser.id;
                const defaultAvatar = `https://cdn.discordapp.com/embed/avatars/${(BigInt(record.discord_user_id || "0") >> 22n) % 6n}.png`;
                const avatarSrc = record.avatarUrl || (record.discord_avatar ? `https://cdn.discordapp.com/avatars/${record.discord_user_id}/${record.discord_avatar}.png` : defaultAvatar);

                return (
                  <div key={record.discord_user_id} className={`flex flex-col gap-3 rounded-lg border border-[#272D3A] bg-[#161A23] p-3 transition-[border-color,background-color,opacity] duration-150 hover:border-[#252B3A] sm:flex-row sm:items-center sm:justify-between ${record.is_active ? 'bg-[#1D2230] border-[#252B3A]' : 'bg-[#161A23] border-[#1D2230] opacity-60'}`}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <img
                        src={avatarSrc}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-[#252B3A] shrink-0 bg-[#161A23]"
                        onError={(e) => { (e.target as HTMLImageElement).src = defaultAvatar; }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-[#F1F3F9]">{record.discord_global_name || record.discord_username || 'Unknown Staff'}</strong>
                          {record.discord_username && (
                            <span className="text-xs text-[#A1A8B8]">@{record.discord_username}</span>
                          )}
                          {isCurrentUser && (
                            <span className="text-[10px] font-bold text-[#818CF8] bg-[#818CF8]/15 border border-[#818CF8]/30 px-1.5 py-0.5 rounded">
                              (You)
                            </span>
                          )}
                          <span className="text-xs font-mono text-[#A1A8B8] bg-[#161A23] px-1.5 py-0.5 rounded border border-[#10131A]">{record.discord_user_id}</span>
                          {!record.is_active && <span className="text-[10px] uppercase font-bold text-[#F87171] bg-[#F87171]/10 px-1.5 py-0.5 rounded">Disabled</span>}
                        </div>
                        <div className="text-xs text-[#A1A8B8] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Cooldown: {record.cooldown_seconds}s</span>
                          <span>Max/hr: {record.max_messages_per_hour}</span>
                          <span>Channels: {record.allowed_channel_ids.length === 0 ? 'NONE' : record.allowed_channel_ids.includes('*') ? 'ALL' : record.allowed_channel_ids.length}</span>
                          <span>Files: {record.can_attach_files === 0 ? 'No' : 'Yes'}</span>
                          <span>Servers: {!(record.allowed_guild_ids ?? []).length ? 'NONE' : (record.allowed_guild_ids ?? []).includes('*') ? 'ALL' : (record.allowed_guild_ids ?? []).length}</span>
                          <span>Automation: {record.can_manage_automation === 1 ? 'Yes' : 'No'}</span>
                          <span>Expires: {record.expires_at ? new Date(record.expires_at).toLocaleDateString() : 'Never'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 self-end sm:self-auto sm:ml-2">
                      <IconButton icon={Edit2} label="Edit" onClick={() => handleEdit(record)} className="text-[#A1A8B8] hover:text-white" />
                      <IconButton icon={Trash2} label="Revoke" onClick={() => handleDelete(record.discord_user_id)} className="text-[#F87171] hover:bg-[#F87171]/10" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessPanel;
