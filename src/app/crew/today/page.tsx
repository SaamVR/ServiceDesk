import { CrewFieldError, CrewTodayV2 } from "@/features/crew/CrewFieldAppV2";
import { loadCrewToday } from "@/features/crew/crew-product-runtime";

export default async function CrewTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const query = await searchParams;
  const now = new Date().toISOString();
  const result = await loadCrewToday(query.workspace, now);

  if (!result.ok) {
    return (
      <CrewFieldError
        title={result.kind === "authentication" ? "Crew sign-in required" : "Crew workspace unavailable"}
        message={result.message}
      />
    );
  }

  return (
    <CrewTodayV2
      jobs={result.value.jobs}
      now={now}
      timeZone={result.value.workspace.timeZone}
      workspaceSlug={result.value.workspace.slug}
      workspaceName={result.value.workspace.name}
    />
  );
}
