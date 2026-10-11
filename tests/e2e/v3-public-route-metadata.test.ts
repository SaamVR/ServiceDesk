import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";
import { publicProductPageCopy } from "@/features/product/StaticProductPage";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("V3 public route search and share metadata", () => {
  const pages = ["features", "pricing", "integrations", "contact"] as const;

  it("serves unique metadata grounded in each public page's actual editorial source", () => {
    const titles = new Set<string>();
    for (const kind of pages) {
      const copy = publicProductPageCopy[kind];
      const metadata = publicProductPageMetadata(kind);
      expect(metadata.title).toBe(copy.title);
      expect(metadata.description).toBe(copy.description);
      expect(metadata.openGraph).toMatchObject({
        type: "website", title: copy.title, description: copy.description,
      });
      expect(metadata.twitter).toMatchObject({
        card: "summary", title: copy.title, description: copy.description,
      });
      titles.add(copy.title);
      const route = source("src/app/" + kind + "/page.tsx");
      expect(route).toContain('export const metadata = publicProductPageMetadata("' + kind + '")');
    }
    expect(titles.size).toBe(4);
  });

  it("makes quote-vs-subscription and provider verification boundaries visible to search", () => {
    const pricing = publicProductPageMetadata("pricing");
    const integrations = publicProductPageMetadata("integrations");
    expect(String(pricing.title)).toContain("Service quote");
    expect(String(pricing.description)).toContain("not ServiceDesk subscription plan prices");
    expect(String(integrations.description)).toContain("sandbox and verification states");
    expect(String(integrations.description)).not.toContain("fully connected");
    const contact = publicProductPageMetadata("contact");
    expect(String(contact.description)).toContain("before deciding what to configure for launch");
  });

  it("defaults to no indexing before explicit publication authorization", () => {
    const root = source("src/app/layout.tsx");
    expect(root).toContain('process.env.SERVICEDESK_PUBLIC_INDEXING_ENABLED === "true"');
    expect(root).toContain("index: publicIndexingEnabled");
    expect(root).toContain("follow: publicIndexingEnabled");
    expect(root).toContain('template: "%s | ServiceDesk AI"');
    expect(root).toContain('default: "ServiceDesk AI | Cleaning Operations Workspace"');
  });

  it("does not invent deployment URLs, canonical addresses, price plans or social images", () => {
    const helper = source("src/features/product/public-page-metadata.ts");
    const metadata = publicProductPageMetadata("pricing");
    expect(helper).not.toContain("https://");
    expect(helper).not.toContain("metadataBase");
    expect(metadata).not.toHaveProperty("alternates.canonical");
    expect(metadata).not.toHaveProperty("openGraph.url");
    expect(metadata).not.toHaveProperty("openGraph.images");
    expect(metadata).not.toHaveProperty("robots.index", true);
  });
});
