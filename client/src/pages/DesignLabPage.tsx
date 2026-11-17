import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Puck, Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  ArrowLeft, Download, Eye, FileUp, LayoutTemplate, Monitor,
  RotateCcw, Shield, Smartphone, Sparkles, UserPlus, X,
} from "lucide-react";
import { useGlobalStore } from "../store/globalStore";
import { designApi } from "../api/design";
import { PublishAppLayoutControl } from "../components/design/PublishAppLayoutControl";
import { publishedThemeTokens } from "../config/puck/publishedTheme";
import { appLayoutConfig } from "../config/puck/appLayoutConfig";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../config/puck/defaultAppLayouts";
import { applyUiTheme } from "../utils/puckTheme";
import {
  downloadAppLayout,
  getAppLayoutDraftKey,
  loadAppLayoutDraft,
  parseAppLayoutFile,
  saveAppLayoutDraft,
  type AppLayoutDocuments,
  type AppLayoutMode,
} from "../utils/puckAppLayout";
import { NotFoundPage } from "./NotFoundPage";
import "./design-lab.css";
import "./app-layout-preview.css";
import "./layout-lab.css";

type SaveState = "saved" | "saving" | "error";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const builtInDocuments = (): AppLayoutDocuments => ({
  desktop: clone(defaultDesktopLayoutData),
  mobile: clone(defaultMobileLayoutData),
});

const modeLabel = (mode: AppLayoutMode) => mode === "desktop" ? "Desktop" : "Mobile";

