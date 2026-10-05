import { CrewRouteUnavailable } from "@/features/crew/CrewRouteUnavailable";

export default async function CrewJobPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <CrewRouteUnavailable page="job" />;
}
