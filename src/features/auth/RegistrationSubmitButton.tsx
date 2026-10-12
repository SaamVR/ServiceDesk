"use client";

import { useFormStatus } from "react-dom";
import styles from "./RegistrationSubmitButton.module.css";

/**
 * One guarded submit per authentication form. The server remains responsible
 * for validating identity and reporting success; pending is never success.
 */
export function RegistrationSubmitButton({
  label,
  pendingLabel,
  disabled = false,
  className,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const busy = pending && !disabled;
  return (
    <button
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={busy || undefined}
    >
      <span>{busy ? pendingLabel : label}</span>
      {!busy ? <span aria-hidden="true">→</span> : null}
      <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {busy ? pendingLabel : ""}
      </span>
    </button>
  );
}
