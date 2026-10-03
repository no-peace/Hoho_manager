import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Edit2, ShieldAlert } from "lucide-react";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, TextField } from "../ui/Field";
import { SearchableDiscordSelect } from "../ui/SearchableDiscordSelect";
import { useGlobalStore } from "../../store/globalStore";
import { useStaffAccess, type StaffRecord } from "../../hooks/useStaffAccess";

export const AccessPanel = () => {
  const { records, loading, error, fetchRecords, createRecord, updateRecord, deleteRecord } = useStaffAccess();
  const { selectedGuildId } = useGlobalStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<StaffRecord>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [allChannelsAllowed, setAllChannelsAllowed] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleEdit = (record: StaffRecord) => {
    setEditingId(record.discord_user_id);
    setFormData(record);
    setIsCreating(false);
    setAllChannelsAllowed(record.allowed_channel_ids.includes("*"));
  };

  const handleCreate = () => {
    setEditingId("new");
    setFormData({
      discord_user_id: "",
      discord_username: "",
      is_active: 1,
      can_send_messages: 1,
      can_edit_messages: 0,
      can_delete_messages: 0,
      can_manage_templates: 0,
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      cooldown_seconds: 30,
      max_messages_per_hour: 10,
      allowed_channel_ids: [],
      allowed_role_mention_ids: [],
      notes: ""
    });
    setIsCreating(true);
    setAllChannelsAllowed(false);
  };

  const handleSave = async () => {
    try {
      const dataToSave = { ...formData };
      if (allChannelsAllowed) {
        dataToSave.allowed_channel_ids = ["*"];
      }
      
      if (isCreating) {
        if (!dataToSave.discord_user_id) {
          return alert("User ID is required.");
        }
        await createRecord(dataToSave);
      } else if (editingId && editingId !== "new") {
        await updateRecord(editingId, dataToSave);
      }
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to revoke access for this user?")) return;
    try {
      await deleteRecord(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateForm = (updates: Partial<StaffRecord>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="flex h-full flex-col bg-[#2b2d31] overflow-hidden rounded-md border border-[#1e1f22]">
      <div className="flex items-center justify-between border-b border-[#1e1f22] px-5 py-4 shrink-0 bg-[#1e1f22]">
        <div>
          <h2 className="text-lg font-bold text-[#dbdee1] flex items-center gap-2">
            <ShieldAlert size={20} className="text-[#faa61a]" />
            Staff Access Management
          </h2>
          <p className="text-sm text-[#949ba4]">Control who can use this tool and what they can do.</p>
        </div>
        {!editingId && (
          <Button icon={Plus} onClick={handleCreate} variant="primary">
            Grant Access
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar text-[#dbdee1]">
        {error && <div className="mb-4 p-3 bg-[#da373c]/10 border border-[#da373c]/30 text-[#da373c] rounded">{error}</div>}

        {editingId ? (
          <div className="max-w-3xl space-y-6 bg-[#1e1f22] p-5 rounded-lg border border-[#111214]">
            <h3 className="text-md font-semibold text-[#dbdee1] border-b border-[#35373c] pb-2 mb-4">
              {isCreating ? "Grant New Access" : `Edit Access: ${formData.discord_username || formData.discord_user_id}`}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {isCreating ? (
                <div>
                  <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Select User or enter ID</label>
                  <SearchableDiscordSelect
                    type="member"
                    guildId={selectedGuildId || undefined}
                    value={formData.discord_user_id || ""}
                    onChange={(val) => updateForm({ discord_user_id: val as string })}
                    placeholder="Search member..."
                  />
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
              <h4 className="text-sm font-semibold text-[#dbdee1]">Action Permissions</h4>
              <div className="grid grid-cols-2 gap-3 bg-[#2b2d31] p-3 rounded border border-[#111214]">
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
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-[#dbdee1]">Mention Permissions</h4>
              <div className="grid grid-cols-3 gap-3 bg-[#2b2d31] p-3 rounded border border-[#111214]">
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
                  <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Allowed Role Mentions (Specific)</label>
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
              <h4 className="text-sm font-semibold text-[#dbdee1]">Channel Allowlist</h4>
              <div className="bg-[#2b2d31] p-3 rounded border border-[#111214] space-y-3">
                <Checkbox
                  label="Allow ALL channels (*)"
                  checked={allChannelsAllowed}
                  onChange={(c) => setAllChannelsAllowed(c)}
                />
                
                {!allChannelsAllowed && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#949ba4] mb-1">Allowed Channel IDs</label>
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

            <div className="grid grid-cols-2 gap-4">
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

            <div className="flex gap-2 pt-4 border-t border-[#35373c]">
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
              <div className="text-[#949ba4] p-4 text-center">Loading...</div>
            ) : records.length === 0 ? (
              <div className="text-[#949ba4] p-8 text-center bg-[#1e1f22] rounded border border-dashed border-[#35373c]">
                No staff members configured. Click &quot;Grant Access&quot; to add one.
              </div>
            ) : (
              records.map(record => (
                <div key={record.discord_user_id} className={`flex items-center justify-between p-3 rounded border ${record.is_active ? 'bg-[#1e1f22] border-[#35373c]' : 'bg-[#2b2d31] border-[#1e1f22] opacity-60'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-[#dbdee1]">{record.discord_username || 'Unknown User'}</strong>
                      <span className="text-xs font-mono text-[#949ba4] bg-[#2b2d31] px-1.5 py-0.5 rounded border border-[#111214]">{record.discord_user_id}</span>
                      {!record.is_active && <span className="text-[10px] uppercase font-bold text-[#f28b8b] bg-[#da373c]/10 px-1.5 py-0.5 rounded">Disabled</span>}
                    </div>
                    <div className="text-xs text-[#949ba4] mt-1 flex gap-3">
                      <span>Cooldown: {record.cooldown_seconds}s</span>
                      <span>Max/hr: {record.max_messages_per_hour}</span>
                      <span>Allowed Channels: {record.allowed_channel_ids.length === 0 ? 'NONE' : record.allowed_channel_ids.includes('*') ? 'ALL' : record.allowed_channel_ids.length}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <IconButton icon={Edit2} label="Edit" onClick={() => handleEdit(record)} className="text-[#b5bac1] hover:text-white" />
                    <IconButton icon={Trash2} label="Revoke" onClick={() => handleDelete(record.discord_user_id)} className="text-[#f28b8b] hover:bg-[#da373c]/10" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccessPanel;
