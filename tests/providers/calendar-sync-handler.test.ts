import { describe, expect, test } from "vitest";
import { handleGoogleCalendarPushNotification, type GoogleCalendarWatchChannel } from "../../src/server/api-handlers/provider-google";

const channel: GoogleCalendarWatchChannel = {
  channelId: "channel-1",
  channelToken: "token-ref-value",
  resourceId: "resource-1",
  workspaceId: "ws-clearnest",
  crewId: "crew-1",
  calendarId: "cal-1",
};

describe("Google Calendar push notification handler", () => {
  test("rejects unknown channel before scheduling sync", async () => {
    let scheduled = 0;
    const result = await handleGoogleCalendarPushNotification({
      headers: {
        "x-goog-channel-id": "unknown",
        "x-goog-resource-id": "resource-1",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "10",
        "x-goog-channel-token": "token-ref-value",
      },
      channelsById: { "channel-1": channel },
      persistNotification: async () => "INSERTED",
      requestSync: async () => {
        scheduled += 1;
      },
    });

    expect(result).toMatchObject({ statusCode: 403, acknowledged: false, retryable: false });
    expect(scheduled).toBe(0);
  });

  test("rejects resource or channel-token mismatch", async () => {
    for (const headers of [
      {
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-id": "wrong-resource",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "11",
        "x-goog-channel-token": "token-ref-value",
      },
      {
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-id": "resource-1",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "12",
        "x-goog-channel-token": "wrong-token",
      },
    ]) {
      const result = await handleGoogleCalendarPushNotification({
        headers,
        channelsById: { "channel-1": channel },
        persistNotification: async () => "INSERTED",
        requestSync: async () => undefined,
      });
      expect(result).toMatchObject({ statusCode: 403, acknowledged: false });
    }
  });

  test("persists notification and schedules incremental sync before acknowledgement", async () => {
    const calls: string[] = [];
    const result = await handleGoogleCalendarPushNotification({
      headers: {
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-id": "resource-1",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "13",
        "x-goog-channel-token": "token-ref-value",
      },
      channelsById: { "channel-1": channel },
      persistNotification: async (input) => {
        calls.push(`persist:${input.messageNumber}`);
        return "INSERTED";
      },
      requestSync: async (input) => {
        calls.push(`sync:${input.calendarId}`);
      },
    });

    expect(calls).toEqual(["persist:13", "sync:cal-1"]);
    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
  });

  test("acknowledges duplicate message number without scheduling duplicate sync", async () => {
    let syncs = 0;
    const result = await handleGoogleCalendarPushNotification({
      headers: {
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-id": "resource-1",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "13",
        "x-goog-channel-token": "token-ref-value",
      },
      channelsById: { "channel-1": channel },
      persistNotification: async () => "DUPLICATE",
      requestSync: async () => {
        syncs += 1;
      },
    });

    expect(syncs).toBe(0);
    expect(result).toMatchObject({ statusCode: 200, acknowledged: true, retryable: false });
  });

  test("returns retryable failure when sync scheduling fails", async () => {
    const result = await handleGoogleCalendarPushNotification({
      headers: {
        "x-goog-channel-id": "channel-1",
        "x-goog-resource-id": "resource-1",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "14",
        "x-goog-channel-token": "token-ref-value",
      },
      channelsById: { "channel-1": channel },
      persistNotification: async () => "INSERTED",
      requestSync: async () => {
        throw new Error("queue unavailable");
      },
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
