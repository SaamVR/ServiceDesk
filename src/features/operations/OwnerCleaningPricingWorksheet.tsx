"use client";

import { useEffect, useRef, useState } from "react";
import type { QuoteServiceCode } from "@/domain/quote";
import {
  evaluateOwnerPricingWorksheet,
  type OwnerPricingWorksheetResult,
} from "./owner-cleaning-pricing-worksheet";

const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

/**
 * This observes the neighboring owner-controlled pricing fields but never
 * submits a preview request or modifies the real form's payload.
 * The only inputs here deliberately have no names (no persistence).
 */
export function OwnerCleaningPricingWorksheet() {
  const root = useRef<HTMLDivElement>(null);
  const [service, setService] = useState<QuoteServiceCode>("STANDARD");
  const [bedrooms, setBedrooms] = useState(0);
  const [bathrooms, setBathrooms] = useState(0);
  const [oven, setOven] = useState(false);
  const [result, setResult] = useState<OwnerPricingWorksheetResult>({
    state: "INCOMPLETE",
    detail: "Enter your actual cleaning rates and policies above to calculate a local worksheet.",
  });

  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const recalculate = () => {
      setResult(evaluateOwnerPricingWorksheet(new FormData(form), {
        service, bedrooms, bathrooms, oven,
      }));
    };
    form.addEventListener("input", recalculate);
    form.addEventListener("change", recalculate);
    recalculate();
    return () => {
      form.removeEventListener("input", recalculate);
      form.removeEventListener("change", recalculate);
    };
  }, [service, bedrooms, bathrooms, oven]);

  const field = { display: "grid", gap: 6, fontSize: ".84rem" } as const;
  const inputStyle = { minWidth: 0, width: "100%" } as const;
  return (
    <div ref={root} aria-label="Unsaved cleaning price worksheet"
      style={{ border: "1px solid #b4d9cf", background: "#f6fcfa",
        padding: 18, borderRadius: 14, display: "grid", gap: 14 }}>
      <div>
        <strong style={{ color: "#164f45" }}>Check your prices before saving</strong>
        <p style={{ margin: "5px 0 0", fontSize: ".83rem", lineHeight: 1.55 }}>
          Unsaved worksheet using the same calculation rules as the quote engine.
          Choose a room scenario; these counts are not submitted and no
          customer quote, rate card, payment or message is created.
        </p>
      </div>
      <div style={{ display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 12 }}>
        <label style={field}>
          Service
          <select className="app-input" value={service}
            onChange={event => setService(event.target.value as QuoteServiceCode)}
            style={inputStyle}>
            <option value="STANDARD">Standard cleaning</option>
            <option value="DEEP">Deep cleaning</option>
            <option value="MOVE_OUT">Move-out cleaning</option>
          </select>
        </label>
        <label style={field}>
          Bedrooms
          <input className="app-input" type="number" inputMode="numeric"
            min={0} max={10} step={1} value={bedrooms}
            onChange={event => setBedrooms(Number(event.target.value))}
            style={inputStyle} />
        </label>
        <label style={field}>
          Bathrooms
          <input className="app-input" type="number" inputMode="numeric"
            min={0} max={10} step={1} value={bathrooms}
            onChange={event => setBathrooms(Number(event.target.value))}
            style={inputStyle} />
        </label>
        {service === "MOVE_OUT" ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center",
            alignSelf: "end", minHeight: 43, fontSize: ".84rem" }}>
            <input type="checkbox" checked={oven}
              onChange={event => setOven(event.target.checked)} />
            Include oven add-on
          </label>
        ) : null}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {result.state === "INCOMPLETE" ? (
          <p role="status" style={{ margin: 0, color: "#755b32", fontSize: ".84rem" }}>
            {result.detail}
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))", gap: 12 }}>
              {[
                ["Calculated total", money(result.value.subtotalMinor)],
                ["Calculated deposit", money(result.value.depositMinor)],
                ["Balance", money(result.value.balanceMinor)],
                ["Service time", result.value.durationMinutes + " min"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "grid", gap: 3 }}>
                  <span style={{ fontSize: ".75rem", color: "#52736b" }}>{label}</span>
                  <strong style={{ fontSize: "1.08rem", color: "#13483f" }}>{value}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              {result.value.lineItems.map(line => (
                <div key={line.description}
                  style={{ display: "flex", justifyContent: "space-between",
                    gap: 12, fontSize: ".83rem" }}>
                  <span>{line.description}</span>
                  <strong>{money(line.amountMinor)}</strong>
                </div>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: ".8rem", lineHeight: 1.5 }}>
              Deposit policy: {result.value.depositPercent}% · Quote validity:
              {" "}{result.value.validHours} hours · Crew buffer: {result.value.bufferMinutes} min.
              {" "}{result.value.approval === "BELOW_OWNER_THRESHOLD"
                ? "Amount is within the entered automatic-approval threshold; real quote and business authorization checks still apply."
                : "Amount exceeds the entered automatic-approval threshold and would require human review."}
            </p>
          </div>
        )}
      </div>
      <p style={{ margin: 0, fontSize: ".73rem", color: "#526e66", lineHeight: 1.45 }}>
        Worksheet only: does not verify an existing saved request, tax obligations,
        branch authorization, pricing activation or customer acceptance.
        Only the Save verified first-run pricing action below can request persistence.
      </p>
    </div>
  );
}
