import { OperationalRoute } from "@/features/operations/OperationalRoute";

export default async function BusinessEnquirePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <OperationalRoute
      surface="business"
      businessModule="enquire"
      businessSlug={slug}
      resourceLabel={`${slug} enquiry`}
      title="Ask questions and build the request summary in one place."
      description="Desktop enquiry uses the required 60/40 conversation and structured summary pattern; mobile collapses into stacked sections until tab behavior is integrated."
    />
  );
}
