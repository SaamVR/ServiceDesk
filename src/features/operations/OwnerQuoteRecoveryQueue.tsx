import { readOwnerQuoteRecoverySummary } from "@/server/workflows/owner-quote-recovery-queue";

/** Owner-only read-only queue evidence; no worker action or mutation. */
export async function OwnerQuoteRecoveryQueue({ workspaceSlug }: { workspaceSlug: string }) {
  const proof = await readOwnerQuoteRecoverySummary(workspaceSlug);
  if (proof.state === "OWNER_REQUIRED") return null;
  return (
    <section aria-label="Saved accepted quote source recovery" className="app-panel"
      style={{ background: "#fff", border: "1px solid #d8e9e4",
        borderRadius: 14, padding: 20, marginBlock: 15 }}>
      <p style={{ margin: 0, color: "#2b7467", fontSize: ".73rem",
        fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>
        Internal queue evidence · read only
      </p>
      <h3 style={{ color: "#184e46", margin: ".5rem 0" }}>
        Saved quote-acceptance recovery
      </h3>
      {proof.state !== "AVAILABLE" ? (
        <p role="status" style={{ color: "#715d44", lineHeight: 1.6 }}>
          Queue data is unavailable or migration 0063 is not yet installed.
          This is <strong>not</strong> evidence of an empty queue or an active worker.
        </p>
      ) : (
        <>
          <dl style={{ display: "grid", gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
            {([
              ["PENDING", "Queued"],
              ["PROCESSING", "Leased"],
              ["RETRY_PENDING", "Retry pending"],
              ["DEAD_LETTER", "Needs review"],
              ["SUCCEEDED", "Completed"],
              ["SKIPPED", "Skipped"],
            ] as const).map(([state, label]) => (
              <div key={state} style={{ border: "1px solid #e2eeea",
                borderRadius: 12, padding: "12px 14px", minWidth: 0 }}>
                <dt style={{ color: "#557369", fontSize: ".76rem" }}>{label}</dt>
                <dd style={{ margin: "5px 0 0", color: "#184e46",
                  fontSize: "1.4rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {proof.counts[state]}
                </dd>
              </div>
            ))}
          </dl>
          <div aria-label="Internal recovery backlog" style={{
            display: "grid", gap: 12, marginTop: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}>
            <p role="status" style={{ margin: 0, padding: 12,
              border: "1px solid #e2eeea", borderRadius: 12 }}>
              <strong>{proof.health.dueNow}</strong> due now
              <span style={{ display: "block", fontSize: ".78rem" }}>
                Pending or retry-ready event count; a running worker is not verified.
              </span>
            </p>
            <p role={proof.health.expiredLeases > 0 ? "alert" : "status"}
              style={{ margin: 0, padding: 12, border: "1px solid #e2eeea",
                borderRadius: 12 }}>
              <strong>{proof.health.expiredLeases}</strong> expired leases
              <span style={{ display: "block", fontSize: ".78rem" }}>
                These claims may need reviewed retry or investigation.
              </span>
            </p>
          </div>
          <p style={{ color: "#557369", fontSize: ".8rem", lineHeight: 1.6 }}>
            Counts come from saved, tenant-scoped internal source records only.
            Completed events do not prove a customer message, external provider
            delivery, payment, or automatic scheduler execution.
          </p>
        </>
      )}
    </section>
  );
}
