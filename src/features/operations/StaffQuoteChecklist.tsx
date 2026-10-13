import {
  buildStaffQuoteChecklist,
  type StaffQuoteChecklistFacts,
} from "./staff-quote-checklist";

/** Local, evidence-aware companion to the optional paid AI quote review. */
export function StaffQuoteChecklist({
  quote, loadedAt,
}: { quote: StaffQuoteChecklistFacts; loadedAt: string }) {
  const check = buildStaffQuoteChecklist(quote, loadedAt);
  return (
    <section aria-label="Saved quote staff preflight"
      style={{ marginTop: 12, padding: 16, background: "#f7fbf9",
        border: "1px solid #d5e8e2", borderRadius: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10,
        alignItems: "baseline", justifyContent: "space-between" }}>
        <strong>Quote preflight · saved evidence</strong>
        <span style={{ fontSize: ".8rem", fontWeight: 600,
          color: check.readyForHumanReview ? "#226a54" : "#95520d" }}>
          {check.readyForHumanReview ? "Ready for human review" : "Review required"}
        </span>
      </div>
      <p style={{ fontSize: ".82rem", marginBlock: "6px 12px", lineHeight: 1.6 }}>
        These checks use only this saved quote. No AI provider, customer contact,
        external message or payment is triggered.
      </p>
      <ul style={{ display: "grid", gap: 9, margin: 0, paddingLeft: 20 }}>
        {check.items.map(item => (
          <li key={item.key} style={{ fontSize: ".84rem", lineHeight: 1.55 }}>
            <strong>{item.state === "PASS" ? "Verified" :
              item.state === "MANUAL" ? "Staff check" : "Needs review"}:</strong>
            {" "}{item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
