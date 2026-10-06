import { CrewTodayV2 } from "@/features/crew/CrewFieldAppV2";
import { CrewRouteUnavailable } from "@/features/crew/CrewRouteUnavailable";
import { loadCrewTodayProduct } from "@/features/crew/crew-product-runtime";

export default async function CrewTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const query = await searchParams;
  const now = new Date().toISOString();
  const result = await loadCrewTodayProduct(now, query.workspace);

  if (!result.ok) {
    const returnPath = query.workspace
      ? "/crew/today?workspace=" + encodeURIComponent(query.workspace)
      : "/crew/today";
    return (
      <CrewRouteUnavailable
        page="today"
        message={result.message}
        signInHref={
          result.kind === "authentication"
            ? "/auth/sign-in?next=" + encodeURIComponent(returnPath)
            : undefined
        }
      />
    );
  }

  return (
    <main className="app-content" aria-label="Crew today">
      <CrewTodayV2 jobs={result.value.jobs} now={now} />
    </main>
  );
}
