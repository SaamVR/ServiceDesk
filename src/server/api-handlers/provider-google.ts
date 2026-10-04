import type { Result } from "../../contracts";

export interface GoogleCalendarOAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export interface GoogleCalendarTokenReferences {
  accessTokenRef: string;
  refreshTokenRef?: string;
  expiresAt: string;
  scopes: string[];
}

export interface PersistGoogleCalendarConnectionInput extends GoogleCalendarTokenReferences {
  workspaceId: string;
  crewId: string;
}

export interface GoogleCalendarOAuthCallbackInput {
  query: GoogleCalendarOAuthCallbackQuery;
  expectedState: string;
  workspaceId: string;
  crewId: string;
  exchange: (code: string) => Promise<Result<GoogleCalendarTokenReferences>>;
  persistConnection: (input: PersistGoogleCalendarConnectionInput) => Promise<"SAVED" | "DUPLICATE">;
}

export interface GoogleCalendarOAuthHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export interface GoogleCalendarWatchChannel {
  channelId: string;
  channelToken: string;
  resourceId: string;
  workspaceId: string;
  crewId: string;
  calendarId: string;
}

export interface PersistGoogleCalendarNotificationInput {
  channelId: string;
  resourceId: string;
  resourceState: string;
  messageNumber: string;
  workspaceId: string;
  crewId: string;
  calendarId: string;
}

export interface RequestGoogleCalendarSyncInput {
  workspaceId: string;
  crewId: string;
  calendarId: string;
  channelId: string;
  messageNumber: string;
}

export interface GoogleCalendarPushNotificationInput {
  headers: Record<string, string | undefined>;
  channelsById: Record<string, GoogleCalendarWatchChannel>;
  persistNotification: (input: PersistGoogleCalendarNotificationInput) => Promise<"INSERTED" | "DUPLICATE">;
  requestSync: (input: RequestGoogleCalendarSyncInput) => Promise<void>;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

export async function handleGoogleCalendarOAuthCallback(
  input: GoogleCalendarOAuthCallbackInput,
): Promise<GoogleCalendarOAuthHandlerResult> {
  if (!input.query.state || input.query.state !== input.expectedState) {
    return {
      statusCode: 403,
      body: "Google Calendar OAuth state did not match.",
      acknowledged: false,
      retryable: false,
    };
  }

  if (input.query.error) {
    return {
      statusCode: 400,
      body: "Google Calendar authorization was not completed.",
      acknowledged: false,
      retryable: false,
    };
  }

  if (!input.query.code) {
    return {
      statusCode: 400,
      body: "Google Calendar authorization code is missing.",
      acknowledged: false,
      retryable: false,
    };
  }

  const exchanged = await input.exchange(input.query.code);
  if (!exchanged.ok) {
    if (exchanged.code === "invalid_grant") {
      return {
        statusCode: 409,
        body: "Google Calendar authorization expired or was revoked; reconnect is required.",
        acknowledged: false,
        retryable: false,
      };
    }

    return {
      statusCode: 502,
      body: "Google Calendar token exchange failed.",
      acknowledged: false,
      retryable: true,
    };
  }

  try {
    await input.persistConnection({
      workspaceId: input.workspaceId,
      crewId: input.crewId,
      accessTokenRef: exchanged.value.accessTokenRef,
      refreshTokenRef: exchanged.value.refreshTokenRef,
      expiresAt: exchanged.value.expiresAt,
      scopes: [...exchanged.value.scopes],
    });
  } catch {
    return {
      statusCode: 503,
      body: "Google Calendar connection persistence failed.",
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: "Google Calendar connection saved.",
    acknowledged: true,
    retryable: false,
  };
}

export async function handleGoogleCalendarPushNotification(
  input: GoogleCalendarPushNotificationInput,
): Promise<GoogleCalendarOAuthHandlerResult> {
  const channelId = header(input.headers, "x-goog-channel-id");
  const resourceId = header(input.headers, "x-goog-resource-id");
  const resourceState = header(input.headers, "x-goog-resource-state");
  const messageNumber = header(input.headers, "x-goog-message-number");
  const channelToken = header(input.headers, "x-goog-channel-token");

  if (!channelId || !resourceId || !resourceState || !messageNumber || !channelToken) {
    return {
      statusCode: 400,
      body: "Google Calendar push notification headers are incomplete.",
      acknowledged: false,
      retryable: false,
    };
  }

  const channel = input.channelsById[channelId];
  if (!channel || channel.resourceId !== resourceId || channel.channelToken !== channelToken) {
    return {
      statusCode: 403,
      body: "Google Calendar push notification channel verification failed.",
      acknowledged: false,
      retryable: false,
    };
  }

  let persisted: "INSERTED" | "DUPLICATE";
  try {
    persisted = await input.persistNotification({
      channelId,
      resourceId,
      resourceState,
      messageNumber,
      workspaceId: channel.workspaceId,
      crewId: channel.crewId,
      calendarId: channel.calendarId,
    });
  } catch {
    return {
      statusCode: 503,
      body: "Google Calendar notification persistence failed.",
      acknowledged: false,
      retryable: true,
    };
  }

  if (persisted === "DUPLICATE") {
    return {
      statusCode: 200,
      body: "Google Calendar notification already processed.",
      acknowledged: true,
      retryable: false,
    };
  }

  if (resourceState === "exists") {
    try {
      await input.requestSync({
        workspaceId: channel.workspaceId,
        crewId: channel.crewId,
        calendarId: channel.calendarId,
        channelId,
        messageNumber,
      });
    } catch {
      return {
        statusCode: 503,
        body: "Google Calendar sync scheduling failed.",
        acknowledged: false,
        retryable: true,
      };
    }
  }

  return {
    statusCode: 200,
    body: resourceState === "sync" ? "Google Calendar watch channel confirmed." : "Google Calendar sync scheduled.",
    acknowledged: true,
    retryable: false,
  };
}
