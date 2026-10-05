export type BusinessModule = "home" | "enquire" | "book";

export const businessModuleConfig: Record<
  BusinessModule,
  {
    label: string;
    description: string;
  }
> = {
  home: {
    label: "Services",
    description: "Available services and how to get started.",
  },
  enquire: {
    label: "Enquire",
    description: "Tell the business what service you need.",
  },
  book: {
    label: "Book",
    description: "Continue booking from an accepted quote.",
  },
};

export const businessNavigation: Array<{
  module: BusinessModule;
  label: string;
}> = [
  { module: "home", label: "Services" },
  { module: "enquire", label: "Enquire" },
  { module: "book", label: "Book" },
];

export function buildBusinessModuleHref(slug: string, module: BusinessModule) {
  const encodedSlug = encodeURIComponent(slug);
  if (module === "home") return `/b/${encodedSlug}`;
  return `/b/${encodedSlug}/${module}`;
}
