import React from "react";
import { FieldGroup, FieldTab } from "@puckeditor/core";

type MotionProps = {
  animation?: string;
  animationDuration?: string;
  animationDelay?: string;
};

const animationOptions = [
  { label: "None", value: "none" },
  { label: "Fade", value: "fade" },
  { label: "Fade up", value: "fade-up" },
  { label: "Slide left", value: "slide-left" },
  { label: "Slide right", value: "slide-right" },
  { label: "Zoom in", value: "zoom-in" },
  { label: "Float", value: "float" },
  { label: "Pulse", value: "pulse" },
];

const durationOptions = [
  { label: "Quick · 180 ms", value: "180ms" },
  { label: "Normal · 300 ms", value: "300ms" },
  { label: "Relaxed · 500 ms", value: "500ms" },
  { label: "Slow · 700 ms", value: "700ms" },
  { label: "Ambient · 1.2 s", value: "1200ms" },
  { label: "Ambient · 2 s", value: "2000ms" },
  { label: "Ambient · 3 s", value: "3000ms" },
];

const delayOptions = [
  { label: "None", value: "0ms" },
  { label: "100 ms", value: "100ms" },
  { label: "200 ms", value: "200ms" },
  { label: "350 ms", value: "350ms" },
];

const motionFields = {
  animation: { type: "select", label: "Animation", options: animationOptions },
  animationDuration: { type: "select", label: "Duration", options: durationOptions },
  animationDelay: { type: "select", label: "Delay", options: delayOptions },
} as const;

const motionStyle = (props: MotionProps) => ({
  "--hoho-motion-duration": props.animationDuration || "300ms",
  "--hoho-motion-delay": props.animationDelay || "0ms",
} as React.CSSProperties);

const MotionFrame: React.FC<React.PropsWithChildren<MotionProps & { className?: string; style?: React.CSSProperties }>> = ({
  children, animation = "none", className = "", style, ...motionProps
}) => (
  <div
    className={className + " hoho-layout-motion-frame"}
    data-hoho-animation={animationOptions.some((option) => option.value === animation) ? animation : "none"}
    style={{ ...motionStyle(motionProps), ...style }}
  >
    {children}
  </div>
);

