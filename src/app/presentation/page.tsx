import { PresentationSlidesPreview } from "@/features/product/ProductSections";
import { presentationSlides } from "@/features/product/story-model";

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

      <section className="section-card" aria-labelledby="presentation-index-heading">
        <div className="section-heading compact">
          <p className="eyebrow">Presentation index</p>
          <h1 id="presentation-index-heading">Ten-slide product story with routed proof links.</h1>
          <p className="lead">
            Use the slide links below for keyboard-friendly navigation. Each slide opens a tour step or
            a clearly marked proof boundary; no provider evidence is claimed from fixture data.
          </p>
        </div>
        <nav className="slide-index" aria-label="Slide index">
          {presentationSlides.map((slide) => (
            <a href={`#slide-${slide.order}`} key={slide.order}>
              <span>{slide.order}</span>
              {slide.title}
            </a>
          ))}
        </nav>
      </section>

      <PresentationSlidesPreview />
    </main>
  );
}
