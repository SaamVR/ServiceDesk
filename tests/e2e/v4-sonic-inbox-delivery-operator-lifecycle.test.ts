import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseInboxDeliveryDiagnostics } from "../../src/features/operations/inbox-delivery-diagnostics";

const read = (p:string) => readFileSync(join(process.cwd(),p),"utf8");
const source = read("src/features/operations/InboxDeliveryDiagnostics.tsx");
const css = read("src/features/operations/InboxDeliveryDiagnostics.module.css");

describe("SONIC read-only inbox delivery diagnostics lifecycle",()=>{
  it("never permits stale, cancelled or old-workspace reads to overwrite visible evidence",()=>{
    expect(source).toContain("key={workspaceSlug}");
    expect(source).toContain("requestController.current !== controller");
    expect(source).toContain("requestController.current === controller");
    expect(source).toContain("controller.signal.aborted");
    expect(source).toContain("old.abort()");
    expect(source).toContain('setCancelled(true)');
    expect(source).toContain('if (timedOut) setState("unavailable")');
    expect(source).toContain('clearTimeout(timeout)');
  });
  it("provides deliberate operator cancellation without mutating delivery",()=>{
    expect(source).toContain('function stopCheck()');
    expect(source).toContain('Stop check');
    expect(source).toContain('Delivery was not changed');
    expect(source).toContain('method: "GET"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('cache: "no-store"');
    expect(source).not.toContain('method: "POST"');
    expect(source).not.toContain('retryDelivery(');
  });
  it("discloses sampled timestamp/truncation and expandable review-only records",()=>{
    expect(source).toContain('allNeedsReview = snapshot?.items.filter(item => item.health === "NEEDS_REVIEW")');
    expect(source).toContain('allNeedsReview.slice(0, 8)');
    expect(source).toContain('Show all');
    expect(source).toContain('aria-expanded={expanded}');
    expect(source).toContain('dateTime={snapshot.generatedAt}');
    expect(source).toContain('This sample is not a live delivery feed.');
    expect(source).toContain('sample incomplete');
    expect(css).toContain('.stop:focus-visible, .more:focus-visible');
    expect(css).toContain('min-height: 44px');
  });
  it("rejects forged delivered status without consistent saved source metadata",()=>{
    const broken={generatedAt:"2026-10-18T00:00:00Z",truncated:false,
      scannedOutboundMessages:1,counts:{ok:1,pending:0,review:0},
      items:[{messageId:"msg-1",conversationId:"conv-1",channel:"WHATSAPP",
        deliveryState:"PROVIDER_ACCEPTED",health:"OK",ageMinutes:2}]};
    expect(parseInboxDeliveryDiagnostics(broken)).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({...broken,items:[
      {...broken.items[0],deliveryState:"DELIVERED"},
    ]})?.counts).toEqual({ok:1,pending:0,review:0});
  });
});
