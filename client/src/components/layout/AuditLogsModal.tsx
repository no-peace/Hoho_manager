import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { api } from "../../api/client";
import { RefreshCw, Shield, AlertCircle } from "lucide-react";

interface AuditLogEntry {
  id: string;
  guild_id: string;
  channel_id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  type: string;
  reason?: string | null;
  details?: string | null;
  created_at: string;
}

interface AuditLogsModalProps {
  open: boolean;
  onClose: () => void;
  guildId: string | null;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({ open, onClose, guildId }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState("");

  const fetchLogs = async () => {
    if (!guildId) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.discord.auditLogs(guildId, {
        limit: 50,
        action: filterAction || undefined,
      });
      setLogs(res.entries || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && guildId) {
      fetchLogs();
    }
  }, [open, guildId, filterAction]);

  return (
    <Modal open={open} onClose={onClose} title="Guild Audit Logs" width="max-w-4xl">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-[#949ba4]">
            {guildId ? (
              <span>Viewing audit log events for guild ID: <code className="text-[#dbdee1] bg-[#1e1f22] px-1 py-0.5 rounded">{guildId}</code></span>
            ) : (
              <span className="text-[#f0b232] flex items-center gap-1">
                <AlertCircle size={14} /> Please select a server first in the top bar.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Filter action (e.g. SEND_MESSAGE)..."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-[#1e1f22] border border-[#35373c] rounded px-2.5 py-1 text-xs text-[#dbdee1] placeholder-[#6d6f78] focus:outline-none focus:border-[#5865f2] w-full sm:w-56"
            />
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading || !guildId}
              className="p-1.5 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#949ba4] hover:text-white transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
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
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-[#949ba4] text-xs bg-[#1e1f22] rounded-lg border border-[#2b2d31]">
            <Shield size={24} className="mx-auto mb-2 opacity-50" />
            No audit log entries recorded for this guild yet.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] border border-[#2b2d31] rounded-lg">
            <table className="w-full text-left text-xs text-[#dbdee1]">
              <thead className="bg-[#1e1f22] border-b border-[#2b2d31] text-[#949ba4] uppercase text-[10px] sticky top-0 tracking-wider">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Action / Type</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Details / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d31] bg-[#2b2d31]/50">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#35373c]/40 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-[#949ba4] font-mono text-[11px]">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="bg-[#5865f2]/20 text-[#5865f2] px-1.5 py-0.5 rounded font-mono font-semibold text-[11px]">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                      {entry.user_name ? (
                        <span className="text-[#dbdee1]">{entry.user_name}</span>
                      ) : entry.user_id ? (
                        <span className="text-[#949ba4]">{entry.user_id}</span>
                      ) : (
                        <span className="text-[#6d6f78]">system</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-[#949ba4]">
                      {entry.channel_id || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#dbdee1] max-w-xs truncate" title={entry.reason || entry.details || ""}>
                      {entry.reason || entry.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