export const DesignLabPage: React.FC = () => {
  const currentUser = useGlobalStore((state) => state.currentUser);
  const showToast = useGlobalStore((state) => state.showToast);
  const draftKey = useMemo(() => getAppLayoutDraftKey(currentUser?.id), [currentUser?.id]);
  const [documents, setDocuments] = useState<AppLayoutDocuments>(() =>
    typeof window !== "undefined" ? loadAppLayoutDraft(getAppLayoutDraftKey(currentUser?.id)) || builtInDocuments() : builtInDocuments(),
  );
  const [mode, setMode] = useState<AppLayoutMode>("desktop");
  const [previewMode, setPreviewMode] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<Array<{ discord_user_id: string; created_at: string }>>([]);
  const [discordId, setDiscordId] = useState("");
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setReady(false);
    void (async () => {
      try {
        const [themeListResult, serverThemeResult] = await Promise.allSettled([
          designApi.themes(),
          designApi.defaultTheme(),
        ]);
        if (!active) return;
        if (themeListResult.status === "rejected") throw themeListResult.reason;
        const themeList = themeListResult.value;
        setIsOwner(themeList.isOwner);
        applyUiTheme(
          serverThemeResult.status === "fulfilled"
            ? serverThemeResult.value.theme?.theme || publishedThemeTokens
            : publishedThemeTokens,
        );
        if (themeList.isOwner) {
          try {
            const access = await designApi.access();
            if (!active) return;
            setAllowedUsers(access.allowedUsers);
          } catch {
            if (active) setMessage("Layout editing is available, but the owner access list could not be loaded.");
          }
        }
        const draft = loadAppLayoutDraft(draftKey);
        setDocuments(draft || builtInDocuments());
        setDirty(false);
        setSaveState("saved");
        setReady(true);
      } catch (error) {
        if (!active) return;
        const status = (error as Error & { status?: number }).status;
        if (status === 401 || status === 403 || status === 404) setDenied(true);
        else setMessage(error instanceof Error ? error.message : "Could not load the Design Lab.");
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, draftKey]);

  useEffect(() => {
    if (!ready || !dirty) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      const saved = saveAppLayoutDraft(draftKey, documents);
      setSaveState(saved ? "saved" : "error");
      if (!saved) setMessage("The browser could not save this draft. Export a backup before leaving this page.");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [documents, dirty, draftKey, ready]);

  const activeDocument = documents[mode];

  const updateDocument = useCallback((nextData: any) => {
    setDocuments((current) => ({ ...current, [mode]: nextData }));
    setDirty(true);
    setMessage("");
  }, [mode]);

  const resetCurrentMode = () => {
    setDocuments((current) => ({
      ...current,
      [mode]: clone(mode === "desktop" ? defaultDesktopLayoutData : defaultMobileLayoutData),
    }));
    setEditorKey((value) => value + 1);
    setDirty(true);
    setPreviewMode(false);
    setMessage(`${modeLabel(mode)} layout restored to the current HoHo Manager default.`);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = parseAppLayoutFile(JSON.parse(await file.text()));
      setDocuments(imported);
      setEditorKey((value) => value + 1);
      setDirty(true);
      setPreviewMode(false);
      setMessage(`Imported both responsive layouts from ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import this layout file.");
    } finally {
      input.value = "";
    }
  };

  const exportLayouts = () => {
    try {
      downloadAppLayout(documents);
      showToast("Desktop and Mobile layout backup exported.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not export the layout.", "error");
    }
  };

  const grantAccess = async () => {
    const id = discordId.trim();
    if (!/^\d{17,20}$/.test(id)) return;
    setWorking(true);
    try {
      await designApi.grantAccess(id);
      const access = await designApi.access();
      setAllowedUsers(access.allowedUsers);
      setDiscordId("");
      showToast("Design Lab access granted.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not grant access.", "error");
    } finally {
      setWorking(false);
    }
  };

  const revokeAccess = async (id: string) => {
    setWorking(true);
    try {
      await designApi.revokeAccess(id);
      const access = await designApi.access();
      setAllowedUsers(access.allowedUsers);
      showToast("Design Lab access revoked.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not revoke access.", "error");
    } finally {
      setWorking(false);
    }
  };

  if (denied) return <NotFoundPage />;
  if (!ready) return <div className="hoho-design-lab hoho-design-lab__loading">Checking private Design Lab access…</div>;

  return (
    <div className="hoho-design-lab hoho-layout-lab">
      <header className="hoho-design-lab__topbar">
        <div className="hoho-design-lab__brand">
          <a href="/" className="hoho-design-lab__back" aria-label="Back to HoHo Manager"><ArrowLeft size={16} /></a>
          <div className="hoho-design-lab__brand-icon"><LayoutTemplate size={18} /></div>
          <div className="min-w-0"><h1>Studio Layout Designer</h1><p>Edit the real HoHo Manager workspace · changes are saved as a local draft</p></div>
          <span className="hoho-design-lab__pill"><Sparkles size={12} /> Puck 0.24</span>
        </div>
        <div className="hoho-design-lab__actions">
          <span className={"hoho-design-lab__save-state hoho-design-lab__save-state--" + saveState} aria-live="polite">
            <span />{saveState === "saving" ? "Saving draft…" : saveState === "error" ? "Draft not saved" : dirty ? "Draft saved" : "Current defaults"}
          </span>
          {isOwner ? <button type="button" onClick={() => setAccessOpen((value) => !value)} className={accessOpen ? "is-active" : ""}><Shield size={15} /><span className="hoho-design-lab__optional-label">Access</span></button> : null}
          {isOwner ? <PublishAppLayoutControl isOwner={isOwner} documents={documents} /> : null}
          <button type="button" onClick={() => setPreviewMode((value) => !value)} className={previewMode ? "is-active" : ""}><Eye size={15} /><span>{previewMode ? "Edit" : "Preview"}</span></button>
          <button type="button" onClick={exportLayouts}><Download size={15} /><span className="hoho-design-lab__optional-label">Export</span></button>
          <button type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={15} /><span className="hoho-design-lab__optional-label">Import</span></button>
          <button type="button" onClick={resetCurrentMode} title={`Restore ${modeLabel(mode)} default`}><RotateCcw size={15} /><span className="hoho-design-lab__optional-label">Reset</span></button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} />
        </div>
      </header>

      <div className="hoho-layout-lab__modebar" role="tablist" aria-label="Responsive layout mode">
        <button type="button" role="tab" aria-selected={mode === "desktop"} className={mode === "desktop" ? "is-active" : ""} onClick={() => { setMode("desktop"); setPreviewMode(false); }}>
          <Monitor size={15} /><span>Desktop</span><small>1440 px</small>
        </button>
        <button type="button" role="tab" aria-selected={mode === "mobile"} className={mode === "mobile" ? "is-active" : ""} onClick={() => { setMode("mobile"); setPreviewMode(false); }}>
          <Smartphone size={15} /><span>Mobile</span><small>390 px</small>
        </button>
        <p>These are two independent layouts. Editing one does not overwrite the other.</p>
      </div>

      {message ? <div className="hoho-design-lab__notice" role="status">{message}</div> : null}

      {accessOpen && isOwner ? (
        <section className="hoho-layout-lab__access" aria-label="Design Lab access management">
          <div className="hoho-layout-lab__access-head"><div><strong>Design Lab access</strong><span>Allow another signed-in Discord account to edit layout drafts.</span></div><button type="button" onClick={() => setAccessOpen(false)} aria-label="Close access settings"><X size={15} /></button></div>
          <div className="hoho-layout-lab__grant-row">
            <input value={discordId} onChange={(event) => setDiscordId(event.target.value)} inputMode="numeric" placeholder="Discord user ID (17–20 digits)" />
            <button type="button" onClick={grantAccess} disabled={working || !/^\d{17,20}$/.test(discordId.trim())}><UserPlus size={14} />Grant access</button>
          </div>
          {allowedUsers.length ? allowedUsers.map((user) => (
            <div className="hoho-layout-lab__allowed-user" key={user.discord_user_id}>
              <code>{user.discord_user_id}</code>
              <button type="button" onClick={() => void revokeAccess(user.discord_user_id)} disabled={working}>Revoke</button>
            </div>
          )) : <p className="hoho-layout-lab__empty">No additional accounts have access.</p>}
        </section>
      ) : null}

      <main className="hoho-design-lab__workspace hoho-layout-lab__workspace">
        {previewMode ? (
          <section className={"hoho-layout-lab__preview hoho-layout-lab__preview--" + mode} aria-label={`${modeLabel(mode)} layout preview`}>
            <div className="hoho-layout-lab__preview-head"><div><strong>{modeLabel(mode)} preview</strong><span>Preview of the HoHo Manager Studio shell using the selected layout</span></div><button type="button" onClick={() => setPreviewMode(false)}>Back to editor</button></div>
            <div className="hoho-layout-lab__preview-frame"><Render config={appLayoutConfig} data={activeDocument} /></div>
          </section>
        ) : (
          <div className="hoho-design-lab__editor hoho-layout-lab__editor" key={mode + "-" + editorKey}>
            <Puck
              config={appLayoutConfig}
              data={activeDocument}
              onChange={updateDocument}
              onPublish={async (nextData: any) => {
                updateDocument(nextData);
                setMessage(`${modeLabel(mode)} draft saved in this browser. Use the owner-only Publish control to publish both responsive layouts.`);
              }}
              headerTitle={`${modeLabel(mode)} Layout`}
              headerPath="/design"
              dictionary={{ "header-publish": "Save draft" }}
              permissions={{ insert: false, delete: false, duplicate: false, drag: false, edit: true }}
              dnd={{ behavior: "static", disableAutoScroll: true, disableOutlineDrag: true }}
              height="100%"
              iframe={{ enabled: true, waitForStyles: true, syncHostStyles: true }}
              viewports={[
                { width: mode === "desktop" ? 1440 : 390, height: "auto", label: mode === "desktop" ? "Desktop" : "Mobile" },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default DesignLabPage;
