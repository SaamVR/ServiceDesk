import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {deliveryReviewAction,deliveryReviewReasonOptions,
  type DeliveryTriageReason} from "../../src/features/operations/inbox-delivery-diagnostics";

describe("R38 authorized source-grounded delivery review actions",()=>{
  it("maps each verified delivery failure reason to one concrete human evidence check",()=>{
    const reasons=deliveryReviewReasonOptions
      .filter((item):item is {value:DeliveryTriageReason;label:string}=>item.value!=="ALL");
    expect(reasons).toHaveLength(6);
    const unique=new Set<string>();
    for(const item of reasons){
      const guide=deliveryReviewAction(item.value);
      expect(guide.label.length).toBeGreaterThan(9);
      expect(guide.instructions.length).toBeGreaterThan(40);
      unique.add(guide.code);
    }
    expect(unique.size).toBe(6);
  });
  it("refuses to infer resend permissions from missing, stale or suppressed delivery",()=>{
    expect(deliveryReviewAction("SUPPRESSED_BY_POLICY").instructions).toContain("Do not resend");
    expect(deliveryReviewAction("STALE_PENDING").instructions).toContain("Pending does not prove delivery");
    expect(deliveryReviewAction(undefined).instructions).toContain("Do not infer delivery or resend");
  });
  it("renders next-step operator guidance in the read-only, scoped Inbox inspection",()=>{
    const ui=readFileSync(join(process.cwd(),
      "src/features/operations/InboxDeliveryDiagnostics.tsx"),"utf8");
    const css=readFileSync(join(process.cwd(),
      "src/features/operations/InboxDeliveryDiagnostics.module.css"),"utf8");
    expect(ui).toContain("deliveryReviewAction(item.reason).instructions");
    expect(ui).toContain('method: "GET"');
    expect(ui).not.toContain('method: "POST"');
    expect(css).toContain(".reviewInstructions");
    expect(css).toContain("@media(max-width:620px)");
  });
});