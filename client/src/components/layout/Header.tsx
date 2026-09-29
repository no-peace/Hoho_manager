import { useRef, useState, type ChangeEvent } from "react";
import {
  Download,
  FolderOpen,
  LayoutTemplate,
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
import {
  downloadJson,
  fromQueryData,
  parseImportedJson,
  toQueryData,
} from "../../utils/exportImport";
import { EDITOR_MODES } from "../../utils/constants";

/**
 * Top bar.
 *
 * Owns the document-level actions: switching editor mode, naming/saving and
 * loading templates, and JSON import/export. `dirty` is tracked in the template
 * store so the save button can signal unsaved work.
 */
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
          className={[
            "tab-item px-3 text-xs",
            mode === option.id ? "tab-item-active" : "tab-item-idle",
          ].join(" ")}
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

  const save = async (): Promise<void> => {
    try {
      await saveCurrent();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const exportJson = (): void => {
    const { data, targets } = useMessageStore.getState();
    downloadJson(
      toQueryData({ data, targets }),
      `${(currentName || "message").replace(/\s+/g, "-").toLowerCase()}.json`,
    );
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-importing the same file
    if (!file) return;

    try {
      const queryData = parseImportedJson(await file.text());
      useMessageStore.getState().load(fromQueryData(queryData));
      useActionStore.getState().reset();
      detachTemplate();
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const resetDocument = (): void => {
    useMessageStore.getState().reset();
    useActionStore.getState().reset();
    detachTemplate();
  };

  return (
    <>
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-chrome px-4 py-2.5 shadow-md">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blurple">
            <Sparkles size={16} className="text-white" />
          </span>
          <span className="text-base font-semibold text-ink-strong">Message Builder</span>
        </div>

        <ModeToggle />

        <div className="flex min-w-48 flex-1 items-center gap-2">
          <input
            className="field !min-h-8 !py-1"
            placeholder="Untitled template"
            value={currentName}
            onChange={(event) => setCurrentName(event.target.value)}
          />
          <Button
            size="sm"
            variant={dirty ? "primary" : "secondary"}
            icon={Save}
            onClick={() => void save()}
            title={dirty ? "Save changes" : "Saved"}
          >
            {dirty ? "Save" : "Saved"}
          </Button>
          <Button size="sm" variant="secondary" icon={FolderOpen} onClick={() => setLoadOpen(true)}>
            Load
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon={Upload}
            label="Import JSON"
            onClick={() => fileInputRef.current?.click()}
          />
          <IconButton icon={Download} label="Export JSON" onClick={exportJson} />
          <IconButton icon={RotateCcw} label="Start over" onClick={resetDocument} />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void importJson(event)}
          />
        </div>
      </header>

      {/* Import errors surface here rather than in an alert(). */}
      <Modal
        open={Boolean(importError)}
        onClose={() => setImportError(null)}
        title="Import problem"
        footer={<Button onClick={() => setImportError(null)}>Got it</Button>}
      >
        <p className="text-sm text-ink">{importError}</p>
      </Modal>

      <Modal
        open={loadOpen}
        onClose={() => setLoadOpen(false)}
        title="Load a template"
        width="max-w-xl"
      >
        {templates.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <LayoutTemplate size={15} />
            No saved templates yet. Name this one and hit Save.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {templates.map((template) => (
              <li key={template.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{template.name}</p>
                  <p className="text-[11px] text-ink-faint">
                    Updated {new Date(template.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    onClick={() => {
                      void (async () => {
                        await loadTemplate(template.id);
                        setLoadOpen(false);
                      })();
                    }}
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeTemplate(template.id)}
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
