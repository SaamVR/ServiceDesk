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
        <TourScenarioList />
      </div>
    </>
  );
}
