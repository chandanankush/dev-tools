import type { ToolMeta } from "@/lib/tools.config";

export interface ToolJsonLd {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: "DeveloperApplication";
  operatingSystem: "Web";
  offers: { "@type": "Offer"; price: "0"; priceCurrency: "USD" };
  description: string;
  url: string;
}

export function buildToolJsonLd(
  tool: Pick<ToolMeta, "title" | "description">,
  url: string
): ToolJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.title,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: tool.description,
    url,
  };
}

// JSON.stringify does not escape `<`, so a description containing `</script>`
// would terminate the script tag early and allow HTML injection. Unicode-escape
// `<` before writing to dangerouslySetInnerHTML.
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
