import { CrewFieldError, CrewJobDetailV2 } from "@/features/crew/CrewFieldAppV2";
import { loadCrewJob } from "@/features/crew/crew-product-runtime";

export default async function CrewJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const result = await loadCrewJob(id, query.workspace);

  if (!result.ok) {
    return (
      <CrewFieldError
        title={
          result.kind === "authentication"
            ? "Crew sign-in required"
            : result.kind === "not_found"
              ? "Job not available"
              : "Crew job unavailable"
        }
        message={result.message}
      />
    );
  }

  return (
    <CrewJobDetailV2
      job={result.value.job}
      timeZone={result.value.workspace.timeZone}
      workspaceName={result.value.workspace.name}
    />
  );
}
