export type ActorRole = "OWNER" | "DISPATCHER" | "CREW" | "CUSTOMER" | "VISITOR" | "PLATFORM_OPERATOR";

export interface ActorContext {
  userId?: string;
  visitorSessionId?: string;
  workspaceId: string;
  role: ActorRole;
}

export interface CommandMeta {
  idempotencyKey: string;
  expectedVersion?: number;
  now: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

export type ISODateTime = string;
export type CurrencyCode = string;
