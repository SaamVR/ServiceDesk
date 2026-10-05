import { BusinessProductRoute } from "@/features/operations/BusinessProductRoute";

export default async function BusinessEnquirePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  return (
    <BusinessProductRoute
      slug={slug}
      module="enquire"
      notice={query.notice}
      error={query.error}
    />
  );
}
