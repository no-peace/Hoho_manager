import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";
import { Button } from "../ui/Button";
import { Plus, Trash2 } from "lucide-react";

interface AllowedMentionsModalProps {
  open: boolean;
  onClose: () => void;
}

export const AllowedMentionsModal: React.FC<AllowedMentionsModalProps> = ({ open, onClose }) => {
  const allowedMentions = useMessageStore((state) => state.data.allowed_mentions);
  const setAllowedMentions = useMessageStore((state) => state.setAllowedMentions);

  const [newUserId, setNewUserId] = useState("");
  const [newRoleId, setNewRoleId] = useState("");

  const isEnabled = Boolean(allowedMentions);

  const toggleEnabled = () => {
    if (isEnabled) {
      setAllowedMentions(undefined);
    } else {
      setAllowedMentions({
        parse: ["users", "roles"],
        users: [],
        roles: [],
      });
    }
  };

  const am = allowedMentions ?? { parse: [], users: [], roles: [] };

  const hasParse = (type: "everyone" | "roles" | "users") =>
    am.parse?.includes(type) ?? false;

  const toggleParse = (type: "everyone" | "roles" | "users") => {
    const current = am.parse ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setAllowedMentions({ ...am, parse: next });
  };

  const addUserId = () => {
    const trimmed = newUserId.trim();
    if (!trimmed || !/^\d{17,20}$/.test(trimmed)) return;
    const current = am.users ?? [];
    if (!current.includes(trimmed)) {
      setAllowedMentions({ ...am, users: [...current, trimmed] });
    }
    setNewUserId("");
  };

  const removeUserId = (id: string) => {
    setAllowedMentions({
      ...am,
      users: (am.users ?? []).filter((u) => u !== id),
    });
  };

  const addRoleId = () => {
    const trimmed = newRoleId.trim();
    if (!trimmed || !/^\d{17,20}$/.test(trimmed)) return;
    const current = am.roles ?? [];
    if (!current.includes(trimmed)) {
      setAllowedMentions({ ...am, roles: [...current, trimmed] });
    }
    setNewRoleId("");
  };

  const removeRoleId = (id: string) => {
    setAllowedMentions({
      ...am,
      roles: (am.roles ?? []).filter((r) => r !== id),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Allowed Mentions"
      width="max-w-lg"
      footer={
        <Button onClick={onClose} className="bg-[#5865f2] hover:bg-[#4752c4] text-white">
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded bg-[#2b2d31] border border-[#1e1f22]">
          <div>
            <span className="text-sm font-semibold text-white block">Custom Allowed Mentions</span>
            <span className="text-xs text-[#949ba4] block mt-0.5">
              Restrict which users, roles, or broadcast pings can be mentioned.
            </span>
          </div>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
              isEnabled
                ? "bg-[#23a55a] text-white hover:bg-[#1da24a]"
                : "bg-[#1e1f22] text-[#949ba4] hover:text-white"
            }`}
          >
            {isEnabled ? "Enabled" : "Disabled (Default)"}
          </button>
        </div>

        {isEnabled && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Automatic parse flags */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block">
                Broadcast & Auto Mentions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 p-2 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    className="rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2]"
                    checked={hasParse("everyone")}
                    onChange={() => toggleParse("everyone")}
                  />
                  <span>@everyone / @here</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    className="rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2]"
                    checked={hasParse("users")}
                    onChange={() => toggleParse("users")}
                  />
                  <span>All Users</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer text-xs font-semibold text-white">
                  <input
                    type="checkbox"
                    className="rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2]"
                    checked={hasParse("roles")}
                    onChange={() => toggleParse("roles")}
                  />
                  <span>All Roles</span>
                </label>
              </div>
            </div>

            {/* Explicit User IDs */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block">
                Explicit Allowed Users (IDs)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Discord User Snowflake ID..."
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded px-3 py-1.5 text-xs text-white placeholder-[#949ba4]"
                />
                <Button size="sm" icon={Plus} onClick={addUserId}>
                  Add
                </Button>
              </div>

              {am.users && am.users.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {am.users.map((uid) => (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1.5 bg-[#2b2d31] border border-[#1e1f22] px-2 py-0.5 rounded text-xs font-mono text-[#dbdee1]"
                    >
                      <span>{uid}</span>
                      <button
                        type="button"
                        onClick={() => removeUserId(uid)}
                        className="text-[#f28b8b] hover:text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Explicit Role IDs */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] block">
                Explicit Allowed Roles (IDs)
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Discord Role Snowflake ID..."
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="flex-1 bg-[#1e1f22] border border-[#2b2d31] rounded px-3 py-1.5 text-xs text-white placeholder-[#949ba4]"
                />
                <Button size="sm" icon={Plus} onClick={addRoleId}>
                  Add
                </Button>
              </div>

              {am.roles && am.roles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {am.roles.map((rid) => (
                    <span
                      key={rid}
                      className="inline-flex items-center gap-1.5 bg-[#2b2d31] border border-[#1e1f22] px-2 py-0.5 rounded text-xs font-mono text-[#dbdee1]"
                    >
                      <span>{rid}</span>
                      <button
                        type="button"
                        onClick={() => removeRoleId(rid)}
                        className="text-[#f28b8b] hover:text-white"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AllowedMentionsModal;
