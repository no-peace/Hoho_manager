import React from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * HoHo Design Lab's Puck component library.
 * Components are deliberately self-contained so saved Puck data can be rendered
 * by both the editor canvas and the public-facing Render component.
 */
const safeHref = (value: string): string => {
  const href = (value || "").trim();
  if (!href) return "#";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(href)) return href;
  return "#";
};

const textStyle = (color: string, align: string): CSSProperties => ({
  color: color || "inherit",
  textAlign: (align || "left") as CSSProperties["textAlign"],
});

const slot = (Content: React.ComponentType<any>, className: string, style?: CSSProperties) => (
  <Content className={className} style={style} />
);

export const designConfig: any = {
  root: {
    fields: {
      title: { type: "text", label: "Page title" },
      background: { type: "text", label: "Page background (CSS color)" },
      contentWidth: {
        type: "select",
        label: "Content width",
        options: [
          { label: "Compact — 960px", value: "960px" },
          { label: "Standard — 1120px", value: "1120px" },
          { label: "Wide — 1280px", value: "1280px" },
          { label: "Full width", value: "100%" },
        ],
      },
      textColor: { type: "text", label: "Base text color" },
      accentColor: { type: "text", label: "Brand accent color" },
      surfaceColor: { type: "text", label: "Card surface color" },
      fontFamily: {
        type: "select",
        label: "Typography",
        options: [
          { label: "Inter", value: "Inter" },
          { label: "System UI", value: "system-ui" },
          { label: "Roboto", value: "Roboto" },
          { label: "Arial", value: "Arial" },
        ],
      },
      radius: {
        type: "select",
        label: "Global corner radius",
        options: [
          { label: "Sharp · 4px", value: "4px" },
          { label: "Compact · 8px", value: "8px" },
          { label: "Default · 10px", value: "10px" },
          { label: "Soft · 14px", value: "14px" },
          { label: "Rounded · 18px", value: "18px" },
        ],
      },
    },
    defaultProps: {
      title: "HoHo Manager — Current Theme",
      background: "#0b0d12",
      contentWidth: "1120px",
      textColor: "#f1f3f9",
      accentColor: "#818cf8",
      surfaceColor: "#1d2230",
      fontFamily: "Inter",
      radius: "10px",
    },
    render: ({ children, background, contentWidth, textColor, accentColor, surfaceColor, fontFamily, radius }: {
      children: ReactNode; background?: string; contentWidth?: string; textColor?: string;
      accentColor?: string; surfaceColor?: string; fontFamily?: string; radius?: string;
    }) => (
      <main className="hoho-design-page" style={{
        background: background || "var(--hoho-theme-bg, #0b0d12)",
        color: textColor || "var(--hoho-theme-text, #f1f3f9)",
        fontFamily: fontFamily || "Inter",
        "--hoho-design-accent": accentColor || "var(--hoho-theme-accent, #818cf8)",
        "--hoho-design-surface": surfaceColor || "var(--hoho-theme-surface, #1d2230)",
        "--hoho-design-radius": radius || "var(--hoho-theme-radius, 10px)",
      } as CSSProperties}>
        <div className="hoho-design-page__content" style={{ maxWidth: contentWidth || "1120px" }}>
          {children}
        </div>
      </main>
    ),
  },
  categories: {
    layout: { title: "Layout", components: ["Section", "Container", "Grid", "Spacer", "Divider"] },
    typography: { title: "Typography", components: ["Heading", "Text", "Quote"] },
    marketing: { title: "Marketing", components: ["Hero", "Button", "FeatureCard"] },
    media: { title: "Media", components: ["Image"] },
  },
  components: {
    Hero: {
      label: "Hero section",
      fields: {
        eyebrow: { type: "text", label: "Eyebrow" },
        title: { type: "textarea", label: "Main heading" },
        subtitle: { type: "textarea", label: "Supporting text" },
        buttonLabel: { type: "text", label: "Button label" },
        buttonUrl: { type: "text", label: "Button URL" },
        align: {
          type: "radio",
          label: "Alignment",
          options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }],
        },
        background: { type: "text", label: "Background color" },
        textColor: { type: "text", label: "Text color" },
        padding: {
          type: "select",
          label: "Vertical spacing",
          options: [{ label: "Compact", value: "4rem" }, { label: "Comfortable", value: "6rem" }, { label: "Large", value: "8rem" }],
        },
      },
      defaultProps: {
        eyebrow: "INTRODUCING YOUR NEXT IDEA",
        title: "Build something people remember.",
        subtitle: "A clear message, a confident layout, and a design system that stays consistent across every screen.",
        buttonLabel: "Get started",
        buttonUrl: "#",
        align: "center",
        background: "#161a23",
        textColor: "#f1f3f9",
        padding: "6rem",
      },
      render: ({ eyebrow, title, subtitle, buttonLabel, buttonUrl, align, background, textColor, padding }: any) => (
        <section className={`hoho-block hoho-hero hoho-hero--${align || "center"}`} style={{ background: background || "#151927", color: textColor || "#f8fafc", padding: `${padding || "6rem"} 1.5rem` }}>
          <div className="hoho-hero__inner">
            {eyebrow ? <p className="hoho-eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? <p className="hoho-hero__subtitle">{subtitle}</p> : null}
            {buttonLabel ? <a className="hoho-button hoho-button--primary" href={safeHref(buttonUrl)}>{buttonLabel}</a> : null}
          </div>
        </section>
      ),
    },
    Section: {
      label: "Section",
      fields: {
        content: { type: "slot" },
        background: { type: "text", label: "Background color" },
        padding: {
          type: "select",
          label: "Spacing",
          options: [{ label: "Small", value: "2rem" }, { label: "Medium", value: "4rem" }, { label: "Large", value: "6rem" }],
        },
      },
      defaultProps: { background: "transparent", padding: "4rem" },
      render: ({ content: Content, background, padding }: any) => (
        <section className="hoho-block hoho-section" style={{ background: background || "transparent", padding: `${padding || "4rem"} 1.5rem` }}>
          {slot(Content, "hoho-section__inner")}
        </section>
      ),
    },
    Container: {
      label: "Container",
      fields: {
        content: { type: "slot" },
        width: {
          type: "select",
          label: "Max width",
          options: [{ label: "Small", value: "720px" }, { label: "Standard", value: "960px" }, { label: "Wide", value: "1120px" }, { label: "Full", value: "100%" }],
        },
        gap: { type: "select", label: "Element gap", options: [{ label: "Tight", value: "0.75rem" }, { label: "Normal", value: "1.5rem" }, { label: "Relaxed", value: "2.5rem" }] },
      },
      defaultProps: { width: "1120px", gap: "1.5rem" },
      render: ({ content: Content, width, gap }: any) => (
        <div className="hoho-container" style={{ maxWidth: width || "1120px", gap: gap || "1.5rem" }}>
          {slot(Content, "hoho-container__content")}
        </div>
      ),
    },
    Grid: {
      label: "Grid",
      fields: {
        content: { type: "slot" },
        columns: { type: "select", label: "Columns", options: [{ label: "2 columns", value: "2" }, { label: "3 columns", value: "3" }, { label: "4 columns", value: "4" }] },
        gap: { type: "select", label: "Gap", options: [{ label: "Small", value: "1rem" }, { label: "Medium", value: "1.5rem" }, { label: "Large", value: "2rem" }] },
      },
      defaultProps: { columns: "3", gap: "1.5rem" },
      render: ({ content: Content, columns, gap }: any) => (
        <div className="hoho-grid" style={{ gridTemplateColumns: `repeat(${columns || "3"}, minmax(0, 1fr))`, gap: gap || "1.5rem" }}>
          {slot(Content, "hoho-grid__content")}
        </div>
      ),
    },
    Heading: {
      label: "Heading",
      fields: {
        text: { type: "text", label: "Text" },
        level: { type: "select", label: "Heading level", options: [{ label: "H1", value: "h1" }, { label: "H2", value: "h2" }, { label: "H3", value: "h3" }, { label: "H4", value: "h4" }] },
        align: { type: "radio", label: "Alignment", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }] },
        color: { type: "text", label: "Text color" },
        fontSize: { type: "select", label: "Custom size", options: [{ label: "Small", value: "1.35rem" }, { label: "Medium", value: "1.8rem" }, { label: "Large", value: "2.4rem" }, { label: "Display", value: "clamp(2.4rem, 5vw, 4rem)" }] },
        fontWeight: { type: "select", label: "Font weight", options: [{ label: "Regular", value: "400" }, { label: "Medium", value: "500" }, { label: "Semibold", value: "600" }, { label: "Bold", value: "700" }, { label: "Extra bold", value: "800" }] },
        lineHeight: { type: "select", label: "Line height", options: [{ label: "Tight", value: "1.05" }, { label: "Normal", value: "1.2" }, { label: "Relaxed", value: "1.4" }] },
      },
      defaultProps: { text: "Your heading goes here", level: "h2", align: "left", color: "#f1f3f9", fontSize: "1.8rem", fontWeight: "800", lineHeight: "1.2" },
      render: ({ text, level, align, color, fontSize, fontWeight, lineHeight }: any) => {
        const Tag = (["h1", "h2", "h3", "h4"].includes(level) ? level : "h2") as React.ElementType;
        return <Tag className={`hoho-heading hoho-heading--${level || "h2"}`} style={{ ...textStyle(color, align), fontSize: fontSize || undefined, fontWeight: fontWeight || undefined, lineHeight: lineHeight || undefined }}>{text}</Tag>;
      },
    },
    Text: {
      label: "Text",
      fields: {
        text: { type: "textarea", label: "Paragraph" },
        size: { type: "select", label: "Text size", options: [{ label: "Small", value: "0.875rem" }, { label: "Normal", value: "1rem" }, { label: "Large", value: "1.125rem" }, { label: "Lead", value: "1.25rem" }] },
        align: { type: "radio", label: "Alignment", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }] },
        color: { type: "text", label: "Text color" },
        lineHeight: { type: "select", label: "Line height", options: [{ label: "Compact", value: "1.4" }, { label: "Comfortable", value: "1.7" }, { label: "Relaxed", value: "1.9" }] },
        fontWeight: { type: "select", label: "Font weight", options: [{ label: "Regular", value: "400" }, { label: "Medium", value: "500" }, { label: "Semibold", value: "600" }] },
        maxWidth: { type: "select", label: "Text width", options: [{ label: "Narrow", value: "36rem" }, { label: "Readable", value: "48rem" }, { label: "Wide", value: "64rem" }, { label: "Full", value: "100%" }] },
      },
      defaultProps: { text: "Add a paragraph to explain your idea. Keep it concise, readable, and focused on one message.", size: "1rem", align: "left", color: "#a1a8b8", lineHeight: "1.7", fontWeight: "400", maxWidth: "48rem" },
      render: ({ text, size, align, color, lineHeight, fontWeight, maxWidth }: any) => <p className="hoho-text" style={{ ...textStyle(color, align), fontSize: size || "1rem", lineHeight: lineHeight || "1.7", fontWeight: fontWeight || "400", maxWidth: maxWidth || "48rem" }}>{text}</p>,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text", label: "Label" },
        url: { type: "text", label: "URL" },
        variant: { type: "select", label: "Style", options: [{ label: "Primary", value: "primary" }, { label: "Secondary", value: "secondary" }, { label: "Outline", value: "outline" }, { label: "Ghost", value: "ghost" }] },
        size: { type: "radio", label: "Size", options: [{ label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }] },
        backgroundColor: { type: "text", label: "Custom background color" },
        textColor: { type: "text", label: "Custom text color" },
        radius: { type: "select", label: "Corner radius", options: [{ label: "Sharp", value: "4px" }, { label: "Soft", value: "10px" }, { label: "Rounded", value: "999px" }] },
      },
      defaultProps: { label: "Learn more", url: "#", variant: "primary", size: "medium", backgroundColor: "", textColor: "", radius: "10px" },
      render: ({ label, url, variant, size, backgroundColor, textColor, radius }: any) => <a className={`hoho-button hoho-button--${variant || "primary"} hoho-button--${size || "medium"}`} href={safeHref(url)} style={{ background: backgroundColor || undefined, color: textColor || undefined, borderRadius: radius || undefined }}>{label}</a>,
    },
    FeatureCard: {
      label: "Feature card",
      fields: {
        icon: { type: "text", label: "Icon / emoji" },
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        accent: { type: "text", label: "Accent color" },
        backgroundColor: { type: "text", label: "Card background" },
        borderColor: { type: "text", label: "Border color" },
        radius: { type: "select", label: "Corner radius", options: [{ label: "Compact", value: "8px" }, { label: "Default", value: "16px" }, { label: "Rounded", value: "24px" }] },
        padding: { type: "select", label: "Card padding", options: [{ label: "Compact", value: "1rem" }, { label: "Comfortable", value: "1.5rem" }, { label: "Spacious", value: "2rem" }] },
        shadow: { type: "select", label: "Shadow", options: [{ label: "None", value: "none" }, { label: "Soft", value: "soft" }, { label: "Strong", value: "strong" }] },
      },
      defaultProps: { icon: "✦", title: "Feature title", description: "Describe the value this feature provides in one or two sentences.", accent: "#818cf8", backgroundColor: "", borderColor: "", radius: "16px", padding: "1.5rem", shadow: "soft" },
      render: ({ icon, title, description, accent, backgroundColor, borderColor, radius, padding, shadow }: any) => (
        <article className="hoho-feature-card" style={{
          borderColor: borderColor || `${accent || "#818cf8"}55`,
          background: backgroundColor || undefined,
          borderRadius: radius || undefined,
          padding: padding || undefined,
          boxShadow: shadow === "none" ? "none" : shadow === "strong" ? "0 18px 48px rgba(0,0,0,.35)" : "0 10px 28px rgba(0,0,0,.18)",
        }}>
          <span className="hoho-feature-card__icon" style={{ color: accent || "#818cf8", background: `${accent || "#818cf8"}18` }}>{icon}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </article>
      ),
    },
    Image: {
      label: "Image",
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alternative text" },
        caption: { type: "text", label: "Caption" },
        width: { type: "select", label: "Width", options: [{ label: "Small", value: "60%" }, { label: "Medium", value: "80%" }, { label: "Full", value: "100%" }] },
        radius: { type: "select", label: "Corners", options: [{ label: "Square", value: "0" }, { label: "Soft", value: "0.75rem" }, { label: "Rounded", value: "1.5rem" }] },
      },
      defaultProps: { src: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=85", alt: "Modern workspace", caption: "", width: "100%", radius: "0.75rem" },
      render: ({ src, alt, caption, width, radius }: any) => (
        <figure className="hoho-image" style={{ width: width || "100%" }}>
          {src ? <img src={src} alt={alt || ""} loading="lazy" style={{ borderRadius: radius || "0.75rem" }} /> : <div className="hoho-image__empty">Add an image URL in the inspector</div>}
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      ),
    },
    Quote: {
      label: "Quote",
      fields: {
        quote: { type: "textarea", label: "Quote" },
        author: { type: "text", label: "Author" },
        role: { type: "text", label: "Role / context" },
      },
      defaultProps: { quote: "Good design makes complex things feel simple.", author: "Your name", role: "Customer / team member" },
      render: ({ quote, author, role }: any) => <blockquote className="hoho-quote"><p>“{quote}”</p><footer><strong>{author}</strong>{role ? <span>{role}</span> : null}</footer></blockquote>,
    },
    Spacer: {
      label: "Spacer",
      fields: { height: { type: "number", label: "Height (px)", min: 0, max: 320 } },
      defaultProps: { height: 32 },
      render: ({ height }: any) => <div aria-hidden="true" style={{ height: `${Math.max(0, Math.min(320, Number(height) || 0))}px` }} />,
    },
    Divider: {
      label: "Divider",
      fields: {
        color: { type: "text", label: "Color" },
        style: { type: "select", label: "Style", options: [{ label: "Solid", value: "solid" }, { label: "Dashed", value: "dashed" }, { label: "Dotted", value: "dotted" }] },
      },
      defaultProps: { color: "#30394d", style: "solid" },
      render: ({ color, style }: any) => <hr className="hoho-divider" style={{ borderTopColor: color || "#30394d", borderTopStyle: style || "solid" }} />,
    },
  },
};


