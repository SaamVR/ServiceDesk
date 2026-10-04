export type ProductActionStatus =
  | "idle"
  | "submitting"
  | "success"
  | "version_conflict"
  | "auth_required"
  | "workspace_denied"
  | "visitor_failure"
  | "slot_unavailable"
  | "hold_failed"
  | "validation_error"
  | "quote_not_found"
  | "not_found"
  | "server_error";

export interface ProductActionError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface ProductActionState {
  status: ProductActionStatus;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
}

export const idleProductActionState: ProductActionState = {
  status: "idle",
  message: "Ready for an accepted server command.",
};

function stateFromError(status: ProductActionStatus, error: ProductActionError): ProductActionState {
  return {
    status,
    message: error.message,
    code: error.code,
    fieldErrors: error.fieldErrors,
  };
}

export function mapProductActionError(error: ProductActionError): ProductActionState {
  switch (error.code) {
    case "VERSION_CONFLICT":
    case "STALE_VERSION":
      return stateFromError("version_conflict", error);
    case "AUTH_REQUIRED":
    case "AUTHORIZATION_FAILED":
    case "UNAUTHORIZED":
      return stateFromError("auth_required", error);
    case "WORKSPACE_DENIED":
    case "WORKSPACE_MISMATCH":
    case "FORBIDDEN":
      return stateFromError("workspace_denied", error);
    case "VISITOR_FAILED":
    case "VISITOR_NOT_FOUND":
    case "VISITOR_ACCESS_DENIED":
    case "VISITOR_SESSION_EXPIRED":
      return stateFromError("visitor_failure", error);
    case "QUOTE_NOT_FOUND":
      return stateFromError("quote_not_found", error);
    case "SLOT_UNAVAILABLE":
    case "SLOT_STALE":
    case "FIND_SLOTS_FAILED":
      return stateFromError("slot_unavailable", error);
    case "HOLD_FAILED":
    case "HOLD_EXPIRED":
    case "HOLD_SLOT_FAILED":
      return stateFromError("hold_failed", error);
    case "VALIDATION_ERROR":
    case "INVALID_INPUT":
      return stateFromError("validation_error", error);
    case "NOT_FOUND":
      return stateFromError("not_found", error);
    default:
      return stateFromError("server_error", error);
  }
}

export function successProductActionState(message = "Server command completed."): ProductActionState {
  return { status: "success", message };
}
