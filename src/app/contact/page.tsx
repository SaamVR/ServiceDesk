import { StaticProductPage } from "@/features/product/StaticProductPage";
import { publicProductPageMetadata } from "@/features/product/public-page-metadata";

export const metadata = publicProductPageMetadata("contact");

export default function ContactPage() {
  return <StaticProductPage kind="contact" />;
}
