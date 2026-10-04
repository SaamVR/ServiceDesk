import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";

export default async function BusinessBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <OperationalFixtureRoute
      surface="business"
      businessModule="book"
      businessSlug={slug}
      resourceLabel={`${slug} booking`}
      title="Select a fresh slot before checkout."
      description="Booking UI separates slot hold, provider checkout mode, payment status and confirmed visit state so a test payment never looks like a live receipt."
    />
  );
}
