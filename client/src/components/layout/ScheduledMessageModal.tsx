import React, { useEffect, useState } from "react";
import { CalendarClock, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, request, type TemplateSummary } from "../../api/client";
import { Modal } from "../ui/Modal";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore } from "../../store/messageStore";
import { fromQueryData } from "../../utils/exportImport";
import { toDiscordPayload } from "../../utils/discord";
import { EDITOR_MODES } from "../../utils/constants";

interface Channel { id: string; name: string }
interface ScheduleRow {
  id: number;
  channel_id: string;
  next_run_at: string | null;
  enabled: number;
  cron_expr: string | null;
  timezone: string;
}

const toLocalInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

export const ScheduledMessageModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const guildId = useGlobalStore((state) => state.selectedGuildId);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [runAt, setRunAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)));
  const [frequency, setFrequency] = useState("once");
  const [interval, setInterval] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!guildId) return;
    setLoading(true);
    try {
      const [channelRows, scheduleRows, templateRows] = await Promise.all([
        request<Channel[]>(`/api/send/channels?guildId=${encodeURIComponent(guildId)}`),
        request<ScheduleRow[]>(`/api/automation/schedules?guildId=${encodeURIComponent(guildId)}`),
        api.templates.list(),
      ]);
      setChannels(Array.isArray(channelRows) ? channelRows : []);
      setSchedules(Array.isArray(scheduleRows) ? scheduleRows : []);
      setTemplates(Array.isArray(templateRows.templates) ? templateRows.templates : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open, guildId]);

  const createSchedule = async () => {
    if (!guildId || !channelId) { setError("Select a server channel."); return; }
    const runDate = new Date(runAt);
    if (!Number.isFinite(runDate.getTime()) || runDate.getTime() <= Date.now()) { setError("Choose a future date and time."); return; }
    setSaving(true);
    setError("");
    try {
      let payload = useMessageStore.getState().getPayload();
      const selectedTemplateId = templateId ? Number(templateId) : null;
      if (selectedTemplateId) {
        const { template } = await api.templates.get(selectedTemplateId);
        const document = fromQueryData(template.data);
        const firstMessage = document.messages[0];
        if (!firstMessage) throw new Error("The selected template has no message to schedule.");
        payload = toDiscordPayload(firstMessage, document.mode ?? EDITOR_MODES.CLASSIC);
      }
      const recurrence = frequency === "once" ? null : {
        frequency: frequency === "custom" ? "custom" : frequency,
        interval,
        ...(frequency === "weekly" ? { weekdays } : {}),
      };
      await request("/api/automation/schedules", {
        method: "POST",
        body: {
          guildId,
          channelId,
          payload,
          ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
          runAt: runDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          recurrence,
        },
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the scheduled message.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSchedule = async (row: ScheduleRow) => {
    try {
      await request(`/api/automation/schedules/${row.id}`, { method: "PATCH", body: { enabled: !row.enabled } });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not update schedule."); }
  };

  const removeSchedule = async (id: number) => {
    try {
      await request(`/api/automation/schedules/${id}`, { method: "DELETE" });
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete schedule."); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Scheduled Messages" width="max-w-2xl">
      <div className="space-y-4">
        <section className="space-y-3 rounded-xl border border-[#272D3A] bg-[#10131A] p-3.5">
          <div className="flex items-center gap-2"><CalendarClock size={15} className="text-[#818CF8]" /><p className="text-xs font-bold text-[#F1F3F9]">Create schedule</p></div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Message source
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs text-[#F1F3F9]">
              <option value="">Current Studio message</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Destination channel
            <select value={channelId} onChange={(event) => setChannelId(event.target.value)} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs text-[#F1F3F9]">
              <option value="">Select channel</option>{channels.map((channel) => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
            </select>
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">First run
            <input type="datetime-local" value={runAt} onChange={(event) => setRunAt(event.target.value)} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs text-[#F1F3F9]" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Repeat
              <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs text-[#F1F3F9]">
                <option value="once">One time</option><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="custom">Custom interval</option>
              </select>
            </label>
            {frequency !== "once" && <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Every
              <input type="number" min={1} max={365} value={interval} onChange={(event) => setInterval(Math.max(1, Math.min(365, Number(event.target.value) || 1)))} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs text-[#F1F3F9]" />
            </label>}
          </div>
          {frequency === "weekly" && <div className="flex flex-wrap gap-1.5">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,index) => <button key={day} type="button" onClick={() => setWeekdays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current,index])} aria-pressed={weekdays.includes(index)} className={`rounded-md border px-2 py-1 text-[10px] ${weekdays.includes(index) ? "border-[#818CF8] bg-[#818CF8]/20 text-white" : "border-[#272D3A] text-[#A1A8B8]"}`}>{day}</button>)}</div>}
          <button type="button" onClick={() => void createSchedule()} disabled={saving || loading || !guildId} className="inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-40"><Plus size={13} /> {saving ? "Saving..." : templateId ? "Schedule template" : "Schedule current message"}</button>
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Existing schedules ({schedules.length})</p><button type="button" onClick={() => void refresh()} aria-label="Refresh schedules" className="rounded p-1 text-[#A1A8B8] hover:text-white"><RefreshCw size={13} /></button></div>
          {loading ? <p className="text-xs text-[#A1A8B8]">Loading schedules...</p> : schedules.length === 0 ? <p className="rounded-lg border border-dashed border-[#272D3A] p-4 text-center text-xs text-[#A1A8B8]">No scheduled messages for this server.</p> : schedules.map((row) => <div key={row.id} className="flex items-center gap-2 rounded-lg border border-[#272D3A] bg-[#161A23] p-2.5"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#F1F3F9]">#{channels.find((channel) => channel.id === row.channel_id)?.name ?? row.channel_id}</p><p className="text-[10px] text-[#A1A8B8]">{row.next_run_at ? new Date(row.next_run_at).toLocaleString() : "No next run"} · {row.cron_expr ? "Recurring" : "One time"}</p></div><button type="button" onClick={() => void toggleSchedule(row)} className="rounded-md border border-[#272D3A] px-2 py-1 text-[10px] text-[#A1A8B8] hover:text-white">{row.enabled ? "Pause" : "Resume"}</button><button type="button" onClick={() => void removeSchedule(row.id)} aria-label="Delete schedule" className="rounded p-1.5 text-[#F87171] hover:bg-[#F87171]/10"><Trash2 size={13} /></button></div>)}
        </section>
        {error && <p role="alert" className="rounded-lg border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-xs text-[#F87171]">{error}</p>}
      </div>
    </Modal>
  );
};

export default ScheduledMessageModal;
