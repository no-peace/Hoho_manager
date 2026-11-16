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
          <div className="text-xs text-[#A1A8B8]">
            {guildId ? (
              <span>Viewing audit log events for guild ID: <code className="text-[#F1F3F9] bg-[#1D2230] px-1 py-0.5 rounded">{guildId}</code></span>
            ) : (
              <span className="text-[#FBBF24] flex items-center gap-1">
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
              className="bg-[#1D2230] border border-[#252B3A] rounded px-2.5 py-1 text-xs text-[#F1F3F9] placeholder-[#6F788A] focus:outline-none focus:border-[#818CF8] w-full sm:w-56"
            />
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading || !guildId}
              className="p-1.5 rounded bg-[#161A23] hover:bg-[#252B3A] text-[#A1A8B8] hover:text-white transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded bg-[#F87171]/20 border border-[#F87171]/40 text-[#F87171] text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-[8px] border border-[#272D3A] bg-[#161A23] px-3 py-4 text-xs text-[#A1A8B8]"><RefreshCw size={15} className="animate-spin text-[#818CF8]" /><span>Loading audit logs...</span></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-[#A1A8B8] text-xs bg-[#1D2230] rounded-lg border border-[#161A23] p-6 space-y-2">
            <Shield size={28} className="mx-auto text-[#818CF8] opacity-80" />
            <p className="font-semibold text-[#F1F3F9]">Audit Logs Stream to Discord</p>
            <p className="max-w-md mx-auto text-[11px] text-[#A1A8B8]">
              Audit events are dispatched directly to your configured Discord log channel to prevent SQLite storage bloat.
              You can configure which events are sent in <span className="text-white font-semibold">Head Admin Settings</span>.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px] border border-[#272D3A] bg-[#161A23] rounded-lg">
            <table className="w-full text-left text-xs text-[#F1F3F9]">
              <thead className="bg-[#1D2230] border-b border-[#161A23] text-[#A1A8B8] uppercase text-[10px] sticky top-0 tracking-wider">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Action / Type</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Details / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#161A23] bg-[#161A23]/50">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#252B3A]/40 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-[#A1A8B8] font-mono text-[11px]">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="bg-[#818CF8]/20 text-[#818CF8] px-1.5 py-0.5 rounded font-mono font-semibold text-[11px]">
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px]">
                      {entry.user_name ? (
                        <span className="text-[#F1F3F9]">{entry.user_name}</span>
                      ) : entry.user_id ? (
                        <span className="text-[#A1A8B8]">{entry.user_id}</span>
                      ) : (
                        <span className="text-[#6F788A]">system</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-[#A1A8B8]">
                      {entry.channel_id || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#F1F3F9] max-w-xs truncate" title={entry.reason || entry.details || ""}>
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
