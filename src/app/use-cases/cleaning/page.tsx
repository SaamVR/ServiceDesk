import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("cleaning");

export default function CleaningUseCasePage() {
  return <StaticProductPage kind="cleaning" />;
}