const PanelHeader = ({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) => (
  <div className="hoho-layout-panel__header">
    <span>{eyebrow}</span>
    <strong>{title}</strong>
    <small>{detail}</small>
  </div>
);

const EditorPanel = ({
  surface = "#2B2D31", padding = 16, radius = 12, label = "Message Editor",
  showToolbar = true, animation, animationDuration, animationDelay,
}): React.ReactElement => (
  <MotionFrame animation={animation} animationDuration={animationDuration} animationDelay={animationDelay} className="hoho-layout-panel hoho-layout-panel--editor" style={{ gridArea: "editor" }}>
    <section className="hoho-layout-panel__surface" style={{ background: surface, padding, borderRadius: radius }}>
      <PanelHeader eyebrow="WORKSPACE / EDITOR" title={label} detail="Compose messages, embeds and Components V2" />
      {showToolbar !== "hide" ? <div className="hoho-layout-editor__toolbar"><span>Message 01</span><span>Classic · Components V2</span></div> : null}
      <div className="hoho-layout-editor__card">
        <div className="hoho-layout-editor__line hoho-layout-editor__line--wide" />
        <div className="hoho-layout-editor__line" />
        <div className="hoho-layout-editor__line hoho-layout-editor__line--short" />
        <div className="hoho-layout-editor__embed">
          <span className="hoho-layout-editor__embed-accent" />
          <div className="hoho-layout-editor__line hoho-layout-editor__line--wide" />
          <div className="hoho-layout-editor__line" />
          <div className="hoho-layout-editor__line hoho-layout-editor__line--short" />
        </div>
      </div>
      <div className="hoho-layout-editor__add"><span>+</span> Add message</div>
    </section>
  </MotionFrame>
);

const PreviewPanel = ({
  surface = "#313338", padding = 16, radius = 12, label = "Live Preview",
  animation, animationDuration, animationDelay,
}): React.ReactElement => (
  <MotionFrame animation={animation} animationDuration={animationDuration} animationDelay={animationDelay} className="hoho-layout-panel hoho-layout-panel--preview" style={{ gridArea: "preview" }}>
    <section className="hoho-layout-panel__surface" style={{ background: surface, padding, borderRadius: radius }}>
      <PanelHeader eyebrow="WORKSPACE / PREVIEW" title={label} detail="Discord-style message rendering" />
      <div className="hoho-layout-discord-card">
        <div className="hoho-layout-discord-card__avatar">H</div>
        <div className="hoho-layout-discord-card__body">
          <div className="hoho-layout-discord-card__author">HoHo Manager <span>APP</span> <small>Today at 12:00 PM</small></div>
          <p>Your Discord workspace, arranged around your workflow.</p>
          <div className="hoho-layout-discord-card__embed">
            <strong>Message preview</strong>
            <span>Embeds, buttons, media and Components V2</span>
            <div className="hoho-layout-discord-card__image" />
          </div>
          <div className="hoho-layout-discord-card__button">Open workspace</div>
        </div>
      </div>
    </section>
  </MotionFrame>
);

const InspectorPanel = ({
  surface = "#161A23", padding = 14, radius = 12, label = "Properties",
  animation, animationDuration, animationDelay,
}): React.ReactElement => (
  <MotionFrame animation={animation} animationDuration={animationDuration} animationDelay={animationDelay} className="hoho-layout-panel hoho-layout-panel--inspector" style={{ gridArea: "inspector" }}>
    <section className="hoho-layout-panel__surface hoho-layout-inspector" style={{ background: surface, padding, borderRadius: radius }}>
      <PanelHeader eyebrow="RIGHT SIDEBAR" title={label} detail="Selection and component settings" />
      <div className="hoho-layout-inspector__field"><span>Component name</span><strong>Embed · Description</strong></div>
      <div className="hoho-layout-inspector__field"><span>Content</span><i /></div>
      <div className="hoho-layout-inspector__field"><span>Color</span><b /></div>
      <div className="hoho-layout-inspector__field"><span>Spacing</span><i /></div>
      <div className="hoho-layout-inspector__footer"><span>Properties</span><span>Actions flow</span></div>
    </section>
  </MotionFrame>
);

const desktopHeaderFields = {
  height: { type: "number", label: "Header height", min: 44, max: 80 },
  horizontalPadding: { type: "number", label: "Side padding", min: 8, max: 36 },
  logoSize: { type: "number", label: "Logo size", min: 20, max: 48 },
  background: { type: "text", label: "Background HEX", placeholder: "#10131A" },
  borderColor: { type: "text", label: "Border HEX", placeholder: "#272D3A" },
  ...motionFields,
} as const;

const workspaceFields = {
  editorRatio: { type: "number", label: "Editor width (%)", min: 28, max: 72 },
  inspectorWidth: { type: "number", label: "Inspector width", min: 300, max: 520 },
  workspaceGap: { type: "number", label: "Panel gap", min: 0, max: 24 },
  panelOrder: { type: "radio", label: "Main panels", options: [{ label: "Editor first", value: "editor-first" }, { label: "Preview first", value: "preview-first" }] },
  inspectorPosition: { type: "radio", label: "Inspector side", options: [{ label: "Right", value: "right" }, { label: "Left", value: "left" }] },
  borderColor: { type: "text", label: "Panel border HEX" },
  ...motionFields,
} as const;

const mobileHeaderFields = {
  height: { type: "number", label: "Header height", min: 44, max: 72 },
  horizontalPadding: { type: "number", label: "Side padding", min: 8, max: 28 },
  logoSize: { type: "number", label: "Logo size", min: 20, max: 40 },
  background: { type: "text", label: "Background HEX" },
  borderColor: { type: "text", label: "Border HEX" },
  ...motionFields,
} as const;

const mobileWorkspaceFields = {
  showInspector: { type: "select", label: "Inspector preview", options: [{ label: "Hidden", value: "hide" }, { label: "Show bottom sheet", value: "show" }] },
  inspectorHeight: { type: "number", label: "Inspector height", min: 180, max: 520 },
  defaultPane: { type: "radio", label: "Open by default", options: [{ label: "Editor", value: "editor" }, { label: "Preview", value: "preview" }] },
  workspaceGap: { type: "number", label: "Panel gap", min: 0, max: 20 },
  panelPadding: { type: "number", label: "Panel padding", min: 8, max: 28 },
  borderColor: { type: "text", label: "Panel border HEX" },
  ...motionFields,
} as const;

const mobileNavigationFields = {
  height: { type: "number", label: "Navigation height", min: 48, max: 84 },
  horizontalPadding: { type: "number", label: "Side padding", min: 8, max: 28 },
  background: { type: "text", label: "Background HEX" },
  accent: { type: "text", label: "Active tab HEX" },
  tabOrder: { type: "radio", label: "Tab order", options: [{ label: "Editor first", value: "editor-first" }, { label: "Preview first", value: "preview-first" }] },
  showLabels: { type: "select", label: "Tab labels", options: [{ label: "Show labels", value: "show" }, { label: "Icons only", value: "hide" }] },
  activeTab: { type: "radio", label: "Active preview tab", options: [{ label: "Editor", value: "editor" }, { label: "Preview", value: "preview" }, { label: "Dispatch", value: "dispatch" }] },
  editorLabel: { type: "text", label: "Editor tab label" },
  previewLabel: { type: "text", label: "Preview tab label" },
  dispatchLabel: { type: "text", label: "Dispatch tab label" },
  ...motionFields,
} as const;

export const appLayoutConfig = {
  root: {
    render: ({ children }: any) => <div className="hoho-layout-root">{children}</div>,
  },
  categories: {
    shell: { title: "Application shell", components: ["DesktopHeader", "DesktopWorkspace", "MobileHeader", "MobileWorkspace", "MobileBottomNavigation"], defaultExpanded: true },
    panels: { title: "Workspace panels", components: ["EditorPanel", "PreviewPanel", "InspectorPanel"], defaultExpanded: false },
  },
  components: {
    DesktopHeader: {
      label: "Desktop header",
      fields: desktopHeaderFields,
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Layout"><FieldGroup label="Sizing" variant="card">{fields.height}{fields.horizontalPadding}{fields.logoSize}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Header colors" variant="card">{fields.background}{fields.borderColor}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Entrance motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { height: 56, horizontalPadding: 16, logoSize: 32, background: "#10131A", borderColor: "#272D3A", animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: (props: any) => (
        <MotionFrame animation={props.animation} animationDuration={props.animationDuration} animationDelay={props.animationDelay} className="hoho-layout-header hoho-layout-header--desktop">
          <div className="hoho-layout-header__brand" style={{ height: props.height, paddingInline: props.horizontalPadding, background: props.background, borderColor: props.borderColor }}>
            <span className="hoho-layout-header__logo" style={{ width: props.logoSize, height: props.logoSize }}>H</span>
            <strong>HoHo Manager</strong>
            <span className="hoho-layout-header__server">Select Server</span>
            <span className="hoho-layout-header__tools">Backups　JSON　Dispatch</span>
            <span className="hoho-layout-header__profile">Profile　⌄</span>
          </div>
        </MotionFrame>
      ),
    },
    DesktopWorkspace: {
      label: "Desktop workspace",
      fields: { ...workspaceFields, content: { type: "slot", label: "Workspace panels", allow: ["EditorPanel", "PreviewPanel", "InspectorPanel"] } },
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Layout"><FieldGroup label="Panel arrangement" variant="card">{fields.editorRatio}{fields.inspectorWidth}{fields.workspaceGap}{fields.panelOrder}{fields.inspectorPosition}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Panel surfaces" variant="card">{fields.borderColor}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Workspace motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: {
        editorRatio: 50, inspectorWidth: 440, workspaceGap: 6, panelOrder: "editor-first", inspectorPosition: "right",
        borderColor: "#272D3A",
        animation: "none", animationDuration: "300ms", animationDelay: "0ms",
        content: [
          { type: "EditorPanel", props: { id: "desktop-editor", surface: "#2B2D31", padding: 16, radius: 10, label: "Message Editor", showToolbar: "show", animation: "none" } },
          { type: "PreviewPanel", props: { id: "desktop-preview", surface: "#313338", padding: 16, radius: 10, label: "Live Preview", animation: "none" } },
          { type: "InspectorPanel", props: { id: "desktop-inspector", surface: "#161A23", padding: 14, radius: 10, label: "Properties", animation: "none" } },
        ],
      },
      render: ({ content: Content, ...props }: any) => {
        const editorFirst = props.panelOrder !== "preview-first";
        const first = editorFirst ? "editor" : "preview";
        const second = editorFirst ? "preview" : "editor";
        const areas = `"${first} ${second}"`;
        const ratio = Math.max(28, Math.min(72, Number(props.editorRatio) || 50));
        const firstRatio = editorFirst ? ratio : 100 - ratio;
        const secondRatio = 100 - firstRatio;
        const columns = `minmax(0,${firstRatio}fr) minmax(0,${secondRatio}fr)`;
        return (
          <MotionFrame animation={props.animation} animationDuration={props.animationDuration} animationDelay={props.animationDelay} className="hoho-layout-workspace hoho-layout-workspace--desktop">
            <div className="hoho-layout-workspace__grid" style={{ gridTemplateColumns: columns, gridTemplateAreas: areas, gap: props.workspaceGap, ["--hoho-layout-editor-ratio" as any]: `${props.editorRatio}%`, ["--hoho-layout-panel-border" as any]: props.borderColor, ["--hoho-layout-inspector-width" as any]: `${props.inspectorWidth}px`, ["--hoho-layout-inspector-left" as any]: props.inspectorPosition === "left" ? "0" : "auto", ["--hoho-layout-inspector-right" as any]: props.inspectorPosition === "right" ? "0" : "auto" }}>
              <Content className="hoho-layout-workspace__slot" style={{ display: "contents" }} />
            </div>
          </MotionFrame>
        );
      },
    },
    MobileHeader: {
      label: "Mobile header",
      fields: mobileHeaderFields,
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Layout"><FieldGroup label="Sizing" variant="card">{fields.height}{fields.horizontalPadding}{fields.logoSize}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Header colors" variant="card">{fields.background}{fields.borderColor}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Entrance motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { height: 56, horizontalPadding: 12, logoSize: 28, background: "#10131A", borderColor: "#272D3A", animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: (props: any) => (
        <MotionFrame animation={props.animation} animationDuration={props.animationDuration} animationDelay={props.animationDelay} className="hoho-layout-header hoho-layout-header--mobile">
          <div className="hoho-layout-header__brand" style={{ height: props.height, paddingInline: props.horizontalPadding, background: props.background, borderColor: props.borderColor }}>
            <span className="hoho-layout-header__logo" style={{ width: props.logoSize, height: props.logoSize }}>H</span>
            <strong>HoHo Manager</strong>
            <span className="hoho-layout-header__mobile-actions">Theme　Profile</span>
          </div>
        </MotionFrame>
      ),
    },
    MobileWorkspace: {
      label: "Mobile workspace",
      fields: { ...mobileWorkspaceFields, content: { type: "slot", label: "Mobile panels", allow: ["EditorPanel", "PreviewPanel", "InspectorPanel"] } },
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Layout"><FieldGroup label="Navigation and defaults" variant="card">{fields.defaultPane}{fields.showInspector}{fields.inspectorHeight}{fields.workspaceGap}{fields.panelPadding}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Panel surfaces" variant="card">{fields.borderColor}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Workspace motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: {
        defaultPane: "editor", showInspector: "hide", inspectorHeight: 300, workspaceGap: 8, panelPadding: 12, borderColor: "#272D3A",
        animation: "none", animationDuration: "300ms", animationDelay: "0ms",
        content: [
          { type: "EditorPanel", props: { id: "mobile-editor", surface: "#2B2D31", padding: 12, radius: 10, label: "Message Editor", showToolbar: "show", animation: "none" } },
          { type: "PreviewPanel", props: { id: "mobile-preview", surface: "#313338", padding: 12, radius: 10, label: "Live Preview", animation: "none" } },
          { type: "InspectorPanel", props: { id: "mobile-inspector", surface: "#161A23", padding: 14, radius: 10, label: "Properties", animation: "none" } },
        ],
      },
      render: ({ content: Content, ...props }: any) => (
        <MotionFrame animation={props.animation} animationDuration={props.animationDuration} animationDelay={props.animationDelay} className="hoho-layout-workspace hoho-layout-workspace--mobile">
          <div className="hoho-layout-mobile__active-pane" data-default-pane={props.defaultPane} data-show-inspector={props.showInspector} style={{ gap: props.workspaceGap, padding: props.panelPadding, ["--hoho-layout-panel-border" as any]: props.borderColor, ["--hoho-layout-mobile-inspector-height" as any]: `${props.inspectorHeight}px` }}>
            <Content className="hoho-layout-workspace__slot" style={{ display: "contents" }} />
          </div>
        </MotionFrame>
      ),
    },
    MobileBottomNavigation: {
      label: "Mobile bottom navigation",
      fields: mobileNavigationFields,
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Layout"><FieldGroup label="Navigation sizing" variant="card">{fields.height}{fields.horizontalPadding}{fields.tabOrder}{fields.showLabels}{fields.activeTab}{fields.editorLabel}{fields.previewLabel}{fields.dispatchLabel}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Navigation colors" variant="card">{fields.background}{fields.accent}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Navigation motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { height: 60, horizontalPadding: 12, background: "#10131A", accent: "#818CF8", tabOrder: "editor-first", showLabels: "show", activeTab: "editor", editorLabel: "Editor", previewLabel: "Preview", dispatchLabel: "Dispatch", animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: (props: any) => (
        <MotionFrame animation={props.animation} animationDuration={props.animationDuration} animationDelay={props.animationDelay} className="hoho-layout-mobile-nav">
          <nav aria-label="Mobile workspace navigation" className={`hoho-layout-mobile-nav__bar ${props.showLabels === "hide" ? "is-icons-only" : ""}`} style={{ minHeight: props.height, paddingInline: props.horizontalPadding, background: props.background, ["--hoho-layout-mobile-accent" as any]: props.accent }}>
            <span className={props.activeTab === "editor" ? "is-active" : ""} style={{ order: props.tabOrder === "preview-first" ? 2 : 1 }}><b>▤</b><small>{props.editorLabel || "Editor"}</small></span>
            <span className={props.activeTab === "preview" ? "is-active" : ""} style={{ order: props.tabOrder === "preview-first" ? 1 : 2 }}><b>◫</b><small>{props.previewLabel || "Preview"}</small></span>
            <span className={props.activeTab === "dispatch" ? "is-active" : ""}><b>➤</b><small>{props.dispatchLabel || "Dispatch"}</small></span>
          </nav>
        </MotionFrame>
      ),
    },
    EditorPanel: {
      label: "Editor panel",
      fields: {
        label: { type: "text", label: "Panel title" },
        surface: { type: "text", label: "Surface HEX" },
        padding: { type: "number", label: "Padding", min: 0, max: 32 },
        radius: { type: "number", label: "Corner radius", min: 0, max: 24 },
        showToolbar: { type: "radio", label: "Show editor toolbar", options: [{ label: "Show", value: "show" }, { label: "Hide", value: "hide" }] },
        ...motionFields,
      },
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Content"><FieldGroup label="Panel content" variant="card">{fields.label}{fields.showToolbar}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Panel style" variant="card">{fields.surface}{fields.padding}{fields.radius}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Entrance motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { label: "Message Editor", surface: "#2B2D31", padding: 16, radius: 10, showToolbar: "show", animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: EditorPanel,
    },
    PreviewPanel: {
      label: "Preview panel",
      fields: {
        label: { type: "text", label: "Panel title" },
        surface: { type: "text", label: "Surface HEX" },
        padding: { type: "number", label: "Padding", min: 0, max: 32 },
        radius: { type: "number", label: "Corner radius", min: 0, max: 24 },
        ...motionFields,
      },
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Content"><FieldGroup label="Panel content" variant="card">{fields.label}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Panel style" variant="card">{fields.surface}{fields.padding}{fields.radius}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Entrance motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { label: "Live Preview", surface: "#313338", padding: 16, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: PreviewPanel,
    },
    InspectorPanel: {
      label: "Inspector panel",
      fields: {
        label: { type: "text", label: "Panel title" },
        surface: { type: "text", label: "Surface HEX" },
        padding: { type: "number", label: "Padding", min: 0, max: 32 },
        radius: { type: "number", label: "Corner radius", min: 0, max: 24 },
        ...motionFields,
      },
      renderFields: ({ fields }: any) => (
        <>
          <FieldTab label="Content"><FieldGroup label="Panel content" variant="card">{fields.label}</FieldGroup></FieldTab>
          <FieldTab label="Appearance"><FieldGroup label="Panel style" variant="card">{fields.surface}{fields.padding}{fields.radius}</FieldGroup></FieldTab>
          <FieldTab label="Motion"><FieldGroup label="Entrance motion" variant="card">{fields.animation}{fields.animationDuration}{fields.animationDelay}</FieldGroup></FieldTab>
        </>
      ),
      defaultProps: { label: "Properties", surface: "#161A23", padding: 14, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" },
      render: InspectorPanel,
    },
  },
};
