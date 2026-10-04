export type CrewModule = "today" | "job";

export const crewModuleConfig: Record<
  CrewModule,
  {
    label: string;
    description: string;
  }
> = {
  today: {
    label: "Today",
    description: "Assigned visits, next start and field-work status.",
  },
  job: {
    label: "Job detail",
    description: "Checklist, evidence, time notes, incidents and completion review.",
  },
};

export const crewNavigation: Array<{
  module: CrewModule;
  label: string;
}> = [
  { module: "today", label: "Today" },
  { module: "job", label: "Job detail" },
];

export function buildCrewModuleHref(module: CrewModule, visitId = "visit_showcase_001") {
  if (module === "today") return "/crew/today";
  return `/crew/jobs/${encodeURIComponent(visitId)}`;
}
