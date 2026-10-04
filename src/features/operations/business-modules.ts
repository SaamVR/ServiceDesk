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
    description: "Public service story, areas, process and FAQs.",
  },
  enquire: {
    label: "Enquire",
    description: "Conversation plus editable request summary.",
  },
  book: {
    label: "Book",
    description: "Fresh slot, hold, checkout mode and visit confirmation boundary.",
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
