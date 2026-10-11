import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("help");

export default function HelpPage() {
  return <StaticProductPage kind="help" />;
}
