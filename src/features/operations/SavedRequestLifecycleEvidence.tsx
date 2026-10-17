import type { OperationalStaffSnapshot, OperationalRequest } from "./operational-product-runtime";
import { summarizeSavedRequestLifecycle } from "./saved-request-lifecycle";

export function SavedRequestLifecycleEvidence({ request, data, workspaceSlug }: {
  request: OperationalRequest;
  data: Pick<OperationalStaffSnapshot, "quotes" | "visits" | "invoices">;
  workspaceSlug: string;
}) {
  const summary = summarizeSavedRequestLifecycle({
    request, quotes: data.quotes, visits: data.visits, invoices: data.invoices,
  });
  const query: Record<string, string> = {
    requests: "request", quotes: "quote", jobs: "job", invoices: "invoice",
  };
  return (
    <section aria-labelledby="saved-request-lifecycle-title"
      style={{ border: "1px solid #d5e8e1", background: "#fff", borderRadius: 16, padding: 18,
        display: "grid", gap: 12 }}>
      <div>
        <p style={{ fontSize: ".72rem", color: "#36655a", margin: 0, fontWeight: 700 }}>
          Persisted evidence · current selected request
        </p>
        <h3 id="saved-request-lifecycle-title" style={{ margin: "5px 0 0", fontSize: "1.12rem" }}>
          Customer journey and next handoffs
        </h3>
      </div>
      <ol style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 10, listStyle: "none", padding: 0, margin: 0 }}>
        {summary.steps.map((step, i) => (
          <li key={step.id} style={{ display: "grid", alignContent: "start", gap: 8,
            border: "1px solid #dcebe5", borderRadius: 12, padding: 13, minWidth: 0 }}>
            <span style={{ fontSize: ".7rem", fontWeight: 750, color: "#406e62" }}>
              {String(i+1).padStart(2,"0")} · {step.status.replaceAll("_", " ")}
            </span>
            <strong style={{ fontSize: ".88rem" }}>{step.label}</strong>
            <p style={{ margin: 0, fontSize: ".78rem", lineHeight: 1.55 }}>{step.detail}</p>
            <a className="app-button-secondary" style={{ marginTop: "auto", textAlign: "center" }}
              href={"/app/" + encodeURIComponent(workspaceSlug) + "/" + step.module +
                (step.recordId ? "?" + query[step.module] + "=" + encodeURIComponent(step.recordId) : "")}>
              {step.recordId ? "Open saved record" : "Review " + step.module}
            </a>
          </li>
        ))}
      </ol>
      <p role="note" style={{ fontSize: ".72rem", color: "#526c63", margin: 0, lineHeight: 1.6 }}>
        {summary.disclosure}
      </p>
    </section>
  );
}
