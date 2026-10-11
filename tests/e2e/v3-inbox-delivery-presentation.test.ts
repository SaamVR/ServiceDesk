import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { presentOutboundDelivery } from "@/features/operations/inbox-delivery-presentation";

describe("V3 persisted outbound delivery labels", () => {
  it("never describes queued or provider accepted evidence as customer delivery", () => {
    expect(presentOutboundDelivery("QUEUED")).toEqual({label:"Queued · not delivered",tone:"info"});
    expect(presentOutboundDelivery("RUNNING")).toEqual({label:"Sending · not yet delivered",tone:"info"});
    expect(presentOutboundDelivery("PROVIDER_ACCEPTED")).toEqual({
      label:"Provider accepted · delivery unconfirmed",tone:"info",
    });
  });
  it("distinguishes delivered/read, failed and suppressed states without guessing", () => {
    expect(presentOutboundDelivery("DELIVERED")).toEqual({label:"Delivered",tone:"success"});
    expect(presentOutboundDelivery("READ")).toEqual({label:"Read",tone:"success"});
    expect(presentOutboundDelivery("FAILED")).toEqual({label:"Delivery failed",tone:"danger"});
    expect(presentOutboundDelivery("SUPPRESSED")).toEqual({label:"Suppressed · not sent",tone:"warning"});
    expect(presentOutboundDelivery("UNKNOWN_FROM_PROVIDER")).toEqual({
      label:"Delivery unconfirmed",tone:"neutral",
    });
  });
  it("uses status evidence on outbound bubbles only and preserves readable wrapping", () => {
    const route = readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.tsx"),"utf8");
    const css = readFileSync(join(process.cwd(),"src/features/operations/OperationalProductRoute.module.css"),"utf8");
    expect(route).toContain("const delivery = outbound && message.deliveryState");
    expect(route).toContain("presentOutboundDelivery(message.deliveryState)");
    expect(route).toContain("<StatusBadge tone={delivery.tone}>{delivery.label}</StatusBadge>");
    expect(route).not.toContain('message.deliveryState.replaceAll("_", " ").toLowerCase()');
    expect(css).toContain(".deliveryState :global(.app-status)");
    expect(css).toContain("white-space: normal");
  });
});
