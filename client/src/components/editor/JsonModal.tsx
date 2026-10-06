import React, { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useMessageStore } from "../../store/messageStore";
import { Copy, Check, Download, AlertCircle } from "lucide-react";
import { copyTextToClipboard } from "../../utils/clipboard";

interface JsonModalProps {
  open: boolean;
  onClose: () => void;
}

export const JsonModal: React.FC<JsonModalProps> = ({ open, onClose }) => {
  const store = useMessageStore();
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      try {
        const fullPayload = {
          messages: store.messages.map((m) => ({ data: m })),
          targets: store.targets,
        };
        setJsonText(JSON.stringify(fullPayload, null, 2));
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Failed to stringify message payload");
      }
    }
  }, [open, store.messages, store.targets]);

  if (!open) return null;

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      store.load({ data: parsed });
      setError(null);
      onClose();
    } catch (err: any) {
      setError(`Invalid JSON syntax: ${err?.message || "Parse error"}`);
    }
  };

  const handleCopy = async () => {
    const success = await copyTextToClipboard(jsonText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discohook-message.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Message JSON Data"
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={copied ? Check : Copy}
              onClick={handleCopy}
              className="text-xs"
            >
              {copied ? "Copied!" : "Copy JSON"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Download}
              onClick={handleDownload}
              className="text-xs"
            >
              Download
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleApply}>
              Apply Changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-[#949ba4]">
          Edit raw Discohook message JSON directly. Changes apply immediately to your visual editor and live preview.
        </p>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-[#da373c]/15 border border-[#da373c]/40 text-[#f28b8b] text-xs">
            <AlertCircle size={14} className="shrink-0" />
            <span className="font-mono break-all">{error}</span>
          </div>
        )}

        <textarea
          rows={18}
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setError(null);
          }}
          className="w-full bg-[#1e1f22] border border-[#111214] rounded-lg p-3 font-mono text-xs text-[#dbdee1] leading-relaxed outline-none focus:border-[#5865f2] custom-scrollbar selection:bg-[#5865f2]/40"
          placeholder="Paste or edit message JSON..."
        />
      </div>
    </Modal>
  );
};

export default JsonModal;