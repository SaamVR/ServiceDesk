import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe,expect,it} from "vitest";
import {
  summarizeDeliveryReviewReasons,selectDeliveryReviewItems,
  type DeliveryDiagnostic,
} from "../../src/features/operations/inbox-delivery-diagnostics";

const rows:DeliveryDiagnostic[]=[
 {messageId:"fail-1",conversationId:"conv-1",channel:"EMAIL",
  deliveryState:"FAILED",health:"NEEDS_REVIEW",reason:"PROVIDER_FAILURE",ageMinutes:31},
 {messageId:"fail-2",conversationId:"conv-2",channel:"WHATSAPP",
  deliveryState:"FAILED",health:"NEEDS_REVIEW",reason:"PROVIDER_FAILURE",ageMinutes:20},
 {messageId:"policy-1",conversationId:"conv-3",channel:"WHATSAPP",
  deliveryState:"SUPPRESSED",health:"NEEDS_REVIEW",reason:"SUPPRESSED_BY_POLICY",ageMinutes:120},
 {messageId:"stale-1",conversationId:"conv-4",channel:"EMAIL",
  deliveryState:"QUEUED",health:"NEEDS_REVIEW",reason:"STALE_PENDING",ageMinutes:50},
 {messageId:"ok-1",conversationId:"conv-5",channel:"EMAIL",
  deliveryState:"DELIVERED",health:"OK",ageMinutes:10},
];
const read=(p:string)=>readFileSync(join(process.cwd(),p),"utf8");
describe("R37 read-only delivery triage breakdown",()=>{
  it("uses authorized sample counts only and never treats delivered records as incidents",()=>{
    const all=summarizeDeliveryReviewReasons(rows,"ALL");
    expect(all.map(x=>[x.value,x.count])).toEqual([
      ["PROVIDER_FAILURE",2],["SUPPRESSED_BY_POLICY",1],["STALE_PENDING",1],
    ]);
    expect(all.reduce((count,x)=>count+x.count,0)).toBe(4);
    expect(summarizeDeliveryReviewReasons(rows,"EMAIL").map(x=>[x.value,x.count]))
      .toEqual([["PROVIDER_FAILURE",1],["STALE_PENDING",1]]);
    expect(summarizeDeliveryReviewReasons(rows,"WHATSAPP").map(x=>[x.value,x.count]))
      .toEqual([["PROVIDER_FAILURE",1],["SUPPRESSED_BY_POLICY",1]]);
  });
  it("fails closed on invalid channel values without inventing a health metric",()=>{
    expect(summarizeDeliveryReviewReasons(rows,"OTHER" as never)).toEqual([]);
    expect(selectDeliveryReviewItems(rows,"OTHER" as never,"ALL")).toEqual([]);
  });
  it("offers accessible quick filters while retaining the canonical reason dropdown",()=>{
    const src=read("src/features/operations/InboxDeliveryDiagnostics.tsx");
    const css=read("src/features/operations/InboxDeliveryDiagnostics.module.css");
    expect(src).toContain("summarizeDeliveryReviewReasons(allNeedsReview,channelFilter)");
    expect(src).toContain("aria-pressed={reasonFilter===reason.value}");
    expect(src).toContain('current===reason.value?"ALL":reason.value');
    expect(src).toContain("setExpanded(false)");
    expect(src).toContain("Saved delivery failure categories in the selected channel");
    expect(src).toContain("Filters only");
    expect(css).toContain(".reasonSummary button:focus-visible");
    expect(css).toContain("@media(max-width:390px)");
    expect(src).not.toContain("retryDelivery(");
  });
});