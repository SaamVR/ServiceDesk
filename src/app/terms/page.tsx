import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("terms");

export default function TermsPage() {
  return <StaticProductPage kind="terms" />;
}
