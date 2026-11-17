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
    },
    defaultProps: {
      title: "Untitled design",
      background: "#0b0d12",
      contentWidth: "1120px",
    },
    render: ({ children, background, contentWidth }: { children: ReactNode; background?: string; contentWidth?: string }) => (
      <main className="hoho-design-page" style={{ background: background || "#0b0d12" }}>
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
        background: "#151927",
        textColor: "#f8fafc",
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
      },
      defaultProps: { text: "Your heading goes here", level: "h2", align: "left", color: "#f8fafc" },
      render: ({ text, level, align, color }: any) => {
        const Tag = (["h1", "h2", "h3", "h4"].includes(level) ? level : "h2") as keyof JSX.IntrinsicElements;
        return <Tag className={`hoho-heading hoho-heading--${level || "h2"}`} style={textStyle(color, align)}>{text}</Tag>;
      },
    },
    Text: {
      label: "Text",
      fields: {
        text: { type: "textarea", label: "Paragraph" },
        size: { type: "select", label: "Text size", options: [{ label: "Small", value: "0.875rem" }, { label: "Normal", value: "1rem" }, { label: "Large", value: "1.125rem" }, { label: "Lead", value: "1.25rem" }] },
        align: { type: "radio", label: "Alignment", options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }] },
        color: { type: "text", label: "Text color" },
      },
      defaultProps: { text: "Add a paragraph to explain your idea. Keep it concise, readable, and focused on one message.", size: "1rem", align: "left", color: "#aeb8ca" },
      render: ({ text, size, align, color }: any) => <p className="hoho-text" style={{ ...textStyle(color, align), fontSize: size || "1rem" }}>{text}</p>,
    },
    Button: {
      label: "Button",
      fields: {
        label: { type: "text", label: "Label" },
        url: { type: "text", label: "URL" },
        variant: { type: "select", label: "Style", options: [{ label: "Primary", value: "primary" }, { label: "Secondary", value: "secondary" }, { label: "Outline", value: "outline" }, { label: "Ghost", value: "ghost" }] },
        size: { type: "radio", label: "Size", options: [{ label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }] },
      },
      defaultProps: { label: "Learn more", url: "#", variant: "primary", size: "medium" },
      render: ({ label, url, variant, size }: any) => <a className={`hoho-button hoho-button--${variant || "primary"} hoho-button--${size || "medium"}`} href={safeHref(url)}>{label}</a>,
    },
    FeatureCard: {
      label: "Feature card",
      fields: {
        icon: { type: "text", label: "Icon / emoji" },
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        accent: { type: "text", label: "Accent color" },
      },
      defaultProps: { icon: "✦", title: "Feature title", description: "Describe the value this feature provides in one or two sentences.", accent: "#818cf8" },
      render: ({ icon, title, description, accent }: any) => (
        <article className="hoho-feature-card" style={{ borderColor: `${accent || "#818cf8"}55` }}>
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

export const initialDesignData: any = {
  content: [
    {
      type: "Hero",
      props: {
        id: "starter-hero",
        eyebrow: "HOHO DESIGN LAB",
        title: "Design with freedom. Build with confidence.",
        subtitle: "A visual playground for landing pages, product sections, portfolios, and polished UI concepts.",
        buttonLabel: "Explore components",
        buttonUrl: "#components",
        align: "center",
        background: "#151927",
        textColor: "#f8fafc",
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
          { type: "Heading", props: { id: "starter-heading", text: "A component library to start from", level: "h2", align: "center", color: "#f8fafc" } },
          { type: "Text", props: { id: "starter-copy", text: "Drag blocks from the left panel, select them to edit their fields, and use the viewport controls to check desktop, tablet, and mobile layouts.", size: "1rem", align: "center", color: "#aeb8ca" } },
          {
            type: "Grid",
            props: {
              id: "starter-grid",
              columns: "3",
              gap: "1.25rem",
              content: [
                { type: "FeatureCard", props: { id: "starter-card-1", icon: "◈", title: "Reusable blocks", description: "Build layouts from sections, containers, grids, cards, and typography.", accent: "#818cf8" } },
                { type: "FeatureCard", props: { id: "starter-card-2", icon: "⌘", title: "Responsive canvas", description: "Switch viewport sizes while designing and refine every breakpoint.", accent: "#34d399" } },
                { type: "FeatureCard", props: { id: "starter-card-3", icon: "↗", title: "Portable designs", description: "Save drafts in this browser and export or import Puck JSON files.", accent: "#fbbf24" } },
              ],
            },
          },
        ],
      },
    },
  ],
  root: { props: { title: "HoHo Design Lab starter", background: "#0b0d12", contentWidth: "1120px" } },
};
