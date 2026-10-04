import { ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

async function main() {
  assert(source("src/features/invoices/server-boundary.ts").includes("applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta)"), "manual payment boundary must match exact Core signature");
  assert(source("src/features/invoices/server-boundary.ts").includes("commands.applyManualPayment(input.ctx, input.invoice.id, input.payment"), "manual payment delegates exactly once to injected command");
  assert(!source("src/features/invoices/server-boundary.ts").includes("balanceMinor ="), "manual payment must not optimistically mutate balance");
  assert(source("src/features/quality/server-boundary.ts").includes("applyQualityCaseAction(ctx: ActorContext, id: string, action: QualityCaseAction, input: QualityCaseActionInput, meta: CommandMeta)"), "quality boundary must match exact Core signature");
  assert(source("src/features/quality/server-boundary.ts").includes("expectedVersion: input.qualityCase.version"), "quality expectedVersion must propagate");
  assert(source("src/features/operations/workspace-snapshot-boundary.ts").includes("snapshot.qualityCases"), "expanded snapshot mapper must consume qualityCases");
  assert(source("src/features/operations/workspace-snapshot-boundary.ts").includes("snapshot.attentionItems"), "expanded snapshot mapper must consume attentionItems");
  assert(source("src/features/operations/workspace-snapshot-boundary.ts").includes("WORKSPACE_MISMATCH"), "snapshot mapper must reject cross-workspace data");
  for (const path of ["src/features/invoices/server-boundary.ts", "src/features/quality/server-boundary.ts", "src/features/operations/workspace-snapshot-boundary.ts"]) {
    const file = source(path);
    assert(!file.includes("Repository"), `${path} must not import Core repositories`);
    assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`);
    assert(!file.includes("stripe"), `${path} must not import provider clients`);
  }
  console.log("runtime-outage-e08-invoice-quality-recovery-product-boundary-harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
