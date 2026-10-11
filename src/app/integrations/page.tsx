import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("integrations");

export default function IntegrationsPage() {
  return <StaticProductPage kind="integrations" />;
}
