import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileUp, Palette, Plus, RefreshCw, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useGlobalStore } from "../../store/globalStore";
import { designApi, type DesignTheme } from "../../api/design";
import {
  applyUiTheme, DEFAULT_UI_THEME, loadUserThemeCache, saveUserThemeCache,
  loadUserThemeLibrary, saveUserThemeToLibrary, deleteUserThemeFromLibrary,
  downloadUserThemeFile, parseUserThemeFile, validateUiTheme, type LocalUserTheme, type UiThemeTokens,
} from "../../utils/puckTheme";

type TokenKey = keyof UiThemeTokens;
const COLOR_FIELDS: Array<[TokenKey, string]> = [
  ["background", "Background"], ["panel", "Panels"], ["surface", "Cards / surfaces"],
  ["text", "Primary text"], ["muted", "Muted text"], ["border", "Borders"],
  ["accent", "Accent"], ["accentHover", "Accent hover"],
];

export const ThemeSettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const user = useGlobalStore((state) => state.currentUser);
  const showToast = useGlobalStore((state) => state.showToast);
  const [themes, setThemes] = useState<DesignTheme[]>([]);
  const [privateThemes, setPrivateThemes] = useState<LocalUserTheme[]>([]);
  const [canPublishServerTheme, setCanPublishServerTheme] = useState(false);
  const [tokens, setTokens] = useState<UiThemeTokens>(DEFAULT_UI_THEME);
  const [name, setName] = useState("My theme");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [serverTheme, setServerTheme] = useState<UiThemeTokens>(DEFAULT_UI_THEME);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const privateFileInputRef = React.useRef<HTMLInputElement>(null);
  const themeUserId = user?.id || "guest";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, serverResult] = await Promise.allSettled([
        user?.id ? designApi.themes() : Promise.resolve({ themes: [], isOwner: false, canPublishServerTheme: false }),
        designApi.defaultTheme(),
      ]);
      if (listResult.status === "fulfilled") {
        setThemes(listResult.value.themes);
        setCanPublishServerTheme(listResult.value.canPublishServerTheme);
      } else {
        setThemes([]);
        setCanPublishServerTheme(false);
      }
      const nextServerTheme = serverResult.status === "fulfilled"
        ? serverResult.value.theme?.theme || DEFAULT_UI_THEME
        : DEFAULT_UI_THEME;
      setServerTheme(nextServerTheme);
      setPrivateThemes(loadUserThemeLibrary(themeUserId));
      const cached = loadUserThemeCache(themeUserId, false);
      if (cached) {
        setTokens(cached.theme);
        setActiveThemeId(cached.themeId);
        applyUiTheme(cached.theme);
      } else {
        setTokens(nextServerTheme);
        setActiveThemeId(null);
        applyUiTheme(nextServerTheme);
      }
      if (listResult.status === "rejected" && serverResult.status === "rejected") {
        showToast("Could not load theme settings. You can still preview a theme in this session.", "error");
      }
    } finally { setLoading(false); }
  }, [showToast, themeUserId, user?.id]);

  useEffect(() => { if (open) void refresh(); }, [open, refresh]);

  const validation = useMemo(() => validateUiTheme(tokens), [tokens]);
  const filteredThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? themes.filter((theme) => (theme.name + " " + (theme.description || "")).toLowerCase().includes(q)) : themes;
  }, [themes, query]);

  const update = (key: TokenKey, value: string) => {
    const next = { ...tokens, [key]: value };
    setTokens(next);
    setErrors(validateUiTheme(next).errors);
    applyUiTheme(next);
  };
  const applyPersonal = (theme: UiThemeTokens, id: string | null) => {
    const result = validateUiTheme(theme);
    if (!result.valid) { setErrors(result.errors); return; }
    applyUiTheme(result.theme);
    if (!saveUserThemeCache(themeUserId, result.theme, id)) {
      showToast("Could not cache this theme in your browser.", "error"); return;
    }
    setTokens(result.theme);
    setActiveThemeId(id);
    showToast("Theme applied. This browser remembers your selection for up to 14 days of activity.", "success");
  };
  const editTheme = (theme: DesignTheme) => {
    setTokens(theme.theme);
    setName(theme.name);
    setDescription(theme.description || "");
    setEditingId(theme.ownerDiscordId === user?.id ? theme.id : null);
    setErrors([]);
    applyUiTheme(theme.theme);
  };
  const applyPrivate = () => {
    const result = validateUiTheme(tokens);
    if (!result.valid) { setErrors(result.errors); return; }
    const saved = saveUserThemeToLibrary(themeUserId, name, description, result.theme);
    if (!saved) {
      // Even if browser storage is full or unavailable, preserve the user's
      // design as a portable file rather than losing the work.
      downloadUserThemeFile({
        id: "file-" + Date.now().toString(36),
        name: name.trim().slice(0, 60) || "My theme",
        description: description.trim().slice(0, 180),
        theme: result.theme,
        createdAt: Date.now(),
      });
      showToast("Browser storage is unavailable. Your private preset was downloaded as a file; keep it safe and import it later.", "error");
      return;
    }
    setPrivateThemes(loadUserThemeLibrary(themeUserId));
    downloadUserThemeFile(saved);
    applyPersonal(result.theme, saved.id);
    setEditingId(null);
    showToast("Private preset saved locally and downloaded as a permanent .hoho-theme.json file.", "success");
  };
  const applySavedPrivate = (theme: LocalUserTheme) => {
    applyPersonal(theme.theme, theme.id);
    setTokens(theme.theme);
    setName(theme.name);
    setDescription(theme.description);
  };
  const importPrivateTheme = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imported = parseUserThemeFile(JSON.parse(await file.text()));
      const saved = saveUserThemeToLibrary(themeUserId, imported.name, imported.description, imported.theme);
      if (!saved) throw new Error("Could not save this preset in browser storage. Keep the original file as your backup.");
      setPrivateThemes(loadUserThemeLibrary(themeUserId));
      setTokens(saved.theme);
      setName(saved.name);
      setDescription(saved.description);
      setEditingId(null);
      applyPersonal(saved.theme, saved.id);
      showToast("Private theme file imported. Your original file remains unchanged.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not import this theme file.", "error");
    } finally {
      input.value = "";
    }
  };
  const removePrivate = (id: string) => {
    deleteUserThemeFromLibrary(themeUserId, id);
    setPrivateThemes(loadUserThemeLibrary(themeUserId));
    if (activeThemeId === id) resetPersonal();
  };
  const save = async () => {
    if (!user?.id || !validation.valid) { setErrors(validation.errors); return; }
    setBusy(true);
    try {
      const body = { name: name.trim(), description, theme: validation.theme };
      const response = editingId
        ? await designApi.updateTheme(editingId, body)
        : await designApi.createTheme(body);
      await refresh();
      applyPersonal(validation.theme, response.theme.id);
      setEditingId(response.theme.id);
      showToast("Theme published to the community gallery.", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not save theme.", "error"); }
    finally { setBusy(false); }
  };
  const publishServer = async (theme: UiThemeTokens, sourceId?: string) => {
    if (!canPublishServerTheme || !validation.valid && !sourceId) return;
    setBusy(true);
    try {
      if (sourceId) await designApi.publishCommunityTheme(sourceId);
      else await designApi.publishServerTheme(theme);
      const latest = await designApi.defaultTheme();
      setServerTheme(latest.theme.theme);
      showToast("Server theme published. All visitors will receive it from the hosted service.", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not publish server theme.", "error"); }
    finally { setBusy(false); }
  };
  const remove = async (theme: DesignTheme) => {
    if (theme.ownerDiscordId !== user?.id) return;
    setBusy(true);
    try {
      await designApi.deleteTheme(theme.id);
      if (editingId === theme.id) setEditingId(null);
      await refresh();
      showToast("Your community theme was removed.", "success");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not delete theme.", "error"); }
    finally { setBusy(false); }
  };
  const resetPersonal = () => {
    try { localStorage.removeItem("hoho:user-theme:v2:" + themeUserId); } catch { /* storage unavailable */ }
    applyUiTheme(serverTheme);
    setTokens(serverTheme);
    setActiveThemeId(null);
    setEditingId(null);
    showToast("Server theme restored for this browser.", "success");
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-2 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="theme-settings-title" className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#303849] bg-[#0d1017] text-[#F1F3F9] shadow-2xl">
        <input ref={privateFileInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={importPrivateTheme} />
        <header className="flex items-center justify-between gap-3 border-b border-[#272D3A] px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#818CF8]/15 p-2 text-[#a5adff]"><Palette size={19}/></span><div><h2 id="theme-settings-title" className="text-sm font-bold">Appearance & themes</h2><p className="text-[11px] text-[#929bad]">Personal preferences · community themes · server appearance</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close theme settings" className="rounded-lg p-2 text-[#9ca3af] hover:bg-white/10"><X size={18}/></button>
        </header>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
          <div className="space-y-5 border-b border-[#272D3A] p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-bold uppercase tracking-wider">Theme editor</h3><p className="mt-1 text-[11px] text-[#929bad]">Changes preview instantly. Apply to this browser to keep the appearance for 14 days, or save a reusable private preset.</p></div><button type="button" onClick={resetPersonal} className="text-[11px] text-[#a5adff] hover:text-white">Reset to server</button></div>
            <label className="block space-y-1"><span className="text-[11px] text-[#aab2c1]">Theme name</span><input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-[#303849] bg-[#151a24] px-3 py-2 text-sm outline-none focus:border-[#818CF8]"/></label>
            <label className="block space-y-1"><span className="text-[11px] text-[#aab2c1]">Description (optional)</span><input value={description} maxLength={180} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-[#303849] bg-[#151a24] px-3 py-2 text-sm outline-none focus:border-[#818CF8]"/></label>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map(([key, label]) => <label key={key} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#252d3b] bg-[#121721] p-2.5"><span className="truncate text-[11px] text-[#c4cad5]">{label}</span><input aria-label={label} type="color" value={tokens[key]} onChange={(e) => update(key, e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"/></label>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-[11px] text-[#aab2c1]">Corner radius<select value={tokens.radius} onChange={(e) => update("radius", e.target.value)} className="w-full rounded-lg border border-[#303849] bg-[#151a24] px-2 py-2 text-sm text-white"><option>4px</option><option>8px</option><option>10px</option><option>14px</option><option>18px</option></select></label>
              <label className="space-y-1 text-[11px] text-[#aab2c1]">Font family<select value={tokens.fontFamily} onChange={(e) => update("fontFamily", e.target.value)} className="w-full rounded-lg border border-[#303849] bg-[#151a24] px-2 py-2 text-sm text-white"><option>Inter</option><option>system-ui</option><option>Roboto</option><option>Arial</option></select></label>
            </div>
            <div className="rounded-xl border border-[#303849] p-4" style={{background:tokens.background}}>
              <div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider" style={{color:tokens.muted}}>Live preview</span><span className="rounded-full px-2 py-1 text-[10px]" style={{background:tokens.accent,color:"#fff"}}>Preview badge</span></div>
              <div className="space-y-3 rounded-lg border p-3" style={{background:tokens.panel,borderColor:tokens.border,borderRadius:tokens.radius}}>
                <div className="text-sm font-bold" style={{color:tokens.text}}>HoHo Manager</div><p className="text-xs" style={{color:tokens.muted}}>Theme preview with realistic surfaces and readable text.</p>
                <div className="flex gap-2"><button type="button" className="rounded-md px-3 py-2 text-xs font-semibold text-white" style={{background:tokens.accent}}>Primary action</button><button type="button" className="rounded-md border px-3 py-2 text-xs" style={{color:tokens.text,borderColor:tokens.border}}>Secondary</button></div>
              </div>
            </div>
            {errors.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-[11px] text-red-300">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : <p className="text-[11px] text-emerald-300"><Check size={12} className="mr-1 inline"/>Theme validation passed. Application structure and controls cannot be changed by theme tokens.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { applyPersonal(validation.theme, null); onClose(); }} disabled={busy || !validation.valid} className="inline-flex items-center gap-2 rounded-lg bg-[#818CF8] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Check size={14}/>Apply to this browser</button>
              <button type="button" onClick={applyPrivate} disabled={busy || !validation.valid || !name.trim()} className="inline-flex items-center gap-2 rounded-lg border border-[#818CF8]/40 bg-[#818CF8]/10 px-3 py-2 text-xs font-semibold text-[#c5caff] disabled:opacity-40"><Save size={14}/>Save privately</button>
              <button type="button" onClick={save} disabled={busy || !validation.valid || !name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#818CF8] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Save size={14}/>{editingId ? "Update shared theme" : "Share with community"}</button>
              {canPublishServerTheme ? <button type="button" onClick={() => void publishServer(tokens)} disabled={busy || !validation.valid} className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40"><ShieldCheck size={14}/>Set as server theme</button> : null}
            </div>
            <p className="text-[10px] leading-relaxed text-[#778196]">Only the active theme override uses the 14-day session cache. Private preset files do not expire. Published community themes are shared so other users can discover and copy them.</p>
          </div>
          <aside className="min-w-0 p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-xs font-bold uppercase tracking-wider">Community gallery</h3><p className="mt-1 text-[11px] text-[#929bad]">{themes.length} shared themes</p></div><button type="button" onClick={() => void refresh()} className="rounded-lg border border-[#303849] p-2 text-[#aab2c1] hover:bg-white/5" aria-label="Refresh themes"><RefreshCw size={14}/></button></div>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search themes..." className="mb-3 w-full rounded-lg border border-[#303849] bg-[#151a24] px-3 py-2 text-xs outline-none focus:border-[#818CF8]"/>
            <div className="mb-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="text-[11px] font-bold uppercase tracking-wider text-[#c5caff]">My private themes</h4><div className="flex items-center gap-2"><span className="text-[10px] text-[#778196]">{privateThemes.length} saved permanently</span><button type="button" onClick={() => privateFileInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-[#303849] px-2 py-1 text-[10px] text-[#c5caff] hover:bg-white/5"><FileUp size={11}/>Import file</button></div></div>
              {privateThemes.length ? <div className="space-y-2">{privateThemes.map((theme) => <article key={theme.id} className="rounded-lg border border-[#818CF8]/20 bg-[#151827] p-2.5"><div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{theme.name}</span><div className="flex gap-1">{Object.values(theme.theme).slice(0,8).map((color,index)=><span key={index} className="h-2.5 w-2.5 rounded-full border border-white/10" style={{background:color}}/>)}</div></div><div className="flex gap-1.5"><button type="button" onClick={() => applySavedPrivate(theme)} className="rounded-md bg-[#818CF8]/15 px-2 py-1.5 text-[10px] text-[#c5caff]">Use</button><button type="button" onClick={() => {setTokens(theme.theme);setName(theme.name);setDescription(theme.description);setEditingId(null);applyUiTheme(theme.theme);}} className="rounded-md border border-[#303849] px-2 py-1.5 text-[10px] text-[#c4cad5]">Edit</button><button type="button" onClick={() => downloadUserThemeFile(theme)} title="Download permanent theme file" aria-label={"Export " + theme.name} className="rounded-md border border-[#303849] px-2 py-1.5 text-[10px] text-[#c4cad5]"><Download size={11}/></button><button type="button" onClick={() => removePrivate(theme.id)} className="rounded-md border border-red-500/20 px-2 py-1.5 text-[10px] text-red-300"><Trash2 size={11}/></button></div></article>)}</div> : <p className="rounded-lg border border-dashed border-[#303849] p-3 text-[10px] text-[#929bad]">Private presets do not expire. Downloaded .hoho-theme.json files remain yours even if browser data is cleared.</p>}
            </div>
            {canPublishServerTheme ? <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-200"><ShieldCheck size={14}/>Current server theme</div><p className="mt-1 text-[10px] text-[#aab2c1]">Changes here publish to the hosted app for every visitor.</p><button type="button" onClick={() => {setTokens(serverTheme);setName("Server theme");setEditingId(null);applyUiTheme(serverTheme);}} className="mt-2 text-[11px] text-emerald-200 underline">Edit server theme</button></div> : null}
            {loading ? <div className="flex items-center gap-2 py-8 text-xs text-[#929bad]"><RefreshCw size={14} className="animate-spin"/>Loading shared themes…</div> : filteredThemes.length === 0 ? <div className="rounded-xl border border-dashed border-[#303849] p-6 text-center text-xs text-[#929bad]">No community themes yet. Create the first one.</div> : <div className="space-y-2">
              {filteredThemes.map((theme) => <article key={theme.id} className="rounded-xl border border-[#293243] bg-[#121721] p-3">
                <div className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-xs font-semibold">{theme.name}</h4><p className="text-[10px] text-[#8993a5]">by {theme.ownerDiscordId === user?.id ? "you" : theme.ownerDiscordId.slice(0,5)+"…"+theme.ownerDiscordId.slice(-4)} · {theme.isPublic ? "Community" : "Private"}</p></div><div className="flex shrink-0 gap-1">{Object.values(theme.theme).slice(0,5).map((color,index)=><span key={index} className="h-3 w-3 rounded-full border border-white/10" style={{background:color}}/>)}</div></div>
                {theme.description ? <p className="mb-2 line-clamp-2 text-[10px] text-[#929bad]">{theme.description}</p> : null}
                <div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => applyPersonal(theme.theme,theme.id)} className="inline-flex items-center gap-1 rounded-md bg-[#818CF8]/15 px-2 py-1.5 text-[10px] font-semibold text-[#c5caff]"><Check size={11}/>Use theme</button><button type="button" onClick={() => editTheme(theme)} className="inline-flex items-center gap-1 rounded-md border border-[#303849] px-2 py-1.5 text-[10px] text-[#c4cad5]"><Copy size={11}/>Copy / edit</button>{canPublishServerTheme ? <button type="button" onClick={() => void publishServer(theme.theme,theme.id)} className="rounded-md border border-emerald-500/30 px-2 py-1.5 text-[10px] text-emerald-200">Make server theme</button> : null}{theme.ownerDiscordId === user?.id ? <button type="button" onClick={() => void remove(theme)} className="rounded-md border border-red-500/20 px-2 py-1.5 text-[10px] text-red-300"><Trash2 size={11}/></button> : null}</div>
              </article>)}
            </div>}
            <button type="button" onClick={() => {setTokens(DEFAULT_UI_THEME);setName("New theme");setDescription("");setEditingId(null);setErrors([]);applyUiTheme(DEFAULT_UI_THEME);}} className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold text-[#a5adff]"><Plus size={13}/>Start a new theme</button>
          </aside>
        </div>
      </section>
    </div>
  );
};
export default ThemeSettingsModal;
