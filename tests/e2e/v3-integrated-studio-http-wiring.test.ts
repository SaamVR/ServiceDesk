import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHandlers = vi.hoisted(() => ({
  ai: vi.fn(async (_request: Request) => new Response("ai draft", { status: 202 })),
  reply: vi.fn(async (_request: Request) => new Response("reviewed reply", { status: 202 })),
  delivery: vi.fn(async (_request: Request) => new Response("delivery status", { status: 200 })),
  whatsappChallenge: vi.fn((_request: Request) => new Response("challenge verified", { status: 200 })),
  whatsappInbound: vi.fn(async (_request: Request) => new Response("signature handled", { status: 202 })),
}));

// Keep this integration check side-effect-free. Security policy belongs to the
// real coordinator handlers and their existing signed/auth/branch-specific tests.
vi.mock("@/server/api-handlers/ai-staff-http", () => ({
  handleStaffAiHttpPost: mockHandlers.ai,
}));
vi.mock("@/server/api-handlers/reviewed-inbox-reply-http", () => ({
  handleReviewedInboxReplyHttpPost: mockHandlers.reply,
}));
vi.mock("@/server/api-handlers/delivery-triage-http", () => ({
  handleDeliveryTriageHttpGet: mockHandlers.delivery,
}));
vi.mock("@/server/api-handlers/provider-whatsapp-http", () => ({
  handleWhatsAppHttpChallenge: mockHandlers.whatsappChallenge,
  handleWhatsAppHttpPost: mockHandlers.whatsappInbound,
}));

import {
  POST as requestStaffDraft,
  dynamic as aiDynamic,
  runtime as aiRuntime,
} from "@/app/api/internal/ai/draft/route";
import {
  POST as approveReviewedReply,
  dynamic as replyDynamic,
  runtime as replyRuntime,
} from "@/app/api/internal/inbox/reply/route";
import {
  GET as readDeliveryTriage,
  dynamic as deliveryDynamic,
  runtime as deliveryRuntime,
} from "@/app/api/internal/inbox/delivery/route";
import {
  GET as verifyWhatsAppChallenge,
  POST as receiveWhatsAppInbound,
  dynamic as whatsappDynamic,
  runtime as whatsappRuntime,
} from "@/app/api/providers/whatsapp/route";

describe("ServiceDesk integrated coordinator-to-frontend HTTP boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps every newly connected endpoint dynamic and server-only", () => {
    expect([aiDynamic, replyDynamic, deliveryDynamic, whatsappDynamic])
      .toEqual(["force-dynamic", "force-dynamic", "force-dynamic", "force-dynamic"]);
    expect([aiRuntime, replyRuntime, deliveryRuntime, whatsappRuntime])
      .toEqual(["nodejs", "nodejs", "nodejs", "nodejs"]);
  });

  it("delegates authenticated AI drafting rather than invoking the model directly", async () => {
    const request = new Request("https://staging.example.test/api/internal/ai/draft", { method: "POST" });
    const response = await requestStaffDraft(request);
    expect(response.status).toBe(202);
    expect(mockHandlers.ai).toHaveBeenCalledExactlyOnceWith(request);
  });

  it("delegates explicit human reply approval and never auto-submits it", async () => {
    const request = new Request("https://staging.example.test/api/internal/inbox/reply", { method: "POST" });
    expect(mockHandlers.reply).not.toHaveBeenCalled();
    const response = await approveReviewedReply(request);
    expect(response.status).toBe(202);
    expect(mockHandlers.reply).toHaveBeenCalledExactlyOnceWith(request);
  });

  it("delegates read-only delivery triage without provider mutations", async () => {
    const request = new Request("https://staging.example.test/api/internal/inbox/delivery?workspaceSlug=office", { method: "GET" });
    const response = await readDeliveryTriage(request);
    expect(response.status).toBe(200);
    expect(mockHandlers.delivery).toHaveBeenCalledExactlyOnceWith(request);
  });

  it("keeps Meta challenge and inbound POST distinct behind signed server handlers", async () => {
    const challenge = new Request("https://staging.example.test/api/providers/whatsapp?hub.mode=subscribe");
    const inbound = new Request("https://staging.example.test/api/providers/whatsapp", { method: "POST" });
    expect((await verifyWhatsAppChallenge(challenge)).status).toBe(200);
    expect((await receiveWhatsAppInbound(inbound)).status).toBe(202);
    expect(mockHandlers.whatsappChallenge).toHaveBeenCalledExactlyOnceWith(challenge);
    expect(mockHandlers.whatsappInbound).toHaveBeenCalledExactlyOnceWith(inbound);
  });
});
