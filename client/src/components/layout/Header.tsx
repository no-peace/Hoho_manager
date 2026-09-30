import { useRef, useState } from "react";
import {
  Download,
  FolderOpen,
  RotateCcw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import { Button, IconButton } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useTemplateStore } from "../../store/templateStore";
import { useTemplates } from "../../hooks/useTemplates";
import { downloadJson, parseImportedJson } from "../../utils/exportImport";
import { EDITOR_MODES } from "../../utils/constants";

const ModeToggle = () => {
  const mode = useMessageStore((state) => state.mode);
  const setMode = useMessageStore((state) => state.setMode);

  return (
    <div className="tab-rail" role="group" aria-label="Editor mode">
      {[
        { id: EDITOR_MODES.CLASSIC, label: "Classic" },
        { id: EDITOR_MODES.V2, label: "Components V2" },
      ].map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={mode === option.id}
          onClick={() => setMode(option.id)}
          className={`tab-item ${mode === option.id ? "tab-item-active" : "tab-item-idle"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export const Header = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const { templates, currentName, dirty, saveCurrent, loadTemplate } = useTemplates();
  const setCurrentName = useTemplateStore((state) => state.setCurrentName);
  const detachTemplate = useTemplateStore((state) => state.detach);
  const removeTemplate = useTemplateStore((state) => state.remove);

  const exportJson = (): void => {
    const payload = useMessageStore.getState().getPayload();
    downloadJson(payload, `${currentName.trim() || "discohook-message"}.json`);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const document = parseImportedJson(text);
      
      // FIX: Wrap the parsed document in the 'data' property expected by LoadDocumentInput
      useMessageStore.getState().load({
        data: document as any,
        mode: "classic" // Force classic mode to ensure imported embeds render properly
      });
      
      setCurrentName(file.name.replace(/\.json$/i, ""));
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse JSON file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetDocument = (): void => {
    useMessageStore.getState().reset();
    useActionStore.getState().reset();
    detachTemplate();
  };

  return (
    <>
      <header className="h-14 shrink-0 flex items-center justify-between border-b border-[#1e1f22] bg-[#2b2d31] px-4 shadow-sm z-20 font-sans">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2] text-white shadow-sm">
            <Sparkles size={18} />
          </div>
          <span className="text-[15px] font-bold text-white tracking-wide">
            HoHo Manager
          </span>
          <ModeToggle />
        </div>

        {/* Template Bar */}
        <div className="flex items-center gap-2 max-w-md w-full mx-4">
          <input
            className="field !min-h-8 !py-1 text-xs"
            placeholder="Untitled Template"
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
          />
          <Button
            size="sm"
            variant={dirty ? "primary" : "secondary"}
            icon={Save}
            onClick={() => void saveCurrent()}
            title={dirty ? "Save changes" : "Saved"}
            className={dirty ? "bg-[#5865f2] hover:bg-[#4752c4] text-white border-none" : "bg-[#1e1f22] text-[#b5bac1] hover:text-white border-[#111214]"}
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={FolderOpen}
            onClick={() => setLoadOpen(true)}
            className="bg-[#1e1f22] text-[#b5bac1] hover:text-white border-[#111214]"
          >
            Load
          </Button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <IconButton
            icon={Upload}
            label="Import JSON"
            onClick={() => fileInputRef.current?.click()}
            className="text-[#b5bac1] hover:text-white hover:bg-[#1e1f22]"
          />
          <IconButton
            icon={Download}
            label="Export JSON"
            onClick={exportJson}
            className="text-[#b5bac1] hover:text-white hover:bg-[#1e1f22]"
          />
          <IconButton
            icon={RotateCcw}
            label="Start over"
            onClick={resetDocument}
            className="text-[#b5bac1] hover:text-white hover:bg-[#1e1f22]"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void importJson(e)}
          />
        </div>
      </header>

      {/* Import Error Modal */}
      <Modal
        open={Boolean(importError)}
        onClose={() => setImportError(null)}
        title="Import Problem"
        footer={<Button onClick={() => setImportError(null)}>Got it</Button>}
      >
        <p className="text-sm text-[#dbdee1]">{importError}</p>
      </Modal>

      {/* Template Load Modal */}
      <Modal
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        title="Saved Templates"
        width="max-w-xl"
      >
        {templates.length === 0 ? (
          <p className="text-xs text-[#949ba4] py-4 text-center">
            No saved templates yet. Type a name and click Save!
          </p>
        ) : (
          <ul className="divide-y divide-[#1e1f22]">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-bold text-white">{template.name}</p>
                  <p className="text-[11px] text-[#949ba4]">
                    Updated {new Date(template.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      void loadTemplate(template.id);
                      setLoadOpen(false);
                    }}
                    className="bg-[#5865f2] hover:bg-[#4752c4] text-white border-none"
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeTemplate(template.id)}
                    className="text-[#f28b8b] hover:bg-[#da373c]/10 border-none"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
};

export default Header;