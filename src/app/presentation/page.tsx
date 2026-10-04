import { PresentationSlidesPreview } from "@/features/product/ProductSections";

export default function PresentationPage() {
  return (
    <main className="site-shell">
      <header className="site-header" aria-label="Presentation navigation">
        <a className="brand-lockup" href="/">
          <span className="brand-mark" aria-hidden="true">SD</span>
          <span>ServiceDesk AI presentation</span>
        </a>
        <nav className="site-nav" aria-label="Presentation links">
          <a href="#slide-1">Start</a>
          <a href="/tour">Tour</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <PresentationSlidesPreview />
    </main>
  );
}
