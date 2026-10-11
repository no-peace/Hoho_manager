import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";

export interface JsonModalProps {
  open: boolean;
  onClose: () => void;
}

export const JsonModal: React.FC<JsonModalProps> = ({ open, onClose }) => {
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const targets = useMessageStore((state) => state.targets);
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
            data: parsed.messages[0]?.data ?? parsed.messages[0],
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
          <div className="p-2.5 rounded bg-[#da373c]/20 border border-[#da373c]/40 text-[#f28b8b] text-xs">
            {errorMessage}
          </div>
        )}
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          className="w-full h-80 bg-[#1e1f22] text-[#dbdee1] font-mono text-xs p-3 rounded border border-[#313338] focus:border-[#5865f2] outline-none resize-none custom-scrollbar"
          placeholder="Paste or edit message JSON..."
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[#dbdee1] hover:text-white hover:bg-[#35373c] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-1.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(JsonModal);