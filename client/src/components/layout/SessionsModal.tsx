import React, { useState, useEffect } from "react";
import { useGlobalStore } from "../../store/globalStore";
import { Modal } from "../ui/Modal";
import { api } from "../../api/client";
import { RefreshCw, Trash2, Key, Check, Copy, AlertCircle, ShieldCheck } from "lucide-react";

interface ActiveSession {
  tokenId: string;
  createdAt: number;
  expiresAt: number;
  permissions: string;
  owner: boolean;
  me: boolean;
  channelId?: string | null;
}

interface SessionsModalProps {
  open: boolean;
  onClose: () => void;
  guildId: string | null;
}

export const SessionsModal: React.FC<SessionsModalProps> = ({ open, onClose, guildId }) => {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!guildId) {
      setSessions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.discord.sessions(guildId);
      setSessions(res.results || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load active sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && guildId) {
      fetchSessions();
    }
  }, [open, guildId]);

  const handleCopy = (tokenId: string) => {
    navigator.clipboard?.writeText(tokenId);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevoke = (tokenId: string) => {
    if (!guildId) return;
    const { openConfirm, showToast } = useGlobalStore.getState();
    openConfirm({
      title: "Revoke Session",
      message: "Are you sure you want to revoke this active session?",
      confirmLabel: "Revoke",
      danger: true,
      onConfirm: async () => {
        setRevokingId(tokenId);
        try {
          await api.discord.revokeSession(guildId, tokenId);
          await fetchSessions();
          showToast("Session revoked.", "success");
        } catch (err: any) {
          showToast(err?.message || "Failed to revoke session", "error");
        } finally {
          setRevokingId(null);
        }
      },
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Active Sessions" width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#A1A8B8]">
            {guildId ? (
              <span>Active authorized sessions for guild: <code className="text-[#F1F3F9] bg-[#1D2230] px-1 py-0.5 rounded">{guildId}</code></span>
            ) : (
              <span className="text-[#FBBF24] flex items-center gap-1">
                <AlertCircle size={14} /> Please select a server first in the top bar.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading || !guildId}
            className="p-1.5 rounded bg-[#161A23] hover:bg-[#252B3A] text-[#A1A8B8] hover:text-white transition-colors disabled:opacity-50"
            title="Refresh sessions"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded bg-[#F87171]/20 border border-[#F87171]/40 text-[#F87171] text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#272D3A] bg-[#161A23] px-3 py-4 text-xs text-[#A1A8B8]"><RefreshCw size={15} className="animate-spin text-[#818CF8]" /><span>Loading active sessions...</span></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-[#A1A8B8] text-xs bg-[#1D2230] rounded-lg border border-[#161A23]">
            <Key size={24} className="mx-auto mb-2 opacity-50" />
            No active sessions found for this server.
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {sessions.map((s) => {
              const isExpired = s.expiresAt < Date.now();
              return (
                <div
                  key={s.tokenId}
                  className="bg-[#161A23] border border-[#272D3A] hover:border-[#252B3A] rounded-lg p-3 flex items-center justify-between gap-4 transition-[border-color,background-color] duration-150"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-white">
                        {s.tokenId.slice(0, 12)}...
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(s.tokenId)}
                        className="text-[#A1A8B8] hover:text-white p-0.5"
                        title="Copy session token"
                      >
                        {copiedToken === s.tokenId ? (
                          <Check size={12} className="text-[#34D399]" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>

                      {s.me && (
                        <span className="text-[10px] bg-[#818CF8]/20 text-[#818CF8] border border-[#818CF8]/40 font-semibold px-1.5 py-0.2 rounded">
                          Current Session (You)
                        </span>
                      )}
                      {s.owner && (
                        <span className="text-[10px] bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40 font-semibold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <ShieldCheck size={10} /> Guild Owner
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/40 font-semibold px-1.5 py-0.2 rounded">
                          Expired
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#A1A8B8] flex items-center gap-3">
                      <span>Permissions: <code className="text-[#F1F3F9]">{s.permissions}</code></span>
                      <span>Created: {new Date(s.createdAt).toLocaleDateString()}</span>
                      <span>Expires: {new Date(s.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.tokenId)}
                      disabled={revokingId === s.tokenId}
                      className="px-2.5 py-1 text-xs font-medium rounded text-[#F87171] hover:bg-[#F87171]/20 border border-[#F87171]/30 hover:border-[#F87171] transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      title="Revoke session"
                    >
                      <Trash2 size={13} />
                      <span>Revoke</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
