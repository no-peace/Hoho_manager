import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";

export interface JsonModalProps {
  open: boolean;
  onClose: () => void;
}

export const JsonModal: React.FC<JsonModalProps> = ({ open, onClose }) => {
  // The modal stays mounted while closed. Avoid subscribing to the live
  // document until it is opened, otherwise every editor keystroke rerenders it.
  const messages = useMessageStore((state) => open ? state.messages : undefined);
  const data = useMessageStore((state) => open ? state.data : undefined);
  const targets = useMessageStore((state) => open ? state.targets : undefined);
  const load = useMessageStore((state) => state.load);

  const [jsonText, setJsonText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const messagesToExport = messages && messages.length > 0 ? messages : [data];
      const exportData = {
        messages: messagesToExport.map((m) => ({ data: m })),
        targets: targets || [{ url: "" }],
      };
      setJsonText(JSON.stringify(exportData, null, 2));
      setErrorMessage(null);
    }
  }, [open, messages, data, targets]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          load({
            data: parsed,
            targets: parsed.targets,
          });
        } else if (parsed.data) {
          load({ data: parsed.data, targets: parsed.targets });
        } else {
          load({ data: parsed });
        }
        setErrorMessage(null);
        onClose();
      } else {
        setErrorMessage("JSON must be a valid object.");
      }
    } catch (e: any) {
      setErrorMessage(e?.message || "Invalid JSON syntax.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="JSON Data" width="max-w-2xl">
      <div className="space-y-3 font-sans">
        {errorMessage && (
          <div className="p-2.5 rounded bg-[#F87171]/20 border border-[#F87171]/40 text-[#F87171] text-xs break-words [overflow-wrap:anywhere]">
            {errorMessage}
          </div>
        )}
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full h-80 bg-[#1D2230] text-[#F1F3F9] font-mono text-xs p-3 rounded border border-[#313338] focus:border-[#818CF8] outline-none resize-none custom-scrollbar"
          placeholder="Paste or edit message JSON..."
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#F1F3F9] hover:text-white hover:bg-[#252B3A] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(JsonModal);