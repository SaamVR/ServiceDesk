import type { Metadata } from "next";
import { publicProductPageCopy, type StaticProductPageKind } from "./StaticProductPage";

/**
 * The same editorial copy powers the screen heading and search/share preview.
 * Do not invent a canonical origin, vendor connection, subscription price, or
 * deployed environment URL while V3 staging and owner approval are blocked.
 */
export function publicProductPageMetadata(kind: StaticProductPageKind): Metadata {
  const { title, description } = publicProductPageCopy[kind];
  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
