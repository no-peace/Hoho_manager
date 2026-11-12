const SITE = "https://hoho-manager.onrender.com";
const DESCRIPTION = "Visual Discord Bot Message, Embed, Components V2, and Dynamic Placeholder Studio for HoHo Hub.";

export interface PageSeoOptions {
  title: string;
  description: string;
  path: string;
  schemaType?: "SoftwareApplication" | "TechArticle";
}

export const updatePageSeo = ({ title, description, path, schemaType = "SoftwareApplication" }: PageSeoOptions): void => {
  if (typeof document === "undefined") return;
  document.title = title;
  const setMeta = (selector: string, attribute: "name" | "property", key: string, content: string) => {
    let element = document.querySelector<HTMLMetaElement>(selector);
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }
    element.content = content;
  };
  setMeta('meta[name="description"]', "name", "description", description);
  const canonicalUrl = `${SITE}${path}`;
  let canonical = document.querySelector<HTMLLinkElement>("#canonical-link");
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.id = "canonical-link";
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;
  setMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
  setMeta('meta[property="og:title"]', "property", "og:title", title);
  setMeta('meta[property="og:description"]', "property", "og:description", description);
  const application = {
    "@type": ["SoftwareApplication", "WebApplication"],
    name: "HoHo Manager",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  const graph = schemaType === "TechArticle"
    ? [{ "@type": "WebSite", name: "HoHo Manager", url: SITE + "/" }, application, { "@type": "TechArticle", headline: title, description, url: canonicalUrl, mainEntityOfPage: canonicalUrl }]
    : [{ "@type": "WebSite", name: "HoHo Manager", url: SITE + "/" }, application];
  let schema = document.querySelector<HTMLScriptElement>("#schema-jsonld");
  if (!schema) {
    schema = document.createElement("script");
    schema.id = "schema-jsonld";
    schema.type = "application/ld+json";
    document.head.appendChild(schema);
  }
  schema.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
};