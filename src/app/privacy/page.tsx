import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("privacy");

export default function PrivacyPage() {
  return <StaticProductPage kind="privacy" />;
}
