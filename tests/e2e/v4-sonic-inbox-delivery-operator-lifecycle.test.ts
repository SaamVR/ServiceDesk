import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseInboxDeliveryDiagnostics, selectDeliveryReviewItems, deliveryReviewReasonOptions,
  distinctDeliveryReviewConversations } from "../../src/features/operations/inbox-delivery-diagnostics";

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
    expect(source).toContain('setState("unavailable");');
    expect(source).toContain('if (controller.signal.aborted || requestController.current !== controller) return;');
    expect(source).toContain('whether fetch() ever settles or reaches finally()');
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
    expect(source).toContain('displayedReviewSource.slice(0, 8)');
    expect(source).toContain("Show the highest-priority issue per conversation");
    expect(source).toContain("All original delivery counts remain unchanged.");
    expect(css).toContain(".conversationToggle input:focus-visible");
    expect(source).toContain('Show all');
    expect(source).toContain("Filter authorized delivery problems");
    expect(source).toContain("No review record matches");
    expect(css).toContain(".filters select:focus-visible");
    expect(source).toContain('aria-expanded={expanded}');
    expect(source).toContain('dateTime={snapshot.generatedAt}');
    expect(source).toContain('This sample is not a live delivery feed.');
    expect(source).toContain('sample incomplete');
    expect(css).toContain('.stop:focus-visible, .more:focus-visible');
    expect(css).toContain('min-height: 44px');
  });
  it("filters sampled review issues by channel and exact reason, without changing source records",()=>{
    const items=[
      {messageId:"m1",conversationId:"c1",channel:"EMAIL" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"FAILED" as const,reason:"PROVIDER_FAILURE" as const,ageMinutes:20},
      {messageId:"m2",conversationId:"c2",channel:"WHATSAPP" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"QUEUED" as const,reason:"STALE_PENDING" as const,ageMinutes:100},
      {messageId:"m3",conversationId:"c3",channel:"EMAIL" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"FAILED" as const,reason:"PROVIDER_FAILURE" as const,ageMinutes:60},
      {messageId:"m4",conversationId:"c4",channel:"EMAIL" as const,
        health:"OK" as const,deliveryState:"DELIVERED" as const,ageMinutes:200},
    ];
    expect(selectDeliveryReviewItems(items,"ALL","ALL").map(x=>x.messageId)).toEqual(["m3","m1","m2"]);
    expect(selectDeliveryReviewItems(items,"EMAIL","PROVIDER_FAILURE").map(x=>x.messageId)).toEqual(["m3","m1"]);
    expect(selectDeliveryReviewItems(items,"WHATSAPP","STALE_PENDING").map(x=>x.messageId)).toEqual(["m2"]);
    expect(selectDeliveryReviewItems(items,"WHATSAPP","PROVIDER_FAILURE")).toEqual([]);
    expect(selectDeliveryReviewItems(items,"FOREIGN" as never,"ALL")).toEqual([]);
    expect(selectDeliveryReviewItems(items,"ALL","UNKNOWN" as never)).toEqual([]);
    expect(deliveryReviewReasonOptions.length).toBe(7);
    expect(items[0].messageId).toBe("m1");
  });
  it("collapses noisy conversations only in UI while keeping highest-risk saved issue",()=>{
    const input=[
      {messageId:"old",conversationId:"thread-a",channel:"EMAIL" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"QUEUED" as const,
        reason:"STALE_PENDING" as const,ageMinutes:180},
      {messageId:"failed",conversationId:"thread-a",channel:"EMAIL" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"FAILED" as const,
        reason:"PROVIDER_FAILURE" as const,ageMinutes:5},
      {messageId:"other",conversationId:"thread-b",channel:"WHATSAPP" as const,
        health:"NEEDS_REVIEW" as const,deliveryState:"SUPPRESSED" as const,
        reason:"SUPPRESSED_BY_POLICY" as const,ageMinutes:15},
      {messageId:"done",conversationId:"thread-c",channel:"EMAIL" as const,
        health:"OK" as const,deliveryState:"READ" as const,ageMinutes:3},
    ];
    const sorted=selectDeliveryReviewItems(input,"ALL","ALL");
    expect(sorted.map(x=>x.messageId)).toEqual(["failed","other","old"]);
    const collapsed=distinctDeliveryReviewConversations(sorted);
    expect(collapsed.map(x=>x.messageId)).toEqual(["failed","other"]);
    expect(sorted).toHaveLength(3);
    expect(input).toHaveLength(4);
    expect(distinctDeliveryReviewConversations(input).map(x=>x.messageId))
      .toEqual(["old","other"]);
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
