"use server";

import { resolveStaffActor, requireOperationalBranchResource } from "./operational-product-runtime";
import { readVerifiedCustomerQuoteLineItems } from "./customer-quote-line-items";
import type { ManualQuoteHandoffFacts } from "./quote-manual-handoff";

type LiveHandoffResult =
  | { ok: true; facts: ManualQuoteHandoffFacts }
  | { ok: false; message: string };

const uuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Re-read the current quote only after a human presses Copy.
 * The authenticated server, not an old browser snapshot, decides which
 * persisted owner-approved prices may be put on the clipboard.
 */
export async function getCurrentVerifiedManualQuoteHandoff(
  workspaceSlug: string, quoteId: string,
): Promise<LiveHandoffResult> {
  const unavailable = (): LiveHandoffResult => ({
    ok: false, message: "Quote sharing needs review. Reload the saved quote and verify the current charges before copying.",
  });
  if (typeof workspaceSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceSlug) ||
      workspaceSlug.length > 40 || !uuid(quoteId)) return unavailable();
  try {
    const resolved = await resolveStaffActor(workspaceSlug);
    if (!resolved.ok || resolved.value.workspace.slug !== workspaceSlug ||
        resolved.value.actor.workspaceId !== resolved.value.workspace.id ||
        !["OWNER", "DISPATCHER"].includes(resolved.value.actor.role)) return unavailable();

    const denied = await requireOperationalBranchResource(resolved.value, "quote", quoteId);
    if (denied) return unavailable();
    const { workspace, service } = resolved.value;
    const response = await service.from("quotes")
      .select("id,workspace_id,status,currency,valid_until,subtotal_minor,tax_minor,total_minor,deposit_minor,balance_minor,duration_minutes,snapshot")
      .eq("workspace_id", workspace.id).eq("id", quoteId).maybeSingle();
    const row = response.data;
    if (response.error || !row || row.id !== quoteId || row.workspace_id !== workspace.id ||
        row.status !== "SENT" || !/^[A-Z]{3}$/.test(String(row.currency)) ||
        typeof row.valid_until !== "string" ||
        !Number.isFinite(Date.parse(row.valid_until)) ||
        Date.parse(row.valid_until) <= Date.now()) return unavailable();

    const money = [row.subtotal_minor,row.tax_minor,row.total_minor,
      row.deposit_minor,row.balance_minor,row.duration_minutes];
    if (money.some(n => typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) ||
        row.subtotal_minor + row.tax_minor !== row.total_minor ||
        row.deposit_minor + row.balance_minor !== row.total_minor) return unavailable();
    const items = readVerifiedCustomerQuoteLineItems(row.snapshot,
      row.subtotal_minor,row.duration_minutes,row.tax_minor,row.total_minor);
    if (!items) return unavailable();
    return { ok: true, facts: {
      quoteId, status:"SENT", currency:row.currency, validUntil:row.valid_until,
      subtotalMinor:row.subtotal_minor, taxMinor:row.tax_minor,
      totalMinor:row.total_minor, depositMinor:row.deposit_minor,
      balanceMinor:row.balance_minor, durationMinutes:row.duration_minutes,
      lineItems:items,
    } };
  } catch { return unavailable(); }
}
