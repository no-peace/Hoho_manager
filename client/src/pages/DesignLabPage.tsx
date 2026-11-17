import React, { useCallback, useMemo, useRef, useState } from "react";
import { Puck, Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { ArrowLeft, Download, Eye, FileUp, LayoutTemplate, RotateCcw, Save, Sparkles } from "lucide-react";
import { useGlobalStore } from "../store/globalStore";
import { designConfig, initialDesignData } from "../config/puck/designConfig";
import { downloadDesign, getDesignStorageKey, loadDesign, parseDesignFile, saveDesign } from "../utils/puckDesignStorage";
import "./design-lab.css";

type SaveState = "saved" | "saving" | "error";

export const DesignLabPage: React.FC = () => {
  const currentUser = useGlobalStore((state) => state.currentUser);
  const storageKey = useMemo(() => getDesignStorageKey(currentUser?.id), [currentUser?.id]);
  const [data, setData] = useState<any>(() => loadDesign(storageKey));
  const [editorKey, setEditorKey] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const persist = useCallback((nextData: any) => {
    setData(nextData);
    setSaveState("saving");
    const saved = saveDesign(storageKey, nextData);
    setSaveState(saved ? "saved" : "error");
    setMessage(saved ? "Draft saved in this browser" : "Browser storage is unavailable or full");
  }, [storageKey]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseDesignFile(JSON.parse(await file.text()));
      persist(imported);
      setEditorKey((value) => value + 1);
      setPreviewMode(false);
      setMessage(`Imported ${file.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import this file");
    } finally {
      event.target.value = "";
    }
  };

  const resetDesign = () => {
    persist(initialDesignData);
    setEditorKey((value) => value + 1);
    setPreviewMode(false);
    setMessage("Starter design restored");
  };

  const handlePublish = async (nextData: any) => {
    persist(nextData);
    setMessage("Design saved locally. Export JSON to move it to another device.");
  };

  return (
    <div className="hoho-design-lab">
      <header className="hoho-design-lab__topbar">
        <div className="hoho-design-lab__brand">
          <a href="/" className="hoho-design-lab__back" aria-label="Back to HoHo Manager"><ArrowLeft size={16} /></a>
          <div className="hoho-design-lab__brand-icon"><LayoutTemplate size={18} /></div>
          <div className="min-w-0">
            <h1>Design Lab</h1>
            <p>Visual website & UI builder</p>
          </div>
          <span className="hoho-design-lab__pill"><Sparkles size={12} /> Puck-powered</span>
        </div>

        <div className="hoho-design-lab__actions">
          <span className={`hoho-design-lab__save-state hoho-design-lab__save-state--${saveState}`} aria-live="polite">
            <span />{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}
          </span>
          <button type="button" onClick={() => setPreviewMode((value) => !value)} className={previewMode ? "is-active" : ""}>
            <Eye size={15} />{previewMode ? "Edit design" : "Preview"}
          </button>
          <button type="button" onClick={() => downloadDesign(data)}><Download size={15} /><span className="hoho-design-lab__optional-label">Export</span></button>
          <button type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={15} /><span className="hoho-design-lab__optional-label">Import</span></button>
          <button type="button" onClick={resetDesign} title="Restore starter design"><RotateCcw size={15} /></button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} />
        </div>
      </header>

      {message ? <div className="hoho-design-lab__notice" role="status">{message}</div> : null}

      <main className="hoho-design-lab__workspace">
        {previewMode ? (
          <div className="hoho-design-lab__preview">
            <div className="hoho-design-lab__preview-toolbar">
              <div><strong>Page preview</strong><span>Rendered with the same component config used by the editor</span></div>
              <button type="button" onClick={() => downloadDesign(data)}><Save size={14} /> Save JSON</button>
            </div>
            <div className="hoho-design-lab__preview-canvas">
              <Render config={designConfig} data={data} />
            </div>
          </div>
        ) : (
          <div className="hoho-design-lab__editor" key={editorKey}>
            <Puck
              config={designConfig}
              data={data}
              onChange={persist}
              onPublish={handlePublish}
              headerTitle="HoHo Design Lab"
              headerPath="/design"
              dictionary={{ "header-publish": "Save draft" }}
              dnd={{ behavior: "auto", enableDragHandle: true }}
              height="100%"
              viewports={[
                { width: 1440, height: "100%", label: "Desktop" },
                { width: 1024, height: "100%", label: "Laptop" },
                { width: 768, height: "100%", label: "Tablet" },
                { width: 390, height: "100%", label: "Mobile" },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default DesignLabPage;
