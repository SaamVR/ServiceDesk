import { describe, expect, it } from "vitest";
import { buildCommunicationPreferenceView } from "../../src/features/preferences/view-models";
import { sampleConversation, sampleIntegrations } from "../../src/features/operations/sample-data";

describe("communication preference view model", () => {
  it("marks the current channel and blocks unavailable provider channels", () => {
    const view = buildCommunicationPreferenceView({
      conversation: sampleConversation,
      integrations: sampleIntegrations,
    });

    expect(view.currentChannel).toBe("WHATSAPP");
    expect(view.options.find((option) => option.channel === "WHATSAPP")?.available).toBe(false);
    expect(view.options.find((option) => option.channel === "WHATSAPP")?.reason).toContain("not configured");
    expect(view.options.find((option) => option.channel === "EMAIL")?.available).toBe(false);
  });

  it("keeps preferences as fixture UI until a frozen DTO exists", () => {
    const view = buildCommunicationPreferenceView({
      conversation: sampleConversation,
      integrations: sampleIntegrations,
    });

    expect(view.source).toBe("FIXTURE_UI_ONLY");
    expect(view.boundaryNotice).toContain("Communication preferences need a shared DTO");
    expect(view.quietHoursLabel).toBe("Quiet hours: 20:00–08:00 fixture");
  });
});
