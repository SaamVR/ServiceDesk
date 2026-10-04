import { OperationalRoute } from "@/features/operations/OperationalRoute";
import { TourScenarioList } from "@/features/product/ProductSections";

export default function TourPage() {
  return (
    <>
      <OperationalRoute
        surface="tour"
        workspaceLabel="ServiceDesk tour"
        title="Controlled tour in an isolated showcase workspace."
        description="The tour uses seeded sample records and labels synthetic history. Real-send mode requires a consenting recipient and Chat 2 provider verification."
      />
      <main className="site-shell">
        <TourScenarioList />
      </main>
    </>
  );
}
