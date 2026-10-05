import { BusinessProductRoute } from "@/features/operations/BusinessProductRoute";

export default async function BusinessEnquirePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BusinessProductRoute slug={slug} module="enquire" />;
}
