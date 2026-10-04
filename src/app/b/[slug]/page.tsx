import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function BusinessSitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <OperationalFixtureRoute
      surface="business"
      businessModule="home"
      businessSlug={slug}
      workspaceLabel="BrightRoom Services"
      resourceLabel={slug}
      title="Book a cleaning service with a clear request record."
      description="The business site presents services, areas, FAQs, process and contact while the enquiry keeps conversation and structured request summary together."
    />
  );
}