const animationOptions = [
  { label: "No animation", value: "none" },
  { label: "Fade in", value: "fade-in" },
  { label: "Fade up", value: "fade-up" },
  { label: "Slide from left", value: "slide-left" },
  { label: "Slide from right", value: "slide-right" },
  { label: "Zoom in", value: "zoom-in" },
  { label: "Float", value: "float" },
  { label: "Soft pulse", value: "pulse" },
];
const animationDurationOptions = [
  { label: "Fast · 300ms", value: "300ms" },
  { label: "Normal · 600ms", value: "600ms" },
  { label: "Slow · 900ms", value: "900ms" },
  { label: "Very slow · 1200ms", value: "1200ms" },
];
const animationDelayOptions = [
  { label: "None", value: "0ms" },
  { label: "100ms", value: "100ms" },
  { label: "200ms", value: "200ms" },
  { label: "400ms", value: "400ms" },
  { label: "600ms", value: "600ms" },
];

// Expose motion controls consistently on every visual block. The animation
// metadata is attached to the rendered element itself so slots remain intact.
Object.values(designConfig.components).forEach((component: any) => {
  const originalRender = component.render;
  component.fields = {
    ...component.fields,
    animation: { type: "select", label: "Entrance animation", options: animationOptions },
    animationDuration: { type: "select", label: "Animation duration", options: animationDurationOptions },
    animationDelay: { type: "select", label: "Animation delay", options: animationDelayOptions },
  };
  component.render = (props: any) => {
    const element = originalRender(props);
    if (!React.isValidElement(element)) return element;
    const animation = animationOptions.some((option) => option.value === props.animation) ? props.animation : "none";
    const duration = animationDurationOptions.some((option) => option.value === props.animationDuration) ? props.animationDuration : "600ms";
    const delay = animationDelayOptions.some((option) => option.value === props.animationDelay) ? props.animationDelay : "0ms";
    const style = {
      ...((element.props as { style?: CSSProperties }).style || {}),
      "--hoho-motion-duration": duration,
      "--hoho-motion-delay": delay,
    } as CSSProperties;
    return React.cloneElement(element as React.ReactElement<any>, {
      "data-hoho-animation": animation,
      style,
    });
  };
});

