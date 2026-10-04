export type ProductActionStatus =
  | "idle"
  | "submitting"
  | "success"
  | "version_conflict"
  | "auth_required"
  | "workspace_denied"
  | "slot_unavailable"
  | "hold_failed"
  | "validation_error"
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

export function mapProductActionError(error: ProductActionError): ProductActionState {
  switch (error.code) {
    case "VERSION_CONFLICT":
    case "STALE_VERSION":
      return { status: "version_conflict", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "AUTH_REQUIRED":
    case "UNAUTHORIZED":
      return { status: "auth_required", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "WORKSPACE_DENIED":
    case "WORKSPACE_MISMATCH":
    case "FORBIDDEN":
      return { status: "workspace_denied", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "SLOT_UNAVAILABLE":
    case "SLOT_STALE":
      return { status: "slot_unavailable", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "HOLD_FAILED":
    case "HOLD_EXPIRED":
      return { status: "hold_failed", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "VALIDATION_ERROR":
    case "INVALID_INPUT":
      return { status: "validation_error", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    case "NOT_FOUND":
      return { status: "not_found", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
    default:
      return { status: "server_error", message: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
}

export function successProductActionState(message = "Server command completed."): ProductActionState {
  return { status: "success", message };
}
