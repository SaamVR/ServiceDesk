import { cleaningRequestNextSteps, type CleaningRequestNextStepsInput } from "./cleaning-request-next-steps";

/** Request readiness is computed from saved staff-visible facts, never a model suggestion. */
export function CleaningRequestNextSteps({ input }: { input: CleaningRequestNextStepsInput }) {
  const summary = cleaningRequestNextSteps(input);
  return (
    <section aria-label="Cleaning request next steps" className="app-panel">
      <h3>Request-to-quote checklist</h3>
      <p>{summary.complete} of {summary.steps.length} recorded requirements verified.</p>
      <ol>
        {summary.steps.map(step => (
          <li key={step.id}>
            <strong>{step.label}: {step.state.replaceAll("_", " ").toLowerCase()}</strong>
            <p>{step.detail}</p>
          </li>
        ))}
      </ol>
      <p role="status">
        {summary.quoteReady
          ? "Staff may request a server-validated quote. No price or slot is promised yet."
          : "Resolve unverified details before relying on any quotation."}
      </p>
      <small>Saved facts only; no automatic message, payment, model request or booking.</small>
    </section>
  );
}