export const initialDesignData: any = {
  content: [
    {
      type: "Hero",
      props: {
        id: "starter-hero",
        eyebrow: "HOHO MANAGER",
        title: "Your Discord workspace. Built around your workflow.",
        subtitle: "Create webhook messages, design rich embeds, build Components V2 layouts, and manage interaction flows from one focused workspace.",
        buttonLabel: "Explore the workspace",
        buttonUrl: "#components",
        align: "center",
        background: "#161a23",
        textColor: "#f1f3f9",
        padding: "6rem",
      },
    },
    {
      type: "Section",
      props: {
        id: "starter-section",
        background: "transparent",
        padding: "4rem",
        content: [
          { type: "Heading", props: { id: "starter-heading", text: "Everything you need to build better Discord messages", level: "h2", align: "center", color: "#f1f3f9" } },
          { type: "Text", props: { id: "starter-copy", text: "Start with the HoHo Manager visual language, then customize every section, color, type scale, card, button, spacing value, and animation without rebuilding the design from scratch.", size: "1rem", align: "center", color: "#a1a8b8" } },
          {
            type: "Grid",
            props: {
              id: "starter-grid",
              columns: "3",
              gap: "1.25rem",
              content: [
                { type: "FeatureCard", props: { id: "starter-card-1", icon: "◈", title: "Message Studio", description: "Compose webhook messages, embeds, and rich Components V2 layouts.", accent: "#818cf8" } },
                { type: "FeatureCard", props: { id: "starter-card-2", icon: "⌘", title: "Live Preview", description: "Inspect your content as you edit and refine layouts for every screen size.", accent: "#34d399" } },
                { type: "FeatureCard", props: { id: "starter-card-3", icon: "↗", title: "Interaction Builder", description: "Shape buttons, select menus, and interaction flows in one connected workflow.", accent: "#fbbf24" } },
              ],
            },
          },
        ],
      },
    },
  ],
  root: { props: { title: "HoHo Manager — Current Theme", background: "#0b0d12", contentWidth: "1120px", textColor: "#f1f3f9", accentColor: "#818cf8", surfaceColor: "#1d2230", fontFamily: "Inter", radius: "10px" } },
};
