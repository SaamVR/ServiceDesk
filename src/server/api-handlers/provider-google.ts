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
