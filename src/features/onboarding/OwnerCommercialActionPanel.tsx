import Link from "next/link";
import type { CommercialSetupEvidence } from "./onboarding-commercial-readiness";
import { buildStaffModuleHref } from "@/features/operations/staff-modules";

/** Read-only links for owner-authorized setup evidence, never a quote approval. */
export function OwnerCommercialActionPanel({
  workspaceSlug,
  evidence,
  canEnterFirstRunRates,
}: {
  workspaceSlug: string;
  evidence: Pick<CommercialSetupEvidence, "state" | "missingPriceBookBranches"> & {
    repairPriceBookBranches?: number;
  };
  canEnterFirstRunRates: boolean;
}) {
  if (evidence.state === "VERIFIED") return null;
  const settings = buildStaffModuleHref(workspaceSlug, "settings");
  const repair = Number.isSafeInteger(evidence.repairPriceBookBranches) &&
    (evidence.repairPriceBookBranches ?? 0) > 0 ? evidence.repairPriceBookBranches! : 0;
  const missing = Number.isSafeInteger(evidence.missingPriceBookBranches) &&
    evidence.missingPriceBookBranches > 0 ? evidence.missingPriceBookBranches : 0;
  const canBegin = canEnterFirstRunRates && missing > 0 &&
    (evidence.state === "NEEDS_PRICE_BOOK" ||
     (evidence.state === "UNVERIFIED" && repair > 0));
  const rows: Array<{ text: string; action: string; href: string }> = [];

  if (repair > 0) rows.push({
    text: `${repair} saved USD branch price book${repair === 1 ? "" : "s"} need correction. Existing rates cannot be overwritten by first-run setup.`,
    action: "Review existing rates and effective dates", href: settings,
  });
  if (missing > 0) rows.push({
    text: `${missing} authorized USD branch${missing === 1 ? "" : "es"} lack an active saved book. Only actual owner-entered rates can establish their first-run pricing.`,
    action: canBegin ? "Enter actual first-run branch rates" : "Verify first-run eligibility",
    href: settings + (canBegin ? "#owner-first-run-pricing" : ""),
  });
  if (rows.length === 0) rows.push({
    text: evidence.state === "UNVERIFIED"
      ? "Saved service or pricing evidence is unavailable. Refresh the owner workspace before changing prices."
      : evidence.state === "UNSUPPORTED_CURRENCY"
        ? "No supported USD pricing branch is selected. Review your authorized branches and currencies."
        : "Complete the supported cleaning catalog and independently verified pricing in Settings.",
    action: "Review owner Settings", href: settings,
  });

  return (
    <div aria-label="Owner pricing next actions">
      {rows.map(row => (
        <div key={row.action}>
          <p>{row.text}</p>
          <Link href={row.href}>{row.action} →</Link>
        </div>
      ))}
      <p role="note">These links do not save rates, authorize quotes, contact customers or confirm launch readiness.</p>
    </div>
  );
}
