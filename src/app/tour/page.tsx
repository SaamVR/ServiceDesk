import { OperationalFixtureRoute } from "@/features/operations/OperationalFixtureRoute";
import { TourScenarioList } from "@/features/product/ProductSections";

export default function TourPage() {
  return (
    <>
      <OperationalFixtureRoute
        surface="tour"
        workspaceLabel="ServiceDesk tour"
        title="Controlled tour in an isolated showcase workspace."
        description="The tour uses explicit fixture route data and labels synthetic history. Real-send mode requires a consenting recipient and provider verification."
      />
      <div className="site-shell">
        <section className="section-card" aria-label="Try the interactive sandbox">
          <p className="eyebrow">NEW · SELF-GUIDED TEST WORKSPACE</p>
          <h2>Try the entire job lifecycle yourself.</h2>
          <p>Click through a sample quote, deposit, crew assignment, completion and payment. Inject a mock delivery failure and retry without real credentials or customer records.</p>
          <p><strong>Local simulation only:</strong> Nothing is saved or sent to an external provider.</p>
          <a className="button-primary" href="/sandbox">Open interactive sandbox →</a>
        </section>
        <TourScenarioList />
      </div>
    </>
  );
}
