import { SandboxCheckoutProductRoute } from "@/features/operations/SandboxCheckoutProductRoute";

export default async function PortalSandboxCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return <SandboxCheckoutProductRoute sessionId={id} notice={query.notice} error={query.error} />;
}
