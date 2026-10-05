import { OnboardingProductRoute } from "@/features/onboarding/OnboardingProductRoute";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const query = await searchParams;
  return <OnboardingProductRoute workspaceSlug={query.workspace} />;
}
