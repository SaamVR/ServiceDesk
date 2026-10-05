import { CrewFieldAppV2 as _Unused } from "@/features/crew/CrewFieldAppV2";
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
    return <CrewRouteUnavailable page="today" message={result.message} />;
  }

  return (
    <main className="app-content" aria-label="Crew today">
      <CrewTodayV2 jobs={result.value.jobs} now={now} />
    </main>
  );
}
