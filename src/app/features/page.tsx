import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("features");

export default function FeaturesPage() {
  return <StaticProductPage kind="features" />;
}
