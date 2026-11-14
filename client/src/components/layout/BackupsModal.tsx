import React, { useEffect, useRef, useState } from "react";
import { Download, Edit3, Upload, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Checkbox } from "../ui/Field";
import { DateTimePickerPopover } from "../ui/DateTimePickerPopover";
import { useTemplates } from "../../hooks/useTemplates";
import { useTemplateStore } from "../../store/templateStore";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useGlobalStore, getServerNow } from "../../store/globalStore";
import { downloadJson, parseImportedJson, toQueryData } from "../../utils/exportImport";
import api from "../../api/client";

export interface BackupsModalProps {
  open: boolean;
  onClose: () => void;
}

export const BackupsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { templates, saveCurrent, loadTemplate, refresh } = useTemplates();
  const [filter, setFilter] = useState<"all" | "tracked" | "templates">("all");
  const [templateName, setTemplateName] = useState("");
  const [trackOnSave, setTrackOnSave] = useState(false);
  const [addToBotCommand, setAddToBotCommand] = useState(false);
  const [expiryEnabled, setExpiryEnabled] = useState(true);
  const [scheduledExpiry, setScheduledExpiry] = useState<string | null>(
    () => new Date(getServerNow().getTime() + 14 * 86_400_000).toISOString(),
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTracked, setEditTracked] = useState(false);
  const [editExpiresAt, setEditExpiresAt] = useState<string | null>(null);
  const [trackedList, setTrackedList] = useState<any[]>([]);
  const [loadingTracked, setLoadingTracked] = useState(false);
  const currentUser = useGlobalStore((state) => state.currentUser);
  const currentName = useTemplateStore((state) => state.currentName);
  const currentTemplateId = useTemplateStore((state) => state.currentId);
  const templateDirty = useTemplateStore((state) => state.dirty);
  const editorData = useMessageStore((state) => state.data) as any;
  const getEditorPayload = useMessageStore((state) => state.getPayload);
  const openBotModal = useGlobalStore((state) => state.openBotModal);
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const remove = useTemplateStore((state) => state.remove);
  const { showToast, openConfirm } = useGlobalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshTracked = async () => {
    setLoadingTracked(true);
    try {
      const response = await api.tracking.list();
      setTrackedList(response.messages ?? []);
    } catch (error: any) {
      showToast(error?.message || "Failed to load tracked messages", "error");
      setTrackedList([]);
    } finally {
      setLoadingTracked(false);
    }
  };

  useEffect(() => {
    if (open) void refreshTracked();
  }, [open]);

  if (!open) return null;

  const resolveNewExpiry = (): string | null => {
    if (!expiryEnabled) return null;
    const expiry = scheduledExpiry
      ? new Date(scheduledExpiry)
      : new Date(getServerNow().getTime() + 14 * 86_400_000);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= getServerNow().getTime()) {
      throw new Error("Expiry date must be in the future.");
    }
    return expiry.toISOString();
  };

  const handleSave = async () => {
    try {
      const expiresAt = resolveNewExpiry();
      if (templateName.trim()) setCurrentName(templateName.trim());
      await saveCurrent(expiresAt, trackOnSave);
      const savedName = templateName.trim() || currentName.trim() || "Untitled Backup";
      setTemplateName("");
      await refresh();
      if (addToBotCommand) {
        if (!currentUser?.isAdmin) throw new Error("Head Admin access is required to add a bot command.");
        const response = await api.templates.list(savedName);
        const savedTemplate = response.templates.find((item) => item.name.toLowerCase() === savedName.toLowerCase());
        if (!savedTemplate) throw new Error("Backup saved, but its template could not be found for command setup.");
        await api.executors.upsert({
          id: `backup_${savedTemplate.id}`,
          title: savedTemplate.name,
          enabled: true,
          template_id: savedTemplate.id,
        });
      }
      setAddToBotCommand(false);
      showToast(addToBotCommand ? "Backup saved and added to /exploit" : "Backup saved successfully", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to save backup", "error");
    }
  };

  const beginEditTemplate = (item: any) => {
    setEditingKey(`template-${item.id}`);
    setEditName(item.name);
    setEditTracked(Boolean(item.is_tracked || item.trackingRecord));
    setEditExpiresAt(item.expires_at ? new Date(item.expires_at).toISOString() : null);
  };

  const beginEditTracked = (item: any) => {
    setEditingKey(`tracked-${item.id}`);
    setEditName(item.name || `Message ${item.messageId}`);
    setEditTracked(true);
    setEditExpiresAt(item.expiresAt ? new Date(item.expiresAt).toISOString() : null);
  };

  const saveItemEdit = async (item: any, kind: "template" | "tracked") => {
    try {
      if (editExpiresAt) {
        const expiry = new Date(editExpiresAt);
        if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= getServerNow().getTime()) {
          throw new Error("Expiry date must be in the future.");
        }
      }
      if (kind === "template") {
        await api.templates.update(item.id, {
          name: editName.trim() || "Untitled Backup",
          expiresAt: editExpiresAt,
          isTracked: editTracked,
        });
        await refresh();
        if (item.trackingRecord) {
          if (editTracked) {
            await api.tracking.update(item.trackingRecord.id, {
              name: editName.trim() || null,
              expiresAt: editExpiresAt,
              track: true,
            });
          } else {
            await api.tracking.untrack(item.trackingRecord.id);
          }
          await refreshTracked();
        }
      } else {
        await api.tracking.update(item.id, {
          name: editName.trim() || null,
          expiresAt: editExpiresAt,
          track: editTracked,
        });
        await refreshTracked();
      }
      setEditingKey(null);
      showToast("Backup settings updated", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to update backup", "error");
    }
  };

  const handleOverwriteBackup = async (item: any) => {
    try {
      await saveCurrent(item.expiresAt ?? null, item.isTracked);
      await refresh();
      showToast("Existing backup overwritten with the current editor content", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to overwrite backup", "error");
    }
  };

  const handleEditTrackedMessage = (item: any) => {
    try {
      const rawPayload = item.source?.rawPayload;
      if (typeof rawPayload !== "string") throw new Error("This tracked message has no saved source payload.");
      const payload = JSON.parse(rawPayload);
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("The saved tracked payload is invalid.");
      }
      const store = useMessageStore.getState();
      store.load({
        data: {
          ...payload,
          link_mode: "edit",
          edit_channel_id: item.source.channelId,
          edit_message_id: item.source.messageId,
        },
        mode: store.mode,
      });
      onClose();
      openBotModal("edit");
    } catch (error: any) {
      showToast(error?.message || "Failed to load tracked message", "error");
    }
  };

  const handleOverwriteTrackedMessage = async (item: any) => {
    try {
      const payload = useMessageStore.getState().getPayload();
      const flows = useActionStore.getState().toRegistrations();
      await api.send({
        mode: "bot",
        channelId: item.source.channelId,
        editMessageId: item.source.messageId,
        payload,
        flows,
      });
      await refreshTracked();
      showToast("Existing bot message edited and tracking refreshed", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to edit tracked bot message", "error");
    }
  };

  const handleAddToBotCommand = async (item: any) => {
    if (!currentUser?.isAdmin) {
      showToast("Head Admin access is required to configure /exploit commands", "error");
      return;
    }
    try {
      const title = typeof item.source?.exploitName === "string" && item.source.exploitName.trim()
        ? item.source.exploitName.trim()
        : item.name;
      const rawPayload = item.kind === "tracked" ? item.source?.rawPayload : null;
      if (item.kind === "tracked" && !item.source?.templateId && !rawPayload) {
        showToast("This tracked message has no saved payload to use as a command template", "error");
        return;
      }
      await api.executors.upsert({
        id: `backup_${item.id}`,
        title,
        enabled: true,
        ...(item.kind === "template" ? { template_id: item.id } : { custom_payload: rawPayload }),
      });
      showToast("Added to /exploit. Messages sent through the command are tracked automatically.", "success");
    } catch (error: any) {
      showToast(error?.message || "Failed to add bot command", "error");
    }
  };

  const handleUntrack = async (id: number) => {
    try {
      await api.tracking.untrack(id);
      setTrackedList((current) => current.filter((item) => item.id !== id));
      showToast("Stopped tracking message", "info");
    } catch (error: any) {
      showToast(error?.message || "Failed to stop tracking", "error");
    }
  };

  const handleLoad = (id: number) => {
    openConfirm({
      title: "Load Saved Template",
      message: "Load this template? Current unsaved changes will be overwritten.",
      confirmLabel: "Load Template",
      onConfirm: async () => {
        await loadTemplate(id);
        showToast("Template loaded into studio", "success");
        onClose();
      },
    });
  };

  const handleDeleteTemplate = (id: number) => {
    openConfirm({
      title: "Delete Backup",
      message: "This permanently deletes the saved template. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        await remove(id);
        showToast("Backup deleted", "info");
      },
    });
  };

  const handleExportJson = () => {
    const store = useMessageStore.getState();
    const queryData = toQueryData(store.messages, store.targets, store.mode);
    downloadJson(queryData, `${currentName.trim() || "hoho-messages"}.json`);
    showToast("Exported JSON file", "info");
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      useMessageStore.getState().load({
        data: document,
        targets: document?.targets,
        mode: document?.mode,
      });
      setCurrentName(file.name.replace(/\.json$/i, ""));
      showToast("Imported JSON file into studio", "success");
      onClose();
    } catch (error: any) {
      showToast(error?.message || "Invalid JSON file format", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const trackedByTemplate = new Map<number, any>(
    trackedList
      .filter((item) => Number.isFinite(Number(item.templateId)) && Number(item.templateId) > 0)
      .map((item) => [Number(item.templateId), item]),
  );
  const items = [
    ...templates.map((item) => {
      const linkedTracking = trackedByTemplate.get(item.id);
      return {
        kind: "template" as const,
        key: `template-${item.id}`,
        id: item.id,
        name: item.name,
        isTracked: Boolean(item.is_tracked || linkedTracking),
        expiresAt: linkedTracking?.expiresAt ?? item.expires_at ?? null,
        updatedAt: item.updated_at,
        source: { ...item, trackingRecord: linkedTracking },
      };
    }),
    ...trackedList
      .filter((item) => !Number.isFinite(Number(item.templateId)) || Number(item.templateId) <= 0)
      .map((item) => ({
        kind: "tracked" as const,
        key: `tracked-${item.id}`,
        id: item.id,
        name: item.name || `Message ${item.messageId}`,
        isTracked: true,
        expiresAt: item.expiresAt ?? null,
        updatedAt: item.updatedAt ?? item.createdAt,
        source: item,
      })),
  ];
  const visibleItems = items.filter((item) => {
    if (filter === "tracked") return item.isTracked;
    if (filter === "templates") return item.kind === "template";
    return true;
  });

  return (
    <Modal open={open} onClose={onClose} title="Backups & Tracking" width="max-w-2xl">
      <section className="space-y-3 rounded-xl border border-[#26282d] bg-[#18191c] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Template / Tracked Backup name..."
            className="min-w-0 flex-1 rounded-lg border border-[#26282d] bg-[#232428] px-3 py-2 text-xs text-[#f2f3f5] outline-none focus:border-[#5865f2]"
          />
          <Button size="sm" variant="primary" onClick={() => void handleSave()}>
            Save Backup
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox
            checked={trackOnSave}
            onChange={setTrackOnSave}
            label="Track Message"
            className="text-xs"
          />
          {currentUser?.isAdmin && (
            <Checkbox
              checked={addToBotCommand}
              onChange={setAddToBotCommand}
              label="Add to /exploit command"
              className="text-xs"
            />
          )}
          <Checkbox
            checked={expiryEnabled}
            onChange={setExpiryEnabled}
            label="Custom Expiry Date"
            className="text-xs"
          />
          {expiryEnabled && (
            <DateTimePickerPopover
              value={scheduledExpiry}
              onChange={setScheduledExpiry}
              placeholder="14-day default expiry"
            />
          )}
        </div>
        <p className="text-[10px] text-[#949ba4]">
          Tracking keeps dynamic user and exploit placeholders synchronized. New backups expire after 14 days by default.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-[#26282d] bg-[#1e1f22] p-1 overflow-x-auto no-scrollbar max-w-full">
          {([
            ["all", `All · ${items.length}`],
            ["tracked", `Tracked Only · ${items.filter((item) => item.isTracked).length}`],
            ["templates", `Saved Templates · ${templates.length}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors shrink-0 whitespace-nowrap ${filter === value ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" icon={Download} onClick={handleExportJson}>
            Export
          </Button>
          <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json,application/json"
            onChange={(event) => void handleImportJson(event)}
          />
        </div>
      </div>

      <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
        {loadingTracked ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#949ba4]"><RefreshCw size={15} className="animate-spin text-[#5865f2]" /><span>Loading tracked messages…</span></div>
        ) : visibleItems.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#949ba4]">
            No items in this view yet. Save a template or enable tracking when dispatching a message.
          </p>
        ) : visibleItems.map((item) => (
          <article key={item.key} className="space-y-2 rounded-lg border border-[#26282d] bg-[#2b2d31] p-3 transition-[border-color,background-color] duration-150 hover:border-[#35373c]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-xs font-semibold text-[#f2f3f5]">{item.name}</p>
                  <span className="rounded border border-[#35373c] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#949ba4]">
                    {item.kind === "template" ? "Saved template" : "Tracked message"}
                  </span>
                  {item.isTracked && <span className="rounded border border-[#5865f2]/40 px-1.5 py-0.5 text-[9px] text-[#aab0ff]">Tracking on</span>}
                </div>
                <p className="mt-1 truncate text-[10px] text-[#949ba4]">
                  {item.kind === "template"
                    ? `Updated ${new Date(item.updatedAt).toLocaleString()}`
                    : `Channel ${item.source.channelId} · Message ${item.source.messageId}`}
                  {" · "}
                  {item.expiresAt ? `Expires ${new Date(item.expiresAt).toLocaleString()}` : "No expiry"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.kind === "template" && currentTemplateId === item.id && templateDirty && (
                  <Button size="sm" variant="primary" onClick={() => void handleOverwriteBackup(item)}>
                    Overwrite Backup
                  </Button>
                )}
                {item.kind === "tracked" && item.source.rawPayload && (
                  <Button size="sm" variant="secondary" onClick={() => handleEditTrackedMessage(item)}>
                    Edit Bot Message
                  </Button>
                )}
                {item.kind === "tracked" && editorData?.link_mode === "edit" &&
                  editorData?.edit_channel_id === item.source.channelId &&
                  editorData?.edit_message_id === item.source.messageId &&
                  (() => {
                    try {
                      return Boolean(item.source.rawPayload) &&
                        JSON.stringify(getEditorPayload()) !== JSON.stringify(JSON.parse(item.source.rawPayload));
                    } catch {
                      return false;
                    }
                  })() && (
                    <Button size="sm" variant="primary" onClick={() => void handleOverwriteTrackedMessage(item)}>
                      Overwrite Tracked Message
                    </Button>
                  )}
                {item.kind === "template" && (
                  <Button size="sm" variant="ghost" onClick={() => handleLoad(item.id)}>
                    Load
                  </Button>
                )}
                {currentUser?.isAdmin && (
                  <Button size="sm" variant="secondary" onClick={() => void handleAddToBotCommand(item)}>
                    Add to Bot Commands
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => item.kind === "template" ? beginEditTemplate(item.source) : beginEditTracked(item.source)}
                  className="rounded-md p-2 text-[#949ba4] hover:bg-[#2b2d31] hover:text-white"
                  title="Edit backup settings"
                >
                  <Edit3 size={13} />
                </button>
                {item.kind === "template" ? (
                  <button type="button" onClick={() => handleDeleteTemplate(item.id)} className="rounded-md p-2 text-[#949ba4] hover:bg-[#da373c]/15 hover:text-[#f28b8b]" title="Delete backup">×</button>
                ) : (
                  <button type="button" onClick={() => void handleUntrack(item.id)} className="rounded-md px-2 py-1 text-[10px] text-[#f28b8b] hover:bg-[#da373c]/15">Untrack</button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {editingKey === item.key && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -4 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: "top left" }}
                  className="space-y-3 border-t border-[#2b2d31] pt-3"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    placeholder="Backup name"
                    className="w-full rounded-lg border border-[#35373c] bg-[#232428] px-3 py-2 text-xs text-[#f2f3f5] outline-none focus:border-[#5865f2]"
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <Checkbox checked={editTracked} onChange={setEditTracked} label="Track Message" className="text-xs" />
                    <DateTimePickerPopover
                      value={editExpiresAt}
                      onChange={setEditExpiresAt}
                      placeholder="No expiry"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>Cancel</Button>
                    <Button size="sm" variant="primary" onClick={() => void saveItemEdit(item.source, item.kind)}>Save Changes</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </article>
        ))}
      </div>
    </Modal>
  );
};

export default BackupsModal;
