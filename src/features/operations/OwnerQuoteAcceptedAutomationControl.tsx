import { redirect } from "next/navigation";
import Link from "next/link";
import type { OperationalStaffSnapshot } from "./operational-product-runtime";
import { summarizeAutomationActivation } from "./owner-automation-activation";
import { buildStaffModuleHref } from "./staff-modules";
import { StaffSubmitButton } from "@/components/product/StaffSubmitButton";
import { OwnerQuoteRecoveryQueue } from "./OwnerQuoteRecoveryQueue";
import {
  readOwnerQuoteAutomationSetting,
  setOwnerQuoteAutomationSetting,
} from "@/server/workflows/owner-quote-automation-setting";

/**
 * Owner-only server component; actual data is read only after a verified
 * current-session OWNER membership. Never passes actor IDs or tenant IDs
 * as browser inputs. Dispatcher/customer views cannot render the toggle.
 */
export async function OwnerQuoteAcceptedAutomationControl({
  workspaceSlug, snapshot,
}: { workspaceSlug: string; snapshot: OperationalStaffSnapshot }) {
  const activation = summarizeAutomationActivation(snapshot);
  // A real accepted customer quote and its internal action are *outcomes*
  // after arming an eligible published rule. Requiring either before first
  // opt-in would deadlock activation for a new cleaning business.
  // Only catalog, authorized USD branch pricing and published rule are gates.
  const missingSetup = activation.steps
    .filter(step => step.id !== "execution-proof" &&
      step.id !== "accepted-quote" && step.status !== "READY");
  const flag = await readOwnerQuoteAutomationSetting(workspaceSlug);
  if (!flag.ok) {
    return (
      <section aria-label="Owner automatic quote follow-up" className="app-panel">
        <p role="status">Automatic accepted-quote settings cannot be verified in this protected backend.
          No automatic follow-up is claimed. Owners can still review saved events manually.</p>
      </section>
    );
  }
  const { enabled, version, deploymentEnabled, journalReady } = flag.value;

  async function change(formData: FormData) {
    "use server";
    const raw = String(formData.get("nextEnabled") ?? "");
    const expectedRaw = String(formData.get("expectedVersion") ?? "");
    const expectedVersion = /^\d{1,15}$/.test(expectedRaw) ? Number(expectedRaw) : NaN;
    // Never accept arbitrary boolean aliases or client-supplied workspace IDs.
    if (raw !== "true" && raw !== "false") {
      redirect("/app/" + encodeURIComponent(workspaceSlug) + "/automations?autoQuote=invalid");
    }
    const result = await setOwnerQuoteAutomationSetting(workspaceSlug, raw === "true", expectedVersion);
    const kind = result.ok ? "notice" : "error";
    const message = result.ok
      ? "Workspace automation choice saved. Verify real event receipts before claiming an automatic follow-up ran."
      : result.message;
    redirect("/app/" + encodeURIComponent(workspaceSlug) + "/automations?" +
      kind + "=" + encodeURIComponent(message));
  }

  return (
    <section aria-label="Owner automatic quote follow-up" className="app-panel"
      style={{ background: "#ffffff", border: "1px solid #d8e9e4",
        borderRadius: 14, padding: 20, marginBlock: 15 }}>
      <div style={{ display: "grid", gap: 7 }}>
        <p style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".07em",
          textTransform: "uppercase", color: "#2b7467", margin: 0 }}>
          Protected owner settings
        </p>
        <h3 style={{ margin: 0, color: "#184e46" }}>Automatic follow-up after quote acceptance</h3>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Workspace choice: <strong>{enabled ? "Opted in" : "Off"}</strong>.
          Deployment switch: <strong>{deploymentEnabled ? "Enabled" : "Disabled"}</strong>.
          Journal 0063: <strong>{journalReady ? "Available" : "Unavailable"}</strong>.
          {" "}A trigger runs only when both switches are enabled and a real customer accepts
          a saved quote with an eligible owner-published rule.
        </p>
        <p style={{ margin: 0, fontSize: ".8rem", color: "#557369", lineHeight: 1.6 }}>
          A published rule is not execution proof. Saved internal attention is permitted;
          external messages always need separate approval. No automatic payment, scheduling
          or model inference occurs here. Internal follow-up remains best-effort until the
          transactional outbox and replay worker are verified.
        </p>
      </div>
      {!enabled && !journalReady ? (
        <p role="status" style={{ marginTop: 14, lineHeight: 1.6, color: "#8c5d28" }}>
          Accepted-quote recovery journal is unavailable. Automatic follow-up
          cannot be enabled until migration 0063 is installed and verified.
          Manual quote review remains available, and existing automation can
          always be disabled.
        </p>
      ) : null}
      {!enabled && missingSetup.length > 0 ? (
        <div role="status" aria-label="Before enabling automatic follow-up"
          style={{ marginTop: 14, border: "1px solid #e6d5ba",
            borderRadius: 12, background: "#fffaf2", padding: 14 }}>
          <strong>Complete these saved workspace requirements before opting in</strong>
          <ul style={{ paddingLeft: 20, marginBlock: 10, display: "grid", gap: 9 }}>
            {missingSetup.map(step => (
              <li key={step.id}>
                <strong>{step.title}</strong>
                {" — "}{step.detail}{" "}
                <Link href={buildStaffModuleHref(workspaceSlug, step.module)}>
                  {step.module === "settings" ? "Open Settings" : "Open Automation Studio"} →
                </Link>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: ".8rem" }}>
            The activation control stays locked until authorized catalog, USD branch pricing,
            and a matching published internal rule are all verifiable. A deployment switch
            or model key is not sufficient.
          </p>
        </div>
      ) : null}
      <form action={change} style={{ display: "flex", gap: 10, flexWrap: "wrap",
        alignItems: "center", marginTop: 14 }}>
        <input type="hidden" name="expectedVersion" value={String(version)} />
        <input type="hidden" name="nextEnabled" value={enabled ? "false" : "true"} />
        {enabled || (journalReady && missingSetup.length === 0) ? (
          <StaffSubmitButton className="app-button-secondary" pendingLabel="Saving workspace choice…">
            {enabled ? "Disable automatic internal follow-up" : "Opt in to automatic internal follow-up"}
          </StaffSubmitButton>
        ) : (
          <span role="note" style={{ color: "#8c5d28", fontWeight: 700, fontSize: ".85rem" }}>
            {journalReady ? "Opt-in unavailable until prerequisites are complete" :
              "Opt-in unavailable until journal 0063 is installed"}
          </span>
        )}
        <span style={{ fontSize: ".78rem", color: "#59756c" }}>
          Owner-only · saved version {version}
        </span>
      </form>
      <OwnerQuoteRecoveryQueue workspaceSlug={workspaceSlug} />
    </section>
  );
}
