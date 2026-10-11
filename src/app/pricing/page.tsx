import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("pricing");

export default function PricingPage() {
  return <StaticProductPage kind="pricing" />;
}
