import React, { useState, useEffect } from "react";
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

  const handleRevoke = async (tokenId: string) => {
    if (!guildId) return;
    if (!confirm("Are you sure you want to revoke this session?")) return;

    setRevokingId(tokenId);
    try {
      await api.discord.revokeSession(guildId, tokenId);
      await fetchSessions();
    } catch (err: any) {
      alert(err?.message || "Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Active Sessions" width="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-[#949ba4]">
            {guildId ? (
              <span>Active authorized sessions for guild: <code className="text-[#dbdee1] bg-[#1e1f22] px-1 py-0.5 rounded">{guildId}</code></span>
            ) : (
              <span className="text-[#f0b232] flex items-center gap-1">
                <AlertCircle size={14} /> Please select a server first in the top bar.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading || !guildId}
            className="p-1.5 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white transition-colors disabled:opacity-50"
            title="Refresh sessions"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded bg-[#da373c]/20 border border-[#da373c]/40 text-[#f28b8b] text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-[#949ba4] text-xs">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#5865f2]" />
            Loading active sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-[#949ba4] text-xs bg-[#1e1f22] rounded-lg border border-[#2b2d31]">
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
                  className="bg-[#2b2d31] border border-[#35373c] rounded-lg p-3 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-white">
                        {s.tokenId.slice(0, 12)}...
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(s.tokenId)}
                        className="text-[#949ba4] hover:text-white p-0.5"
                        title="Copy session token"
                      >
                        {copiedToken === s.tokenId ? (
                          <Check size={12} className="text-[#57f287]" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>

                      {s.me && (
                        <span className="text-[10px] bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/40 font-semibold px-1.5 py-0.2 rounded">
                          Current Session (You)
                        </span>
                      )}
                      {s.owner && (
                        <span className="text-[10px] bg-[#57f287]/20 text-[#57f287] border border-[#57f287]/40 font-semibold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <ShieldCheck size={10} /> Guild Owner
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-[10px] bg-[#da373c]/20 text-[#f28b8b] border border-[#da373c]/40 font-semibold px-1.5 py-0.2 rounded">
                          Expired
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#949ba4] flex items-center gap-3">
                      <span>Permissions: <code className="text-[#dbdee1]">{s.permissions}</code></span>
                      <span>Created: {new Date(s.createdAt).toLocaleDateString()}</span>
                      <span>Expires: {new Date(s.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(s.tokenId)}
                      disabled={revokingId === s.tokenId}
                      className="px-2.5 py-1 text-xs font-medium rounded text-[#f28b8b] hover:bg-[#da373c]/20 border border-[#da373c]/30 hover:border-[#da373c] transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
