import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Puck, Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { ArrowLeft, Download, Eye, FileUp, FolderOutput, LayoutTemplate, RotateCcw, Save, Settings, Shield, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import { useGlobalStore } from "../store/globalStore";
import { designConfig, initialDesignData } from "../config/puck/designConfig";
import { publishedDesign } from "../config/puck/publishedDesign";
import { publishedThemeTokens } from "../config/puck/publishedTheme";
import { applyUiTheme, type UiThemeTokens } from "../utils/puckTheme";
import { writeDesignFilesToLocalProject } from "../utils/puckSourceExport";
import { designApi, type DesignTheme } from "../api/design";
import { downloadDesign, getDesignStorageKey, loadDesign, parseDesignFile, saveDesign } from "../utils/puckDesignStorage";
import { NotFoundPage } from "./NotFoundPage";
import "./design-lab.css";

type SaveState = "saved" | "saving" | "error";
type ThemeTokenKey = keyof UiThemeTokens;
const initialPublishedData = publishedDesign && typeof publishedDesign === "object" ? publishedDesign : initialDesignData;

const createThemeStarter = (theme: UiThemeTokens): any => {
  const base = JSON.parse(JSON.stringify(initialPublishedData));
  const mapBlocks = (blocks: any[]): any[] => blocks.map((block) => {
    const props = { ...(block.props || {}) };
    if (block.type === "Hero") {
      props.background = theme.panel;
      props.textColor = theme.text;
    } else if (block.type === "Heading") {
      props.color = theme.text;
    } else if (block.type === "Text") {
      props.color = theme.muted;
    } else if (block.type === "FeatureCard") {
      props.accent = theme.accent;
    }
    if (Array.isArray(props.content)) props.content = mapBlocks(props.content);
    return { ...block, props };
  });
  return {
    ...base,
    root: {
      ...(base.root || {}),
      props: {
        ...((base.root && base.root.props) || {}),
        title: "HoHo Manager — Current Theme",
        background: theme.background,
        textColor: theme.text,
        accentColor: theme.accent,
        surfaceColor: theme.surface,
        fontFamily: theme.fontFamily,
        radius: theme.radius,
      },
    },
    content: mapBlocks(Array.isArray(base.content) ? base.content : []),
  };
};

export const DesignLabPage: React.FC = () => {
  const currentUser = useGlobalStore((state) => state.currentUser);
  const storageKey = useMemo(() => getDesignStorageKey(currentUser?.id), [currentUser?.id]);
  const [data, setData] = useState<any>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(storageKey)
        ? loadDesign(storageKey)
        : initialPublishedData;
    } catch { return initialPublishedData; }
  });
  const [tokens, setTokens] = useState<UiThemeTokens>(publishedThemeTokens);
  const [themes, setThemes] = useState<DesignTheme[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [themeName, setThemeName] = useState("My HoHo theme");
  const [editorKey, setEditorKey] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<Array<{ discord_user_id: string; created_at: string }>>([]);
  const [discordId, setDiscordId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [working, setWorking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshThemes = useCallback(async () => {
    const response = await designApi.themes();
    setThemes(response.themes);
    return response.themes;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const access = await designApi.access();
        if (!active) return;
        setIsOwner(access.isOwner);
        setAllowedUsers(access.allowedUsers);
        const [result, serverThemeResponse] = await Promise.all([
          designApi.themes(),
          designApi.defaultTheme(),
        ]);
        if (!active) return;
        setThemes(result.themes);
        const liveServerTheme = serverThemeResponse.theme?.theme || publishedThemeTokens;
        setTokens(liveServerTheme);
        applyUiTheme(liveServerTheme);
        const hasLocalDraft = typeof window !== "undefined" && window.localStorage.getItem(storageKey) !== null;
        const ownTheme = result.themes.find((theme) => theme.ownerDiscordId === (currentUser?.id || "local-admin") && !theme.isDefault);
        const defaultTheme = result.themes.find((theme) => theme.isDefault);
        const selected = ownTheme || defaultTheme;
        if (!hasLocalDraft) {
          setData(selected?.data?.puck && typeof selected.data.puck === "object"
            ? selected.data.puck
            : createThemeStarter(liveServerTheme));
        }
        if (selected?.data?.theme) {
          const nextTokens = { ...publishedThemeTokens, ...selected.data.theme };
          setTokens(nextTokens);
          applyUiTheme(nextTokens);
        }
        if (ownTheme) { setActiveThemeId(ownTheme.id); setThemeName(ownTheme.name); }
        setReady(true);
      } catch (error) {
        const status = (error as Error & { status?: number }).status;
        if (status === 404 || status === 401 || status === 403) setDenied(true);
        else setMessage(error instanceof Error ? error.message : "Could not load Design Lab.");
        setReady(true);
      }
    })();
    return () => { active = false; };
  }, [currentUser?.id, storageKey]);

  const persist = useCallback((nextData: any) => {
    setData(nextData);
    setSaveState("saving");
    const saved = saveDesign(storageKey, nextData);
    setSaveState(saved ? "saved" : "error");
    if (!saved) setMessage("Browser draft storage is unavailable or full.");
  }, [storageKey]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseDesignFile(JSON.parse(await file.text()));
      persist(imported);
      setEditorKey((value) => value + 1);
      setPreviewMode(false);
      setActiveThemeId(null);
      setThemeName("Imported design");
      setMessage("Imported " + file.name + ". Save it as a theme to store it in your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import this file.");
    } finally { event.target.value = ""; }
  };

  const resetDesign = () => {
    persist(initialDesignData);
    setEditorKey((value) => value + 1);
    setPreviewMode(false);
    setActiveThemeId(null);
    setThemeName("New HoHo theme");
    setMessage("Starter design restored. Save it as a theme to keep it in your account.");
  };

  const saveTheme = async () => {
    setWorking(true);
    try {
      const body = { name: themeName.trim() || "Untitled theme", data: { puck: data, theme: tokens } };
      const response = activeThemeId ? await designApi.updateTheme(activeThemeId, body) : await designApi.createTheme(body);
      if (response.theme) { setActiveThemeId(response.theme.id); setThemeName(response.theme.name); }
      await refreshThemes();
      setMessage("Theme saved to your account database.");
      setSaveState("saved");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save theme."); }
    finally { setWorking(false); }
  };

  const loadTheme = (id: string) => {
    const selected = themes.find((theme) => theme.id === id);
    if (!selected) return;
    const nextPuck = selected.data?.puck;
    if (nextPuck && typeof nextPuck === "object") persist(nextPuck);
    if (selected.data?.theme) {
      const nextTokens = { ...publishedThemeTokens, ...selected.data.theme };
      setTokens(nextTokens);
      applyUiTheme(nextTokens);
    }
    setActiveThemeId(selected.isDefault || selected.ownerDiscordId !== (currentUser?.id || "local-admin") ? null : selected.id);
    setThemeName(selected.isDefault ? "Copy of " + selected.name : selected.name);
    setEditorKey((value) => value + 1);
    setMessage(selected.isDefault ? "Loaded the published default. Save it under your account to create your own copy." : "Theme loaded.");
  };

  const setAsDefault = async () => {
    if (!activeThemeId || !isOwner) return;
    setWorking(true);
    try {
      await designApi.setDefault(activeThemeId);
      await refreshThemes();
      setMessage("Default theme updated. The public HoHo Manager UI will use it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not set the default theme."); }
    finally { setWorking(false); }
  };

  const deleteTheme = async () => {
    if (!activeThemeId) return;
    setWorking(true);
    try {
      await designApi.deleteTheme(activeThemeId);
      setActiveThemeId(null);
      await refreshThemes();
      setMessage("Theme deleted from your account.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not delete theme."); }
    finally { setWorking(false); }
  };

  const writeLocalFiles = async () => {
    if (!isOwner) return;
    setWorking(true);
    try {
      await writeDesignFilesToLocalProject(data, tokens);
      setMessage("Source files written to the selected local HoHo Manager repository. Review the Git diff before committing.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") setMessage("Folder selection cancelled.");
      else setMessage(error instanceof Error ? error.message : "Could not write local project files.");
    } finally { setWorking(false); }
  };

  const grantAccess = async () => {
    const id = discordId.trim();
    if (!id) return;
    setWorking(true);
    try {
      await designApi.grantAccess(id);
      const access = await designApi.access();
      setAllowedUsers(access.allowedUsers);
      setDiscordId("");
      setMessage("Design Lab access granted to Discord ID " + id + ".");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not grant access."); }
    finally { setWorking(false); }
  };

  const revokeAccess = async (id: string) => {
    setWorking(true);
    try {
      await designApi.revokeAccess(id);
      const access = await designApi.access();
      setAllowedUsers(access.allowedUsers);
      setMessage("Design Lab access revoked for " + id + ".");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke access."); }
    finally { setWorking(false); }
  };

  const updateToken = (key: ThemeTokenKey, value: string) => {
    setTokens((current) => {
      const next = { ...current, [key]: value };
      applyUiTheme(next);
      return next;
    });
  };

  if (denied) return <NotFoundPage />;
  if (!ready) return <div className="hoho-design-lab hoho-design-lab__loading">Checking private Design Lab access…</div>;

  return (
    <div className="hoho-design-lab">
      <header className="hoho-design-lab__topbar">
        <div className="hoho-design-lab__brand">
          <a href="/" className="hoho-design-lab__back" aria-label="Back to HoHo Manager"><ArrowLeft size={16} /></a>
          <div className="hoho-design-lab__brand-icon"><LayoutTemplate size={18} /></div>
          <div className="min-w-0"><h1>Design Lab</h1><p>Private visual editor · database-backed themes</p></div>
          <span className="hoho-design-lab__pill"><Sparkles size={12} /> Puck-powered</span>
        </div>
        <div className="hoho-design-lab__actions">
          <span className={"hoho-design-lab__save-state hoho-design-lab__save-state--" + saveState} aria-live="polite">
            <span />{saveState === "saving" ? "Draft saved" : saveState === "error" ? "Not saved" : "Ready"}
          </span>
          <button type="button" onClick={() => setSettingsOpen((value) => !value)} className={settingsOpen ? "is-active" : ""}><Settings size={15} /><span className="hoho-design-lab__optional-label">Theme config</span></button>
          <button type="button" onClick={() => setPreviewMode((value) => !value)} className={previewMode ? "is-active" : ""}><Eye size={15} />{previewMode ? "Edit" : "Preview"}</button>
          {isOwner ? <button type="button" onClick={writeLocalFiles} disabled={working}><FolderOutput size={15} /><span className="hoho-design-lab__optional-label">Write local files</span></button> : null}
          <button type="button" onClick={() => downloadDesign(data)}><Download size={15} /><span className="hoho-design-lab__optional-label">Export JSON</span></button>
          <button type="button" onClick={() => fileInputRef.current?.click()}><FileUp size={15} /><span className="hoho-design-lab__optional-label">Import</span></button>
          <button type="button" onClick={resetDesign} title="Restore starter design"><RotateCcw size={15} /></button>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={handleImport} />
        </div>
      </header>

      {message ? <div className="hoho-design-lab__notice" role="status">{message}</div> : null}

      {settingsOpen ? (
        <section className="hoho-design-lab__settings" aria-label="Theme configuration">
          <div className="hoho-design-lab__settings-head">
            <div><strong>Theme configuration</strong><span>Save named themes to your Discord account</span></div>
            <button type="button" className="hoho-design-lab__icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close theme settings"><X size={16} /></button>
          </div>
          <div className="hoho-design-lab__settings-grid">
            <label className="hoho-design-lab__field hoho-design-lab__field--wide"><span>Saved themes</span>
              <select value={activeThemeId || ""} onChange={(event) => loadTheme(event.target.value)}>
                <option value="">Current unsaved design</option>
                {themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}{theme.isDefault ? " · Default" : ""}</option>)}
              </select>
            </label>
            <label className="hoho-design-lab__field hoho-design-lab__field--wide"><span>Theme name</span>
              <input value={themeName} maxLength={80} onChange={(event) => setThemeName(event.target.value)} placeholder="My theme" />
            </label>
            {([
              ["background", "App background"], ["panel", "Panels"], ["surface", "Cards / surfaces"],
              ["text", "Primary text"], ["muted", "Muted text"], ["border", "Borders"],
              ["accent", "Accent"], ["accentHover", "Accent hover"],
            ] as Array<[ThemeTokenKey, string]>).map(([key, label]) => (
              <label className="hoho-design-lab__color-field" key={key}>
                <span>{label}</span><input type="color" value={tokens[key]} onChange={(event) => updateToken(key, event.target.value)} /><code>{tokens[key]}</code>
              </label>
            ))}
            <label className="hoho-design-lab__field"><span>Corner radius</span>
              <select value={tokens.radius} onChange={(event) => updateToken("radius", event.target.value)}>
                <option value="4px">Sharp · 4px</option><option value="8px">Compact · 8px</option>
                <option value="10px">Default · 10px</option><option value="14px">Soft · 14px</option><option value="18px">Rounded · 18px</option>
              </select>
            </label>
            <label className="hoho-design-lab__field"><span>Font family</span>
              <select value={tokens.fontFamily} onChange={(event) => updateToken("fontFamily", event.target.value)}>
                <option value="Inter">Inter</option><option value="system-ui">System UI</option><option value="Roboto">Roboto</option><option value="Arial">Arial</option>
              </select>
            </label>
          </div>
          <div className="hoho-design-lab__settings-actions">
            <button type="button" onClick={saveTheme} disabled={working}><Save size={14} />Save theme to database</button>
            {isOwner ? <button type="button" onClick={setAsDefault} disabled={working || !activeThemeId}><Shield size={14} />Set as default</button> : null}
            {activeThemeId ? <button type="button" className="is-danger" onClick={deleteTheme} disabled={working}><Trash2 size={14} />Delete my theme</button> : null}
          </div>
          {isOwner ? (
            <div className="hoho-design-lab__access">
              <div><strong>Allowed Discord accounts</strong><span>These accounts can save their own themes, but cannot publish or change the default.</span></div>
              <div className="hoho-design-lab__grant-row">
                <input value={discordId} onChange={(event) => setDiscordId(event.target.value)} inputMode="numeric" placeholder="Discord user ID (17–20 digits)" />
                <button type="button" onClick={grantAccess} disabled={working || !/^\d{17,20}$/.test(discordId.trim())}><UserPlus size={14} />Allow</button>
              </div>
              {allowedUsers.length ? allowedUsers.map((user) => (
                <div className="hoho-design-lab__allowed-user" key={user.discord_user_id}>
                  <code>{user.discord_user_id}</code><button type="button" onClick={() => revokeAccess(user.discord_user_id)} disabled={working} aria-label={"Revoke " + user.discord_user_id}><X size={14} /></button>
                </div>
              )) : <p className="hoho-design-lab__empty">No additional Discord accounts have been allowed.</p>}
            </div>
          ) : <p className="hoho-design-lab__permission-note">You can save and manage your own themes. Only the Design Lab owner can publish source files or change the default theme.</p>}
        </section>
      ) : null}

      <main className="hoho-design-lab__workspace">
        {previewMode ? (
          <div className="hoho-design-lab__preview">
            <div className="hoho-design-lab__preview-toolbar"><div><strong>Page preview</strong><span>Rendered with the same component config used by the editor</span></div><button type="button" onClick={() => downloadDesign(data)}><Save size={14} />Save JSON</button></div>
            <div className="hoho-design-lab__preview-canvas"><Render config={designConfig} data={data} /></div>
          </div>
        ) : (
          <div className="hoho-design-lab__editor" key={editorKey}>
            <Puck config={designConfig} data={data} onChange={persist}
              onPublish={async (nextData: any) => { persist(nextData); setMessage("Draft saved in this browser. Use Theme config to save it to your database."); }}
              headerTitle="HoHo Design Lab" headerPath="/design"
              dictionary={{ "header-publish": "Save draft" }}
              dnd={{ behavior: "auto", enableDragHandle: true }} height="100%"
              viewports={[
                { width: 1440, height: "auto", label: "Desktop" },
                { width: 1024, height: "auto", label: "Laptop" },
                { width: 768, height: "auto", label: "Tablet" },
                { width: 390, height: "auto", label: "Mobile" },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
};
export default DesignLabPage;
